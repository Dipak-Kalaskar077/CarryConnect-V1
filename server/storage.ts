import { users, deliveries, reviews, messages, fcmTokens, deliveryLocations, type User, type InsertUser, type Delivery, 
  type InsertDelivery, type Review, type InsertReview, type DeliveryWithUser, 
  type InsertMessage, type Message, type MessageWithSender, type InsertFcmToken, type FcmToken, type InsertDeliveryLocation } from "@shared/schema";
import { db, isDatabaseConfigured } from "./db";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import createMemoryStore from "memorystore";
import session from "express-session";

const MemoryStore = createMemoryStore(session);

// Define storage interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserProfile(userId: number): Promise<Partial<User> | undefined>;
  
  // Delivery methods
  getDeliveriesWithFilters(filters: Record<string, any>): Promise<DeliveryWithUser[]>;
  getDeliveryById(id: number): Promise<Delivery | undefined>;
  createDelivery(delivery: InsertDelivery): Promise<Delivery>;
  updateDeliveryStatus(id: number, status: string, carrierId?: number): Promise<Delivery | undefined>;
  updateDeliveryPickupOTP(id: number, otp: string): Promise<void>;
  updateDeliveryDeliveryOTP(id: number, otp: string): Promise<void>;
  cancelDelivery(id: number, reason: string): Promise<void>;
  updateDeliveryLocation(id: number, latitude: string, longitude: string): Promise<void>;
  getDeliveryLocation(id: number): Promise<{ latitude: string; longitude: string; timestamp: string } | null>;
  getSenderDeliveries(userId: number): Promise<DeliveryWithUser[]>;
  getCarrierDeliveries(userId: number): Promise<DeliveryWithUser[]>;
  
  // Review methods
  createReview(review: InsertReview): Promise<Review>;
  getUserReviews(userId: number): Promise<(Review & { reviewer: Partial<User> })[]>;
  getReviewByDeliveryAndReviewer(deliveryId: number, reviewerId: number): Promise<Review | undefined>;
  
  // Message methods
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByDelivery(deliveryId: number, userId: number): Promise<MessageWithSender[]>;
  
  // FCM methods
  saveFcmToken(token: InsertFcmToken): Promise<FcmToken>;
  sendNotification(userId: number, notification: { title: string; body: string; data?: any }): Promise<void>;
  
  // Session store
  sessionStore: session.Store;
}

/**
 * INTERNAL HELPERS & TYPES
 *
 * We keep your public API and runtime logic unchanged.
 * To fix TS mismatches between full `User` (with password/role) and
 * partial user projections returned by queries, we introduce
 * DeliveryUser for internal normalization and then cast results
 * back to DeliveryWithUser[] for the exported signatures.
 *
 * Also convert createdAt -> ISO string (Option A you chose).
 */

// Partial user projection shape returned from many DB selects
type DeliveryUser = Pick<User, "id" | "username" | "fullName" | "rating" | "totalReviews" | "role"> | {
  id: number;
  username: string;
  fullName: string;
  rating: number | null;
  totalReviews: number | null;
  role?: "sender" | "carrier" | "both" | undefined;
};

// Normalize a delivery object so createdAt is string and sender/carrier are DeliveryUser | null
function normalizeDeliveryWithSenderCarrier(raw: any): any {
  // Delivery part may have createdAt as Date (from DB) or string (from mem storage)
  if (raw.delivery && raw.delivery.createdAt instanceof Date) {
    raw.delivery = { ...raw.delivery, createdAt: raw.delivery.createdAt.toISOString() };
  } else if (raw.delivery && typeof raw.delivery.createdAt === "string") {
    // already string, keep
  } else if (raw.createdAt instanceof Date) {
    // sometimes we might be passed the delivery itself
    raw.createdAt = raw.createdAt.toISOString();
  }
  
  // Normalize delivery OTP fields if delivery exists
  if (raw.delivery) {
    normalizeDeliveryObject(raw.delivery);
  }

  // Normalize sender projection
  if (raw.sender) {
    const s = raw.sender;
    raw.sender = {
      id: s.id,
      username: s.username,
      fullName: s.fullName,
      rating: s.rating ?? null,
      totalReviews: s.totalReviews ?? null,
      // keep role if present, otherwise undefined
      role: s.role as any,
    } as DeliveryUser;
  } else {
    raw.sender = null;
  }

  // Normalize carrier projection if present
  if (raw.carrier) {
    const c = raw.carrier;
    raw.carrier = {
      id: c.id,
      username: c.username,
      fullName: c.fullName,
      rating: c.rating ?? null,
      totalReviews: c.totalReviews ?? null,
      role: c.role as any,
    } as DeliveryUser;
  } else {
    // leave undefined (caller expects optional)
    delete raw.carrier;
  }

  return raw;
}

// Normalize a single delivery object (not from the joined result)
function normalizeDeliveryObject(delivery: any) {
  if (!delivery) return delivery;

  console.log(`[normalizeDeliveryObject] Before normalization:`, {
    pickupOtp: delivery.pickupOtp,
    pickup_otp: delivery.pickup_otp,
    deliveryOtp: delivery.deliveryOtp,
    delivery_otp: delivery.delivery_otp,
    allKeys: Object.keys(delivery),
  });

  // Drizzle ORM should return camelCase, but handle both cases
  // convert snake_case → camelCase for OTP fields if they exist
  if (delivery.pickup_otp !== undefined && delivery.pickupOtp === undefined) {
    delivery.pickupOtp = delivery.pickup_otp;
    delete delivery.pickup_otp;
  }
  if (delivery.delivery_otp !== undefined && delivery.deliveryOtp === undefined) {
    delivery.deliveryOtp = delivery.delivery_otp;
    delete delivery.delivery_otp;
  }

  console.log(`[normalizeDeliveryObject] After normalization:`, {
    pickupOtp: delivery.pickupOtp,
    deliveryOtp: delivery.deliveryOtp,
  });

  return delivery;
}


// Helper to normalize review createdAt to ISO string
function normalizeReviewObject(review: any): any {
  if (!review) return review;
  if (review.createdAt instanceof Date) {
    review.createdAt = review.createdAt.toISOString();
  }
  return review;
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
  
}


export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  async getUserProfile(userId: number): Promise<Partial<User> | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        rating: users.rating,
        totalReviews: users.totalReviews,
        phoneNumber: users.phoneNumber,
      })
      .from(users)
      .where(eq(users.id, userId));
      
    return user;
  }
  
  // Delivery methods
  async getDeliveriesWithFilters(filters: Record<string, any>): Promise<DeliveryWithUser[]> {
    let query = db
      .select({
        delivery: deliveries,
        sender: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          rating: users.rating,
          totalReviews: users.totalReviews,
        },
      })
      .from(deliveries)
      .leftJoin(users, eq(deliveries.senderId, users.id))
      .orderBy(desc(deliveries.createdAt));
    
    // Apply filters
    const conditions: any[] = [];
    
    if (filters.status) {
      conditions.push(eq(deliveries.status, filters.status));
    }
    
    if (filters.pickupLocation) {
      conditions.push(eq(deliveries.pickupLocation, filters.pickupLocation));
    }
    
    if (filters.dropLocation) {
      conditions.push(eq(deliveries.dropLocation, filters.dropLocation));
    }
    
    if (filters.packageSize) {
      conditions.push(eq(deliveries.packageSize, filters.packageSize));
    }
    
    if (filters.minWeight) {
      conditions.push(sql`${deliveries.packageWeight} >= ${filters.minWeight}`);
    }
    
    if (filters.maxWeight) {
      conditions.push(sql`${deliveries.packageWeight} <= ${filters.maxWeight}`);
    }
    
    if (filters.minFee) {
      conditions.push(sql`${deliveries.deliveryFee} >= ${filters.minFee}`);
    }
    
    if (filters.maxFee) {
      conditions.push(sql`${deliveries.deliveryFee} <= ${filters.maxFee}`);
    }
    
    if (filters.startDate) {
      conditions.push(sql`${deliveries.preferredDeliveryDate} >= ${filters.startDate}`);
    }
    
    if (filters.endDate) {
      conditions.push(sql`${deliveries.preferredDeliveryDate} <= ${filters.endDate}`);
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    const results = await query;
    
    // Format results to match DeliveryWithUser type and convert createdAt to string
    const normalized = results.map(({ delivery, sender }: any) => {
      const item = { delivery, sender };
      const normalizedItem = normalizeDeliveryWithSenderCarrier(item);
      // Flatten: { ...delivery, sender }
      return {
        ...normalizedItem.delivery,
        sender: normalizedItem.sender,
      };
    });

    // Cast to original public signature
    return normalized as unknown as DeliveryWithUser[];
  }
  
  async getDeliveryById(id: number): Promise<Delivery | undefined> {
    const [delivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, id));
      
    // Normalize createdAt to ISO string
    if (delivery) {
      normalizeDeliveryObject(delivery);
    }
    
    return delivery;
  }
  
// New method to return full delivery with sender + carrier + OTP fields
async getDeliveryWithUsers(id: number): Promise<DeliveryWithUser | undefined> {
  // Create aliases for users table to join it twice
  const senderUser = alias(users, "sender_user");
  const carrierUser = alias(users, "carrier_user");
  
  const [result] = await db
    .select({
      delivery: deliveries,
      sender: {
        id: senderUser.id,
        username: senderUser.username,
        fullName: senderUser.fullName,
        rating: senderUser.rating,
        totalReviews: senderUser.totalReviews,
        phoneNumber: senderUser.phoneNumber,
        role: senderUser.role,
      },
      carrier: {
        id: carrierUser.id,
        username: carrierUser.username,
        fullName: carrierUser.fullName,
        rating: carrierUser.rating,
        totalReviews: carrierUser.totalReviews,
        phoneNumber: carrierUser.phoneNumber,
        role: carrierUser.role,
      }
    })
    .from(deliveries)
    .leftJoin(senderUser, eq(deliveries.senderId, senderUser.id))
    .leftJoin(carrierUser, eq(deliveries.carrierId, carrierUser.id))
    .where(eq(deliveries.id, id));

  if (!result) {
    console.log(`[DatabaseStorage] getDeliveryWithUsers(${id}): No result found`);
    return undefined;
  }

  console.log(`[DatabaseStorage] getDeliveryWithUsers(${id}): Raw result from DB:`, {
    deliveryId: result.delivery?.id,
    pickupOtp: (result.delivery as any)?.pickupOtp,
    pickup_otp: (result.delivery as any)?.pickup_otp,
    deliveryOtp: (result.delivery as any)?.deliveryOtp,
    delivery_otp: (result.delivery as any)?.delivery_otp,
    status: result.delivery?.status,
  });

  const normalized = normalizeDeliveryWithSenderCarrier(result);
  
  console.log(`[DatabaseStorage] getDeliveryWithUsers(${id}): After normalization:`, {
    pickupOtp: normalized.delivery?.pickupOtp,
    deliveryOtp: normalized.delivery?.deliveryOtp,
  });
  
  const deliveryWithUsers = {
    ...normalized.delivery,
    sender: normalized.sender,
    carrier: normalized.carrier,
  } as DeliveryWithUser;
  
  // Log to verify OTPs are included
  console.log(`[DatabaseStorage] getDeliveryWithUsers(${id}): Final result - pickupOtp=${deliveryWithUsers.pickupOtp}, deliveryOtp=${deliveryWithUsers.deliveryOtp}`);
  
  return deliveryWithUsers;
}


  async createDelivery(delivery: InsertDelivery): Promise<Delivery> {
    const [createdDelivery] = await db
      .insert(deliveries)
      .values(delivery)
      .returning();
      
    // convert createdAt to string if returned as Date
    normalizeDeliveryObject(createdDelivery);
    return createdDelivery;
  }
  
  async updateDeliveryStatus(id: number, status: string, carrierId?: number): Promise<Delivery | undefined> {
    const updateValues: any = { status };
  
    if (carrierId) updateValues.carrierId = carrierId;
  
    if (status === "picked") {
      updateValues.pickupOtp = generateOtp();
    }

    if (status === "delivered") {
      updateValues.deliveryOtp = generateOtp();
    }    
  
    const [updated] = await db
      .update(deliveries)
      .set(updateValues)
      .where(eq(deliveries.id, id))
      .returning();
  
    if (!updated) return undefined;
  
    return this.getDeliveryWithUsers(id);
  }
  
  

  async updateDeliveryPickupOTP(id: number, otp: string): Promise<Delivery | undefined> {
  const [updated] = await db
    .update(deliveries)
    .set({ pickupOtp: otp })
    .where(eq(deliveries.id, id))
    .returning();

  if (!updated) {
    console.error(`[DatabaseStorage] updateDeliveryPickupOTP FAILED for ${id}`);
    return undefined;
  }

  return this.getDeliveryWithUsers(id);
}


async updateDeliveryDeliveryOTP(id: number, otp: string): Promise<Delivery | undefined> {
  console.log(`[DatabaseStorage] updateDeliveryDeliveryOTP: Starting - deliveryId=${id}, otp=${otp}`);

  const [updated] = await db
    .update(deliveries)
    .set({ deliveryOtp: otp })
    .where(eq(deliveries.id, id))
    .returning();

  if (!updated) {
    console.error(`[DatabaseStorage] updateDeliveryDeliveryOTP: FAILED - No rows updated for deliveryId=${id}`);
    return undefined;
  }

  console.log(`[DatabaseStorage] updateDeliveryDeliveryOTP: SUCCESS - Updated delivery OTP for delivery ${id}`);

  // Return the fully hydrated delivery with sender + carrier + OTP fields
  return this.getDeliveryWithUsers(id);
}


  async cancelDelivery(id: number, reason: string) {
    const [cancelledDelivery] = await db
      .update(deliveries)
      .set({
        status: "cancelled",
        cancellationReason: reason,
        cancelledAt: new Date(),
      })
      .where(eq(deliveries.id, id))
      .returning();
  
    return this.getDeliveryWithUsers(id);
  }
  

  async updateDeliveryLocation(id: number, latitude: string, longitude: string): Promise<void> {
    await db
      .insert(deliveryLocations)
      .values({
        deliveryId: id,
        latitude,
        longitude,
      });
  }

  async getDeliveryLocation(id: number): Promise<{ latitude: string; longitude: string; timestamp: string } | null> {
    const [location] = await db
      .select()
      .from(deliveryLocations)
      .where(eq(deliveryLocations.deliveryId, id))
      .orderBy(desc(deliveryLocations.timestamp))
      .limit(1);
    
    if (!location) return null;
    
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: location.timestamp instanceof Date 
        ? location.timestamp.toISOString() 
        : (typeof location.timestamp === "string" ? location.timestamp : new Date().toISOString()),
    };
  }
  
  async getSenderDeliveries(userId: number): Promise<DeliveryWithUser[]> {
    const results = await db
      .select({
        delivery: deliveries,
        carrier: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          rating: users.rating,
          totalReviews: users.totalReviews,
        },
      })
      .from(deliveries)
      .leftJoin(users, eq(deliveries.carrierId, users.id))
      .where(eq(deliveries.senderId, userId))
      .orderBy(desc(deliveries.createdAt));
      
    // Sender deliveries already have the sender, so we just need to add the carrier
    const normalized = results.map(({ delivery, carrier }: any) => {
      const item = { delivery, sender: null, carrier };
      const normalizedItem = normalizeDeliveryWithSenderCarrier(item);
      // Provide minimal sender info (we keep your original behaviour)
      const senderMinimal = { id: userId } as any;
      return {
        ...normalizedItem.delivery,
        sender: senderMinimal,
        carrier: normalizedItem.carrier ? normalizedItem.carrier : undefined,
      };
    });

    return normalized as unknown as DeliveryWithUser[];
  }
  
  async getCarrierDeliveries(userId: number): Promise<DeliveryWithUser[]> {
    const results = await db
      .select({
        delivery: deliveries,
        sender: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          rating: users.rating,
          totalReviews: users.totalReviews,
        },
      })
      .from(deliveries)
      .leftJoin(users, eq(deliveries.senderId, users.id))
      .where(eq(deliveries.carrierId, userId))
      .orderBy(desc(deliveries.createdAt));
      
    // Format results to match DeliveryWithUser type
    const normalized = results.map(({ delivery, sender }: any) => {
      const item = { delivery, sender, carrier: null };
      const normalizedItem = normalizeDeliveryWithSenderCarrier(item);
      // Set minimal carrier info as you did originally
      const carrierMinimal = { id: userId } as any;
      return {
        ...normalizedItem.delivery,
        sender: normalizedItem.sender,
        carrier: carrierMinimal,
      };
    });

    return normalized as unknown as DeliveryWithUser[];
  }
  
  // Review methods
  async createReview(review: InsertReview): Promise<Review> {
    // Ensure rating is set (required by DB schema)
    const reviewWithRating = {
      ...review,
      rating: review.rating || Math.round((review.punctuality + review.communication + review.packageHandling) / 3),
    };
    
    // Start a transaction to create review and update user rating
    const [createdReview] = await db.transaction(async (tx) => {
      // Create the review
      const [newReview] = await tx
        .insert(reviews)
        .values(reviewWithRating)
        .returning();
      
      // Update the reviewee's rating
      await this.updateUserRating(tx, review.revieweeId);
      
      return [newReview];
    });
    
    // Normalize createdAt to string
    normalizeReviewObject(createdReview);
    return createdReview;
  }
  
  async getUserReviews(userId: number): Promise<(Review & { reviewer: Partial<User> })[]> {
    const reviewsWithReviewers = await db
      .select({
        review: reviews,
        reviewer: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.reviewerId, users.id))
      .where(eq(reviews.revieweeId, userId))
      .orderBy(desc(reviews.createdAt));
      
    const normalized = reviewsWithReviewers.map(({ review, reviewer }: any) => {
      const r = normalizeReviewObject(review);
      return {
        ...r,
        reviewer: reviewer ? {
          id: reviewer.id,
          username: reviewer.username,
          fullName: reviewer.fullName,
        } : undefined,
      };
    });

    return normalized as unknown as (Review & { reviewer: Partial<User> })[];
  }
  
  async getReviewByDeliveryAndReviewer(deliveryId: number, reviewerId: number): Promise<Review | undefined> {
    const [review] = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.deliveryId, deliveryId),
          eq(reviews.reviewerId, reviewerId)
        )
      );
      
    if (review) normalizeReviewObject(review);
    return review;
  }
  
  // Helper method to recalculate and update a user's rating
  private async updateUserRating(tx: any, userId: number) {
    // Calculate average rating from overall ratings
    const ratingResult = await tx
      .select({
        averageRating: sql`AVG(${reviews.rating})`,
        totalReviews: sql`COUNT(*)`,
      })
      .from(reviews)
      .where(eq(reviews.revieweeId, userId));
      
    if (ratingResult.length > 0) {
      const { averageRating, totalReviews } = ratingResult[0];
      
      // Update user's rating and totalReviews
      await tx
        .update(users)
        .set({
          rating: Math.round(averageRating),
          totalReviews,
        })
        .where(eq(users.id, userId));
    }
  }

  // Message methods
  async createMessage(message: InsertMessage): Promise<Message> {
    const [createdMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    
    // Return as-is (createdAt will be Date from DB)
    return createdMessage;
  }

  async getMessagesByDelivery(deliveryId: number, userId: number): Promise<MessageWithSender[]> {
    // First verify user has access to this delivery
    const delivery = await this.getDeliveryById(deliveryId);
    if (!delivery) {
      throw new Error("Delivery not found");
    }
    
    // Verify user is either sender or carrier
    if (delivery.senderId !== userId && delivery.carrierId !== userId) {
      throw new Error("Unauthorized access to messages");
    }

    const results = await db
      .select({
        message: messages,
        sender: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
        },
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.deliveryId, deliveryId))
      .orderBy(messages.createdAt);

    return results.map(({ message, sender }: any) => {
      const normalizedMessage: any = {
        ...message,
        createdAt: message.createdAt instanceof Date 
          ? message.createdAt.toISOString() 
          : message.createdAt,
      };
      
      return {
        ...normalizedMessage,
        sender: sender || { id: message.senderId, username: "Unknown", fullName: "Unknown" },
      } as unknown as MessageWithSender;
    });
  }

  // FCM methods
  async saveFcmToken(tokenData: InsertFcmToken): Promise<FcmToken> {
    // Check if token already exists
    const [existing] = await db
      .select()
      .from(fcmTokens)
      .where(eq(fcmTokens.token, tokenData.token));

    if (existing) {
      // Update existing token
      const [updated] = await db
        .update(fcmTokens)
        .set({
          userId: tokenData.userId,
          deviceInfo: tokenData.deviceInfo,
          updatedAt: new Date(),
        })
        .where(eq(fcmTokens.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new token
      const [created] = await db
        .insert(fcmTokens)
        .values(tokenData)
        .returning();
      return created;
    }
  }

  async sendNotification(userId: number, notification: { title: string; body: string; data?: any }): Promise<void> {
    // Get all FCM tokens for the user
    const tokens = await db
      .select()
      .from(fcmTokens)
      .where(eq(fcmTokens.userId, userId));

    if (tokens.length === 0) {
      return; // No tokens to send to
    }

    // In a real implementation, you would use Firebase Admin SDK here
    // For now, we'll just log it
    console.log(`Sending notification to user ${userId}:`, notification);
    console.log(`Tokens:`, tokens.map(t => t.token));

    // TODO: Implement actual FCM sending using firebase-admin
    // const admin = require('firebase-admin');
    // const message = {
    //   notification: { title: notification.title, body: notification.body },
    //   data: notification.data,
    //   tokens: tokens.map(t => t.token),
    // };
    // await admin.messaging().sendMulticast(message);
  }
}

export class MemStorage implements IStorage {
  private usersData: Map<number, User>;
  private deliveriesData: Map<number, Delivery>;
  private reviewsData: Map<number, Review>;
  private messagesData: Map<number, Message>;
  sessionStore: session.Store;
  private userId: number;
  private deliveryId: number;
  private reviewId: number;
  private messageId: number;
  
  constructor() {
    this.usersData = new Map();
    this.deliveriesData = new Map();
    this.reviewsData = new Map();
    this.messagesData = new Map();
    this.userId = 1;
    this.deliveryId = 1;
    this.reviewId = 1;
    this.messageId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    
    // Seed sample data
    this.seedData();
  }
  
  private seedData() {
    // Create some sample users
    const user1 = this.createUser({
      username: "john_sender",
      password: "password123",
      fullName: "John Sender",
      role: "sender",
    });
    
    const user2 = this.createUser({
      username: "alice_carrier",
      password: "password123",
      fullName: "Alice Carrier",
      role: "carrier",
    });
    
    const user3 = this.createUser({
      username: "bob_both",
      password: "password123",
      fullName: "Bob Both",
      role: "both",
    });
    
    // Create some sample deliveries
    const delivery1 = this.createDelivery({
      senderId: 1,
      pickupLocation: "Pune",
      dropLocation: "Mumbai",
      packageSize: "medium",
      packageWeight: 3500, // 3.5 kg
      description: "Electronics",
      specialInstructions: "Handle with care",
      preferredDeliveryDate: "2023-06-22",
      preferredDeliveryTime: "Before 6:00 PM",
      deliveryFee: 30000, // $300
    });
    
    const delivery2 = this.createDelivery({
      senderId: 3,
      pickupLocation: "Mumbai",
      dropLocation: "Bangalore",
      packageSize: "small",
      packageWeight: 1000, // 1 kg
      description: "Clothes",
      preferredDeliveryDate: "2023-06-24",
      preferredDeliveryTime: "Before 2:00 PM",
      deliveryFee: 50000, // $500
    });
    
    const delivery3 = this.createDelivery({
      senderId: 1,
      pickupLocation: "Bangalore",
      dropLocation: "Pune",
      packageSize: "large",
      packageWeight: 8000, // 8 kg
      description: "Books",
      preferredDeliveryDate: "2023-06-23",
      preferredDeliveryTime: "Before 8:00 PM",
      deliveryFee: 60000, // $600
    });
    
    // Update delivery1 to be picked by carrier
    this.updateDeliveryStatus(1, "accepted", 2);
    this.updateDeliveryStatus(1, "picked");
    
    // Update delivery2 to be accepted by carrier
    this.updateDeliveryStatus(2, "accepted", 2);
    
    // Create reviews
    this.createReview({
      deliveryId: 1,
      reviewerId: 1,
      revieweeId: 2,
      punctuality: 5,
      communication: 5,
      packageHandling: 5,
      comment: "Excellent service!",
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.usersData.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersData.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { 
      ...insertUser, 
      id, 
      rating: null, 
      totalReviews: null,
      role: insertUser.role ?? "both",
      phoneNumber: insertUser.phoneNumber ?? null,
    };
    this.usersData.set(id, user);
    return user;
  }
  
  async getUserProfile(userId: number): Promise<Partial<User> | undefined> {
    const user = this.usersData.get(userId);
    if (!user) return undefined;
    
    const { password, ...profile } = user;
    return profile;
  }
  
  // Delivery methods
  async getDeliveriesWithFilters(filters: Record<string, any>): Promise<DeliveryWithUser[]> {
    let deliveries = Array.from(this.deliveriesData.values());
    
    // Apply filters
    if (filters.status) {
      deliveries = deliveries.filter(d => d.status === filters.status);
    }
    
    if (filters.pickupLocation) {
      deliveries = deliveries.filter(d => d.pickupLocation === filters.pickupLocation);
    }
    
    if (filters.dropLocation) {
      deliveries = deliveries.filter(d => d.dropLocation === filters.dropLocation);
    }
    
    if (filters.packageSize) {
      deliveries = deliveries.filter(d => d.packageSize === filters.packageSize);
    }
    
    // Sort by creation date (most recent first)
    deliveries.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    
    // Add sender and carrier info
    const normalized = deliveries.map(delivery => {
      const sender = this.usersData.get(delivery.senderId);
      const carrier = delivery.carrierId ? this.usersData.get(delivery.carrierId) : undefined;
      
      // Remove sensitive info from users
      const senderSafe = sender ? {
        id: sender.id,
        username: sender.username,
        fullName: sender.fullName,
        rating: sender.rating,
        totalReviews: sender.totalReviews,
        role: sender.role,
      } : undefined;
      
      const carrierSafe = carrier ? {
        id: carrier.id,
        username: carrier.username,
        fullName: carrier.fullName,
        rating: carrier.rating,
        totalReviews: carrier.totalReviews,
        role: carrier.role,
      } : undefined;
      
      // Ensure createdAt is ISO string (Option A)
      const createdDelivery = {
        ...delivery,
        createdAt: typeof delivery.createdAt === "string" ? delivery.createdAt : (delivery.createdAt instanceof Date ? delivery.createdAt.toISOString() : new Date().toISOString()),
      };
      
      return {
        ...createdDelivery,
        sender: senderSafe as User ?? null,
        ...(carrierSafe && { carrier: carrierSafe as User }),
      };
    });

    return normalized as unknown as DeliveryWithUser[];
  }
  
  async getDeliveryById(id: number): Promise<Delivery | undefined> {
    const delivery = this.deliveriesData.get(id);
    if (!delivery) return undefined;
    // Ensure createdAt is a Date object
    const normalized: Delivery = {
      ...delivery,
      createdAt: delivery.createdAt instanceof Date ? delivery.createdAt : (typeof delivery.createdAt === "string" ? new Date(delivery.createdAt) : new Date()),
    };
    return normalized;
  }
  
  async getDeliveryWithUsers(id: number): Promise<DeliveryWithUser | undefined> {
    const delivery = this.deliveriesData.get(id);
    if (!delivery) return undefined;
    
    const sender = this.usersData.get(delivery.senderId);
    const carrier = delivery.carrierId ? this.usersData.get(delivery.carrierId) : undefined;
    
    // Remove sensitive info from users
    const senderSafe = sender ? {
      id: sender.id,
      username: sender.username,
      fullName: sender.fullName,
      rating: sender.rating,
      totalReviews: sender.totalReviews,
      role: sender.role,
      phoneNumber: sender.phoneNumber,
    } : undefined;
    
    const carrierSafe = carrier ? {
      id: carrier.id,
      username: carrier.username,
      fullName: carrier.fullName,
      rating: carrier.rating,
      totalReviews: carrier.totalReviews,
      role: carrier.role,
      phoneNumber: carrier.phoneNumber,
    } : undefined;
    
    // Ensure createdAt is ISO string and include all delivery fields including OTPs
    const createdDelivery = {
      ...delivery,
      createdAt: typeof delivery.createdAt === "string" ? delivery.createdAt : (delivery.createdAt instanceof Date ? delivery.createdAt.toISOString() : new Date().toISOString()),
      pickupOtp: (delivery as any).pickupOtp ?? null,
      deliveryOtp: (delivery as any).deliveryOtp ?? null,
    };
    
    const deliveryWithUsers = {
      ...createdDelivery,
      sender: senderSafe as User,
      ...(carrierSafe && { carrier: carrierSafe as User }),
    } as unknown as DeliveryWithUser;
    
    // Log to verify OTPs are included
    console.log(`[MemStorage] getDeliveryWithUsers(${id}): Raw delivery:`, {
      pickupOtp: (delivery as any).pickupOtp,
      deliveryOtp: (delivery as any).deliveryOtp,
    });
    console.log(`[MemStorage] getDeliveryWithUsers(${id}): Final result - pickupOtp=${deliveryWithUsers.pickupOtp}, deliveryOtp=${deliveryWithUsers.deliveryOtp}`);
    
    return deliveryWithUsers;
  }
  
  async createDelivery(delivery: InsertDelivery): Promise<Delivery> {
    const id = this.deliveryId++;
    const now = new Date();
    const createdDelivery: Delivery = { 
      id, 
      senderId: delivery.senderId,
      carrierId: null,
      pickupLocation: delivery.pickupLocation,
      dropLocation: delivery.dropLocation,
      packageSize: delivery.packageSize,
      packageWeight: delivery.packageWeight,
      description: delivery.description ?? null,
      specialInstructions: delivery.specialInstructions ?? null,
      preferredDeliveryDate: delivery.preferredDeliveryDate,
      preferredDeliveryTime: delivery.preferredDeliveryTime,
      status: "requested", 
      deliveryFee: delivery.deliveryFee,
      createdAt: now,
      pickupOtp: null,
      deliveryOtp: null,
      cancellationReason: null,
      cancelledAt: null,
    };
    this.deliveriesData.set(id, createdDelivery);
    return createdDelivery;
  }
  
  async updateDeliveryStatus(id: number, status: string, carrierId?: number) {
    const delivery = this.deliveriesData.get(id);
    if (!delivery) return undefined;
    
    const updatedDelivery = {
      ...delivery,
      status: status as any,
      ...(carrierId && { carrierId }),
    };
    
    this.deliveriesData.set(id, updatedDelivery);
    return this.getDeliveryWithUsers(id);  // Full data instead of partial
  }
  

async updateDeliveryPickupOTP(id: number, otp: string): Promise<Delivery | undefined> {
    console.log(`[MemStorage] updateDeliveryPickupOTP: Starting - id=${id}, otp=${otp}`);
    const delivery = this.deliveriesData.get(id);
    if (delivery) {
      (delivery as any).pickupOtp = otp;
      this.deliveriesData.set(id, delivery);
      console.log(`[MemStorage] updateDeliveryPickupOTP: SUCCESS - Updated pickup OTP for delivery ${id}: ${otp}`);
      
      // Verify
      const verify = this.deliveriesData.get(id);
      console.log(`[MemStorage] updateDeliveryPickupOTP: Verification - delivery ${id} now has pickupOtp=${(verify as any)?.pickupOtp}`);
    } else {
      console.error(`[MemStorage] updateDeliveryPickupOTP: FAILED - Delivery ${id} not found`);
    }
  }

  async updateDeliveryDeliveryOTP(id: number, otp: string): Promise<void> {
    console.log(`[MemStorage] updateDeliveryDeliveryOTP: Starting - id=${id}, otp=${otp}`);
    const delivery = this.deliveriesData.get(id);
    if (delivery) {
      (delivery as any).deliveryOtp = otp;
      this.deliveriesData.set(id, delivery);
      console.log(`[MemStorage] updateDeliveryDeliveryOTP: SUCCESS - Updated delivery OTP for delivery ${id}: ${otp}`);
      
      // Verify
      const verify = this.deliveriesData.get(id);
      console.log(`[MemStorage] updateDeliveryDeliveryOTP: Verification - delivery ${id} now has deliveryOtp=${(verify as any)?.deliveryOtp}`);
    } else {
      console.error(`[MemStorage] updateDeliveryDeliveryOTP: FAILED - Delivery ${id} not found`);
    }
  }

  async cancelDelivery(id: number, reason: string) {
    const delivery = this.deliveriesData.get(id);
    if (!delivery) return;
    
    const updatedDelivery = {
      ...delivery,
      status: "cancelled" as any,
      cancellationReason: reason,
      cancelledAt: new Date(),
    };
    
    this.deliveriesData.set(id, updatedDelivery);
  }
  

  async updateDeliveryLocation(id: number, latitude: string, longitude: string): Promise<void> {
    if (!(this as any).deliveryLocationsData) {
      (this as any).deliveryLocationsData = new Map();
      (this as any).locationId = 1;
    }
    const locationId = (this as any).locationId++;
    (this as any).deliveryLocationsData.set(locationId, {
      id: locationId,
      deliveryId: id,
      latitude,
      longitude,
      timestamp: new Date(),
    });
  }

  async getDeliveryLocation(id: number): Promise<{ latitude: string; longitude: string; timestamp: string } | null> {
    if (!(this as any).deliveryLocationsData) return null;
    const locations = Array.from((this as any).deliveryLocationsData.values())
      .filter((loc: any) => loc.deliveryId === id)
      .sort((a: any, b: any) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeB - timeA;
      });
    if (locations.length === 0) return null;
    const latest = locations[0] as { latitude: string; longitude: string; timestamp: Date | string };
    return {
      latitude: latest.latitude,
      longitude: latest.longitude,
      timestamp: latest.timestamp instanceof Date ? latest.timestamp.toISOString() : String(latest.timestamp),
    };
  }
  
  async getSenderDeliveries(userId: number): Promise<DeliveryWithUser[]> {
    // Get all deliveries where the user is the sender
    const deliveries = Array.from(this.deliveriesData.values())
      .filter(d => d.senderId === userId)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    
    // Add sender and carrier info
    const normalized = deliveries.map(delivery => {
      const sender = this.usersData.get(delivery.senderId);
      const carrier = delivery.carrierId ? this.usersData.get(delivery.carrierId) : undefined;
      
      // Remove sensitive info from users
      const senderSafe = sender ? {
        id: sender.id,
        username: sender.username,
        fullName: sender.fullName,
        rating: sender.rating,
        totalReviews: sender.totalReviews,
        role: sender.role,
      } : undefined;
      
      const carrierSafe = carrier ? {
        id: carrier.id,
        username: carrier.username,
        fullName: carrier.fullName,
        rating: carrier.rating,
        totalReviews: carrier.totalReviews,
        role: carrier.role,
      } : undefined;
      
      const createdDelivery = {
        ...delivery,
        createdAt: typeof delivery.createdAt === "string" ? delivery.createdAt : (delivery.createdAt instanceof Date ? delivery.createdAt.toISOString() : new Date().toISOString()),
      };
      
      return {
        ...createdDelivery,
        sender: senderSafe as User ?? null,
        ...(carrierSafe && { carrier: carrierSafe as User }),
      };
    });

    return normalized as unknown as DeliveryWithUser[];
  }
  
  async getCarrierDeliveries(userId: number): Promise<DeliveryWithUser[]> {
    // Get all deliveries where the user is the carrier
    const deliveries = Array.from(this.deliveriesData.values())
      .filter(d => d.carrierId === userId)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    
    // Add sender and carrier info
    const normalized = deliveries.map(delivery => {
      const sender = this.usersData.get(delivery.senderId);
      const carrier = this.usersData.get(userId);
      
      // Remove sensitive info from users
      const senderSafe = sender ? {
        id: sender.id,
        username: sender.username,
        fullName: sender.fullName,
        rating: sender.rating,
        totalReviews: sender.totalReviews,
        role: sender.role,
      } : undefined;
      
      const carrierSafe = carrier ? {
        id: carrier.id,
        username: carrier.username,
        fullName: carrier.fullName,
        rating: carrier.rating,
        totalReviews: carrier.totalReviews,
        role: carrier.role,
      } : undefined;
      
      const createdDelivery = {
        ...delivery,
        createdAt: typeof delivery.createdAt === "string" ? delivery.createdAt : (delivery.createdAt instanceof Date ? delivery.createdAt.toISOString() : new Date().toISOString()),
      };
      
      return {
        ...createdDelivery,
        sender: senderSafe as User ?? null,
        ...(carrierSafe && { carrier: carrierSafe as User }),
      };
    });

    return normalized as unknown as DeliveryWithUser[];
  }
  
  // Review methods
  async createReview(review: InsertReview): Promise<Review> {
    const id = this.reviewId++;
    const now = new Date();
    const overallRating = Math.round((review.punctuality + review.communication + review.packageHandling) / 3);
    const createdReview: Review = { 
      id,
      deliveryId: review.deliveryId,
      reviewerId: review.reviewerId,
      revieweeId: review.revieweeId,
      rating: overallRating,
      punctuality: review.punctuality,
      communication: review.communication,
      packageHandling: review.packageHandling,
      comment: review.comment ?? null,
      createdAt: now,
    };
    this.reviewsData.set(id, createdReview);
    
    // Update user's rating
    await this.updateUserRating(review.revieweeId);
    
    return createdReview;
  }
  
  async getUserReviews(userId: number): Promise<(Review & { reviewer: Partial<User> })[]> {
    // Get all reviews for the user
    const userReviews = Array.from(this.reviewsData.values())
      .filter(r => r.revieweeId === userId)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    
    // Add reviewer info
    const normalized = userReviews.map(review => {
      const reviewer = this.usersData.get(review.reviewerId);
      
      // Safe reviewer info (without password)
      const reviewerSafe = reviewer ? {
        id: reviewer.id,
        username: reviewer.username,
        fullName: reviewer.fullName,
      } : undefined;
      
      return {
        ...{
          ...review,
          createdAt: typeof review.createdAt === "string" ? review.createdAt : (review.createdAt instanceof Date ? review.createdAt.toISOString() : new Date().toISOString()),
        },
        reviewer: reviewerSafe as Partial<User>,
      };
    });

    return normalized as unknown as (Review & { reviewer: Partial<User> })[];
  }
  
  async getReviewByDeliveryAndReviewer(deliveryId: number, reviewerId: number): Promise<Review | undefined> {
    return Array.from(this.reviewsData.values()).find(
      r => r.deliveryId === deliveryId && r.reviewerId === reviewerId
    );
  }

  // Message methods
  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.messageId++;
    const now = new Date();
    const createdMessage: Message = {
      id,
      deliveryId: message.deliveryId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      message: message.message,
      attachmentPath: message.attachmentPath ?? null,
      attachmentType: message.attachmentType ?? null,
      createdAt: now,
    };
    this.messagesData.set(id, createdMessage);
    return createdMessage;
  }

  async getMessagesByDelivery(deliveryId: number, userId: number): Promise<MessageWithSender[]> {
    // First verify user has access to this delivery
    const delivery = this.deliveriesData.get(deliveryId);
    if (!delivery) {
      throw new Error("Delivery not found");
    }
    
    // Verify user is either sender or carrier
    if (delivery.senderId !== userId && delivery.carrierId !== userId) {
      throw new Error("Unauthorized access to messages");
    }

    const deliveryMessages = Array.from(this.messagesData.values())
      .filter(m => m.deliveryId === deliveryId)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });

    return deliveryMessages.map(msg => {
      const sender = this.usersData.get(msg.senderId);
      return {
        ...msg,
        createdAt: typeof msg.createdAt === "string" 
          ? msg.createdAt 
          : (msg.createdAt instanceof Date ? msg.createdAt.toISOString() : new Date().toISOString()),
        sender: sender ? {
          id: sender.id,
          username: sender.username,
          fullName: sender.fullName,
        } : { id: msg.senderId, username: "Unknown", fullName: "Unknown" },
      } as unknown as MessageWithSender;
    });
  }
  
  // Helper method to recalculate and update a user's rating
  private async updateUserRating(userId: number) {
    const user = this.usersData.get(userId);
    if (!user) return;
    
    // Get all reviews for the user
    const userReviews = Array.from(this.reviewsData.values())
      .filter(r => r.revieweeId === userId);
    
    if (userReviews.length === 0) return;
    
    // Calculate average rating from overall ratings
    const totalRating = userReviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = Math.round(totalRating / userReviews.length);
    
    // Update user's rating and totalReviews
    const updatedUser = {
      ...user,
      rating: averageRating,
      totalReviews: userReviews.length,
    };
    
    this.usersData.set(userId, updatedUser);
  }

  // FCM methods
  async saveFcmToken(tokenData: InsertFcmToken): Promise<FcmToken> {
    // In-memory storage for FCM tokens
    if (!(this as any).fcmTokensData) {
      (this as any).fcmTokensData = new Map();
      (this as any).fcmTokenId = 1;
    }
    
    const existing = Array.from((this as any).fcmTokensData.values()).find(
      (t: any) => t.token === tokenData.token
    );
    
    if (existing) {
      (existing as any).userId = tokenData.userId;
      (existing as any).deviceInfo = tokenData.deviceInfo ?? null;
      (existing as any).updatedAt = new Date();
      return existing as FcmToken;
    } else {
      const newToken: FcmToken = {
        id: (this as any).fcmTokenId++,
        userId: tokenData.userId,
        token: tokenData.token,
        deviceInfo: tokenData.deviceInfo ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (this as any).fcmTokensData.set(newToken.id, newToken);
      return newToken;
    }
  }

  async sendNotification(userId: number, notification: { title: string; body: string; data?: any }): Promise<void> {
    // In-memory: just log for now
    console.log(`Sending notification to user ${userId}:`, notification);
    // In real implementation, would use FCM tokens stored in database
  }
}

// Using in-memory storage can cause session persistence issues
// export const storage = new MemStorage();

// Using database storage for persistent sessions
export const storage = new DatabaseStorage();
