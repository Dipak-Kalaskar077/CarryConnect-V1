import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load .env from project root
dotenv.config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("❌ DATABASE_URL is missing in .env");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
