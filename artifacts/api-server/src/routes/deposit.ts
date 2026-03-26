import { Router } from "express";
import { db, usersTable, depositsTable, transactionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware.js";
import multer from "multer";
import fs from "fs";
import FormData from "form-data";
import { getOperatorIds } from "../lib/operators.js";

const router = Router();
const BOT_TOKEN = "8743378443:AAFZ1rWsJ7T_ikruznsA8kzNOTKyvrpFa0U";

async function tgFetch(url: string, opts: any = {}, timeoutMs = 15_000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal as any });
  } finally {
    clearTimeout(timer);
  }
}

const CARDS = [
  { number: "8600 0609 9769 8544", holder: "Umurova Sayyora",    raw: "8600060997698544" },
  { number: "5614 6867 0950 1780", holder: "Negmurodov Mirzoxid", raw: "5614686709501780" },
  { number: "9860 1966 1932 3336", holder: "Negmurodov Mirzoxid", raw: "9860196619323336" },
  { number: "4195 2500 5245 9060", holder: "Negmurodov Mirzoxid", raw: "4195250052459060" },
];

const LIMITS: Record<string, number> = { uzcard: 30000, humo: 10000, visa: 100000 };

const uploadDir = "/tmp/receipts";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 20 * 1024 * 1024 } });

// Broadcast deposit notification to ALL registered operators
async function sendToTelegram(text: string, photoPath?: string, userId?: string, amount?: number) {
  const keyboard = userId ? {
    inline_keyboard: [[
      { text: `✅ ${amount?.toLocaleString()} UZS Tasdiqlash`, callback_data: `dep_approve_${userId}_${amount}` },
      { text: "❌ Rad etish", callback_data: `dep_reject_${userId}` },
    ]],
  } : undefined;

  await Promise.all(getOperatorIds().map(async (chatId) => {
    try {
      if (photoPath && fs.existsSync(photoPath)) {
        const form = new FormData();
        form.append("chat_id", chatId);
        form.append("caption", text);
        form.append("parse_mode", "HTML");
        if (keyboard) form.append("reply_markup", JSON.stringify(keyboard));
        form.append("photo", fs.createReadStream(photoPath));
        const r = await tgFetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: "POST", body: form as any,
        }, 30_000);
        const rj = await r.json() as any;
        if (!rj.ok) {
          // Fallback to document
          const form2 = new FormData();
          form2.append("chat_id", chatId);
          form2.append("caption", text);
          form2.append("parse_mode", "HTML");
          if (keyboard) form2.append("reply_markup", JSON.stringify(keyboard));
          form2.append("document", fs.createReadStream(photoPath));
          await tgFetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: "POST", body: form2 as any }, 30_000);
        }
      } else {
        await tgFetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            ...(keyboard ? { reply_markup: keyboard } : {}),
          }),
        });
      }
    } catch (e) {
      console.error("Deposit Telegram error:", e);
    }
  }));
}

// Deposit callback handler (called from support.ts polling)
export async function handleDepositCallback(cbData: string, chatId: string) {
  if (cbData.startsWith("dep_approve_")) {
    const parts = cbData.replace("dep_approve_", "").split("_");
    const userId = parts[0];
    const amount = Number(parts[1]);
    if (!userId || !amount) return;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, userId));
    if (!user) return;

    // Idempotency: only approve if deposit is still in "receipt_uploaded" state
    // This prevents double-crediting if callback is processed twice (e.g. server restart)
    const [updated] = await db.update(depositsTable)
      .set({ status: "approved" })
      .where(and(eq(depositsTable.userId, userId), eq(depositsTable.status, "receipt_uploaded")))
      .returning();

    if (!updated) {
      // Already approved or no pending deposit — do NOT credit balance again
      console.log(`[Deposit] Duplicate approval ignored for userId=${userId} amount=${amount}`);
      return;
    }

    await db.update(usersTable)
      .set({ balance: user.balance + amount })
      .where(eq(usersTable.userId, userId));

    await db.insert(transactionsTable).values({
      userId,
      type: "deposit",
      amount,
      status: "completed",
      description: `Depozit tasdiqlandi: +${amount.toLocaleString()} UZS`,
    });

    console.log(`[Deposit] Approved: userId=${userId} amount=${amount} newBalance=${user.balance + amount}`);

    // Notify all operators
    await Promise.all(getOperatorIds().map(id =>
      tgFetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: id,
          text: `✅ <b>Depozit Tasdiqlandi</b>\n\n👤 ${user.username}\n💰 +${amount.toLocaleString()} UZS\n💳 Yangi balans: ${(user.balance + amount).toLocaleString()} UZS`,
          parse_mode: "HTML",
        }),
      }).catch(() => {})
    ));

  } else if (cbData.startsWith("dep_reject_")) {
    const userId = cbData.replace("dep_reject_", "");

    const [updatedDep] = await db.update(depositsTable)
      .set({ status: "rejected" })
      .where(and(eq(depositsTable.userId, userId), eq(depositsTable.status, "receipt_uploaded")))
      .returning();

    if (!updatedDep) {
      console.log(`[Deposit] Reject ignored — already processed: userId=${userId}`);
      return;
    }

    console.log(`[Deposit] Rejected: userId=${userId}`);

    await Promise.all(getOperatorIds().map(id =>
      tgFetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: id,
          text: `❌ <b>Depozit Rad Etildi</b>\n\n👤 User: ${userId}`,
          parse_mode: "HTML",
        }),
      }).catch(() => {})
    ));
  }
}

router.post("/initiate", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { method, amount } = req.body;

  if (!["uzcard", "humo", "visa"].includes(method)) {
    return res.status(400).json({ error: "Noto'g'ri to'lov usuli" });
  }
  const minAmount = LIMITS[method];
  if (!amount || amount < minAmount) {
    return res.status(400).json({ error: `Minimal miqdor: ${minAmount.toLocaleString()} so'm` });
  }

  const card = CARDS[Math.floor(Math.random() * CARDS.length)];
  const [deposit] = await db.insert(depositsTable).values({
    userId: user.userId,
    method,
    amount,
    cardNumber: card.raw,
    cardHolder: card.holder,
    status: "pending",
  }).returning();

  return res.json({
    depositId: deposit.id,
    cardNumber: card.number,
    cardHolder: card.holder,
    method,
    amount,
  });
});

router.post("/confirm", requireAuth, upload.single("receipt"), async (req, res) => {
  const user = (req as any).user;
  const { depositId } = req.body;
  const file = req.file;

  if (!depositId) {
    return res.status(400).json({ error: "Depozit IDsi kiritilmadi" });
  }

  const [deposit] = await db.select().from(depositsTable)
    .where(and(eq(depositsTable.id, parseInt(depositId)), eq(depositsTable.userId, user.userId)));

  if (!deposit) {
    return res.status(400).json({ error: "Depozit topilmadi" });
  }

  await db.update(depositsTable).set({
    status: "receipt_uploaded",
    receiptUrl: file?.path || null,
  }).where(eq(depositsTable.id, deposit.id));

  const msg = `🏦 <b>Yangi Depozit So'rovi!</b>\n\n👤 <b>${user.username}</b>\n🆔 ID: <code>${user.userId}</code>\n📞 Tel: ${user.phone}\n💳 Usul: <b>${deposit.method.toUpperCase()}</b>\n💰 Miqdor: <b>${deposit.amount.toLocaleString()} UZS</b>\n🕐 Vaqt: ${new Date().toLocaleString("uz-UZ")}\n\n${file ? "📎 Chek yuborilgan" : "⚠️ Cheksiz so'rov"}`;

  await sendToTelegram(msg, file?.path, user.userId, deposit.amount);

  return res.json({ ok: true, message: "Chek yuborildi. Admin tasdiqlagandan keyin balansingiz to'ldiriladi." });
});

// ── Get current user's deposit history ───────────────────────────────────────
router.get("/my-history", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const deposits = await db
    .select({
      id: depositsTable.id,
      method: depositsTable.method,
      amount: depositsTable.amount,
      status: depositsTable.status,
      createdAt: depositsTable.createdAt,
      confirmedAt: depositsTable.confirmedAt,
    })
    .from(depositsTable)
    .where(eq(depositsTable.userId, user.userId))
    .orderBy(desc(depositsTable.createdAt))
    .limit(50);
  return res.json({ deposits });
});

export default router;
