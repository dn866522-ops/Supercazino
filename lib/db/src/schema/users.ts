import { pgTable, text, integer, boolean, real, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone").notNull().unique(),
  balance: real("balance").notNull().default(0),
  firstName: text("first_name"),
  lastName: text("last_name"),
  country: text("country"),
  city: text("city"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  isProfileComplete: boolean("is_profile_complete").notNull().default(false),
  totalDeposited: real("total_deposited").notNull().default(0),
  totalWagered: real("total_wagered").notNull().default(0),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: text("referred_by"),
  lastIp: text("last_ip"),
  fingerprint: text("fingerprint"),
  blockReason: text("block_reason"),
  isAdmin: boolean("is_admin").notNull().default(false),
  winRate: real("win_rate"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
