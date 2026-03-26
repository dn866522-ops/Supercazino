import { Router } from "express";
import { db, usersTable, withdrawalsTable, transactionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware.js";
import { getOperatorIds } from "../lib/operators.js";

const router = Router();
const BOT_TOKEN = "8743378443:AAFZ1rWsJ7T_ikruznsA8kzNOTKyvrpFa0U";

const MAX_LIMITS: Record<string, number> = {
  uzcard: 5_000_000,
  humo: 5_000_000,
  visa: 10_000_000,
};

async function tgFetch(url: string, opts: any = {}, timeoutMs = 10_000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal as any });
  } finally {
    clearTimeout(timer);
  }
}

async function sendWithdrawalToTelegram(text: string, userId: string, amount: number, withdrawalId: number) {
  const keyboard = {
    inline_keyboard: [[
      { text: `✅ ${amount.toLocaleString()} UZS To'landi`, callback_data: `wd_approve_${userId}_${amount}_${withdrawalId}` },
      { text: "❌ Rad etish", callback_data: `wd_reject_${userId}_${withdrawalId}` },
    ]],
  };

  await Promise.all(getOperatorIds().map(async (chatId) => {
    try {
      await tgFetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          reply_markup: keyboard,
        }),
      });
    } catch (e) {
      console.error("Withdrawal Telegram error:", e);
    }
  }));
}

// Withdrawal callback handler (called from support.ts polling)
export async function handleWithdrawalCallback(cbData: string, chatId: string) {
  if (cbData.startsWith("wd_approve_")) {
    const parts = cbData.replace("wd_approve_", "").split("_");
    const userId = parts[0];
    const amount = Number(parts[1]);
    const withdrawalId = Number(parts[2]);
    if (!userId || !amount) return;

    // Idempotency: only approve if withdrawal is still "pending"
    // Prevents double-deduction if callback is processed twice (server restart, etc.)
    const [updatedWd] = await db.update(withdrawalsTable)
      .set({ status: "approved" })
      .where(and(eq(withdrawalsTable.id, withdrawalId), eq(withdrawalsTable.status, "pending")))
      .returning();

    if (!updatedWd) {
      console.log(`[Withdrawal] Duplicate approval ignored for withdrawalId=${withdrawalId}`);
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, userId));
    if (!user) return;

    if (user.balance < amount) {
      // Rollback the status change if balance is insufficient
      await db.update(withdrawalsTable)
        .set({ status: "pending" })
        .where(eq(withdrawalsTable.id, withdrawalId));
      await Promise.all(getOperatorIds().map(id =>
        tgFetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: id,
            text: `⚠️ <b>Chiqim Xatosi</b>\n\n👤 ${user.username}\n❌ Balans yetarli emas: ${user.balance.toLocaleString()} UZS < ${amount.toLocaleString()} UZS`,
            parse_mode: "HTML",
          }),
        }).catch(() => {})
      ));
      return;
    }

    const newBalance = user.balance - amount;
    await db.update(usersTable)
      .set({ balance: newBalance })
      .where(eq(usersTable.userId, userId));

    await db.insert(transactionsTable).values({
      userId,
      type: "withdrawal",
      amount: -amount,
      status: "completed",
      description: `Chiqim tasdiqlandi: -${amount.toLocaleString()} UZS`,
    });

    console.log(`[Withdrawal] Approved: userId=${userId} amount=${amount} newBalance=${newBalance}`);

    // Notify all operators
    await Promise.all(getOperatorIds().map(id =>
      tgFetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: id,
          text: `✅ <b>Chiqim Tasdiqlandi</b>\n\n👤 ${user.username}\n💸 -${amount.toLocaleString()} UZS to'landi\n💳 Yangi balans: ${newBalance.toLocaleString()} UZS`,
          parse_mode: "HTML",
        }),
      }).catch(() => {})
    ));

  } else if (cbData.startsWith("wd_reject_")) {
    const parts = cbData.replace("wd_reject_", "").split("_");
    const userId = parts[0];
    const withdrawalId = Number(parts[1]);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, userId));

    const [updatedWd] = await db.update(withdrawalsTable)
      .set({ status: "rejected" })
      .where(and(eq(withdrawalsTable.id, withdrawalId), eq(withdrawalsTable.status, "pending")))
      .returning();

    if (!updatedWd) {
      console.log(`[Withdrawal] Reject ignored — already processed: withdrawalId=${withdrawalId}`);
      return;
    }

    console.log(`[Withdrawal] Rejected: userId=${userId} withdrawalId=${withdrawalId}`);

    await Promise.all(getOperatorIds().map(id =>
      tgFetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: id,
          text: `❌ <b>Chiqim Rad Etildi</b>\n\n👤 ${user?.username || userId}\n🆔 So'rov #${withdrawalId}`,
          parse_mode: "HTML",
        }),
      }).catch(() => {})
    ));
  }
}

router.post("/request", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { method, amount, cardNumber } = req.body;

  if (!user.isProfileComplete) {
    return res.status(400).json({ error: "Profilingizni to'liq to'ldiring" });
  }
  if (!["uzcard", "humo", "visa"].includes(method)) {
    return res.status(400).json({ error: "Noto'g'ri usul" });
  }
  const maxAmount = MAX_LIMITS[method];
  if (!amount || amount <= 0 || amount > maxAmount) {
    return res.status(400).json({ error: `Maksimal miqdor: ${maxAmount.toLocaleString()} so'm` });
  }
  if (amount > user.balance) {
    return res.status(400).json({ error: "Balansingiz yetarli emas" });
  }

  let withdrawal: any;
  try {
    [withdrawal] = await db.insert(withdrawalsTable).values({
      userId: user.userId,
      method,
      amount,
      cardNumber,
      status: "pending",
    }).returning();
  } catch (e) {
    console.error("[Withdrawal] DB insert error:", e);
    return res.status(500).json({ error: "Server xatosi" });
  }

  // Immediately respond — do NOT await Telegram
  res.json({ message: "Chiqim so'rovi yuborildi. Admin tasdiqlagandan keyin amalga oshiriladi." });

  // Fire-and-forget: send to Telegram in background
  const msg = `💸 <b>Yangi Chiqim So'rovi!</b>\n\n👤 <b>${user.username}</b>\n🆔 ID: <code>${user.userId}</code>\n📞 Tel: ${user.phone}\n💳 Usul: <b>${method.toUpperCase()}</b>\n💰 Miqdor: <b>${amount.toLocaleString()} UZS</b>\n🏦 Karta: <code>${cardNumber || "ko'rsatilmagan"}</code>\n💼 Hozirgi balans: ${user.balance.toLocaleString()} UZS\n🕐 Vaqt: ${new Date().toLocaleString("uz-UZ")}`;

  sendWithdrawalToTelegram(msg, user.userId, amount, withdrawal.id).catch(e =>
    console.error("[Withdrawal] Telegram send error:", e)
  );
});

// ── Get current user's withdrawal history ────────────────────────────────────
router.get("/my-history", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const withdrawals = await db
    .select({
      id: withdrawalsTable.id,
      method: withdrawalsTable.method,
      amount: withdrawalsTable.amount,
      status: withdrawalsTable.status,
      cardNumber: withdrawalsTable.cardNumber,
      createdAt: withdrawalsTable.createdAt,
    })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, user.userId))
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(50);
  return res.json({ withdrawals });
});

export default router;
