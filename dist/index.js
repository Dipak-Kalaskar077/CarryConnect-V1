var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import dotenv2 from "dotenv";
import path3 from "path";
import { fileURLToPath } from "url";
import express2 from "express";
import cors from "cors";
import { createServer as createServer2 } from "http";
import { Server as SocketIOServer } from "socket.io";

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  createDeliverySchema: () => createDeliverySchema,
  deliveries: () => deliveries,
  deliveryLocations: () => deliveryLocations,
  deliveryStatusEnum: () => deliveryStatusEnum,
  fcmTokens: () => fcmTokens,
  insertDeliveryLocationSchema: () => insertDeliveryLocationSchema,
  insertDeliverySchema: () => insertDeliverySchema,
  insertFcmTokenSchema: () => insertFcmTokenSchema,
  insertMessageSchema: () => insertMessageSchema,
  insertReviewSchema: () => insertReviewSchema,
  insertUserSchema: () => insertUserSchema,
  locationSchema: () => locationSchema,
  messages: () => messages,
  packageSizeEnum: () => packageSizeEnum,
  reviews: () => reviews,
  userRoleEnum: () => userRoleEnum,
  users: () => users
});
import { pgTable, text, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var packageSizeEnum = pgEnum("package_size", ["small", "medium", "large"]);
var deliveryStatusEnum = pgEnum("delivery_status", ["requested", "accepted", "picked", "in-transit", "delivered", "cancelled"]);
var userRoleEnum = pgEnum("user_role", ["sender", "carrier", "both"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: userRoleEnum("role").notNull().default("both"),
  rating: integer("rating"),
  totalReviews: integer("total_reviews").default(0),
  phoneNumber: text("phone_number")
  // Phone number for contact
});
var deliveries = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  carrierId: integer("carrier_id").references(() => users.id),
  pickupLocation: text("pickup_location").notNull(),
  dropLocation: text("drop_location").notNull(),
  packageSize: packageSizeEnum("package_size").notNull(),
  packageWeight: integer("package_weight").notNull(),
  // weight in grams
  description: text("description"),
  specialInstructions: text("special_instructions"),
  preferredDeliveryDate: text("preferred_delivery_date").notNull(),
  preferredDeliveryTime: text("preferred_delivery_time").notNull(),
  status: deliveryStatusEnum("status").notNull().default("requested"),
  deliveryFee: integer("delivery_fee").notNull(),
  // fee in cents
  pickupOtp: text("pickupOtp"),
  // OTP for pickup confirmation
  deliveryOtp: text("deliveryOtp"),
  // OTP for delivery confirmation
  cancellationReason: text("cancellation_reason"),
  // Reason for cancellation
  cancelledAt: timestamp("cancelled_at"),
  // When delivery was cancelled
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").references(() => deliveries.id).notNull(),
  reviewerId: integer("reviewer_id").references(() => users.id).notNull(),
  revieweeId: integer("reviewee_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  // Overall rating (computed from metrics)
  punctuality: integer("punctuality").notNull(),
  // 1-5 rating
  communication: integer("communication").notNull(),
  // 1-5 rating
  packageHandling: integer("package_handling").notNull(),
  // 1-5 rating
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").references(() => deliveries.id).notNull(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  attachmentPath: text("attachment_path"),
  // Path to attached file
  attachmentType: text("attachment_type"),
  // e.g., 'image/jpeg', 'image/png'
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  rating: true,
  totalReviews: true
}).extend({
  phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits").optional().nullable()
});
var insertDeliverySchema = createInsertSchema(deliveries).omit({
  id: true,
  carrierId: true,
  status: true,
  createdAt: true
});
var insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true
}).extend({
  punctuality: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  packageHandling: z.number().int().min(1).max(5),
  rating: z.number().int().min(1).max(5).optional()
  // Will be computed
});
var insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true
});
var fcmTokens = pgTable("fcm_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  deviceInfo: text("device_info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertFcmTokenSchema = createInsertSchema(fcmTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var deliveryLocations = pgTable("delivery_locations", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").references(() => deliveries.id).notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull()
});
var insertDeliveryLocationSchema = createInsertSchema(deliveryLocations).omit({
  id: true,
  timestamp: true
});
var locationSchema = z.object({
  name: z.string().min(1, "Location is required")
});
var createDeliverySchema = insertDeliverySchema.omit({
  senderId: true
  // Omit senderId from base schema - it will be added by server
}).extend({
  senderId: z.number().int().optional(),
  // Optional for client, server will add it
  packageWeight: z.number().min(1, "Weight must be at least 1 gram"),
  deliveryFee: z.number().min(1, "Fee must be at least 1 cent"),
  pickupLocation: z.string().min(1, "Pickup location is required"),
  dropLocation: z.string().min(1, "Drop location is required"),
  packageSize: z.enum(["small", "medium", "large"]),
  description: z.string().optional().nullable(),
  specialInstructions: z.string().optional().nullable()
});

// server/db.ts
import dotenv from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
dotenv.config();
neonConfig.webSocketConstructor = ws;
var connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Cannot initialize database."
  );
}
var pool = new Pool({ connectionString });
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { eq, and, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import createMemoryStore from "memorystore";
import session from "express-session";
var MemoryStore = createMemoryStore(session);
function normalizeDeliveryWithSenderCarrier(raw) {
  if (raw.delivery && raw.delivery.createdAt instanceof Date) {
    raw.delivery = { ...raw.delivery, createdAt: raw.delivery.createdAt.toISOString() };
  } else if (raw.delivery && typeof raw.delivery.createdAt === "string") {
  } else if (raw.createdAt instanceof Date) {
    raw.createdAt = raw.createdAt.toISOString();
  }
  if (raw.delivery) {
    normalizeDeliveryObject(raw.delivery);
  }
  if (raw.sender) {
    const s = raw.sender;
    raw.sender = {
      id: s.id,
      username: s.username,
      fullName: s.fullName,
      rating: s.rating ?? null,
      totalReviews: s.totalReviews ?? null,
      // keep role if present, otherwise undefined
      role: s.role
    };
  } else {
    raw.sender = null;
  }
  if (raw.carrier) {
    const c = raw.carrier;
    raw.carrier = {
      id: c.id,
      username: c.username,
      fullName: c.fullName,
      rating: c.rating ?? null,
      totalReviews: c.totalReviews ?? null,
      role: c.role
    };
  } else {
    delete raw.carrier;
  }
  return raw;
}
function normalizeDeliveryObject(delivery) {
  if (!delivery) return delivery;
  console.log(`[normalizeDeliveryObject] Before normalization:`, {
    pickupOtp: delivery.pickupOtp,
    pickup_otp: delivery.pickup_otp,
    deliveryOtp: delivery.deliveryOtp,
    delivery_otp: delivery.delivery_otp,
    allKeys: Object.keys(delivery)
  });
  if (delivery.pickup_otp !== void 0 && delivery.pickupOtp === void 0) {
    delivery.pickupOtp = delivery.pickup_otp;
    delete delivery.pickup_otp;
  }
  if (delivery.delivery_otp !== void 0 && delivery.deliveryOtp === void 0) {
    delivery.deliveryOtp = delivery.delivery_otp;
    delete delivery.delivery_otp;
  }
  console.log(`[normalizeDeliveryObject] After normalization:`, {
    pickupOtp: delivery.pickupOtp,
    deliveryOtp: delivery.deliveryOtp
  });
  return delivery;
}
function normalizeReviewObject(review) {
  if (!review) return review;
  if (review.createdAt instanceof Date) {
    review.createdAt = review.createdAt.toISOString();
  }
  return review;
}
function generateOtp() {
  return Math.floor(1e5 + Math.random() * 9e5).toString();
}
var DatabaseStorage = class {
  sessionStore;
  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 864e5
      // prune expired entries every 24h
    });
  }
  // User methods
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async getUserProfile(userId) {
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      rating: users.rating,
      totalReviews: users.totalReviews
    }).from(users).where(eq(users.id, userId));
    return user;
  }
  // Delivery methods
  async getDeliveriesWithFilters(filters) {
    let query = db.select({
      delivery: deliveries,
      sender: {
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        rating: users.rating,
        totalReviews: users.totalReviews
      }
    }).from(deliveries).leftJoin(users, eq(deliveries.senderId, users.id)).orderBy(desc(deliveries.createdAt));
    const conditions = [];
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
      query = query.where(and(...conditions));
    }
    const results = await query;
    const normalized = results.map(({ delivery, sender }) => {
      const item = { delivery, sender };
      const normalizedItem = normalizeDeliveryWithSenderCarrier(item);
      return {
        ...normalizedItem.delivery,
        sender: normalizedItem.sender
      };
    });
    return normalized;
  }
  async getDeliveryById(id) {
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, id));
    if (delivery) {
      normalizeDeliveryObject(delivery);
    }
    return delivery;
  }
  // New method to return full delivery with sender + carrier + OTP fields
  async getDeliveryWithUsers(id) {
    const senderUser = alias(users, "sender_user");
    const carrierUser = alias(users, "carrier_user");
    const [result] = await db.select({
      delivery: deliveries,
      sender: {
        id: senderUser.id,
        username: senderUser.username,
        fullName: senderUser.fullName,
        rating: senderUser.rating,
        totalReviews: senderUser.totalReviews,
        phoneNumber: senderUser.phoneNumber,
        role: senderUser.role
      },
      carrier: {
        id: carrierUser.id,
        username: carrierUser.username,
        fullName: carrierUser.fullName,
        rating: carrierUser.rating,
        totalReviews: carrierUser.totalReviews,
        phoneNumber: carrierUser.phoneNumber,
        role: carrierUser.role
      }
    }).from(deliveries).leftJoin(senderUser, eq(deliveries.senderId, senderUser.id)).leftJoin(carrierUser, eq(deliveries.carrierId, carrierUser.id)).where(eq(deliveries.id, id));
    if (!result) {
      console.log(`[DatabaseStorage] getDeliveryWithUsers(${id}): No result found`);
      return void 0;
    }
    console.log(`[DatabaseStorage] getDeliveryWithUsers(${id}): Raw result from DB:`, {
      deliveryId: result.delivery?.id,
      pickupOtp: result.delivery?.pickupOtp,
      pickup_otp: result.delivery?.pickup_otp,
      deliveryOtp: result.delivery?.deliveryOtp,
      delivery_otp: result.delivery?.delivery_otp,
      status: result.delivery?.status
    });
    const normalized = normalizeDeliveryWithSenderCarrier(result);
    console.log(`[DatabaseStorage] getDeliveryWithUsers(${id}): After normalization:`, {
      pickupOtp: normalized.delivery?.pickupOtp,
      deliveryOtp: normalized.delivery?.deliveryOtp
    });
    const deliveryWithUsers = {
      ...normalized.delivery,
      sender: normalized.sender,
      carrier: normalized.carrier
    };
    console.log(`[DatabaseStorage] getDeliveryWithUsers(${id}): Final result - pickupOtp=${deliveryWithUsers.pickupOtp}, deliveryOtp=${deliveryWithUsers.deliveryOtp}`);
    return deliveryWithUsers;
  }
  async createDelivery(delivery) {
    const [createdDelivery] = await db.insert(deliveries).values(delivery).returning();
    normalizeDeliveryObject(createdDelivery);
    return createdDelivery;
  }
  async updateDeliveryStatus(id, status, carrierId) {
    const updateValues = { status };
    if (carrierId) updateValues.carrierId = carrierId;
    if (status === "picked") {
      updateValues.pickupOtp = generateOtp();
    }
    if (status === "delivered") {
      updateValues.deliveryOtp = generateOtp();
    }
    const [updated] = await db.update(deliveries).set(updateValues).where(eq(deliveries.id, id)).returning();
    if (!updated) return void 0;
    return this.getDeliveryWithUsers(id);
  }
  async updateDeliveryPickupOTP(id, otp) {
    const [updated] = await db.update(deliveries).set({ pickupOtp: otp }).where(eq(deliveries.id, id)).returning();
    if (!updated) {
      console.error(`[DatabaseStorage] updateDeliveryPickupOTP FAILED for ${id}`);
      return void 0;
    }
    return this.getDeliveryWithUsers(id);
  }
  async updateDeliveryDeliveryOTP(id, otp) {
    console.log(`[DatabaseStorage] updateDeliveryDeliveryOTP: Starting - deliveryId=${id}, otp=${otp}`);
    const [updated] = await db.update(deliveries).set({ deliveryOtp: otp }).where(eq(deliveries.id, id)).returning();
    if (!updated) {
      console.error(`[DatabaseStorage] updateDeliveryDeliveryOTP: FAILED - No rows updated for deliveryId=${id}`);
      return void 0;
    }
    console.log(`[DatabaseStorage] updateDeliveryDeliveryOTP: SUCCESS - Updated delivery OTP for delivery ${id}`);
    return this.getDeliveryWithUsers(id);
  }
  async cancelDelivery(id, reason) {
    const [cancelledDelivery] = await db.update(deliveries).set({
      status: "cancelled",
      cancellationReason: reason,
      cancelledAt: /* @__PURE__ */ new Date()
    }).where(eq(deliveries.id, id)).returning();
    return this.getDeliveryWithUsers(id);
  }
  async updateDeliveryLocation(id, latitude, longitude) {
    await db.insert(deliveryLocations).values({
      deliveryId: id,
      latitude,
      longitude
    });
  }
  async getDeliveryLocation(id) {
    const [location] = await db.select().from(deliveryLocations).where(eq(deliveryLocations.deliveryId, id)).orderBy(desc(deliveryLocations.timestamp)).limit(1);
    if (!location) return null;
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: location.timestamp instanceof Date ? location.timestamp.toISOString() : typeof location.timestamp === "string" ? location.timestamp : (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async getSenderDeliveries(userId) {
    const results = await db.select({
      delivery: deliveries,
      carrier: {
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        rating: users.rating,
        totalReviews: users.totalReviews
      }
    }).from(deliveries).leftJoin(users, eq(deliveries.carrierId, users.id)).where(eq(deliveries.senderId, userId)).orderBy(desc(deliveries.createdAt));
    const normalized = results.map(({ delivery, carrier }) => {
      const item = { delivery, sender: null, carrier };
      const normalizedItem = normalizeDeliveryWithSenderCarrier(item);
      const senderMinimal = { id: userId };
      return {
        ...normalizedItem.delivery,
        sender: senderMinimal,
        carrier: normalizedItem.carrier ? normalizedItem.carrier : void 0
      };
    });
    return normalized;
  }
  async getCarrierDeliveries(userId) {
    const results = await db.select({
      delivery: deliveries,
      sender: {
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        rating: users.rating,
        totalReviews: users.totalReviews
      }
    }).from(deliveries).leftJoin(users, eq(deliveries.senderId, users.id)).where(eq(deliveries.carrierId, userId)).orderBy(desc(deliveries.createdAt));
    const normalized = results.map(({ delivery, sender }) => {
      const item = { delivery, sender, carrier: null };
      const normalizedItem = normalizeDeliveryWithSenderCarrier(item);
      const carrierMinimal = { id: userId };
      return {
        ...normalizedItem.delivery,
        sender: normalizedItem.sender,
        carrier: carrierMinimal
      };
    });
    return normalized;
  }
  // Review methods
  async createReview(review) {
    const reviewWithRating = {
      ...review,
      rating: review.rating || Math.round((review.punctuality + review.communication + review.packageHandling) / 3)
    };
    const [createdReview] = await db.transaction(async (tx) => {
      const [newReview] = await tx.insert(reviews).values(reviewWithRating).returning();
      await this.updateUserRating(tx, review.revieweeId);
      return [newReview];
    });
    normalizeReviewObject(createdReview);
    return createdReview;
  }
  async getUserReviews(userId) {
    const reviewsWithReviewers = await db.select({
      review: reviews,
      reviewer: {
        id: users.id,
        username: users.username,
        fullName: users.fullName
      }
    }).from(reviews).leftJoin(users, eq(reviews.reviewerId, users.id)).where(eq(reviews.revieweeId, userId)).orderBy(desc(reviews.createdAt));
    const normalized = reviewsWithReviewers.map(({ review, reviewer }) => {
      const r = normalizeReviewObject(review);
      return {
        ...r,
        reviewer: reviewer ? {
          id: reviewer.id,
          username: reviewer.username,
          fullName: reviewer.fullName
        } : void 0
      };
    });
    return normalized;
  }
  async getReviewByDeliveryAndReviewer(deliveryId, reviewerId) {
    const [review] = await db.select().from(reviews).where(
      and(
        eq(reviews.deliveryId, deliveryId),
        eq(reviews.reviewerId, reviewerId)
      )
    );
    if (review) normalizeReviewObject(review);
    return review;
  }
  // Helper method to recalculate and update a user's rating
  async updateUserRating(tx, userId) {
    const ratingResult = await tx.select({
      averageRating: sql`AVG(${reviews.rating})`,
      totalReviews: sql`COUNT(*)`
    }).from(reviews).where(eq(reviews.revieweeId, userId));
    if (ratingResult.length > 0) {
      const { averageRating, totalReviews } = ratingResult[0];
      await tx.update(users).set({
        rating: Math.round(averageRating),
        totalReviews
      }).where(eq(users.id, userId));
    }
  }
  // Message methods
  async createMessage(message) {
    const [createdMessage] = await db.insert(messages).values(message).returning();
    return createdMessage;
  }
  async getMessagesByDelivery(deliveryId, userId) {
    const delivery = await this.getDeliveryById(deliveryId);
    if (!delivery) {
      throw new Error("Delivery not found");
    }
    if (delivery.senderId !== userId && delivery.carrierId !== userId) {
      throw new Error("Unauthorized access to messages");
    }
    const results = await db.select({
      message: messages,
      sender: {
        id: users.id,
        username: users.username,
        fullName: users.fullName
      }
    }).from(messages).leftJoin(users, eq(messages.senderId, users.id)).where(eq(messages.deliveryId, deliveryId)).orderBy(messages.createdAt);
    return results.map(({ message, sender }) => {
      const normalizedMessage = {
        ...message,
        createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt
      };
      return {
        ...normalizedMessage,
        sender: sender || { id: message.senderId, username: "Unknown", fullName: "Unknown" }
      };
    });
  }
  // FCM methods
  async saveFcmToken(tokenData) {
    const [existing] = await db.select().from(fcmTokens).where(eq(fcmTokens.token, tokenData.token));
    if (existing) {
      const [updated] = await db.update(fcmTokens).set({
        userId: tokenData.userId,
        deviceInfo: tokenData.deviceInfo,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(fcmTokens.id, existing.id)).returning();
      return updated;
    } else {
      const [created] = await db.insert(fcmTokens).values(tokenData).returning();
      return created;
    }
  }
  async sendNotification(userId, notification) {
    const tokens = await db.select().from(fcmTokens).where(eq(fcmTokens.userId, userId));
    if (tokens.length === 0) {
      return;
    }
    console.log(`Sending notification to user ${userId}:`, notification);
    console.log(`Tokens:`, tokens.map((t) => t.token));
  }
};
var storage = new DatabaseStorage();

// server/auth.ts
import { z as z2, ZodError } from "zod";
var scryptAsync = promisify(scrypt);
var loginSchema = z2.object({
  username: z2.string().min(1, "Username is required"),
  password: z2.string().min(1, "Password is required")
});
var registerRequestSchema = insertUserSchema.extend({
  password: z2.string().min(6, "Password must be at least 6 characters"),
  terms: z2.boolean().optional(),
  phoneNumber: z2.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits").optional().nullable()
}).strict();
var formatZodError = (error) => error.errors.map((err) => ({
  path: err.path.join("."),
  message: err.message
}));
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function setupAuth(app2) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "carryconnect-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1e3 * 60 * 60 * 24 * 7,
      // 1 week
      secure: process.env.NODE_ENV === "production"
    }
  };
  app2.set("trust proxy", 1);
  app2.use(session2(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !await comparePasswords(password, user.password)) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    })
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user ?? void 0);
    } catch (err) {
      done(err);
    }
  });
  app2.post("/api/register", async (req, res, next) => {
    try {
      const parsedBody = registerRequestSchema.parse(req.body);
      const { terms: _terms, ...userInput } = parsedBody;
      const existingUser = await storage.getUserByUsername(userInput.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createUser({
        ...userInput,
        password: await hashPassword(userInput.password)
      });
      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: formatZodError(error)
        });
      }
      next(error);
    }
  });
  app2.post("/api/login", async (req, res, next) => {
    try {
      const parsedBody = loginSchema.parse(req.body);
      passport.authenticate("local", (err, user) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.status(401).json({ message: "Invalid username or password" });
        }
        req.login(user, (loginErr) => {
          if (loginErr) {
            return next(loginErr);
          }
          const { password, ...userWithoutPassword } = user;
          res.status(200).json(userWithoutPassword);
        });
      })(req, res, next);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: formatZodError(error)
        });
      }
      next(error);
    }
  });
  app2.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user;
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });
}

// server/routes.ts
import { createServer } from "http";
import { ZodError as ZodError2 } from "zod";
import { randomInt } from "crypto";
var isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
var formatZodError2 = (error) => {
  return error.errors.map((err) => ({
    path: err.path.join("."),
    message: err.message
  }));
};
function generateOTP() {
  return randomInt(1e3, 999999).toString().padStart(6, "0");
}
async function registerRoutes(app2) {
  setupAuth(app2);
  app2.get("/api/deliveries", async (req, res) => {
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
      const filters = {};
      if (status && status !== "any") filters.status = status;
      if (pickupLocation && pickupLocation !== "any") filters.pickupLocation = pickupLocation;
      if (dropLocation && dropLocation !== "any") filters.dropLocation = dropLocation;
      if (packageSize && packageSize !== "any") filters.packageSize = packageSize;
      if (minWeight) filters.minWeight = parseInt(minWeight);
      if (maxWeight) filters.maxWeight = parseInt(maxWeight);
      if (minFee) filters.minFee = parseInt(minFee);
      if (maxFee) filters.maxFee = parseInt(maxFee);
      if (minRating) filters.minRating = parseInt(minRating);
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      const deliveries2 = await storage.getDeliveriesWithFilters(filters);
      res.json(deliveries2);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      res.status(500).json({ message: "Failed to fetch deliveries" });
    }
  });
  app2.get("/api/deliveries/:id", async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }
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
  app2.post("/api/deliveries", isAuthenticated, async (req, res) => {
    try {
      const parsedData = createDeliverySchema.parse(req.body);
      const deliveryData = {
        ...parsedData,
        senderId: req.user.id
        // Always set from authenticated user
      };
      const delivery = await storage.createDelivery(deliveryData);
      res.status(201).json(delivery);
    } catch (error) {
      if (error instanceof ZodError2) {
        return res.status(400).json({
          message: "Please check all required fields and try again",
          errors: formatZodError2(error)
        });
      }
      console.error("Error creating delivery:", error);
      res.status(500).json({ message: "Unable to create delivery. Please try again later" });
    }
  });
  app2.patch("/api/deliveries/:id/status", isAuthenticated, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      const { status, otp } = req.body;
      if (isNaN(deliveryId)) return res.status(400).json({ message: "Invalid delivery ID" });
      if (!Object.values(deliveryStatusEnum.enumValues).includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const delivery = await storage.getDeliveryById(deliveryId);
      if (!delivery) return res.status(404).json({ message: "Delivery not found" });
      const isSender = req.user.id === delivery.senderId;
      const isCarrier = req.user.id === delivery.carrierId;
      if (status === "accepted") {
        if (delivery.carrierId !== null) {
          return res.status(400).json({ message: "This delivery has already been accepted by someone else" });
        }
        if (isSender) return res.status(403).json({ message: "You cannot accept your own delivery" });
        const pickupOtp = generateOTP();
        const deliveryOtp = generateOTP();
        await storage.updateDeliveryPickupOTP(deliveryId, pickupOtp);
        await storage.updateDeliveryDeliveryOTP(deliveryId, deliveryOtp);
        await storage.updateDeliveryStatus(deliveryId, "accepted", req.user.id);
      }
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
      const updatedDelivery = await storage.updateDeliveryStatus(deliveryId, status);
      console.log("[Routes] Updated:", updatedDelivery);
      res.json(updatedDelivery);
    } catch (err) {
      console.error("Error updating status:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/deliveries/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }
      const { cancellationReason } = req.body;
      if (!cancellationReason || typeof cancellationReason !== "string" || cancellationReason.trim().length < 10) {
        return res.status(400).json({ message: "Cancellation reason is required and must be at least 10 characters" });
      }
      const delivery = await storage.getDeliveryById(deliveryId);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }
      const isSender = req.user.id === delivery.senderId;
      if (!isSender) {
        return res.status(403).json({ message: "Only the sender can cancel the delivery" });
      }
      if (delivery.status === "delivered" || delivery.status === "in-transit") {
        return res.status(400).json({ message: "You cannot cancel the delivery after it is in transit" });
      }
      if (delivery.status === "cancelled") {
        return res.status(400).json({ message: "Delivery is already cancelled" });
      }
      await storage.cancelDelivery(deliveryId, cancellationReason.trim());
      if (delivery.carrierId) {
        await storage.sendNotification(delivery.carrierId, {
          title: "Delivery Cancelled",
          body: `The sender has cancelled this delivery.
Reason: ${cancellationReason.trim()}`,
          data: { deliveryId, type: "delivery_cancelled" }
        });
      }
      const cancelledDelivery = await storage.getDeliveryWithUsers(deliveryId);
      res.json(cancelledDelivery || { message: "Delivery cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling delivery:", error);
      res.status(500).json({ message: "Failed to cancel delivery" });
    }
  });
  app2.post("/api/deliveries/:id/validate-otp", isAuthenticated, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }
      const { otp, type = "pickup" } = req.body;
      if (!otp || typeof otp !== "string") {
        return res.status(400).json({ message: "OTP is required" });
      }
      const delivery = await storage.getDeliveryById(deliveryId);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }
      const isCarrier = delivery.carrierId != null && req.user.id === delivery.carrierId;
      if (!isCarrier) {
        return res.status(403).json({ message: "Only the carrier can validate OTP" });
      }
      const expectedOTP = type === "delivery" ? delivery.deliveryOtp : delivery.pickupOtp;
      if (!expectedOTP || expectedOTP !== otp) {
        return res.status(400).json({ message: "Invalid OTP entered" });
      }
      res.json({ valid: true });
    } catch (error) {
      console.error("Error validating OTP:", error);
      res.status(500).json({ message: "Failed to validate OTP" });
    }
  });
  app2.get("/api/user/deliveries/sender", isAuthenticated, async (req, res) => {
    try {
      const deliveries2 = await storage.getSenderDeliveries(req.user.id);
      res.json(deliveries2);
    } catch (error) {
      console.error("Error fetching sender deliveries:", error);
      res.status(500).json({ message: "Failed to fetch sender deliveries" });
    }
  });
  app2.get("/api/user/deliveries/carrier", isAuthenticated, async (req, res) => {
    try {
      const deliveries2 = await storage.getCarrierDeliveries(req.user.id);
      res.json(deliveries2);
    } catch (error) {
      console.error("Error fetching carrier deliveries:", error);
      res.status(500).json({ message: "Failed to fetch carrier deliveries" });
    }
  });
  app2.post("/api/reviews", isAuthenticated, async (req, res) => {
    try {
      const reviewData = insertReviewSchema.parse({
        ...req.body,
        reviewerId: req.user.id
      });
      const delivery = await storage.getDeliveryById(reviewData.deliveryId);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }
      if (delivery.status !== "delivered") {
        return res.status(400).json({ message: "Can only review completed deliveries" });
      }
      const isCarrier = req.user.id === delivery.carrierId;
      const isSender = req.user.id === delivery.senderId;
      if (!isCarrier && !isSender) {
        return res.status(403).json({ message: "Only participants in the delivery can leave reviews" });
      }
      if (reviewData.revieweeId !== (isSender ? delivery.carrierId : delivery.senderId)) {
        return res.status(400).json({ message: "Invalid reviewee" });
      }
      const existingReview = await storage.getReviewByDeliveryAndReviewer(
        reviewData.deliveryId,
        req.user.id
      );
      if (existingReview) {
        return res.status(400).json({ message: "You have already reviewed this delivery" });
      }
      const overallRating = Math.round(
        (reviewData.punctuality + reviewData.communication + reviewData.packageHandling) / 3
      );
      const review = await storage.createReview({
        ...reviewData,
        rating: overallRating
      });
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof ZodError2) {
        return res.status(400).json({
          message: "Validation error",
          errors: formatZodError2(error)
        });
      }
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });
  app2.get("/api/users/:id/reviews", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const reviews2 = await storage.getUserReviews(userId);
      res.json(reviews2);
    } catch (error) {
      console.error("Error fetching user reviews:", error);
      res.status(500).json({ message: "Failed to fetch user reviews" });
    }
  });
  app2.get("/api/users/:id/profile", async (req, res) => {
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
  app2.get("/api/deliveries/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }
      const messages2 = await storage.getMessagesByDelivery(deliveryId, req.user.id);
      res.json(messages2);
    } catch (error) {
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
  app2.post("/api/deliveries/:id/upload", isAuthenticated, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }
      const mockPath = `/uploads/delivery-${deliveryId}-${Date.now()}.jpg`;
      res.json({ path: mockPath, success: true });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });
  app2.post("/api/fcm/token", isAuthenticated, async (req, res) => {
    try {
      const { token, deviceInfo } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Token is required" });
      }
      await storage.saveFcmToken({
        userId: req.user.id,
        token,
        deviceInfo: deviceInfo || null
      });
      res.status(201).json({ message: "Token saved successfully" });
    } catch (error) {
      console.error("Error saving FCM token:", error);
      res.status(500).json({ message: "Failed to save FCM token" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/chat.ts
import session3 from "express-session";
var socketSessions = /* @__PURE__ */ new Map();
function setupChat(io, sessionMiddleware) {
  io.use(async (socket, next) => {
    const req = socket.request;
    const sessionMiddlewareFunc = session3(sessionMiddleware);
    sessionMiddlewareFunc(req, {}, async () => {
      if (req.session?.passport?.user) {
        const userId = req.session.passport.user;
        const user = await storage.getUser(userId);
        if (user) {
          socket.userId = userId;
          socket.user = user;
          return next();
        }
      }
      next(new Error("Unauthorized"));
    });
  });
  io.on("connection", (socket) => {
    const userId = socket.userId;
    const socketId = socket.id;
    socketSessions.set(socketId, { userId });
    socket.on("joinChat", async (data) => {
      try {
        const { deliveryId } = data;
        if (!deliveryId || typeof deliveryId !== "number") {
          socket.emit("error", { message: "Invalid delivery ID" });
          return;
        }
        const delivery = await storage.getDeliveryById(deliveryId);
        if (!delivery) {
          socket.emit("error", { message: "Delivery not found" });
          return;
        }
        if (delivery.senderId !== userId && delivery.carrierId !== userId) {
          socket.emit("error", { message: "Unauthorized access to chat" });
          return;
        }
        if (delivery.status === "requested") {
          socket.emit("error", { message: "Chat is only available after delivery is accepted" });
          return;
        }
        const roomName = `delivery-${deliveryId}`;
        socket.join(roomName);
        socketSessions.set(socketId, { userId, deliveryId });
        socket.emit("joinedChat", { deliveryId });
      } catch (error) {
        console.error("Error joining chat:", error);
        socket.emit("error", { message: error.message || "Failed to join chat" });
      }
    });
    socket.on("sendMessage", async (data) => {
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
        const delivery = await storage.getDeliveryById(deliveryId);
        if (!delivery) {
          socket.emit("error", { message: "Delivery not found" });
          return;
        }
        if (delivery.senderId !== userId && delivery.carrierId !== userId) {
          socket.emit("error", { message: "Unauthorized access to chat" });
          return;
        }
        if (delivery.status === "requested") {
          socket.emit("error", { message: "Chat is only available after delivery is accepted" });
          return;
        }
        const receiverId = delivery.senderId === userId ? delivery.carrierId : delivery.senderId;
        if (!receiverId) {
          socket.emit("error", { message: "Receiver not found" });
          return;
        }
        const savedMessage = await storage.createMessage({
          deliveryId,
          senderId: userId,
          receiverId,
          message: message ? message.trim() : "",
          attachmentPath: attachmentPath || null,
          attachmentType: attachmentType || null
        });
        const sender = await storage.getUser(userId);
        const messageWithSender = {
          ...savedMessage,
          createdAt: savedMessage.createdAt instanceof Date ? savedMessage.createdAt.toISOString() : typeof savedMessage.createdAt === "string" ? savedMessage.createdAt : (/* @__PURE__ */ new Date()).toISOString(),
          sender: sender ? {
            id: sender.id,
            username: sender.username,
            fullName: sender.fullName
          } : {
            id: userId,
            username: "Unknown",
            fullName: "Unknown"
          }
        };
        const roomName = `delivery-${deliveryId}`;
        io.to(roomName).emit("receiveMessage", messageWithSender);
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: error.message || "Failed to send message" });
      }
    });
    socket.on("disconnect", () => {
      socketSessions.delete(socketId);
    });
  });
}

// server/index.ts
dotenv2.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path3.dirname(__filename);
var serviceAccountPath = path3.join(__dirname, "firebase-service-account.json");
var app = express2();
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true
  })
);
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
setupAuth(app);
app.use((req, res, next) => {
  const start = Date.now();
  const path4 = req.path;
  let capturedJsonResponse;
  const originalJson = res.json;
  res.json = function(body, ...args) {
    capturedJsonResponse = body;
    return originalJson.apply(res, [body, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path4.startsWith("/api")) {
      let out = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) out += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (out.length > 100) out = out.slice(0, 99) + "\u2026";
      log(out);
    }
  });
  next();
});
(async () => {
  const httpServer = createServer2(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"]
    }
  });
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "carryconnect-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1e3 * 60 * 60 * 24 * 7,
      // 1 week
      secure: process.env.NODE_ENV === "production"
    }
  };
  setupChat(io, sessionSettings);
  await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
  });
  if (app.get("env") === "development") {
    await setupVite(app, httpServer);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  httpServer.listen(port, "0.0.0.0", () => log(`serving on port ${port}`));
})();
