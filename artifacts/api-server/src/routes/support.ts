import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import { requireAuth } from "../lib/auth-middleware.js";
import { db } from "@workspace/db";
import { supportMessagesTable, tgMsgMapTable } from "@workspace/db";
import { eq, asc, and, desc } from "drizzle-orm";
import { getOperatorIds, registerOperator, removeOperator, isOperator, loadOperatorsFromDB } from "../lib/operators.js";
import { handleDepositCallback } from "./deposit.js";
import { handleWithdrawalCallback } from "./withdrawal.js";

const router = Router();
const BOT_TOKEN          = "8520676994:AAGeJoFl7snXkTfNG3iRFSxX4J8fB6JXReA"; // Promo/support bot
const OPERATOR_BOT_TOKEN = "8743378443:AAFZ1rWsJ7T_ikruznsA8kzNOTKyvrpFa0U"; // Operator panel bot

// ── Safe fetch with timeout ──────────────────────────────────────────────────
// Every Telegram API call must use this — prevents hanging fetches that freeze
// the polling loop when Telegram API is slow or unresponsive.
async function tgFetch(url: string, opts: any = {}, timeoutMs = 10_000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal as any });
  } finally {
    clearTimeout(timer);
  }
}

const uploadDir = "/tmp/support-files";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 50 * 1024 * 1024 } });

let lastUpdateId   = 0;
let lastOpUpdateId = 0;

// ── DB-based message mapping ────────────────────────────────────────────────
// Stores Telegram message_id → website userId in PostgreSQL (survives restarts)
async function storeMsgMapping(chatId: string, msgId: number, userId: string) {
  try {
    await db.insert(tgMsgMapTable).values({ chatId, msgId, userId });
  } catch (e) {
    console.error("storeMsgMapping error:", e);
  }
}

// Delete a single Telegram message from operator bot
async function deleteTgMsg(chatId: string, msgId: number) {
  try {
    await tgFetch(`https://api.telegram.org/bot${OPERATOR_BOT_TOKEN}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: msgId }),
    });
  } catch {}
}

// Delete ALL operator bot messages related to a userId, then clear DB mappings
async function deleteAllOpMsgsForUser(userId: string) {
  try {
    const rows = await db.select().from(tgMsgMapTable).where(eq(tgMsgMapTable.userId, userId));
    await Promise.all(rows.map(r => deleteTgMsg(r.chatId, r.msgId)));
    // Clear the mapping rows
    await db.delete(tgMsgMapTable).where(eq(tgMsgMapTable.userId, userId));
    console.log(`[Support] Deleted ${rows.length} Telegram messages for user ${userId}`);
  } catch (e) {
    console.error("deleteAllOpMsgsForUser error:", e);
  }
}

async function lookupUser(chatId: string, msgId: number): Promise<string | undefined> {
  try {
    const rows = await db.select()
      .from(tgMsgMapTable)
      .where(and(eq(tgMsgMapTable.chatId, chatId), eq(tgMsgMapTable.msgId, msgId)))
      .limit(1);
    return rows[0]?.userId;
  } catch (e) {
    console.error("lookupUser error:", e);
    return undefined;
  }
}

// ── Telegram helpers ────────────────────────────────────────────────────────
async function tgSendOne(chatId: string, text: string, replyMarkup?: any): Promise<number | null> {
  try {
    const res = await tgFetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...(replyMarkup !== undefined ? { reply_markup: replyMarkup } : {}),
      }),
    });
    const data = await res.json() as any;
    return data?.result?.message_id ?? null;
  } catch (e) {
    console.error("tgSendOne error:", e);
    return null;
  }
}

// Broadcast support message to ALL operators via OPERATOR_BOT_TOKEN
async function tgSend(text: string, userId: string, replyMarkup?: any) {
  const keyboard = replyMarkup ?? {
    inline_keyboard: [[
      { text: "✅ Hal qilindi", callback_data: `close_${userId}` },
    ]],
  };
  await Promise.all(getOperatorIds().map(async (chatId) => {
    const msgId = await opTgSendOne(chatId, text, keyboard);
    if (msgId) await storeMsgMapping(chatId, msgId, userId);
  }));
}

async function tgSendFile(caption: string, filePath: string, mime: string, userId: string) {
  const keyboard = {
    inline_keyboard: [[
      { text: "✅ Hal qilindi", callback_data: `close_${userId}` },
    ]],
  };

  await Promise.all(getOperatorIds().map(async (chatId) => {
    try {
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("caption", caption.substring(0, 1024));
      form.append("parse_mode", "HTML");
      form.append("reply_markup", JSON.stringify(keyboard));
      const stream = fs.createReadStream(filePath);
      let res: any;
      if (mime.startsWith("image/")) {
        form.append("photo", stream);
        res = await tgFetch(`https://api.telegram.org/bot${OPERATOR_BOT_TOKEN}/sendPhoto`, { method: "POST", body: form as any }, 30_000);
      } else if (mime.startsWith("video/")) {
        form.append("video", stream);
        res = await tgFetch(`https://api.telegram.org/bot${OPERATOR_BOT_TOKEN}/sendVideo`, { method: "POST", body: form as any }, 30_000);
      } else {
        form.append("document", stream);
        res = await tgFetch(`https://api.telegram.org/bot${OPERATOR_BOT_TOKEN}/sendDocument`, { method: "POST", body: form as any }, 30_000);
      }
      const data = await res?.json() as any;
      const msgId = data?.result?.message_id;
      if (msgId) await storeMsgMapping(chatId, msgId, userId);
    } catch (e) {
      console.error("tgSendFile error:", e);
    }
  }));
}

async function answerCallback(cbId: string, text: string) {
  try {
    await tgFetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cbId, text, show_alert: false }),
    });
  } catch {}
}

// ── Operator bot helpers (old bot) ───────────────────────────────────────────
async function opTgSendOne(chatId: string, text: string, replyMarkup?: any): Promise<number | null> {
  try {
    const res = await tgFetch(`https://api.telegram.org/bot${OPERATOR_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...(replyMarkup !== undefined ? { reply_markup: replyMarkup } : {}),
      }),
    });
    const data = await res.json() as any;
    return data?.result?.message_id ?? null;
  } catch (e) {
    console.error("opTgSendOne error:", e);
    return null;
  }
}

async function answerOpCallback(cbId: string, text: string, showAlert = false) {
  try {
    await tgFetch(`https://api.telegram.org/bot${OPERATOR_BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cbId, text, show_alert: showAlert }),
    });
  } catch {}
}

// Remove inline keyboard buttons from a message after it's been acted on
async function removeOpMsgKeyboard(chatId: string, messageId: number) {
  try {
    await tgFetch(`https://api.telegram.org/bot${OPERATOR_BOT_TOKEN}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
    });
  } catch {}
}

// ── Retry queue for failed Telegram sends ────────────────────────────────────
interface RetryItem {
  caption: string;
  userId: string;
  filePath?: string;
  mime?: string;
  attempts: number;
  nextRetry: number;
}
const retryQueue: RetryItem[] = [];

async function processRetryQueue() {
  const now = Date.now();
  const pending = retryQueue.filter(item => item.nextRetry <= now);
  for (const item of pending) {
    const idx = retryQueue.indexOf(item);
    retryQueue.splice(idx, 1);
    if (item.attempts >= 5) {
      console.warn(`[Support] Retry exhausted for userId=${item.userId} after 5 attempts`);
      continue;
    }
    try {
      if (item.filePath && item.mime) {
        await tgSendFile(item.caption, item.filePath, item.mime, item.userId);
      } else {
        await tgSend(item.caption, item.userId);
      }
      console.log(`[Support] Retry succeeded for userId=${item.userId} (attempt ${item.attempts + 1})`);
    } catch (e) {
      const delay = Math.min(60_000, 5_000 * Math.pow(2, item.attempts));
      retryQueue.push({ ...item, attempts: item.attempts + 1, nextRetry: Date.now() + delay });
      console.error(`[Support] Retry failed (attempt ${item.attempts + 1}), next in ${delay / 1000}s`);
    }
  }
}
setInterval(processRetryQueue, 5_000);

// ── Operator bot long-polling (24/7, no concurrent runs) ──────────────────────
let isOpPolling = false;

async function pollOperatorBot() {
  if (isOpPolling) return;
  isOpPolling = true;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 35_000);
    let res: any;
    try {
      res = await fetch(
        `https://api.telegram.org/bot${OPERATOR_BOT_TOKEN}/getUpdates?offset=${lastOpUpdateId + 1}&timeout=25&allowed_updates=["message","callback_query"]`,
        { signal: ctrl.signal as any }
      );
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json() as any;
    if (!data.ok || !data.result?.length) return;

    for (const update of data.result) {
      lastOpUpdateId = update.update_id;
      try { await processOpUpdate(update); }
      catch (e) { console.error("[OpBot] update error:", e); }
    }
  } catch (e: any) {
    if (e?.name !== "AbortError") console.error("[OpBot] poll error:", e?.message);
  } finally {
    isOpPolling = false;
  }
}

async function processOpUpdate(update: any) {
  // ── Callback queries ──────────────────────────────────────────────────────
  if (update.callback_query) {
    const cb       = update.callback_query;
    const cbData   = (cb.data || "") as string;
    const cbMsgId  = cb.message?.message_id as number | undefined;
    const cbChatId = String(cb.from?.id || cb.message?.chat?.id || "");

    // ALWAYS answer immediately — Telegram drops button if not answered in 30s
    if (cbData.startsWith("dep_approve_") || cbData.startsWith("dep_reject_")) {
      await answerOpCallback(cb.id, "⏳ Qayta ishlanmoqda...");
      if (cbMsgId) await removeOpMsgKeyboard(cbChatId, cbMsgId); // Remove buttons immediately
      await handleDepositCallback(cbData, cbChatId);

    } else if (cbData.startsWith("wd_approve_") || cbData.startsWith("wd_reject_")) {
      await answerOpCallback(cb.id, "⏳ Qayta ishlanmoqda...");
      if (cbMsgId) await removeOpMsgKeyboard(cbChatId, cbMsgId); // Remove buttons immediately
      await handleWithdrawalCallback(cbData, cbChatId);

    } else if (cbData.startsWith("close_")) {
      // Answer FIRST — heavy work runs async after
      await answerOpCallback(cb.id, "✅ Chat yopildi!", true);
      if (cbMsgId) await removeOpMsgKeyboard(cbChatId, cbMsgId);

      const targetUserId = cbData.replace("close_", "");
      const closerName   = [cb.from?.first_name, cb.from?.last_name].filter(Boolean).join(" ") || cb.from?.username || "Operator";

      // Fire-and-forget — do not block the polling loop
      (async () => {
        try {
          await db.insert(supportMessagesTable).values({
            userId: targetUserId,
            text: "✅ Muammoingiz hal qilindi. Chat yopildi. Boshqa savollar bo'lsa qayta yozing.",
            isOperator: true,
          });
          await deleteAllOpMsgsForUser(targetUserId);
          const allOps = getOperatorIds();
          const kb = { inline_keyboard: [[{ text: "🔓 Qayta ochish", callback_data: `reopen_${targetUserId}` }]] };
          for (const opId of allOps) {
            await opTgSendOne(
              opId,
              `🗑 <b>Chat yopildi</b>\n👤 Operator: <b>${closerName}</b>\n🆔 User: <code>${targetUserId}</code>\n\n📭 Barcha xabarlar o'chirildi.`,
              kb,
            );
          }
        } catch (e) { console.error("[OpBot] close_ async error:", e); }
      })();

    } else if (cbData.startsWith("reopen_")) {
      await answerOpCallback(cb.id, "🔓 Chat qayta ochildi!", true);
      if (cbMsgId) await removeOpMsgKeyboard(cbChatId, cbMsgId);

      const targetUserId = cbData.replace("reopen_", "");
      const openerName   = [cb.from?.first_name, cb.from?.last_name].filter(Boolean).join(" ") || cb.from?.username || "Operator";

      (async () => {
        try {
          await db.insert(supportMessagesTable).values({
            userId: targetUserId,
            text: "👋 Operator sizni yana kutmoqda! Yangi savolingizni yozing.",
            isOperator: true,
          });
          const allOps = getOperatorIds();
          for (const opId of allOps) {
            await opTgSendOne(opId, `🔓 <b>Chat qayta ochildi</b>\n👤 Operator: <b>${openerName}</b>\n🆔 User: <code>${targetUserId}</code>`);
          }
        } catch (e) { console.error("[OpBot] reopen_ async error:", e); }
      })();

    } else {
      await answerOpCallback(cb.id, "");
    }
    return;
  }

  // ── Text messages ─────────────────────────────────────────────────────────
  const msg = update.message;
  if (!msg) return;

  const fromId     = String(msg.from?.id || "");
  const chatId     = String(msg.chat?.id || "");
  const senderId   = fromId || chatId;
  const text       = (msg.text || "") as string;
  const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || msg.from?.username || "Operator";

  if (text.startsWith("/start")) {
    const isNew  = await registerOperator(senderId, senderName);
    const allOps = getOperatorIds();
    await opTgSendOne(
      senderId,
      `✅ <b>BetUZ Operator Paneli</b>\n\n🆔 Chat ID: <code>${senderId}</code>\n👤 Ism: <b>${senderName}</b>\n\n${isNew ? "🎉 Siz yangi operator sifatida qo'shildingiz!" : "✅ Siz allaqachon operator ro'yxatidasiz."}\n\n📥 Barcha <b>depozit</b>, <b>chiqim</b> va <b>support</b> xabarlari shu botga keladi.\n\n💬 Foydalanuvchi xabariga javob berish uchun xabarga <b>Reply</b> (chapga suring) qiling — avtomatik yuboriladi.\n🔘 Depozit/chiqim tasdiqlash uchun xabar ostidagi tugmalardan foydalaning.\n\n👥 Jami operatorlar: <b>${allOps.length}</b> ta`,
    );
    if (isNew) {
      for (const opId of allOps) {
        if (opId === senderId) continue;
        await opTgSendOne(opId, `👤 Yangi operator qo'shildi: <b>${senderName}</b> (<code>${senderId}</code>)\n👥 Jami: ${allOps.length} ta operator`);
      }
    }
    return;
  }

  if (text.startsWith("/operators")) {
    const allOps = getOperatorIds();
    await opTgSendOne(senderId, `👥 <b>Barcha operatorlar (${allOps.length} ta):</b>\n\n${allOps.map((id, i) => `${i + 1}. <code>${id}</code>`).join("\n")}`);
    return;
  }

  const ochishMatch = text.match(/^\/ochish\s+(\S+)/i);
  if (ochishMatch) {
    const targetUserId = ochishMatch[1];
    if (!isOperator(senderId)) { await opTgSendOne(senderId, `⛔ Ruxsat yo'q.`); return; }
    await db.insert(supportMessagesTable).values({
      userId: targetUserId,
      text: "👋 Operator sizni yana kutmoqda! Yangi savolingizni yozing.",
      isOperator: true,
    });
    const allOps = getOperatorIds();
    for (const opId of allOps) {
      await opTgSendOne(opId, `🔓 <b>Chat qayta ochildi</b>\n👤 Operator: <b>${senderName}</b>\n🆔 User: <code>${targetUserId}</code>`);
    }
    return;
  }

  if (!isOperator(senderId)) return;

  if (msg.reply_to_message && text.trim()) {
    const repliedToMsgId: number = msg.reply_to_message.message_id;
    const targetUserId = await lookupUser(chatId, repliedToMsgId);
    if (targetUserId) {
      await db.insert(supportMessagesTable).values({
        userId: targetUserId, text: text.trim(), isOperator: true, telegramMsgId: msg.message_id,
      });
      await opTgSendOne(senderId, `✅ Javob yuborildi → <b>${targetUserId}</b>`);
      const allOps = getOperatorIds();
      for (const opId of allOps) {
        if (opId === senderId) continue;
        await opTgSendOne(opId, `💬 <b>${senderName}</b> → User <code>${targetUserId}</code>:\n\n<i>"${text.trim()}"</i>`);
      }
    } else {
      await opTgSendOne(senderId, `⚠️ Bu xabar foydalanuvchiga bog'liq emas. Foydalanuvchi xabarini Reply qiling.`);
    }
  }

  const replyMatch = text.match(/^\/reply\s+(\S+)\s+([\s\S]+)$/i);
  if (replyMatch) {
    const targetId  = replyMatch[1];
    const replyText = replyMatch[2].trim();
    await db.insert(supportMessagesTable).values({ userId: targetId, text: replyText, isOperator: true });
    await opTgSendOne(senderId, `✅ Javob yuborildi → User ${targetId}`);
    const allOps = getOperatorIds();
    for (const opId of allOps) {
      if (opId === senderId) continue;
      await opTgSendOne(opId, `💬 <b>${senderName}</b> → User <code>${targetId}</code>:\n\n<i>"${replyText}"</i>`);
    }
  }
}

// Start operator bot loop — recursive setTimeout prevents overlap
// Watchdog: if polling is stuck for >45s, force-reset the flag so next cycle can run
let lastOpPollComplete = Date.now();
setInterval(() => {
  if (isOpPolling && Date.now() - lastOpPollComplete > 45_000) {
    console.warn("[OpBot] Watchdog: polling stuck >45s, force-resetting...");
    isOpPolling = false;
  }
}, 10_000);

function startOpPoll() {
  pollOperatorBot().finally(() => {
    lastOpPollComplete = Date.now();
    setTimeout(startOpPoll, 300);
  });
}
setTimeout(startOpPoll, 1000);

// ── Promo bot long-polling (24/7) ────────────────────────────────────────────
let isPromoPolling = false;

async function pollTelegram() {
  if (isPromoPolling) return;
  isPromoPolling = true;
  let data: any;
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 35_000);
    let res: any;
    try {
      res = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=25&allowed_updates=["message","callback_query"]`,
        { signal: ctrl.signal as any }
      );
    } finally {
      clearTimeout(timer);
    }
    data = await res.json() as any;
    if (!data.ok || !data.result?.length) return;

    for (const update of data.result) {
      lastUpdateId = update.update_id;

      // ── Callback query (button clicks) ──────────────────────────────────
      if (update.callback_query) {
        const cb = update.callback_query;
        const cbData: string = cb.data || "";
        await answerCallback(cb.id, "");

        if (cbData.startsWith("dep_approve_") || cbData.startsWith("dep_reject_")) {
          const fromChatId = String(cb.from?.id || cb.message?.chat?.id || "");
          await handleDepositCallback(cbData, fromChatId);
          continue;
        }

        if (cbData.startsWith("wd_approve_") || cbData.startsWith("wd_reject_")) {
          const fromChatId = String(cb.from?.id || cb.message?.chat?.id || "");
          await handleWithdrawalCallback(cbData, fromChatId);
          continue;
        }

        if (cbData.startsWith("close_")) {
          const targetUserId = cbData.replace("close_", "");
          const closerName = [cb.from?.first_name, cb.from?.last_name].filter(Boolean).join(" ") || cb.from?.username || "Operator";
          await db.insert(supportMessagesTable).values({
            userId: targetUserId,
            text: "✅ Muammoingiz hal qilindi. Chat yopildi. Boshqa savollar bo'lsa qayta yozing.",
            isOperator: true,
          });
          // Delete all operator Telegram messages about this user
          await deleteAllOpMsgsForUser(targetUserId);
          // Notify all operators with a "Qayta ochish" button
          const allOps2 = getOperatorIds();
          const reopenKeyboard2 = {
            inline_keyboard: [[{ text: "🔓 Qayta ochish", callback_data: `reopen_${targetUserId}` }]],
          };
          for (const opId of allOps2) {
            await opTgSendOne(
              opId,
              `🗑 <b>Chat yopildi</b>\n👤 Operator: <b>${closerName}</b>\n🆔 User: <code>${targetUserId}</code>\n\n📭 Barcha xabarlar o'chirildi.\nFoydalanuvchiga yangi murojaat qilishiga ruxsat berish uchun qayta oching.`,
              reopenKeyboard2,
            );
          }
        }
        continue;
      }

      // ── Text messages ────────────────────────────────────────────────────
      const msg = update.message;
      if (!msg) continue;

      const fromId   = String(msg.from?.id   || "");
      const chatId   = String(msg.chat?.id   || "");
      const senderId = fromId || chatId;
      const text: string = msg.text || msg.caption || "";

      // /start apk — ilova yuklab olish yo'riqnomasi
      if (text === "/start apk" || text.trim() === "/start apk") {
        const APP_URL = `https://${process.env.REPLIT_DOMAINS || "betuz.replit.app"}`;
        await tgSendOne(senderId,
`📲 <b>BetUZ ilovasini o'rnatish</b>

Quyidagi ko'rsatmani bajaring:

<b>1️⃣ Havolani nusxalang:</b>
<code>${APP_URL}</code>

<b>2️⃣ Chrome brauzerni oching</b>
(Telegram ichida emas, alohida Chrome ilovasi)

<b>3️⃣ Manzil satriga havolani joylashtiring</b>
va saytni oching

<b>4️⃣ Chrome menyusini bosing (⋮ yoki ...)</b>
va <b>"Ilovani o'rnatish"</b> yoki <b>"Qurilmaga qo'shish"</b> tanlang

<b>5️⃣ "O'rnatish"</b> tugmasini bosing ✅

Shundan so'ng BetUZ uy ekraningizda ilovaga o'xshab paydo bo'ladi! 🎰`,
          {
            inline_keyboard: [
              [{ text: "🌐 Saytni ochish (Chrome)", url: APP_URL }],
              [{ text: "📞 Yordam kerakmi?", url: `${APP_URL}/support` }],
            ],
          }
        );
        continue;
      }

      // /start — faqat reklama xabari (promo bot, operatorga aloqasi yo'q)
      if (text.startsWith("/start")) {
        const APP_URL = `https://${process.env.REPLIT_DOMAINS || "betuz.replit.app"}`;

        const promoText =
`🎰 <b>BetUZ — O'zbekistonning #1 Kazino!</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 <b>Nima uchun BetUZ?</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎮 <b>20+ zamonaviy o'yinlar:</b>
  • 🚀 Crash — x1000 gacha yutish!
  • 💣 Mines — strategik o'yin
  • 🎯 Ruletka, Blackjek, Plinko
  • 💎 Gems Odyssey puzzle o'yin

⚽ <b>Jonli Sport Tikish:</b>
  • Futbol, basketbol, tennis va boshqalar
  • Real vaqtda koeffitsientlar yangilanadi
  • Ekspress kupon → katta yutuqlar!

🎡 <b>Lucky Wheel — Har Kuni Bepul!</b>
  • Kuniga 1 marta aylantiring
  • FREE BET, ×2 bonus, pul yutuqlari!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 <b>To'lov usullari:</b>
  🟦 Uzcard  🟩 Humo  💳 Visa

⚡ Tezkor chiqim — 24 soat ichida
🔐 100% xavfsiz — ma'lumotlaringiz himoyalangan
👥 Do'st taklif qiling — har biri uchun mukofot!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 <b>Hoziroq ro'yxatdan o'ting va g'alaba qozonin!</b>`;

        await tgSendOne(senderId, promoText, {
          inline_keyboard: [
            [{ text: "🎮 Hoziroq O'ynash →", url: APP_URL }],
            [
              { text: "🎡 Lucky Wheel", url: `${APP_URL}/lucky-wheel` },
              { text: "⚽ Sport Tikish", url: `${APP_URL}/sport` },
            ],
            [{ text: "📞 Qo'llab-quvvatlash", url: `${APP_URL}/support` }],
          ],
        });
        continue;
      }

      // Only process messages from registered operators
      if (!isOperator(senderId)) continue;

      // ── Native Telegram Reply — operator swipes left on a forwarded msg ──
      if (msg.reply_to_message) {
        const repliedToMsgId: number = msg.reply_to_message.message_id;
        const targetUserId = await lookupUser(chatId, repliedToMsgId);
        const repSenderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || msg.from?.username || "Operator";

        if (targetUserId && text.trim()) {
          await db.insert(supportMessagesTable).values({
            userId: targetUserId,
            text: text.trim(),
            isOperator: true,
            telegramMsgId: msg.message_id,
          });
          await tgSendOne(senderId, `✅ Javob yuborildi → <b>${targetUserId}</b>`);
          // Broadcast to all other operators
          const allOps = getOperatorIds();
          for (const opId of allOps) {
            if (opId === senderId) continue;
            await opTgSendOne(opId, `💬 <b>${repSenderName}</b> → User <code>${targetUserId}</code>:\n\n<i>"${text.trim()}"</i>`);
          }
          continue;
        }

        if (!targetUserId && text.trim()) {
          await tgSendOne(senderId, `⚠️ Bu xabar foydalanuvchiga bog'liq emas. Foydalanuvchi xabarini Reply qiling.`);
          continue;
        }
      }

      // ── Legacy /reply command (still supported) ──────────────────────────
      const replyMatch = text.match(/^\/reply\s+(\S+)\s+([\s\S]+)$/i);
      if (replyMatch) {
        const targetId   = replyMatch[1];
        const replyText  = replyMatch[2].trim();
        await db.insert(supportMessagesTable).values({
          userId: targetId,
          text: replyText,
          isOperator: true,
          telegramMsgId: msg.message_id,
        });
        await tgSendOne(senderId, `✅ Javob yuborildi → User ${targetId}`);
      }
    }
  } catch (e: any) {
    if (e?.name !== "AbortError") console.error("[PromoBot] poll error:", e?.message);
  } finally {
    isPromoPolling = false;
  }
}

// Start promo bot loop — recursive setTimeout prevents overlap
// Watchdog: reset if stuck >45s
let lastPromoPollComplete = Date.now();
setInterval(() => {
  if (isPromoPolling && Date.now() - lastPromoPollComplete > 45_000) {
    console.warn("[PromoBot] Watchdog: polling stuck >45s, force-resetting...");
    isPromoPolling = false;
  }
}, 10_000);

function startPromoPoll() {
  pollTelegram().finally(() => {
    lastPromoPollComplete = Date.now();
    setTimeout(startPromoPoll, 300);
  });
}
setTimeout(startPromoPoll, 1500);

// GET messages
router.get("/messages", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const msgs = await db
    .select()
    .from(supportMessagesTable)
    .where(eq(supportMessagesTable.userId, user.userId))
    .orderBy(desc(supportMessagesTable.createdAt))
    .limit(200);

  // Reverse so frontend gets chronological order (oldest first)
  msgs.reverse();

  return res.json({
    messages: msgs.map((m) => ({
      id: m.id,
      text: m.text,
      isOperator: m.isOperator,
      fileUrl: m.fileUrl ? `/api/uploads/support/${path.basename(m.fileUrl)}` : null,
      fileType: m.fileType,
      time: m.createdAt.toISOString(),
    })),
  });
});

// POST message from user
router.post("/message", requireAuth, upload.single("file"), async (req, res) => {
  const user = (req as any).user;
  const message: string = req.body?.message || "";
  const file = req.file;

  if (!message.trim() && !file) {
    return res.status(400).json({ error: "Xabar yoki fayl yuborish kerak" });
  }

  let saved: any;
  try {
    [saved] = await db
      .insert(supportMessagesTable)
      .values({
        userId: user.userId,
        text: message.trim() || null,
        isOperator: false,
        fileUrl: file ? file.path : null,
        fileType: file ? file.mimetype : null,
      })
      .returning();
  } catch (e) {
    console.error("[Support] DB insert error:", e);
    return res.status(500).json({ error: "Server xatosi" });
  }

  // Immediately respond to user — do NOT await Telegram (prevents timeout)
  res.json({ ok: true, id: saved.id });

  // Fire-and-forget: send to Telegram in background, retry if fails
  const tgCaption = `💬 <b>Support Xabari</b>\n\n👤 <b>${user.username}</b>\n🆔 ID: <code>${user.userId}</code>\n📞 ${user.phone}\n\n📝 ${message || "(faqat fayl)"}\n\n↩️ <i>Javob berish uchun shu xabarga Reply qiling</i>`;

  (async () => {
    try {
      if (file) {
        await tgSendFile(tgCaption, file.path, file.mimetype, user.userId);
      } else {
        await tgSend(tgCaption, user.userId);
      }
    } catch (e) {
      console.error("[Support] Telegram forward error, adding to retry queue:", e);
      retryQueue.push({
        caption: tgCaption,
        userId: user.userId,
        filePath: file?.path,
        mime: file?.mimetype,
        attempts: 0,
        nextRetry: Date.now() + 5_000,
      });
    }
  })();
});

// DELETE /support/reset — foydalanuvchi eski chatni tozalab yangi murojaat boshlaydi
router.delete("/reset", requireAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    await db
      .delete(supportMessagesTable)
      .where(eq(supportMessagesTable.userId, user.userId));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Xatolik" });
  }
});

export default router;
