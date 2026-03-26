import { Router } from "express";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware.js";

const router = Router();

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// 10 segments — 1/10 free_bet probability
const SEGMENTS = [
  { idx: 0, type: "bomb",      label: "💣 Bomba",       prize: 0,     gameRedirect: false },
  { idx: 1, type: "free_spin", label: "🔄 Bepul spin",  prize: 0,     gameRedirect: false },
  { idx: 2, type: "bomb",      label: "💣 Bomba",       prize: 0,     gameRedirect: false },
  { idx: 3, type: "x2",        label: "×2 Bonus",       prize: 10000, gameRedirect: true  },
  { idx: 4, type: "bomb",      label: "💣 Bomba",       prize: 0,     gameRedirect: false },
  { idx: 5, type: "bomb",      label: "💣 Bomba",       prize: 0,     gameRedirect: false },
  { idx: 6, type: "free_bet",  label: "🎰 FREE BET",   prize: 20000, gameRedirect: true  },
  { idx: 7, type: "bomb",      label: "💣 Bomba",       prize: 0,     gameRedirect: false },
  { idx: 8, type: "money",     label: "💰 5,000 UZS",  prize: 5000,  gameRedirect: false },
  { idx: 9, type: "bomb",      label: "💣 Bomba",       prize: 0,     gameRedirect: false },
];

const GAMES = [
  { name: "Mines",     path: "/mines"     },
  { name: "Crash",     path: "/crash"     },
  { name: "Dice",      path: "/dice"      },
  { name: "Coinflip",  path: "/coinflip"  },
  { name: "Plinko",    path: "/plinko"    },
  { name: "Roulette",  path: "/roulette"  },
  { name: "Blackjack", path: "/blackjack" },
  { name: "Wheel",     path: "/wheel"     },
];

// GET /api/lucky-wheel/status
router.get("/status", requireAuth, async (req, res) => {
  const user = (req as any).user;

  const rows = await db
    .select({ createdAt: transactionsTable.createdAt, description: transactionsTable.description })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, user.userId),
      eq(transactionsTable.type, "lucky_wheel_spin"),
    ))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(1);

  const lastSpunAt = rows[0]?.createdAt ?? null;
  const hasDeposited = user.totalDeposited > 0;
  const cooldownOk = !lastSpunAt || (Date.now() - new Date(lastSpunAt).getTime() >= COOLDOWN_MS);
  const canSpin = hasDeposited && cooldownOk;
  const nextSpinAt = lastSpunAt
    ? new Date(new Date(lastSpunAt).getTime() + COOLDOWN_MS).toISOString()
    : null;

  return res.json({ canSpin, nextSpinAt, hasDeposited });
});

// POST /api/lucky-wheel/spin
router.post("/spin", requireAuth, async (req, res) => {
  const user = (req as any).user;

  // Require at least one deposit before spinning
  if (!user.totalDeposited || user.totalDeposited <= 0) {
    return res.status(403).json({ error: "Lucky Wheel uchun kamida 1 marta depozit qilishingiz kerak" });
  }

  // Cooldown check
  const rows = await db
    .select({ createdAt: transactionsTable.createdAt })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, user.userId),
      eq(transactionsTable.type, "lucky_wheel_spin"),
    ))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(1);

  if (rows.length > 0) {
    const elapsed = Date.now() - new Date(rows[0].createdAt).getTime();
    if (elapsed < COOLDOWN_MS) {
      const nextAt = new Date(new Date(rows[0].createdAt).getTime() + COOLDOWN_MS).toISOString();
      return res.status(400).json({ error: "Hali erta", nextSpinAt: nextAt });
    }
  }

  // Pick segment — weighted: bombs × 6, free_bet × 1, x2 × 1, money × 1, free_spin × 1
  // Use built-in indices: 0,2,4,5,7,9 = bomb; 1 = free_spin; 3 = x2; 6 = free_bet; 8 = money
  const weights = [6, 1, 1, 1, 1]; // bomb, free_spin, x2, free_bet, money
  const types   = ["bomb", "free_spin", "x2", "free_bet", "money"];
  const total   = weights.reduce((a, b) => a + b, 0); // 10
  let rand      = Math.floor(Math.random() * total);
  let pickedType = "bomb";
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i];
    if (rand < 0) { pickedType = types[i]; break; }
  }

  // Find matching segment index (pick randomly among matching)
  const matching = SEGMENTS.filter(s => s.type === pickedType);
  const seg = matching[Math.floor(Math.random() * matching.length)];

  // Pick random game for redirect
  const game = GAMES[Math.floor(Math.random() * GAMES.length)];

  // Apply prize to balance if non-zero (bomb ALWAYS gives 0)
  const actualPrize = seg.type === "bomb" ? 0 : seg.prize;
  if (actualPrize > 0) {
    await db.update(usersTable)
      .set({ balance: user.balance + actualPrize })
      .where(eq(usersTable.userId, user.userId));

    await db.insert(transactionsTable).values({
      userId: user.userId,
      type: "lucky_wheel_bonus",
      amount: actualPrize,
      status: "completed",
      description: `🎡 Lucky Wheel bonus: ${seg.label} +${actualPrize.toLocaleString()} UZS`,
    });
  }

  // Record spin (free_spin does NOT consume the cooldown)
  if (seg.type !== "free_spin") {
    await db.insert(transactionsTable).values({
      userId: user.userId,
      type: "lucky_wheel_spin",
      amount: 0,
      status: "completed",
      description: `🎡 Lucky Wheel aylantirdi: ${seg.label}`,
    });
  }

  return res.json({
    segmentIndex: seg.idx,
    segment: { type: seg.type, label: seg.label, prize: seg.prize },
    game: seg.gameRedirect ? game : null,
    newBalance: user.balance + seg.prize,
  });
});

export default router;
