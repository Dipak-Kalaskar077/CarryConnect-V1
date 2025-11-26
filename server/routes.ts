import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  createDeliverySchema, 
  insertReviewSchema,
  deliveryStatusEnum,
  type InsertDelivery,
  type InsertFcmToken
} from "@shared/schema";
import { ZodError } from "zod";
import { randomInt } from "crypto";

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Helper to format zod errors
const formatZodError = (error: ZodError) => {
  return error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message
  }));
};

// Generate OTP (4-6 digits)
function generateOTP(): string {
  return randomInt(1000, 999999).toString().padStart(6, '0');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // Deliveries routes
  // Get all deliveries with advanced filters
  app.get("/api/deliveries", async (req, res) => {
    try {
      const { 
        status, 
        pickupLocation, 
        dropLocation, 
        packageSize,
        minWeight,
        maxWeight,
        minFee,
        maxFee,
        minRating,
        startDate,
        endDate
      } = req.query;
      
      const filters: Record<string, any> = {};
      
      if (status && status !== "any") filters.status = status;
      if (pickupLocation && pickupLocation !== "any") filters.pickupLocation = pickupLocation;
      if (dropLocation && dropLocation !== "any") filters.dropLocation = dropLocation;
      if (packageSize && packageSize !== "any") filters.packageSize = packageSize;
      if (minWeight) filters.minWeight = parseInt(minWeight as string);
      if (maxWeight) filters.maxWeight = parseInt(maxWeight as string);
      if (minFee) filters.minFee = parseInt(minFee as string);
      if (maxFee) filters.maxFee = parseInt(maxFee as string);
      if (minRating) filters.minRating = parseInt(minRating as string);
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;

      const deliveries = await storage.getDeliveriesWithFilters(filters);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      res.status(500).json({ message: "Failed to fetch deliveries" });
    }
  });

  // Get delivery by ID
  app.get("/api/deliveries/:id", async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }
      
      // Use getDeliveryWithUsers to get full delivery with sender, carrier, and OTP fields
      const delivery = await storage.getDeliveryWithUsers(deliveryId);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }
      
      res.json(delivery);
    } catch (error) {
      console.error("Error fetching delivery:", error);
      res.status(500).json({ message: "Failed to fetch delivery" });
    }
  });

  // Create a new delivery
  app.post("/api/deliveries", isAuthenticated, async (req, res) => {
    try {
        // Parse and validate the delivery data (senderId is optional in schema for client-side validation)
        const parsedData = createDeliverySchema.parse(req.body);
        
        // Ensure senderId is set from authenticated user (required for database)
        const deliveryData = {
            ...parsedData,
            senderId: req.user!.id,   // Always set from authenticated user
        } as InsertDelivery;

        const delivery = await storage.createDelivery(deliveryData);
        res.status(201).json(delivery);

    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                message: "Please check all required fields and try again",
                errors: formatZodError(error),
            });
        }

        console.error("Error creating delivery:", error);
        res.status(500).json({ message: "Unable to create delivery. Please try again later" });
    }
});
  // Update delivery status
app.patch("/api/deliveries/:id/status", isAuthenticated, async (req, res) => {
  try {
    const deliveryId = parseInt(req.params.id);
    const { status, otp } = req.body;

    if (isNaN(deliveryId)) return res.status(400).json({ message: "Invalid delivery ID" });
    if (!Object.values(deliveryStatusEnum.enumValues).includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const delivery = await storage.getDeliveryById(deliveryId);
    if (!delivery) return res.status(404).json({ message: "Delivery not found" });

    const isSender = req.user!.id === delivery.senderId;
    const isCarrier = req.user!.id === delivery.carrierId;

    // Carrier accepts delivery
    if (status === "accepted") {
      if (delivery.carrierId !== null) {
        return res.status(400).json({ message: "This delivery has already been accepted by someone else" });
      }
      if (isSender) return res.status(403).json({ message: "You cannot accept your own delivery" });

      const pickupOtp = generateOTP();
      const deliveryOtp = generateOTP();

      await storage.updateDeliveryPickupOTP(deliveryId, pickupOtp);
      await storage.updateDeliveryDeliveryOTP(deliveryId, deliveryOtp);
      
      await storage.updateDeliveryStatus(deliveryId, "accepted", req.user!.id);
    }

    // Validate OTP before status change
    if (status === "picked" || status === "delivered") {
      if (!otp) {
        return res.status(400).json({ message: "OTP is required" });
      }

      const isPickup = status === "picked";
      const correctOtp = isPickup ? delivery.pickupOtp : delivery.deliveryOtp;

      if (!correctOtp || correctOtp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }
    }

    // Perform final status update AFTER verifying OTP
    const updatedDelivery = await storage.updateDeliveryStatus(deliveryId, status);

    console.log("[Routes] Updated:", updatedDelivery);
    res.json(updatedDelivery);
    
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

  

  // Cancel delivery
  app.post("/api/deliveries/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }

      const { cancellationReason } = req.body;
      if (!cancellationReason || typeof cancellationReason !== "string" || cancellationReason.trim().length < 10) {
        return res.status(400).json({ message: "Cancellation reason is required and must be at least 10 characters" });
      }

      // Get delivery to check permissions
      const delivery = await storage.getDeliveryById(deliveryId);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }

      const isSender = req.user!.id === delivery.senderId;
      const isCarrier = req.user!.id === delivery.carrierId;

      // Check if already cancelled
      if (delivery.status === "cancelled") {
        return res.status(400).json({ message: "Delivery is already cancelled" });
      }

      // Check if user can cancel
      // Sender can cancel before picked
      // Carrier can cancel before in-transit
      if (isSender) {
        if (delivery.status !== "requested" && delivery.status !== "accepted") {
          return res.status(400).json({ message: "Sender can only cancel delivery before it is picked" });
        }
      } else if (isCarrier) {
        if (delivery.status !== "requested" && delivery.status !== "accepted" && delivery.status !== "picked") {
          return res.status(400).json({ message: "Carrier can only cancel delivery before it is in-transit" });
        }
      } else {
        return res.status(403).json({ message: "Only the sender or carrier can cancel this delivery" });
      }

      // Cancel the delivery
      await storage.cancelDelivery(deliveryId, cancellationReason.trim());

      // Send notifications
      if (isSender && delivery.carrierId) {
        await storage.sendNotification(delivery.carrierId, {
          title: "Delivery Cancelled",
          body: `The delivery has been cancelled by the sender. Reason: ${cancellationReason.trim()}`,
          data: { deliveryId, type: "delivery_cancelled" }
        });
      } else if (isCarrier) {
        await storage.sendNotification(delivery.senderId, {
          title: "Delivery Cancelled",
          body: `The delivery has been cancelled by the carrier. Reason: ${cancellationReason.trim()}`,
          data: { deliveryId, type: "delivery_cancelled" }
        });
      }

      // Get updated delivery with full info
      const cancelledDelivery = await storage.getDeliveryWithUsers(deliveryId);
      
      res.json(cancelledDelivery || { message: "Delivery cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling delivery:", error);
      res.status(500).json({ message: "Failed to cancel delivery" });
    }
  });

  // Validate OTP
  app.post("/api/deliveries/:id/validate-otp", isAuthenticated, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }

      const { otp, type = "pickup" } = req.body; // type: 'pickup' or 'delivery', default to 'pickup'
      if (!otp || typeof otp !== "string") {
        return res.status(400).json({ message: "OTP is required" });
      }

      const delivery = await storage.getDeliveryById(deliveryId);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }

      const isCarrier = delivery.carrierId != null && req.user!.id === delivery.carrierId;
      if (!isCarrier) {
        return res.status(403).json({ message: "Only the carrier can validate OTP" });
      }

      const expectedOTP = type === "delivery" ? (delivery as any).deliveryOtp : (delivery as any).pickupOtp;
      if (!expectedOTP || expectedOTP !== otp) {
        return res.status(400).json({ message: "Invalid OTP entered" });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error("Error validating OTP:", error);
      res.status(500).json({ message: "Failed to validate OTP" });
    }
  });

  // Get user deliveries (as sender)
  app.get("/api/user/deliveries/sender", isAuthenticated, async (req, res) => {
    try {
      const deliveries = await storage.getSenderDeliveries(req.user!.id);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching sender deliveries:", error);
      res.status(500).json({ message: "Failed to fetch sender deliveries" });
    }
  });

  // Get user deliveries (as carrier)
  app.get("/api/user/deliveries/carrier", isAuthenticated, async (req, res) => {
    try {
      const deliveries = await storage.getCarrierDeliveries(req.user!.id);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching carrier deliveries:", error);
      res.status(500).json({ message: "Failed to fetch carrier deliveries" });
    }
  });

  // Reviews routes
  // Create a review
  app.post("/api/reviews", isAuthenticated, async (req, res) => {
    try {
      const reviewData = insertReviewSchema.parse({
        ...req.body,
        reviewerId: req.user!.id,
      });
      
      // Check if the delivery exists and is delivered
      const delivery = await storage.getDeliveryById(reviewData.deliveryId);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }
      
      if (delivery.status !== 'delivered') {
        return res.status(400).json({ message: "Can only review completed deliveries" });
      }
      
      // Check if user is associated with the delivery
      const isCarrier = req.user!.id === delivery.carrierId;
      const isSender = req.user!.id === delivery.senderId;
      
      if (!isCarrier && !isSender) {
        return res.status(403).json({ message: "Only participants in the delivery can leave reviews" });
      }
      
      // Check if the reviewee is the other party in the delivery
      if (reviewData.revieweeId !== (isSender ? delivery.carrierId : delivery.senderId)) {
        return res.status(400).json({ message: "Invalid reviewee" });
      }
      
      // Check if already reviewed
      const existingReview = await storage.getReviewByDeliveryAndReviewer(
        reviewData.deliveryId, req.user!.id
      );
      
      if (existingReview) {
        return res.status(400).json({ message: "You have already reviewed this delivery" });
      }
      
      // Compute overall rating from metrics
      const overallRating = Math.round(
        (reviewData.punctuality + reviewData.communication + reviewData.packageHandling) / 3
      );
      
      const review = await storage.createReview({
        ...reviewData,
        rating: overallRating,
      });
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: formatZodError(error) 
        });
      }
      
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // Get reviews for a user
  app.get("/api/users/:id/reviews", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const reviews = await storage.getUserReviews(userId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching user reviews:", error);
      res.status(500).json({ message: "Failed to fetch user reviews" });
    }
  });

  // Get user profile (public)
  app.get("/api/users/:id/profile", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUserProfile(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Messages routes
  // Get messages for a delivery (only sender or carrier can access)
  app.get("/api/deliveries/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }

      const messages = await storage.getMessagesByDelivery(deliveryId, req.user!.id);
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      if (error.message === "Delivery not found") {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === "Unauthorized access to messages") {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // File upload route for chat attachments
  app.post("/api/deliveries/:id/upload", isAuthenticated, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }

      // In a real implementation, you would use multer or similar
      // For now, we'll return a mock path
      // TODO: Implement actual file upload with multer
      const mockPath = `/uploads/delivery-${deliveryId}-${Date.now()}.jpg`;
      
      res.json({ path: mockPath, success: true });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // FCM Token routes
  // Save FCM token
  app.post("/api/fcm/token", isAuthenticated, async (req, res) => {
    try {
      const { token, deviceInfo } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Token is required" });
      }

      await storage.saveFcmToken({
        userId: req.user!.id,
        token,
        deviceInfo: deviceInfo || null,
      });

      res.status(201).json({ message: "Token saved successfully" });
    } catch (error) {
      console.error("Error saving FCM token:", error);
      res.status(500).json({ message: "Failed to save FCM token" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
