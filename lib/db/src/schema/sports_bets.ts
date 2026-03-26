import { pgTable, text, real, timestamp, serial, boolean, integer } from "drizzle-orm/pg-core";

export const sportsBetsTable = pgTable("sports_bets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  matchId: text("match_id").notNull(),
  matchName: text("match_name").notNull(),
  betDescription: text("bet_description").notNull(),
  betAmount: real("bet_amount").notNull(),
  odds: real("odds").notNull(),
  status: text("status").notNull().default("pending"),
  won: boolean("won"),
  winAmount: real("win_amount"),
  resolvedAt: timestamp("resolved_at"),
  isCardBet: boolean("is_card_bet").notNull().default(false),
  isFirstHalfCard: boolean("is_first_half_card").notNull().default(false),
  isCoupon: boolean("is_coupon").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SportsBet = typeof sportsBetsTable.$inferSelect;
