import { pgTable, text, integer, timestamp, serial } from "drizzle-orm/pg-core";

export const tgMsgMapTable = pgTable("tg_msg_map", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  msgId: integer("msg_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TgMsgMap = typeof tgMsgMapTable.$inferSelect;
