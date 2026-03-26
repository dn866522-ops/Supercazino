import { pgTable, text, integer, real, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const depositsTable = pgTable("deposits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  method: text("method").notNull(),
  amount: real("amount").notNull(),
  cardNumber: text("card_number").notNull(),
  cardHolder: text("card_holder").notNull(),
  status: text("status").notNull().default("pending"),
  receiptUrl: text("receipt_url"),
  telegramMessageId: integer("telegram_message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

export const insertDepositSchema = createInsertSchema(depositsTable).omit({ id: true, createdAt: true });
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Deposit = typeof depositsTable.$inferSelect;
