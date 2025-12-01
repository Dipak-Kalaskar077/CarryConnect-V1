import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { MessageWithSender, Delivery, User } from "@shared/schema";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Send, ArrowLeft, Phone, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


const ChatPage = () => {
  const { id } = useParams<{ id: string }>();
  const deliveryId = parseInt(id || "0");
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Fetch delivery details
  const { data: delivery, isLoading: deliveryLoading } = useQuery<Delivery>({
    queryKey: [`/api/deliveries/${deliveryId}`],
    enabled: !isNaN(deliveryId),
  });

  // Fetch past messages (last 20)
  const { data: pastMessages, isLoading: messagesLoading } = useQuery<MessageWithSender[]>({
    queryKey: [`/api/deliveries/${deliveryId}/messages`],
    enabled: !isNaN(deliveryId) && !!user,
    queryFn: async ({ queryKey }) => {
      const res = await getQueryFn({ on401: "throw" })({ queryKey, signal: new AbortController().signal, meta: {} });
      // Return last 20 messages
      if (Array.isArray(res)) {
        setHasMoreMessages(res.length > 20);
        return res.slice(-20) as MessageWithSender[];
      }
      return (res as MessageWithSender[]) || [];
    },
  });
// Fetch sender and carrier profiles for phone numbers
const { data: senderProfile } = useQuery<Partial<User>>({
  queryKey: [`/api/users/${delivery?.senderId}/profile`],
  enabled: !!delivery?.senderId,
  queryFn: async () => {
    const res = await fetch(`/api/users/${delivery?.senderId}/profile`, {
      credentials: "include",
    });
    return res.ok ? res.json() : null;
  },
});

const { data: carrierProfile } = useQuery<Partial<User>>({
  queryKey: [`/api/users/${delivery?.carrierId}/profile`],
  enabled: !!delivery?.carrierId,
  queryFn: async () => {
    const res = await fetch(`/api/users/${delivery?.carrierId}/profile`, {
      credentials: "include",
    });
    return res.ok ? res.json() : null;
  },
});

  // Initialize socket connection
  useEffect(() => {
    if (!user || !deliveryId || isNaN(deliveryId)) return;

    // Verify user has access
    const isSender = user.id === delivery?.senderId;
    const isCarrier = user.id === delivery?.carrierId;
    
    if (!isSender && !isCarrier) {
      toast({
        title: "Unauthorized",
        description: "You don't have access to this chat",
        variant: "destructive",
      });
      navigate(`/deliveries/${deliveryId}`);
      return;
    }

    // Verify delivery is accepted or later
    if (delivery?.status === "requested") {
      toast({
        title: "Chat unavailable",
        description: "Chat is only available after delivery is accepted",
        variant: "destructive",
      });
      navigate(`/deliveries/${deliveryId}`);
      return;
    }

    const socketURL =
      import.meta.env.MODE === "development"
      ? "http://localhost:5000"
      : "wss://carryconnect-v1.onrender.com";

    const newSocket = io(socketURL, {
      withCredentials: true,
      transports: ["websocket"],
    });

    

    newSocket.on("connect", () => {
      console.log("Socket connected");
      setIsConnected(true);
      setIsJoining(true);
      
      // Join the chat room
      newSocket.emit("joinChat", { deliveryId });
    });

    newSocket.on("joinedChat", () => {
      setIsJoining(false);
      
      // Load past messages (last 20)
      if (pastMessages && Array.isArray(pastMessages)) {
        setMessages(pastMessages);
        // Auto-scroll to bottom after loading messages
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    });

    newSocket.on("receiveMessage", (message: MessageWithSender) => {
      setMessages((prev) => [...prev, message]);
      // Auto-scroll to bottom on new message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    newSocket.on("error", (error: { message: string }) => {
      toast({
        title: "Chat Error",
        description: error.message || "An error occurred in the chat",
        variant: "destructive",
      });
      setIsJoining(false);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user, deliveryId, delivery, navigate, toast]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && !isJoining) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isJoining]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Only images (JPG/PNG) are allowed",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((!newMessage.trim() && !selectedFile) || !socket || !isConnected) return;

    try {
      let attachmentPath: string | undefined;
      let attachmentType: string | undefined;

      // Upload file if selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("deliveryId", deliveryId.toString());

        const uploadRes = await fetch(`/api/deliveries/${deliveryId}/upload`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload file");
        }

        const uploadData = await uploadRes.json();
        attachmentPath = uploadData.path;
        attachmentType = selectedFile.type;
      }

      socket.emit("sendMessage", {
        deliveryId,
        message: newMessage.trim() || "",
        attachmentPath,
        attachmentType,
      });

      setNewMessage("");
      setSelectedFile(null);
      setFilePreview(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMoreMessages) return;
    
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/messages?before=${messages[0]?.id || 0}`, {
        credentials: "include",
      });
      const moreMessages: MessageWithSender[] = await res.json();
      
      if (moreMessages.length > 0) {
        setMessages((prev) => [...moreMessages, ...prev]);
        setHasMoreMessages(moreMessages.length >= 20);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  if (deliveryLoading || messagesLoading) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">Delivery not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSender = user?.id === delivery.senderId;
  const otherUser = isSender 
    ? (carrierProfile ? { ...carrierProfile, id: delivery.carrierId } : null)
    : (senderProfile ? { ...senderProfile, id: delivery.senderId } : null);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <Card className="h-[calc(100vh-8rem)] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/deliveries/${deliveryId}`)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <CardTitle className="text-lg">
                  Chat - Delivery #{deliveryId}
                </CardTitle>
                <div className="text-sm text-gray-500 mt-1">
                  <p className="font-medium text-gray-900">{otherUser?.fullName || "Loading..."}</p>
                  {otherUser?.phoneNumber && (
                    <p className="text-gray-600 mt-0.5">
                      +91 {otherUser.phoneNumber}
                    </p>
                  )}
                  <Button
                    onClick={() => window.location.href = `tel:${otherUser?.phoneNumber}`}
                    variant="outline"
                    size="icon"
                  >
                    <Phone className="w-4 h-4" />
                  </Button>


                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isConnected ? (
                <div className="flex items-center text-sm text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
                  Online
                </div>
              ) : (
                <div className="flex items-center text-sm text-gray-500">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                  Connecting...
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
          {/* Messages container */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
          >
            {isJoining && (
              <div className="text-center text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Joining chat...
              </div>
            )}
            
            {messages.length === 0 && !isJoining && (
              <div className="text-center text-gray-500 py-8">
                No messages yet. Start the conversation!
              </div>
            )}

            {messages.map((message) => {
              const isOwnMessage = message.senderId === user?.id;
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex items-start space-x-2 max-w-[70%] ${
                      isOwnMessage ? "flex-row-reverse space-x-reverse" : ""
                    }`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback>
                        {message.sender.fullName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        isOwnMessage
                          ? "bg-primary text-primary-foreground"
                          : "bg-white text-gray-900 border border-gray-200"
                      }`}
                    >
                      {!isOwnMessage && (
                        <p className="text-xs font-semibold mb-1 opacity-80">
                          {message.sender.fullName}
                        </p>
                      )}
                      {(message as any).attachmentPath && (
                        <div className="mb-2">
                          <img
                            src={(message as any).attachmentPath}
                            alt="Attachment"
                            className="max-w-xs rounded-lg cursor-pointer"
                            onClick={() => window.open((message as any).attachmentPath, "_blank")}
                          />
                        </div>
                      )}
                      {message.message && (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.message}
                        </p>
                      )}
                      <p
                        className={`text-xs mt-1 ${
                          isOwnMessage ? "opacity-70" : "text-gray-500"
                        }`}
                      >
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div className="border-t p-4 bg-white">
            {filePreview && (
              <div className="mb-2 relative inline-block">
                <img
                  src={filePreview}
                  alt="Preview"
                  className="h-20 w-20 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-red-500 hover:bg-red-600"
                  onClick={() => {
                    setSelectedFile(null);
                    setFilePreview(null);
                  }}
                >
                  <X className="w-4 h-4 text-white" />
                </Button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={!isConnected || isJoining}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!isConnected || isJoining}
                >
                  <ImageIcon className="w-4 h-4" />
                </Button>
              </label>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={!isConnected || isJoining}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <Button
                type="submit"
                disabled={(!newMessage.trim() && !selectedFile) || !isConnected || isJoining}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatPage;

