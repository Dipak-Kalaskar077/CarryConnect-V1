var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  createDeliverySchema: () => createDeliverySchema,
  deliveries: () => deliveries,
  deliveryStatusEnum: () => deliveryStatusEnum,
  insertDeliverySchema: () => insertDeliverySchema,
  insertReviewSchema: () => insertReviewSchema,
  insertUserSchema: () => insertUserSchema,
  locationSchema: () => locationSchema,
  packageSizeEnum: () => packageSizeEnum,
  reviews: () => reviews,
  userRoleEnum: () => userRoleEnum,
  users: () => users
});
import { pgTable, text, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var packageSizeEnum = pgEnum("package_size", ["small", "medium", "large"]);
var deliveryStatusEnum = pgEnum("delivery_status", ["requested", "accepted", "picked", "delivered"]);
var userRoleEnum = pgEnum("user_role", ["sender", "carrier", "both"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: userRoleEnum("role").notNull().default("both"),
  rating: integer("rating"),
  totalReviews: integer("total_reviews").default(0)
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
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").references(() => deliveries.id).notNull(),
  reviewerId: integer("reviewer_id").references(() => users.id).notNull(),
  revieweeId: integer("reviewee_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  rating: true,
  totalReviews: true
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
});
var locationSchema = z.object({
  name: z.string().min(1, "Location is required")
});
var createDeliverySchema = insertDeliverySchema.extend({
  packageWeight: z.number().min(1, "Weight must be at least 1 gram"),
  deliveryFee: z.number().min(1, "Fee must be at least 1 cent"),
  pickupLocation: z.string().min(1, "Pickup location is required"),
  dropLocation: z.string().min(1, "Drop location is required"),
  packageSize: z.enum(["small", "medium", "large"])
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
var connectionString = process.env.DATABASE_URL;
var isDatabaseConfigured = Boolean(connectionString);
var pool = connectionString ? new Pool({ connectionString }) : void 0;
var db = connectionString ? drizzle(pool, { schema: schema_exports }) : void 0;

// server/storage.ts
import { eq, and, desc, sql } from "drizzle-orm";
import createMemoryStore from "memorystore";
import session from "express-session";
var MemoryStore = createMemoryStore(session);
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
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    const results = await query;
    return results.map(({ delivery, sender }) => ({
      ...delivery,
      sender
    }));
  }
  async getDeliveryById(id) {
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, id));
    return delivery;
  }
  async createDelivery(delivery) {
    const [createdDelivery] = await db.insert(deliveries).values(delivery).returning();
    return createdDelivery;
  }
  async updateDeliveryStatus(id, status, carrierId) {
    const updateValues = { status };
    if (carrierId) {
      updateValues.carrierId = carrierId;
    }
    const [updatedDelivery] = await db.update(deliveries).set(updateValues).where(eq(deliveries.id, id)).returning();
    return updatedDelivery;
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
    return results.map(({ delivery, carrier }) => ({
      ...delivery,
      sender: { id: userId },
      // Set minimal sender info
      carrier: carrier?.id ? carrier : void 0
    }));
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
    return results.map(({ delivery, sender }) => ({
      ...delivery,
      sender,
      carrier: { id: userId }
      // Set minimal carrier info
    }));
  }
  // Review methods
  async createReview(review) {
    const [createdReview] = await db.transaction(async (tx) => {
      const [newReview] = await tx.insert(reviews).values(review).returning();
      await this.updateUserRating(tx, review.revieweeId);
      return [newReview];
    });
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
    return reviewsWithReviewers.map(({ review, reviewer }) => ({
      ...review,
      reviewer
    }));
  }
  async getReviewByDeliveryAndReviewer(deliveryId, reviewerId) {
    const [review] = await db.select().from(reviews).where(
      and(
        eq(reviews.deliveryId, deliveryId),
        eq(reviews.reviewerId, reviewerId)
      )
    );
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
};
var storage = new DatabaseStorage();

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
var scryptAsync = promisify(scrypt);
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
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
  app2.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }
      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password)
      });
      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });
  app2.post("/api/login", passport.authenticate("local"), (req, res) => {
    if (req.user) {
      const { password, ...userWithoutPassword } = req.user;
      res.status(200).json(userWithoutPassword);
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
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
}

// server/routes.ts
import { ZodError } from "zod";
var isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
var formatZodError = (error) => {
  return error.errors.map((err) => ({
    path: err.path.join("."),
    message: err.message
  }));
};
async function registerRoutes(app2) {
  setupAuth(app2);
  app2.get("/api/deliveries", async (req, res) => {
    try {
      const { status, pickupLocation, dropLocation, packageSize } = req.query;
      const filters = {};
      if (status) filters.status = status;
      if (pickupLocation) filters.pickupLocation = pickupLocation;
      if (dropLocation) filters.dropLocation = dropLocation;
      if (packageSize) filters.packageSize = packageSize;
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
      const delivery = await storage.getDeliveryById(deliveryId);
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
      const deliveryData = createDeliverySchema.parse({
        ...req.body,
        senderId: req.user.id
      });
      const delivery = await storage.createDelivery(deliveryData);
      res.status(201).json(delivery);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: formatZodError(error)
        });
      }
      console.error("Error creating delivery:", error);
      res.status(500).json({ message: "Failed to create delivery" });
    }
  });
  app2.patch("/api/deliveries/:id/status", isAuthenticated, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }
      const { status } = req.body;
      if (!Object.values(deliveryStatusEnum.enumValues).includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const delivery = await storage.getDeliveryById(deliveryId);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }
      const isCarrier = req.user.id === delivery.carrierId;
      const isSender = req.user.id === delivery.senderId;
      if (!isCarrier && !isSender) {
        return res.status(403).json({ message: "Forbidden: Not associated with this delivery" });
      }
      if (status === "accepted") {
        if (delivery.status !== "requested") {
          return res.status(400).json({ message: "Can only accept deliveries with 'requested' status" });
        }
        if (!isCarrier) {
          return res.status(403).json({ message: "Only carriers can accept deliveries" });
        }
      } else if (status === "picked") {
        if (delivery.status !== "accepted") {
          return res.status(400).json({ message: "Can only mark as picked when delivery is accepted" });
        }
        if (!isCarrier) {
          return res.status(403).json({ message: "Only carriers can mark as picked" });
        }
      } else if (status === "delivered") {
        if (delivery.status !== "picked") {
          return res.status(400).json({ message: "Can only mark as delivered when package is picked" });
        }
        if (!isCarrier) {
          return res.status(403).json({ message: "Only carriers can mark as delivered" });
        }
      }
      const updatedDelivery = await storage.updateDeliveryStatus(
        deliveryId,
        status,
        status === "accepted" ? req.user.id : void 0
      );
      res.json(updatedDelivery);
    } catch (error) {
      console.error("Error updating delivery status:", error);
      res.status(500).json({ message: "Failed to update delivery status" });
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
      const review = await storage.createReview(reviewData);
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

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
