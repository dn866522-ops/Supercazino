import { db, usersTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";

const BOT_TOKEN = "8520676994:AAGeJoFl7snXkTfNG3iRFSxX4J8fB6JXReA";

// Get real IP behind proxy/nginx
export function getIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
}

// User-Agent + Accept-Language as browser fingerprint
export function getFingerprint(req: any): string {
  const ua   = req.headers["user-agent"]      || "unknown";
  const lang = req.headers["accept-language"] || "";
  return `${ua}|${lang}`.substring(0, 512);
}

async function notifyAdmin(message: string) {
  try {
    const { getOperatorIds } = await import("./operators.js");
    await Promise.all(
      getOperatorIds().map(chatId =>
        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
        }).catch(() => {})
      )
    );
  } catch {}
}

// Check for duplicate accounts.
// STRICT MODE: requires BOTH same IP AND same fingerprint to block.
// This prevents false positives from shared mobile NAT IPs or same phone models.
export async function checkAndBlockDuplicate(
  newUserId: string,
  ip: string,
  fingerprint: string
): Promise<boolean> {
  // Skip check for unknown values
  if (ip === "unknown" || fingerprint === "unknown") return false;
  // Skip generic/empty fingerprints
  if (fingerprint.startsWith("unknown|") && fingerprint.length < 15) return false;

  // Require BOTH IP AND fingerprint to match — prevents false positives
  const existing = await db
    .select()
    .from(usersTable)
    .where(
      and(
        ne(usersTable.userId, newUserId),
        eq(usersTable.lastIp, ip),
        eq(usersTable.fingerprint, fingerprint)
      )
    )
    .limit(5);

  if (existing.length === 0) return false;

  // Only block accounts that are not already blocked
  const toBlock = existing.filter(u => !u.isBlocked);
  if (toBlock.length === 0) return false;

  const blockReason = "Ko'p akkaunt: IP va brauzer bir xil";

  // Block existing matched accounts
  for (const u of toBlock) {
    await db
      .update(usersTable)
      .set({ isBlocked: true, blockReason })
      .where(eq(usersTable.userId, u.userId));
  }

  // Block the new account
  await db
    .update(usersTable)
    .set({ isBlocked: true, blockReason })
    .where(eq(usersTable.userId, newUserId));

  const blockedList = [...toBlock.map(u => u.userId), newUserId]
    .map(id => `• <code>${id}</code>`)
    .join("\n");

  await notifyAdmin(
    `🚨 <b>Ko'p Akkaunt Aniqlandi!</b>\n\n` +
    `🔴 Bloklangan:\n${blockedList}\n\n` +
    `📋 <b>Sabab:</b> ${blockReason}\n` +
    `🌐 <b>IP:</b> <code>${ip}</code>\n` +
    `🖥 <b>Brauzer:</b> <code>${fingerprint.substring(0, 80)}...</code>\n` +
    `🕐 <b>Vaqt:</b> ${new Date().toLocaleString("uz-UZ")}`
  );

  return true;
}

// Update user's IP and fingerprint on every login
export async function updateUserTracking(userId: string, ip: string, fingerprint: string) {
  try {
    await db
      .update(usersTable)
      .set({ lastIp: ip, fingerprint })
      .where(eq(usersTable.userId, userId));
  } catch {}
}
