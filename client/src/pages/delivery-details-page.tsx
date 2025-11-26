import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Delivery, User } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import OtpModal from "@/components/deliveries/OtpModal";
import ConfirmModal from "@/components/deliveries/ConfirmModal";
import CancelDeliveryModal from "@/components/deliveries/CancelDeliveryModal";
import { Phone, X } from "lucide-react";
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Textarea 
} from "@/components/ui/textarea";
import DeliveryStatusBadge from "@/components/deliveries/DeliveryStatusBadge";
import { Separator } from "@/components/ui/separator";
import ReviewList from "@/components/reviews/ReviewList";
import { Loader2, Map, MessageCircle, CheckCircle } from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Type for DeliveryWithUsers
type DeliveryWithUsers = Delivery & {
  sender?: User;
  carrier?: User;
};

// Create review schema with multi-metric ratings
const reviewSchema = z.object({
  punctuality: z.number().min(1).max(5),
  communication: z.number().min(1).max(5),
  packageHandling: z.number().min(1).max(5),
  comment: z.string().min(3, "Comment must be at least 3 characters"),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

const DeliveryDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const deliveryId = parseInt(id);
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Fetch delivery details
  const { data: delivery, isLoading, error } = useQuery<DeliveryWithUsers>({
    queryKey: [`/api/deliveries/${deliveryId}`],
    enabled: !isNaN(deliveryId),
  });

  // Check roles
  const isSender = user?.id === delivery?.senderId;
  const isCarrier = user?.id === delivery?.carrierId;
  const isInvolved = isSender || isCarrier;

  // Debug OTP data
  useEffect(() => {
    if (delivery) {
      console.log('[Frontend] ========== DELIVERY DATA RECEIVED ==========');
      console.log('[Frontend] Delivery ID:', delivery.id);
      console.log('[Frontend] Status:', delivery.status);
      console.log('[Frontend] Pickup OTP:', delivery.pickupOtp);
      console.log('[Frontend] Delivery OTP:', delivery.deliveryOtp);
      console.log('[Frontend] Is Sender:', isSender);
      console.log('[Frontend] Should Show OTPs:', isSender && delivery.status !== "requested" && delivery.status !== "cancelled");
      console.log('[Frontend] Full delivery object:', JSON.stringify(delivery, null, 2));
    }
  }, [delivery, isSender]);

  // Review form
  const reviewForm = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      punctuality: 5,
      communication: 5,
      packageHandling: 5,
      comment: "",
    },
  });

  // OTP modal state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  
  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // GPS tracking state
  const [carrierLocation, setCarrierLocation] = useState<{ latitude: string; longitude: string; timestamp: string } | null>(null);

  // Determine who to review
  const revieweeId = isSender ? delivery?.carrierId : delivery?.senderId;

  // Update delivery status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, otp }: { status: string; otp?: string }) => {
      const payload: any = { status };
      if (otp) {
        payload.otp = otp;
      }
      const res = await apiRequest("PATCH", `/api/deliveries/${deliveryId}/status`, payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: "Delivery status has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/deliveries/${deliveryId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/deliveries/sender"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/deliveries/carrier"] });
      setShowOtpModal(false);
      setPendingStatus(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update delivery status",
        variant: "destructive",
      });
    },
  });

  // Create review mutation
  const createReviewMutation = useMutation({
    mutationFn: async (data: ReviewFormValues) => {
      if (!revieweeId) throw new Error("No recipient for review");
      
      const reviewData = {
        ...data,
        deliveryId,
        revieweeId,
      };
      
      const res = await apiRequest("POST", "/api/reviews", reviewData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Review submitted",
        description: "Your review has been submitted successfully",
      });
      reviewForm.reset();
      // Refresh reviews
      queryClient.invalidateQueries({ queryKey: [`/api/users/${revieweeId}/reviews`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review",
        variant: "destructive",
      });
    },
  });

  // Cancel delivery mutation
  const cancelDeliveryMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("POST", `/api/deliveries/${deliveryId}/cancel`, { cancellationReason: reason });
      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = "Failed to cancel delivery";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Delivery cancelled",
        description: "The delivery has been cancelled successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/deliveries/${deliveryId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/deliveries/sender"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/deliveries/carrier"] });
      setShowCancelModal(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel delivery",
        variant: "destructive",
      });
    },
  });

  // Fetch carrier location for GPS tracking
  const { data: locationData } = useQuery({
    queryKey: [`/api/deliveries/${deliveryId}/location`],
    enabled: !isNaN(deliveryId) && isSender && delivery?.status !== "requested" && delivery?.status !== "cancelled",
    refetchInterval: 5000, // Poll every 5 seconds
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/deliveries/${deliveryId}/location`);
      return await res.json();
    },
  });

  // Handle form submission
  const onSubmitReview = (data: ReviewFormValues) => {
    createReviewMutation.mutate(data);
  };

  // Format currency from cents to dollars/rupees
  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100).toFixed(2)}`;
  };

  // Format package size
  const formatPackageSize = (size: string, weight: number) => {
    const weightInKg = weight / 1000;
    return `${size.charAt(0).toUpperCase() + size.slice(1)} package (${weightInKg} kg)`;
  };

  useEffect(() => {
    if (locationData) {
      setCarrierLocation(locationData);
    }
  }, [locationData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Error</h2>
          <p className="mt-2 text-gray-500">
            {error?.message || "Delivery not found"}
          </p>
          <Button 
            className="mt-4" 
            variant="outline" 
            onClick={() => navigate("/available-deliveries")}
          >
            Back to Deliveries
          </Button>
        </div>
      </div>
    );
  }

  // Get next status based on current status
  const getNextStatus = () => {
    switch (delivery.status) {
      case "accepted":
        return "picked";
      case "picked":
        return "in-transit";
      case "in-transit":
        return "delivered";
      default:
        return null;
    }
  };

  const nextStatus = getNextStatus();
  const nextStatusLabel = nextStatus 
  ? `Mark as ${nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1).replace("-", " ")}`
  : null;
  const handleStatusUpdate = (status: string) => {
    console.log("[Frontend] handleStatusUpdate:", { status });
  
    if (status === "picked" || status === "delivered") {
      setPendingStatus(status);     // store what we want to update to
      setShowOtpModal(true);        // only open modal
      return;
    }
  
    // For non-OTP statuses
    updateStatusMutation.mutate({ status });
  };  
  
  
  // Handle OTP submission
  const handleOtpSubmit = async (otp: string) => {
    try {
      if (!pendingStatus) throw new Error("No status is pending for OTP");
  
      if (!otp || otp.length !== 6) {
        throw new Error("Please enter a valid 6-digit OTP");
      }
  
      const otpType = pendingStatus === "picked" ? "pickup" : "delivery";
  
      console.log("[Frontend] Submitting OTP for:", pendingStatus, otp);
  
      // Validate OTP with backend
      const validateRes = await apiRequest(
        "POST",
        `/api/deliveries/${deliveryId}/validate-otp`,
        { otp, type: otpType }
      );
  
      const { valid } = await validateRes.json();
      if (!valid) {
        throw new Error("Invalid OTP");
      }
  
      // OTP VALID → Perform final status update
      await updateStatusMutation.mutateAsync({ status: pendingStatus, otp });
  
      // Reset UI only on success
      setShowOtpModal(false);
      setPendingStatus(null);
  
    } catch (err: any) {
      toast({
        title: "OTP Failed",
        description: err.message || "Failed to verify OTP",
        variant: "destructive",
      });
    }
  };
  

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="pb-5 border-b border-gray-200 mb-6 flex flex-col md:flex-row md:justify-between md:items-center">
        <div>
          <h2 className="text-2xl font-bold leading-tight text-gray-900">Delivery Details</h2>
          <p className="mt-1 text-sm text-gray-500">Tracking ID: #{delivery.id}</p>
        </div>
        <div className="mt-4 md:mt-0">
          <DeliveryStatusBadge status={delivery.status} />
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Package Information</h3>
              <dl className="mt-2 text-sm text-gray-500">
                <div className="mt-3">
                  <dt className="font-medium text-gray-500">From</dt>
                  <dd className="mt-1 text-gray-900">{delivery.pickupLocation}</dd>
                </div>
                <div className="mt-3">
                  <dt className="font-medium text-gray-500">To</dt>
                  <dd className="mt-1 text-gray-900">{delivery.dropLocation}</dd>
                </div>
                <div className="mt-3">
                  <dt className="font-medium text-gray-500">Package Size</dt>
                  <dd className="mt-1 text-gray-900">{formatPackageSize(delivery.packageSize, delivery.packageWeight)}</dd>
                </div>
                <div className="mt-3">
                  <dt className="font-medium text-gray-500">Delivery Date/Time</dt>
                  <dd className="mt-1 text-gray-900">{delivery.preferredDeliveryDate}, {delivery.preferredDeliveryTime}</dd>
                </div>
                <div className="mt-3">
                  <dt className="font-medium text-gray-500">Delivery Fee</dt>
                  <dd className="mt-1 text-gray-900">{formatCurrency(delivery.deliveryFee)}</dd>
                </div>
                {delivery.description && (
                  <div className="mt-3">
                    <dt className="font-medium text-gray-500">Description</dt>
                    <dd className="mt-1 text-gray-900">{delivery.description}</dd>
                  </div>
                )}
                {delivery.specialInstructions && (
                  <div className="mt-3">
                    <dt className="font-medium text-gray-500">Special Instructions</dt>
                    <dd className="mt-1 text-gray-900">{delivery.specialInstructions}</dd>
                  </div>
                )}
              </dl>
              
              {/* OTP Display for Sender - Only visible to sender */}
              {isSender && delivery.status !== "requested" && delivery.status !== "cancelled" && (
                <div className="mt-6 space-y-3">
                  {(() => {
                    console.log('[Frontend] OTP Display Check:', {
                      isSender,
                      status: delivery.status,
                      pickupOtp: delivery.pickupOtp,
                      deliveryOtp: delivery.deliveryOtp,
                      deliveryId: delivery.id
                    });
                    return null;
                  })()}
                  {delivery.pickupOtp && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 mb-1">Pickup OTP</p>
                      <p className="text-2xl font-bold text-blue-700 font-mono">{delivery.pickupOtp}</p>
                      <p className="text-xs text-blue-600 mt-1">Share this OTP with the carrier to confirm pickup</p>
                    </div>
                  )}
                  {!delivery.pickupOtp && (delivery.status === "accepted" || delivery.status === "picked") && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-600">Pickup OTP will appear after carrier marks delivery as picked</p>
                    </div>
                  )}
                  {delivery.deliveryOtp && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-900 mb-1">Delivery OTP</p>
                      <p className="text-2xl font-bold text-green-700 font-mono">{delivery.deliveryOtp}</p>
                      <p className="text-xs text-green-600 mt-1">Share this OTP with the carrier to confirm delivery</p>
                    </div>
                  )}
                  {!delivery.deliveryOtp && delivery.status === "in-transit" && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-600">Delivery OTP will appear when carrier marks delivery as in-transit</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="sm:col-span-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Sender Information</h3>
              <dl className="mt-2 text-sm text-gray-500">
                {delivery.sender && (
                  <div className="mt-3 flex items-center">
                    <dt className="sr-only">Sender name</dt>
                    <dd className="flex items-center">
                      <Avatar className="h-10 w-10 mr-3">
                        <AvatarFallback className="text-base">
                          {delivery.sender.fullName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-gray-900 font-medium text-base">{delivery.sender.fullName}</p>
                        {delivery.sender?.rating && (
                          <div className="flex items-center mt-1">
                            {[...Array(5)].map((_, i) => (
                              <svg 
                                key={i} 
                                className={`h-4 w-4 ${
                                  i < Math.round(delivery.sender?.rating ?? 0) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                                }`}
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            ))}
                            <span className="ml-1 text-xs text-gray-600">
                              {delivery.sender.rating.toFixed(1)}
                              {delivery.sender.totalReviews ? ` (${delivery.sender.totalReviews} reviews)` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </dd>
                  </div>
                )}
                
                {delivery.createdAt && (
                  <div className="mt-4">
                    <dt className="font-medium text-gray-500">Created At</dt>
                    <dd className="mt-1 text-gray-900">
                      {new Date(delivery.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </dd>
                  </div>
                )}
              </dl>
              
              {/* Accept Delivery Card for carriers when status is requested */}
              {isCarrier && delivery.status === "requested" && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="text-base">Accept Delivery</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-3">
                      <Button 
                        onClick={() => handleStatusUpdate("accepted")}
                        disabled={updateStatusMutation.isPending}
                        className="flex-1"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {updateStatusMutation.isPending ? "Accepting..." : "Accept Delivery"}
                      </Button>
                      <Button 
                        onClick={() => setShowCancelModal(true)}
                        variant="destructive"
                        disabled={updateStatusMutation.isPending}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Cancel button for other scenarios (sender or carrier after acceptance) */}
              {delivery.status !== "cancelled" && delivery.status !== "delivered" && delivery.status !== "requested" && (
                <div className="mt-6">
                  {((isSender && (delivery.status === "accepted")) ||
                    (isCarrier && (delivery.status === "accepted" || delivery.status === "picked"))) && (
                    <Button 
                      onClick={() => setShowCancelModal(true)}
                      variant="destructive"
                      className="w-full"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel Delivery
                    </Button>
                  )}
                </div>
              )}
              
              {/* Cancel button for sender when status is requested */}
              {isSender && delivery.status === "requested" && (
                <div className="mt-6">
                  <Button 
                    onClick={() => setShowCancelModal(true)}
                    variant="destructive"
                    className="w-full"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel Delivery
                  </Button>
                </div>
              )}
              
              {/* Carrier information (when carrier exists and is not current user) */}
              {delivery.carrier && !isCarrier && (
                <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Carrier Profile</h4>
                  <div className="flex items-start space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-lg">
                        {delivery.carrier.fullName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-gray-900 font-medium text-base">{delivery.carrier.fullName}</p>
                      <p className="text-sm text-gray-600 mt-0.5">@{delivery.carrier.username}</p>
                      {delivery.carrier.phoneNumber && (
                        <p className="text-sm text-gray-600 mt-1">
                          <Phone className="w-3 h-3 inline mr-1" />
                          +91 {delivery.carrier.phoneNumber}
                        </p>
                      )}
                      {delivery.carrier?.rating && (
                        <div className="flex items-center mt-2">
                          {[...Array(5)].map((_, i) => (
                            <svg 
                              key={i} 
                              className={`h-4 w-4 ${
                                i < Math.round(delivery.carrier?.rating ?? 0) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                              }`}
                              xmlns="http://www.w3.org/2000/svg" 
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ))}
                          <span className="ml-1 text-xs text-gray-600">
                            {delivery.carrier.rating.toFixed(1)} 
                            {delivery.carrier.totalReviews ? ` (${delivery.carrier.totalReviews} reviews)` : ""}
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2 capitalize">
                        Role: {delivery.carrier.role}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => navigate(`/profile/${delivery.carrier?.id}`)}
                      >
                        View Profile
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Call Buttons */}
              {isInvolved && delivery.status !== "requested" && delivery.status !== "cancelled" && (
                <div className="mt-6">
                  {isSender && delivery.carrier?.phoneNumber && (
                    <Button 
                      asChild
                      variant="outline"
                      className="w-full"
                    >
                      <a href={`tel:+91${delivery.carrier.phoneNumber}`}>
                        <Phone className="w-4 h-4 mr-2" />
                        Call Carrier (+91 {delivery.carrier.phoneNumber})
                      </a>
                    </Button>
                  )}
                  {isCarrier && delivery.sender?.phoneNumber && (
                    <Button 
                      asChild
                      variant="outline"
                      className="w-full mt-2"
                    >
                      <a href={`tel:+91${delivery.sender.phoneNumber}`}>
                        <Phone className="w-4 h-4 mr-2" />
                        Call Sender (+91 {delivery.sender.phoneNumber})
                      </a>
                    </Button>
                  )}
                </div>
              )}

              {/* GPS Tracking for Sender */}
              {isSender && delivery.status !== "requested" && delivery.status !== "cancelled" && delivery.carrierId && (
                <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 mb-2">Live Tracking</p>
                  {carrierLocation ? (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                        Carrier is moving...
                      </p>
                      <p className="text-xs text-gray-500">
                        Last updated: {new Date(carrierLocation.timestamp).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">
                        Location: {carrierLocation.latitude}, {carrierLocation.longitude}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Waiting for location update...</p>
                  )}
                </div>
              )}

              {/* Actions for carrier */}
              {isCarrier && nextStatus && delivery.status !== "cancelled" && (
                <div className="mt-6">
                  <Button 
                    onClick={() => handleStatusUpdate(nextStatus)}
                    disabled={updateStatusMutation.isPending}
                  >
                    {updateStatusMutation.isPending ? "Updating..." : nextStatusLabel}
                  </Button>
                </div>
              )}

              {/* Chat button - visible only to sender or carrier when delivery is accepted or later */}
              {isInvolved && delivery.status !== "requested" && delivery.status !== "cancelled" && (
                <div className="mt-6">
                  <Button 
                    onClick={() => navigate(`/deliveries/${deliveryId}/chat`)}
                    variant="outline"
                    className="w-full"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Open Chat
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Tracking Timeline</h3>
            <div className="mt-6 relative">
              {/* Status Timeline */}
              <div className="mt-6 sm:mt-5 sm:grid sm:grid-cols-5 sm:gap-4">
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full ${
                    delivery.status === "requested" || delivery.status === "accepted" || delivery.status === "picked" || delivery.status === "delivered"
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      {delivery.status === "requested" || delivery.status === "accepted" || delivery.status === "picked" || delivery.status === "delivered"
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      }
                    </svg>
                  </div>
                  <div className="text-center mt-3">
                    <h4 className="text-sm font-medium text-gray-900">Requested</h4>
                    <p className="text-xs text-gray-500">
                      {new Date(delivery.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full ${
                    delivery.status === "accepted" || delivery.status === "picked" || delivery.status === "delivered"
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      {delivery.status === "accepted" || delivery.status === "picked" || delivery.status === "delivered"
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      }
                    </svg>
                  </div>
                  <div className="text-center mt-3">
                    <h4 className={`text-sm font-medium ${
                      delivery.status === "accepted" || delivery.status === "picked" || delivery.status === "delivered"
                        ? "text-gray-900"
                        : "text-gray-500"
                    }`}>Accepted</h4>
                    <p className="text-xs text-gray-500">
                      {delivery.status === "requested" ? "Pending" : "Completed"}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full ${
                    delivery.status === "picked" || delivery.status === "in-transit" || delivery.status === "delivered"
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      {delivery.status === "picked" || delivery.status === "in-transit" || delivery.status === "delivered"
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      }
                    </svg>
                  </div>
                  <div className="text-center mt-3">
                    <h4 className={`text-sm font-medium ${
                      delivery.status === "picked" || delivery.status === "in-transit" || delivery.status === "delivered"
                        ? "text-gray-900"
                        : "text-gray-500"
                    }`}>Picked</h4>
                    <p className="text-xs text-gray-500">
                      {delivery.status === "requested" || delivery.status === "accepted" 
                        ? "Pending" 
                        : "Completed"}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full ${
                    delivery.status === "in-transit" || delivery.status === "delivered"
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      {delivery.status === "in-transit" || delivery.status === "delivered"
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      }
                    </svg>
                  </div>
                  <div className="text-center mt-3">
                    <h4 className={`text-sm font-medium ${
                      delivery.status === "in-transit" || delivery.status === "delivered"
                        ? "text-gray-900"
                        : "text-gray-500"
                    }`}>In Transit</h4>
                    <p className="text-xs text-gray-500">
                      {delivery.status === "in-transit" || delivery.status === "delivered" ? "In Progress" : "Pending"}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full ${
                    delivery.status === "delivered"
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      {delivery.status === "delivered"
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      }
                    </svg>
                  </div>
                  <div className="text-center mt-3">
                    <h4 className={`text-sm font-medium ${
                      delivery.status === "delivered"
                        ? "text-gray-900"
                        : "text-gray-500"
                    }`}>Delivered</h4>
                    <p className="text-xs text-gray-500">
                      {delivery.status === "delivered" ? "Completed" : "Pending"}
                    </p>
                  </div>
                </div>
                
                {/* Cancelled status */}
                {delivery.status === "cancelled" && (
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-6 w-6" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div className="text-center mt-3">
                      <h4 className="text-sm font-medium text-gray-900">Cancelled</h4>
                      <p className="text-xs text-gray-500">Delivery cancelled</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Map preview section */}
          <div className="mt-8">
            <div className="border border-gray-200 rounded-md">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Package Location</h3>
                <div className="mt-2 bg-gray-100 rounded-md overflow-hidden h-48">
                  {/* Map Placeholder */}
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Map className="h-12 w-12 text-gray-400 mb-2" />
                    <p className="font-medium">Route Preview</p>
                    <p className="text-sm mt-1">{delivery.pickupLocation} → {delivery.dropLocation}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Review section - visible when delivery is completed and user is involved */}
          {isInvolved && delivery.status === "delivered" && (
            <div className="mt-8">
              <Separator className="my-6" />
              
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Leave a review (if not already left) */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Leave a Review</h3>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <Form {...reviewForm}>
                        <form onSubmit={reviewForm.handleSubmit(onSubmitReview)} className="space-y-4">
                          <div className="space-y-4">
                            <FormField
                              control={reviewForm.control}
                              name="punctuality"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Punctuality</FormLabel>
                                  <Select
                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                    defaultValue={field.value.toString()}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select rating" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="1">1 - Poor</SelectItem>
                                      <SelectItem value="2">2 - Fair</SelectItem>
                                      <SelectItem value="3">3 - Good</SelectItem>
                                      <SelectItem value="4">4 - Very Good</SelectItem>
                                      <SelectItem value="5">5 - Excellent</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={reviewForm.control}
                              name="communication"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Communication</FormLabel>
                                  <Select
                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                    defaultValue={field.value.toString()}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select rating" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="1">1 - Poor</SelectItem>
                                      <SelectItem value="2">2 - Fair</SelectItem>
                                      <SelectItem value="3">3 - Good</SelectItem>
                                      <SelectItem value="4">4 - Very Good</SelectItem>
                                      <SelectItem value="5">5 - Excellent</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={reviewForm.control}
                              name="packageHandling"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Package Handling</FormLabel>
                                  <Select
                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                    defaultValue={field.value.toString()}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select rating" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="1">1 - Poor</SelectItem>
                                      <SelectItem value="2">2 - Fair</SelectItem>
                                      <SelectItem value="3">3 - Good</SelectItem>
                                      <SelectItem value="4">4 - Very Good</SelectItem>
                                      <SelectItem value="5">5 - Excellent</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={reviewForm.control}
                            name="comment"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Comment</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Share your experience..."
                                    rows={4}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <Button 
                            type="submit"
                            disabled={createReviewMutation.isPending}
                          >
                            {createReviewMutation.isPending ? "Submitting..." : "Submit Review"}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Reviews list */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {isSender 
                      ? "Carrier Reviews" 
                      : "Sender Reviews"}
                  </h3>
                  
                  {revieweeId ? (
                    <ReviewList userId={revieweeId} />
                  ) : (
                    <p className="text-gray-500">No reviews available</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OTP Modal */}
      <OtpModal
  open={showOtpModal}
  onOpenChange={(open) => {
    setShowOtpModal(open);
    if (!open) {
      setPendingStatus(null); // Reset if modal closed manually
    }
  }}
  onSubmit={handleOtpSubmit}
  title={
    pendingStatus === "picked"
      ? "Mark as Picked Up"
      : pendingStatus === "delivered"
      ? "Mark as Delivered"
      : "Enter OTP"
  }
  description={
    pendingStatus === "picked"
      ? "Enter the 6-digit pickup OTP shared by the sender"
      : pendingStatus === "delivered"
      ? "Enter the 6-digit delivery OTP shared by the sender"
      : "Enter the OTP"
  }
  isLoading={updateStatusMutation.isPending}
/>


<CancelDeliveryModal
  open={showCancelModal}
  onOpenChange={setShowCancelModal}
  onSubmit={(reason) => cancelDeliveryMutation.mutateAsync(reason)}
  isLoading={cancelDeliveryMutation.isPending}
/>
    </div>
  );
};

export default DeliveryDetailsPage;
