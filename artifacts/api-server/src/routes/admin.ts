import { Router } from "express";
import { db, usersTable, transactionsTable, depositsTable } from "@workspace/db";
import { supportMessagesTable } from "@workspace/db";
import { eq, desc, asc, and, gte, lt, sum, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware.js";
import { getWinRate, setWinRate, invalidateWinRateCache } from "../lib/settings.js";

const router = Router();
const ADMIN_CODE = "M1i2r3z4o5";

function adminCheck(req: any, res: any, next: any) {
  const code = req.headers["x-admin-code"] || req.body?.adminCode || req.query?.adminCode;
  if (code !== ADMIN_CODE) {
    return res.status(401).json({ error: "Admin huquqi yo'q" });
  }
  next();
}

router.post("/verify", async (req, res) => {
  const { code } = req.body;
  if (code !== ADMIN_CODE) return res.status(401).json({ error: "Noto'g'ri kod" });
  return res.json({ message: "Admin tasdiqlandi" });
});

router.get("/users", adminCheck, async (req, res) => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  return res.json({
    users: users.map(u => ({
      id: u.id,
      userId: u.userId,
      username: u.username,
      phone: u.phone,
      balance: u.balance,
      isBlocked: u.isBlocked,
      blockReason: u.blockReason || null,
      lastIp: u.lastIp || null,
      fingerprint: u.fingerprint ? u.fingerprint.substring(0, 80) : null,
      totalDeposited: u.totalDeposited,
      winRate: u.winRate ?? null,
      createdAt: u.createdAt?.toISOString(),
    })),
  });
});

// Set per-user win rate
router.post("/user/:userId/win-rate", adminCheck, async (req, res) => {
  const { userId } = req.params;
  const { winRate } = req.body;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, userId));
  if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });

  // winRate null means reset to global
  const rate = winRate === null || winRate === undefined ? null : Math.min(1, Math.max(0, Number(winRate) / 100));

  await db.update(usersTable).set({ winRate: rate }).where(eq(usersTable.userId, userId));

  return res.json({
    userId,
    winRate: rate === null ? null : Math.round(rate * 100),
    message: rate === null ? "Global sozlamaga qaytarildi" : `Win rate ${Math.round(rate * 100)}% ga o'rnatildi`,
  });
});

router.post("/balance", adminCheck, async (req, res) => {
  const { userId, amount, action, reason } = req.body;
  if (!userId || !amount || !action) return res.status(400).json({ error: "Majburiy maydonlar to'ldirilmagan" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, userId));
  if (!user) return res.status(400).json({ error: "Foydalanuvchi topilmadi" });

  let newBalance: number;
  let txAmount: number;
  let desc2: string;

  if (action === "add") {
    newBalance = user.balance + amount;
    txAmount = amount;
    desc2 = reason || `Admin tomonidan ${amount.toLocaleString()} so'm qo'shildi`;
    await db.update(usersTable).set({ balance: newBalance, totalDeposited: user.totalDeposited + amount }).where(eq(usersTable.userId, userId));
  } else {
    if (amount > user.balance) return res.status(400).json({ error: "Balansi yetarli emas" });
    newBalance = user.balance - amount;
    txAmount = -amount;
    desc2 = reason || `Admin tomonidan ${amount.toLocaleString()} so'm ayirildi`;
    await db.update(usersTable).set({ balance: newBalance }).where(eq(usersTable.userId, userId));
  }

  await db.insert(transactionsTable).values({
    userId, type: action === "add" ? "admin_deposit" : "admin_withdrawal",
    amount: txAmount, status: "completed", description: desc2,
  });

  return res.json({ message: `Balans yangilandi. Yangi balans: ${newBalance.toLocaleString()} so'm` });
});

router.post("/block", adminCheck, async (req, res) => {
  const { userId, action } = req.body;
  if (!userId || !action) return res.status(400).json({ error: "Majburiy maydonlar to'ldirilmagan" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, userId));
  if (!user) return res.status(400).json({ error: "Foydalanuvchi topilmadi" });
  await db.update(usersTable).set({ isBlocked: action === "block" }).where(eq(usersTable.userId, userId));
  return res.json({ message: `Foydalanuvchi ${action === "block" ? "bloklandi" : "blokdan chiqarildi"}` });
});

// Pending deposits for admin
router.get("/deposits", adminCheck, async (req, res) => {
  const deps = await db.select({
    id: depositsTable.id,
    userId: depositsTable.userId,
    method: depositsTable.method,
    amount: depositsTable.amount,
    status: depositsTable.status,
    receiptUrl: depositsTable.receiptUrl,
    createdAt: depositsTable.createdAt,
    username: usersTable.username,
  }).from(depositsTable)
    .leftJoin(usersTable, eq(depositsTable.userId, usersTable.userId))
    .where(eq(depositsTable.status, "receipt_uploaded"))
    .orderBy(desc(depositsTable.createdAt));
  return res.json({ deposits: deps });
});

// Approve deposit
router.post("/deposit/approve", adminCheck, requireAuth, async (req, res) => {
  const { depositId, userId, amount } = req.body;
  if (!depositId || !userId || !amount) return res.status(400).json({ error: "Majburiy maydonlar" });

  await db.update(depositsTable).set({ status: "approved" }).where(eq(depositsTable.id, depositId));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, userId));
  if (!user) return res.status(400).json({ error: "Foydalanuvchi topilmadi" });

  const newBalance = user.balance + amount;
  await db.update(usersTable).set({ balance: newBalance, totalDeposited: user.totalDeposited + amount }).where(eq(usersTable.userId, userId));

  await db.insert(transactionsTable).values({
    userId, type: "deposit", amount, status: "completed",
    description: `Depozit tasdiqlandi: ${amount.toLocaleString()} so'm`,
  });

  return res.json({ message: `✅ ${amount.toLocaleString()} so'm balansi to'ldirildi` });
});

// ── User detailed stats: deposits + wagering breakdown + lucky wheel ──────────
router.get("/user/:userId/stats", adminCheck, async (req, res) => {
  const { userId } = req.params;

  // 1. All approved/admin deposits for this user, sorted oldest first
  const userDeposits = await db.select()
    .from(depositsTable)
    .where(and(eq(depositsTable.userId, userId), eq(depositsTable.status, "approved")))
    .orderBy(asc(depositsTable.createdAt));

  // 2. All transactions for this user, sorted oldest first
  const allTxns = await db.select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(asc(transactionsTable.createdAt));

  // Also include admin_deposit events in timeline
  const adminDepositTxns = allTxns.filter(t => t.type === "admin_deposit");

  // Build a unified deposit timeline (real deposits + admin deposits)
  const depositTimeline = [
    ...userDeposits.map(d => ({ date: d.createdAt, amount: d.amount, source: "deposit" as const, id: d.id })),
    ...adminDepositTxns.map(t => ({ date: t.createdAt, amount: t.amount, source: "admin" as const, id: t.id })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // 3. Wager types = negative game / sports_bet / coupon_bet transactions
  const wagerTypes = new Set(["game", "sports_bet", "coupon_bet"]);

  // Per-deposit wagering: for each deposit, sum bets placed AFTER that deposit's date
  // and BEFORE the next deposit's date
  const depositsWithWager = depositTimeline.map((dep, idx) => {
    const fromDate = dep.date;
    const toDate = depositTimeline[idx + 1]?.date ?? new Date("2099-01-01");

    const wagered = allTxns
      .filter(t =>
        wagerTypes.has(t.type) &&
        t.amount < 0 &&
        t.createdAt >= fromDate &&
        t.createdAt < toDate
      )
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const won = allTxns
      .filter(t =>
        wagerTypes.has(t.type) &&
        t.amount > 0 &&
        t.createdAt >= fromDate &&
        t.createdAt < toDate
      )
      .reduce((s, t) => s + t.amount, 0);

    return {
      depositId: dep.id,
      source: dep.source,
      depositAmount: dep.amount,
      depositDate: dep.date.toISOString(),
      wagered: Math.round(wagered),
      won: Math.round(won),
      wagerRatio: dep.amount > 0 ? Math.round((wagered / dep.amount) * 10) / 10 : 0,
    };
  });

  // 4. Lucky Wheel stats
  const lwTxns = allTxns.filter(t => t.type === "lucky_wheel_spin" || t.type === "lucky_wheel_bonus");
  const lwSpins    = lwTxns.filter(t => t.type === "lucky_wheel_spin").length;
  const lwWon      = lwTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const lwLost     = lwTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  // 5. Overall summary
  const totalWagered = allTxns
    .filter(t => wagerTypes.has(t.type) && t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalWon = allTxns
    .filter(t => wagerTypes.has(t.type) && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const totalDeposited = depositTimeline.reduce((s, d) => s + d.amount, 0);

  return res.json({
    deposits: depositsWithWager,
    luckyWheel: { spins: lwSpins, won: Math.round(lwWon), lost: Math.round(lwLost) },
    summary: {
      totalDeposited: Math.round(totalDeposited),
      totalWagered: Math.round(totalWagered),
      totalWon: Math.round(totalWon),
      netResult: Math.round(totalWon - totalWagered),
    },
  });
});

// All support messages for admin
router.get("/support", adminCheck, async (req, res) => {
  const msgs = await db.select().from(supportMessagesTable)
    .orderBy(desc(supportMessagesTable.createdAt))
    .limit(100);
  return res.json({ messages: msgs });
});

// Admin sends message to user
router.post("/support/reply", adminCheck, async (req, res) => {
  const { userId, text } = req.body;
  if (!userId || !text) return res.status(400).json({ error: "userId va text kerak" });
  const [saved] = await db.insert(supportMessagesTable).values({ userId, text, isOperator: true }).returning();
  return res.json({ message: "Yuborildi", id: saved.id });
});

// ── Win Rate settings ─────────────────────────────────────────────────────
router.get("/settings", adminCheck, async (_req, res) => {
  // Force fresh read from DB (don't use stale cache)
  invalidateWinRateCache();
  const winRate = await getWinRate();
  return res.json({ winRate: Math.round(winRate * 100) });
});

router.post("/settings/win-rate", adminCheck, async (req, res) => {
  const { winRate } = req.body;
  const pct = Number(winRate);
  if (isNaN(pct) || pct < 1 || pct > 95) {
    return res.status(400).json({ error: "Win rate 1 dan 95 gacha bo'lishi kerak" });
  }
  const saved = await setWinRate(pct);
  console.log(`[Admin] WIN_RATE o'zgartirildi → ${saved}%`);
  return res.json({ message: `Win rate ${saved}% ga o'rnatildi`, winRate: saved });
});

// ── Support Chat endpoints ───────────────────────────────────────────────────

// GET active support chats — returns last message per user
router.get("/support/chats", adminCheck, async (req, res) => {
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (sm.user_id)
      sm.user_id,
      sm.text,
      sm.is_operator,
      sm.created_at,
      u.username
    FROM support_messages sm
    LEFT JOIN users u ON u.user_id = sm.user_id
    ORDER BY sm.user_id, sm.created_at DESC
  `);
  return res.json({ chats: rows.rows });
});

// GET messages for a specific user
router.get("/support/messages/:userId", adminCheck, async (req, res) => {
  const { userId } = req.params;
  const msgs = await db
    .select()
    .from(supportMessagesTable)
    .where(eq(supportMessagesTable.userId, userId))
    .orderBy(desc(supportMessagesTable.createdAt))
    .limit(100);
  msgs.reverse();
  return res.json({ messages: msgs });
});

// POST send message to user directly from admin panel
router.post("/support/send", adminCheck, async (req, res) => {
  const { userId, text } = req.body;
  if (!userId || !text?.trim()) {
    return res.status(400).json({ error: "userId va text kerak" });
  }
  try {
    const [saved] = await db
      .insert(supportMessagesTable)
      .values({ userId, text: text.trim(), isOperator: true })
      .returning();
    console.log(`[Admin Support] Message sent to user ${userId}: ${text.trim().slice(0, 50)}`);
    return res.json({ ok: true, id: saved.id });
  } catch (e) {
    return res.status(500).json({ error: "Server xatosi" });
  }
});

// POST close chat for a user
router.post("/support/close", adminCheck, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId kerak" });
  try {
    await db.insert(supportMessagesTable).values({
      userId,
      text: "✅ Muammoingiz hal qilindi. Chat yopildi. Boshqa savollar bo'lsa qayta yozing.",
      isOperator: true,
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
