import { pgTable, text, timestamp, serial } from "drizzle-orm/pg-core";

export const operatorChatsTable = pgTable("operator_chats", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull().unique(),
  name: text("name"),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
});

export type OperatorChat = typeof operatorChatsTable.$inferSelect;
