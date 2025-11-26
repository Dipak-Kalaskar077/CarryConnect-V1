import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { storage } from "./storage";
import type { Express } from "express";
import session from "express-session";
import passport from "passport";
import type { MessageWithSender } from "@shared/schema";

// Extend Express Request to include session
declare module "express-session" {
  interface SessionData {
    passport?: {
      user?: number;
    };
  }
}

interface AuthenticatedSocket {
  userId: number;
  deliveryId?: number;
}

// Map to store socket sessions
const socketSessions = new Map<string, AuthenticatedSocket>();

export function setupChat(io: SocketIOServer, sessionMiddleware: session.SessionOptions) {
  // Socket.io authentication middleware
  io.use(async (socket, next) => {
    const req = socket.request as any;
    
    // Use express session middleware to get session
    const sessionMiddlewareFunc = session(sessionMiddleware);
    
    sessionMiddlewareFunc(req as any, {} as any, async () => {
      // Deserialize user from session
      if (req.session?.passport?.user) {
        const userId = req.session.passport.user;
        const user = await storage.getUser(userId);
        
        if (user) {
          (socket as any).userId = userId;
          (socket as any).user = user;
          return next();
        }
      }
      
      next(new Error("Unauthorized"));
    });
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId;
    const socketId = socket.id;

    // Store socket session
    socketSessions.set(socketId, { userId });

    // Join chat room for a specific delivery
    socket.on("joinChat", async (data: { deliveryId: number }) => {
      try {
        const { deliveryId } = data;

        if (!deliveryId || typeof deliveryId !== "number") {
          socket.emit("error", { message: "Invalid delivery ID" });
          return;
        }

        // Get delivery and verify user has access
        const delivery = await storage.getDeliveryById(deliveryId);
        if (!delivery) {
          socket.emit("error", { message: "Delivery not found" });
          return;
        }

        // Verify user is either sender or carrier
        if (delivery.senderId !== userId && delivery.carrierId !== userId) {
          socket.emit("error", { message: "Unauthorized access to chat" });
          return;
        }

        // Verify delivery is accepted or later
        if (delivery.status === "requested") {
          socket.emit("error", { message: "Chat is only available after delivery is accepted" });
          return;
        }

        // Join the room
        const roomName = `delivery-${deliveryId}`;
        socket.join(roomName);
        
        // Update socket session
        socketSessions.set(socketId, { userId, deliveryId });

        socket.emit("joinedChat", { deliveryId });
      } catch (error: any) {
        console.error("Error joining chat:", error);
        socket.emit("error", { message: error.message || "Failed to join chat" });
      }
    });

    // Send message
    socket.on("sendMessage", async (data: { deliveryId: number; message: string; attachmentPath?: string; attachmentType?: string }) => {
      try {
        const { deliveryId, message, attachmentPath, attachmentType } = data;

        if (!deliveryId || typeof deliveryId !== "number") {
          socket.emit("error", { message: "Invalid delivery ID" });
          return;
        }

        if ((!message || typeof message !== "string" || message.trim().length === 0) && !attachmentPath) {
          socket.emit("error", { message: "Message or attachment is required" });
          return;
        }

        // Get delivery and verify user has access
        const delivery = await storage.getDeliveryById(deliveryId);
        if (!delivery) {
          socket.emit("error", { message: "Delivery not found" });
          return;
        }

        // Verify user is either sender or carrier
        if (delivery.senderId !== userId && delivery.carrierId !== userId) {
          socket.emit("error", { message: "Unauthorized access to chat" });
          return;
        }

        // Verify delivery is accepted or later
        if (delivery.status === "requested") {
          socket.emit("error", { message: "Chat is only available after delivery is accepted" });
          return;
        }

        // Determine receiver (the other party)
        const receiverId = delivery.senderId === userId ? delivery.carrierId : delivery.senderId;
        
        if (!receiverId) {
          socket.emit("error", { message: "Receiver not found" });
          return;
        }

        // Save message to database
        const savedMessage = await storage.createMessage({
          deliveryId,
          senderId: userId,
          receiverId,
          message: message ? message.trim() : "",
          attachmentPath: attachmentPath || null,
          attachmentType: attachmentType || null,
        });

        // Get sender info
        const sender = await storage.getUser(userId);
        const messageWithSender: MessageWithSender = {
          ...savedMessage,
          createdAt: savedMessage.createdAt instanceof Date 
            ? savedMessage.createdAt.toISOString() 
            : (typeof savedMessage.createdAt === "string" ? savedMessage.createdAt : new Date().toISOString()),
          sender: sender ? {
            id: sender.id,
            username: sender.username,
            fullName: sender.fullName,
          } : {
            id: userId,
            username: "Unknown",
            fullName: "Unknown",
          },
        };

        // Emit to all users in the room
        const roomName = `delivery-${deliveryId}`;
        io.to(roomName).emit("receiveMessage", messageWithSender);
      } catch (error: any) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: error.message || "Failed to send message" });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      socketSessions.delete(socketId);
    });
  });
}

