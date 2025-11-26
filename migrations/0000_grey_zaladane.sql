CREATE TYPE "public"."delivery_status" AS ENUM('requested', 'accepted', 'picked', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."package_size" AS ENUM('small', 'medium', 'large');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('sender', 'carrier', 'both');--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"carrier_id" integer,
	"pickup_location" text NOT NULL,
	"drop_location" text NOT NULL,
	"package_size" "package_size" NOT NULL,
	"package_weight" integer NOT NULL,
	"description" text,
	"special_instructions" text,
	"preferred_delivery_date" text NOT NULL,
	"preferred_delivery_time" text NOT NULL,
	"status" "delivery_status" DEFAULT 'requested' NOT NULL,
	"delivery_fee" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"delivery_id" integer NOT NULL,
	"reviewer_id" integer NOT NULL,
	"reviewee_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" DEFAULT 'both' NOT NULL,
	"rating" integer,
	"total_reviews" integer DEFAULT 0,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_users_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;