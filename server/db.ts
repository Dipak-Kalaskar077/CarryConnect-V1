// server/db.ts
import dotenv from "dotenv";
dotenv.config();

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";

// Use WebSocket for serverless Neon connections
neonConfig.webSocketConstructor = ws;

// Get the database URL from environment variables
const connectionString = process.env.DATABASE_URL;

// Throw error if DATABASE_URL is missing
if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Cannot initialize database."
  );
}

// Create Neon pool
export const pool = new Pool({ connectionString });

// Initialize Drizzle ORM
export const db = drizzle(pool, { schema });

// Helper to test if the database connection works
export async function isDatabaseConfigured(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (err) {
    console.error("Database connection failed:", err);
    return false;
  }
}
