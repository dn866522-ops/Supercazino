import { db, operatorChatsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_CHAT_ID = "8414989794";

const registeredOperators = new Set<string>([DEFAULT_CHAT_ID]);

let loaded = false;

export async function loadOperatorsFromDB(): Promise<void> {
  if (loaded) return;
  try {
    const rows = await db.select().from(operatorChatsTable);
    for (const row of rows) {
      registeredOperators.add(row.chatId);
    }
    registeredOperators.add(DEFAULT_CHAT_ID);
    loaded = true;
    console.log(`[Operators] Loaded ${registeredOperators.size} operators from DB`);
  } catch (e) {
    console.error("[Operators] Failed to load from DB:", e);
  }
}

export function getOperatorIds(): string[] {
  return [...registeredOperators];
}

export async function registerOperator(chatId: string, name?: string): Promise<boolean> {
  const isNew = !registeredOperators.has(chatId);
  registeredOperators.add(chatId);
  try {
    await db
      .insert(operatorChatsTable)
      .values({ chatId, name: name || null })
      .onConflictDoNothing();
    if (isNew) {
      console.log(`[Bot] New operator registered: ${chatId} (${name || "no name"}). Total: ${registeredOperators.size}`);
    }
  } catch (e) {
    console.error("[Operators] Failed to save to DB:", e);
  }
  return isNew;
}

export async function removeOperator(chatId: string): Promise<void> {
  if (chatId === DEFAULT_CHAT_ID) return;
  registeredOperators.delete(chatId);
  try {
    await db.delete(operatorChatsTable).where(eq(operatorChatsTable.chatId, chatId));
    console.log(`[Bot] Operator removed: ${chatId}. Total: ${registeredOperators.size}`);
  } catch (e) {
    console.error("[Operators] Failed to remove from DB:", e);
  }
}

export function isOperator(chatId: string): boolean {
  return registeredOperators.has(chatId);
}
