import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define package size enum
export const packageSizeEnum = pgEnum('package_size', ['small', 'medium', 'large']);

// Define delivery status enum
export const deliveryStatusEnum = pgEnum('delivery_status', ['requested', 'accepted', 'picked', 'in-transit', 'delivered', 'cancelled']);

// Define user roles enum
export const userRoleEnum = pgEnum('user_role', ['sender', 'carrier', 'both']);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: userRoleEnum("role").notNull().default('both'),
  rating: integer("rating"),
  totalReviews: integer("total_reviews").default(0),
  phoneNumber: text("phone_number"), // Phone number for contact
});

// Deliveries table
export const deliveries = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  carrierId: integer("carrier_id").references(() => users.id),
  pickupLocation: text("pickup_location").notNull(),
  dropLocation: text("drop_location").notNull(),
  packageSize: packageSizeEnum("package_size").notNull(),
  packageWeight: integer("package_weight").notNull(), // weight in grams
  description: text("description"),
  specialInstructions: text("special_instructions"),
  preferredDeliveryDate: text("preferred_delivery_date").notNull(),
  preferredDeliveryTime: text("preferred_delivery_time").notNull(),
  status: deliveryStatusEnum("status").notNull().default('requested'),
  deliveryFee: integer("delivery_fee").notNull(), // fee in cents
  pickupOtp: text("pickupOtp"), // OTP for pickup confirmation
  deliveryOtp: text("deliveryOtp"), // OTP for delivery confirmation
  cancellationReason: text("cancellation_reason"), // Reason for cancellation
  cancelledAt: timestamp("cancelled_at"), // When delivery was cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").references(() => deliveries.id).notNull(),
  reviewerId: integer("reviewer_id").references(() => users.id).notNull(),
  revieweeId: integer("reviewee_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(), // Overall rating (computed from metrics)
  punctuality: integer("punctuality").notNull(), // 1-5 rating
  communication: integer("communication").notNull(), // 1-5 rating
  packageHandling: integer("package_handling").notNull(), // 1-5 rating
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").references(() => deliveries.id).notNull(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  attachmentPath: text("attachment_path"), // Path to attached file
  attachmentType: text("attachment_type"), // e.g., 'image/jpeg', 'image/png'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Create Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  rating: true,
  totalReviews: true,
}).extend({
  phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits").optional().nullable(),
});

export const insertDeliverySchema = createInsertSchema(deliveries).omit({
  id: true,
  carrierId: true,
  status: true,
  createdAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
}).extend({
  punctuality: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  packageHandling: z.number().int().min(1).max(5),
  rating: z.number().int().min(1).max(5).optional(), // Will be computed
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

// FCM Tokens table
export const fcmTokens = pgTable("fcm_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  deviceInfo: text("device_info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFcmTokenSchema = createInsertSchema(fcmTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Delivery locations table for GPS tracking
export const deliveryLocations = pgTable("delivery_locations", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").references(() => deliveries.id).notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertDeliveryLocationSchema = createInsertSchema(deliveryLocations).omit({
  id: true,
  timestamp: true,
});

// Location schema for form validation
export const locationSchema = z.object({
  name: z.string().min(1, "Location is required"),
});

// Extended schema for create delivery form
// export const createDeliverySchema = insertDeliverySchema.extend({
//   packageWeight: z.number().min(1, "Weight must be at least 1 gram"),
//   deliveryFee: z.number().min(1, "Fee must be at least 1 cent"),
//   pickupLocation: z.string().min(1, "Pickup location is required"),
//   dropLocation: z.string().min(1, "Drop location is required"),
//   packageSize: z.enum(["small", "medium", "large"]),
//   carrierId: z.number().nullable().optional(), // ⭐ FIX HERE
// });

export const createDeliverySchema = insertDeliverySchema
  .omit({
    senderId: true,  // Omit senderId from base schema - it will be added by server
  })
  .extend({
    senderId: z.number().int().optional(),   // Optional for client, server will add it
    packageWeight: z.number().min(1, "Weight must be at least 1 gram"),
    deliveryFee: z.number().min(1, "Fee must be at least 1 cent"),
    pickupLocation: z.string().min(1, "Pickup location is required"),
    dropLocation: z.string().min(1, "Drop location is required"),
    packageSize: z.enum(["small", "medium", "large"]),
    description: z.string().optional().nullable(),
    specialInstructions: z.string().optional().nullable(),
  });


// Define types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Delivery = typeof deliveries.$inferSelect;
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type FcmToken = typeof fcmTokens.$inferSelect;
export type InsertFcmToken = z.infer<typeof insertFcmTokenSchema>;
export type DeliveryLocation = typeof deliveryLocations.$inferSelect;
export type InsertDeliveryLocation = z.infer<typeof insertDeliveryLocationSchema>;

// Define new types for delivery with sender/carrier info
export type DeliveryWithUser = Delivery & {
  sender: User;
  carrier?: User;
};

// Define message with sender info (createdAt as string for API responses)
export type MessageWithSender = Omit<Message, "createdAt"> & {
  createdAt: string;
  sender: Pick<User, "id" | "username" | "fullName">;
};

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
