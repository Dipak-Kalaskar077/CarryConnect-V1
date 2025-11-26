import dotenv from "dotenv";
dotenv.config();

import path from "path";
import { fileURLToPath } from "url";

// Fix for ESM: create __dirname manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase service account path
const serviceAccountPath = path.join(__dirname, "firebase-service-account.json");


import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { setupAuth } from "./auth";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupChat } from "./chat";
import session from "express-session";
import { storage } from "./storage";

const app = express();

// 1) CORS FIRST
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// 2) BODY PARSER
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 3) AUTH (sessions + passport) — MUST come BEFORE routes
setupAuth(app);

// 4) LOGGER
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: any;

  const originalJson = res.json;
  res.json = function (body, ...args) {
    capturedJsonResponse = body;
    return originalJson.apply(res, [body, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let out = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) out += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (out.length > 100) out = out.slice(0, 99) + "…";
      log(out);
    }
  });

  next();
});

// 5) ROUTES + SERVER BOOTSTRAP
(async () => {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  // Get session settings from auth
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "carryconnect-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      secure: process.env.NODE_ENV === "production",
    }
  };

  // Setup chat with socket.io
  setupChat(io, sessionSettings);

  // Register routes (this returns the server, but we're using httpServer instead)
  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
  });

  if (app.get("env") === "development") {
    await setupVite(app, httpServer);
  } else {
    serveStatic(app);
  }

  const port = 5000;
  httpServer.listen(port, "0.0.0.0", () => log(`serving on port ${port}`));
})();
