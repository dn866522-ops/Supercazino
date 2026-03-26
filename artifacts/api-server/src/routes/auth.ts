import { Router } from "express";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getIp, getFingerprint, checkAndBlockDuplicate, updateUserTracking } from "../lib/anti-multi.js";
import { getOperatorIds } from "../lib/operators.js";

const OPERATOR_BOT_TOKEN = "8743378443:AAFZ1rWsJ7T_ikruznsA8kzNOTKyvrpFa0U";

async function notifyOperators(text: string) {
  const ops = getOperatorIds();
  await Promise.all(ops.map(chatId =>
    fetch(`https://api.telegram.org/bot${OPERATOR_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    }).catch(() => {})
  ));
}

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "betuz-secret-key-2024";

function generateUserId(): string {
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "betuz_salt").digest("hex");
}

function formatUser(user: any) {
  return {
    id: user.id,
    userId: user.userId,
    username: user.username,
    phone: user.phone,
    balance: user.balance,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    country: user.country || "",
    city: user.city || "",
    isBlocked: user.isBlocked,
    isProfileComplete: user.isProfileComplete,
    isAdmin: user.isAdmin || false,
    totalDeposited: user.totalDeposited,
    totalWagered: user.totalWagered,
    referralCode: user.referralCode,
    createdAt: user.createdAt?.toISOString(),
  };
}

router.post("/register", async (req, res) => {
  const { username, password, phone, referralCode } = req.body;
  if (!username || !password || !phone) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldiring" });
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing.length > 0) {
    return res.status(400).json({ error: "Bu username band" });
  }

  // Phone must be unique — one phone number = one account only
  const phoneExists = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phone));
  if (phoneExists.length > 0) {
    return res.status(400).json({ error: "Bu telefon raqam allaqachon ro'yxatdan o'tgan" });
  }

  const ip          = getIp(req);
  const fingerprint = getFingerprint(req);
  const userId      = generateUserId();
  const refCode     = generateReferralCode();

  const [user] = await db.insert(usersTable).values({
    userId,
    username,
    password: hashPassword(password),
    phone,
    balance: 0,
    totalDeposited: 0,
    totalWagered: 0,
    referralCode: refCode,
    referredBy: referralCode || null,
    isBlocked: false,
    isProfileComplete: false,
    lastIp: ip,
    fingerprint,
  }).returning();

  // Anti-multiaccout check (runs async after user is created)
  checkAndBlockDuplicate(userId, ip, fingerprint).then(isDuplicate => {
    if (isDuplicate) console.log(`[AntiMulti] Blocked duplicate: ${userId} (IP: ${ip})`);
  });

  if (referralCode) {
    const referrer = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode));
    if (referrer.length > 0) {
      const { referralsTable } = await import("@workspace/db");
      await db.insert(referralsTable).values({
        referrerId: referrer[0].userId,
        referredId: userId,
        isQualified: false,
      }).onConflictDoNothing();
    }
  }

  // Re-fetch to get updated blocked status
  const [fresh] = await db.select().from(usersTable).where(eq(usersTable.userId, userId));
  if (fresh.isBlocked) {
    return res.status(403).json({ error: "Ro'yxatdan o'tish rad etildi. Operator bilan bog'laning." });
  }

  const token = jwt.sign({ userId: user.userId, id: user.id }, JWT_SECRET, { expiresIn: "30d" });

  // Notify operators about new registration (async, don't await)
  notifyOperators(
    `🆕 <b>Yangi foydalanuvchi ro'yxatdan o'tdi!</b>\n\n` +
    `👤 Username: <b>${username}</b>\n` +
    `📞 Telefon: <code>${phone}</code>\n` +
    `🆔 ID: <code>${userId}</code>\n` +
    `🌐 IP: <code>${ip}</code>` +
    (referralCode ? `\n🔗 Referal kodi: <code>${referralCode}</code>` : "")
  ).catch(() => {});

  return res.json({ token, user: formatUser(fresh) });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username va parol kiriting" });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user) {
    return res.status(401).json({ error: "Username yoki parol noto'g'ri" });
  }
  if (user.password !== hashPassword(password)) {
    return res.status(401).json({ error: "Username yoki parol noto'g'ri" });
  }
  if (user.isBlocked) {
    return res.status(401).json({ error: "Akkauntingiz bloklangan. Operator bilan bog'laning." });
  }

  // Update IP and fingerprint on login
  const ip          = getIp(req);
  const fingerprint = getFingerprint(req);
  await updateUserTracking(user.userId, ip, fingerprint);

  const token = jwt.sign({ userId: user.userId, id: user.id }, JWT_SECRET, { expiresIn: "30d" });
  return res.json({ token, user: formatUser(user) });
});

router.post("/logout", async (req, res) => {
  // Try to identify who logged out from the token
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, decoded.userId));
      if (user) {
        notifyOperators(
          `🚪 <b>Foydalanuvchi chiqdi</b>\n\n` +
          `👤 Username: <b>${user.username}</b>\n` +
          `📞 Telefon: <code>${user.phone}</code>\n` +
          `🆔 ID: <code>${user.userId}</code>\n` +
          `💰 Balans: <b>${user.balance.toLocaleString()} so'm</b>`
        ).catch(() => {});
      }
    }
  } catch {}
  return res.json({ message: "Chiqish muvaffaqiyatli" });
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Avtorizatsiya talab etiladi" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, decoded.userId));
    if (!user) return res.status(401).json({ error: "Foydalanuvchi topilmadi" });
    if (user.isBlocked) return res.status(401).json({ error: "Akkauntingiz bloklangan" });
    return res.json(formatUser(user));
  } catch {
    return res.status(401).json({ error: "Token yaroqsiz" });
  }
});

export default router;
export { hashPassword, formatUser, JWT_SECRET };
