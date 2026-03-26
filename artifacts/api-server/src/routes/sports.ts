import { Router } from "express";
import { db, usersTable, transactionsTable, sportsBetsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware.js";
import { getWinRate } from "../lib/settings.js";

const router = Router();

// ── Static data ──────────────────────────────────────────────────────────────
const LEAGUES = [
  "UEFA Chempionlar Ligasi",
  "Angliya. Premier Liga",
  "Ispaniya. La Liga",
  "Germaniya. Bundesliga",
  "Italiya. Serie A",
  "Fransiya. Ligue 1",
  "Turkiya. Superlig",
  "O'zbekiston. Oliy Liga",
  "Niderlandiya. Eredivisie",
  "Yevropa Ligasi",
];

const TEAMS = [
  "Manchester City","Arsenal","Liverpool","Chelsea","Tottenham","Man United",
  "Real Madrid","Barcelona","Atletico Madrid","Bayern Munich","Borussia Dortmund",
  "Juventus","Inter Milan","AC Milan","Napoli","PSG","Lyon","Marseille",
  "Galatasaray","Fenerbahce","Besiktas","Trabzonspor",
  "AGMK","Pakhtakor","Nasaf","Navbahor","Lokomotiv Toshkent",
  "Porto","Benfica","Sporting CP","Ajax","Feyenoord",
  "Roma","Fiorentina","Lazio","Bodo-Glimt","Shakhtar","Dynamo Kyiv",
  "Sevilla","Valencia","Rayo Vallecano","Wolves","Brentford",
];

const FAMOUS_FIXTURES: [string, string, string][] = [
  ["Real Madrid",    "Barcelona",         "Ispaniya. La Liga"],
  ["Manchester City","Arsenal",           "Angliya. Premier Liga"],
  ["Liverpool",      "Man United",        "Angliya. Premier Liga"],
  ["Bayern Munich",  "Borussia Dortmund", "Germaniya. Bundesliga"],
  ["PSG",            "Marseille",         "Fransiya. Ligue 1"],
  ["Juventus",       "Inter Milan",       "Italiya. Serie A"],
  ["AC Milan",       "Napoli",            "Italiya. Serie A"],
  ["Galatasaray",    "Fenerbahce",        "Turkiya. Superlig"],
  ["Barcelona",      "Atletico Madrid",   "Ispaniya. La Liga"],
  ["Chelsea",        "Tottenham",         "Angliya. Premier Liga"],
  ["Manchester City","Liverpool",         "UEFA Chempionlar Ligasi"],
  ["Real Madrid",    "Atletico Madrid",   "UEFA Chempionlar Ligasi"],
  ["Arsenal",        "Chelsea",           "Angliya. Premier Liga"],
  ["Inter Milan",    "AC Milan",          "Italiya. Serie A"],
  ["Sporting CP",    "Benfica",           "Yevropa Ligasi"],
  ["Pakhtakor",      "AGMK",             "O'zbekiston. Oliy Liga"],
  ["Nasaf",          "Pakhtakor",         "O'zbekiston. Oliy Liga"],
  ["Ajax",           "PSG",              "UEFA Chempionlar Ligasi"],
  ["Roma",           "Fiorentina",        "Italiya. Serie A"],
  ["Bodo-Glimt",     "Shakhtar",          "Yevropa Ligasi"],
];

function randTeam(exclude?: string): string {
  let t: string;
  do { t = TEAMS[Math.floor(Math.random() * TEAMS.length)]; } while (t === exclude);
  return t;
}

// Base odds before any score influence (realistic range, lower values)
function randBaseOdds() {
  const homeAdv = Math.random(); // 0 = home underdog, 1 = home favourite
  return {
    home: parseFloat((1.30 + (1 - homeAdv) * 1.20).toFixed(2)), // 1.30–2.50
    draw: parseFloat((2.60 + Math.random() * 0.90).toFixed(2)), // 2.60–3.50
    away: parseFloat((1.40 + homeAdv * 1.60).toFixed(2)),       // 1.40–3.00
  };
}

// Recalculate displayed odds from base + live score
function calcOdds(base: any, homeScore: number, awayScore: number, minute: number) {
  const diff = homeScore - awayScore; // positive → home leading
  // Later in the game, goals shift odds more dramatically
  const tw = 0.75 + (minute / 90) * 0.60; // 0.75 at kick-off → 1.35 at 90'
  const shift = diff * 0.30 * tw;

  const h = parseFloat((base.home - shift + (Math.random() - 0.5) * 0.05).toFixed(2));
  const d = parseFloat((base.draw + Math.abs(diff) * 0.22 * tw + (Math.random() - 0.5) * 0.04).toFixed(2));
  const a = parseFloat((base.away + shift + (Math.random() - 0.5) * 0.05).toFixed(2));
  return {
    home: Math.max(1.01, h),
    draw: Math.max(1.01, d),
    away: Math.max(1.01, a),
  };
}

// Small random nudge to base odds each tick (keeps market moving)
function nudgeBase(base: any, scale = 0.04) {
  return {
    home: Math.max(1.01, parseFloat((base.home + (Math.random() - 0.5) * scale).toFixed(2))),
    draw: Math.max(1.01, parseFloat((base.draw + (Math.random() - 0.5) * scale * 0.6).toFixed(2))),
    away: Math.max(1.01, parseFloat((base.away + (Math.random() - 0.5) * scale).toFixed(2))),
  };
}

// ── Match creators ────────────────────────────────────────────────────────────
function createLive(id: string, leagueIdx: number): any {
  const home = randTeam();
  const away = randTeam(home);
  const hScore = Math.floor(Math.random() * 3);
  const aScore = Math.floor(Math.random() * 3);
  const min = Math.floor(Math.random() * 70) + 1;
  const base = randBaseOdds();
  return {
    id,
    league: LEAGUES[leagueIdx % LEAGUES.length],
    homeTeam: home, awayTeam: away,
    homeScore: hScore,
    awayScore: aScore,
    status: "live",
    minute: min,
    startTime: new Date(Date.now() - 3600000).toISOString(),
    baseOdds: base,
    odds: calcOdds(base, hScore, aScore, min),
    isLive: true,
    cards: {
      homeYellow: Math.floor(Math.random() * 3),
      awayYellow: Math.floor(Math.random() * 3),
      halfHomeYellow: 0,
      halfAwayYellow: 0,
    },
    corners: { home: Math.floor(Math.random() * 5), away: Math.floor(Math.random() * 5) },
    halfResolved: false,
  };
}

const EVENING_TIMES = [
  { h: 19, m: 0 }, { h: 19, m: 45 },
  { h: 20, m: 0 }, { h: 20, m: 45 },
  { h: 21, m: 0 }, { h: 21, m: 45 },
  { h: 22, m: 0 }, { h: 22, m: 30 },
  { h: 21, m: 15 }, { h: 20, m: 30 },
];

function createUpcoming(id: string, idx: number): any {
  const fixture = FAMOUS_FIXTURES[idx % FAMOUS_FIXTURES.length];
  const t = EVENING_TIMES[idx % EVENING_TIMES.length];
  const startTime = new Date();
  startTime.setDate(startTime.getDate() + Math.floor(idx / EVENING_TIMES.length));
  startTime.setHours(t.h, t.m, 0, 0);
  if (startTime.getTime() < Date.now()) startTime.setDate(startTime.getDate() + 1);
  const base = randBaseOdds();
  return {
    id,
    league: fixture[2],
    homeTeam: fixture[0], awayTeam: fixture[1],
    homeScore: 0, awayScore: 0,
    status: "scheduled",
    minute: 0,
    startTime: startTime.toISOString(),
    baseOdds: base,
    odds: calcOdds(base, 0, 0, 0),
    isLive: false,
    cards: { homeYellow: 0, awayYellow: 0, halfHomeYellow: 0, halfAwayYellow: 0 },
    corners: { home: 0, away: 0 },
    halfResolved: false,
  };
}

// ── Stable match store — IDs NEVER change ────────────────────────────────────
const store = new Map<string, any>();

function initStore() {
  for (let i = 0; i < 20; i++) store.set(`live_${i}`,     createLive(`live_${i}`, i));
  for (let i = 0; i < 20; i++) store.set(`upcoming_${i}`, createUpcoming(`upcoming_${i}`, i));
}

// ── Resolve pending bets for a match ─────────────────────────────────────────
async function resolveBetsForMatch(matchId: string, match: any, phase: "half" | "full") {
  try {
    const pendingBets = await db.select().from(sportsBetsTable)
      .where(and(
        eq(sportsBetsTable.matchId, matchId),
        eq(sportsBetsTable.status, "pending"),
      ));

    for (const bet of pendingBets) {
      const isCard = bet.isCardBet;
      const isHalf = bet.isFirstHalfCard;

      // Skip half-time card bets at full-time resolve, and vice versa
      if (phase === "half" && isCard && !isHalf) continue;
      if (phase === "full" && isCard && isHalf) continue;
      // Non-card bets only resolve at full time
      if (phase === "half" && !isCard) continue;

      let won = false;

      if (isCard) {
        // Resolve based on actual card stats
        const totalYellow = (match.cards?.homeYellow || 0) + (match.cards?.awayYellow || 0);
        const halfTotal   = (match.cards?.halfHomeYellow || 0) + (match.cards?.halfAwayYellow || 0);
        const desc = bet.betDescription.toLowerCase();

        if (desc.includes("jami sariq") || desc.includes("cards_total")) {
          const val = isHalf ? halfTotal : totalYellow;
          if (desc.includes("ko'p") || desc.includes("over") || desc.includes(">")) {
            const thr = parseFloat(desc.match(/[\d.]+/)?.[0] || "2.5");
            won = val > thr;
          } else {
            const thr = parseFloat(desc.match(/[\d.]+/)?.[0] || "2.5");
            won = val <= thr;
          }
        } else {
          // For other card bets, 40% win rate
          won = Math.random() < 0.40;
        }
      } else {
        // Regular bets: use actual match result for 1X2 bets, random for others
        const globalWinRate = await getWinRate();
        const winRateFraction = globalWinRate / 100;
        const desc = (bet.betDescription || "").toLowerCase();

        // Determine actual match result
        const hScore = match.homeScore ?? 0;
        const aScore = match.awayScore ?? 0;
        const actualResult = hScore > aScore ? "home" : hScore < aScore ? "away" : "draw";

        // Match bet choice to actual result
        const betOnHome = desc.startsWith("1 ") || desc.startsWith("1(");
        const betOnDraw  = desc.startsWith("x ") || desc.startsWith("x(") || desc.includes("durang");
        const betOnAway  = desc.startsWith("2 ") || desc.startsWith("2(");

        if (betOnHome || betOnDraw || betOnAway) {
          // 1X2 bet: compare with actual result, apply win rate throttle
          const correctPick =
            (betOnHome && actualResult === "home") ||
            (betOnDraw && actualResult === "draw") ||
            (betOnAway && actualResult === "away");
          // Throttle: correct pick wins if admin winRate allows (house edge)
          won = correctPick && Math.random() < Math.max(winRateFraction, 0.30);
          // If wrong pick, small chance of "lucky" win too
          if (!correctPick) won = Math.random() < (winRateFraction * 0.15);
        } else {
          // Other market bets: random based on admin win rate
          won = Math.random() < winRateFraction;
        }
      }

      const winAmount = won ? Math.round(bet.betAmount * bet.odds) : 0;
      const resolvedAt = new Date();

      // Update bet status
      await db.update(sportsBetsTable).set({
        status: "resolved",
        won,
        winAmount,
        resolvedAt,
      }).where(eq(sportsBetsTable.id, bet.id));

      // Update user balance
      const users = await db.select().from(usersTable).where(eq(usersTable.userId, bet.userId));
      if (users.length > 0) {
        const user = users[0];
        const newBalance = user.balance + winAmount;
        await db.update(usersTable).set({ balance: newBalance }).where(eq(usersTable.userId, bet.userId));

        // Insert transaction
        await db.insert(transactionsTable).values({
          userId: bet.userId,
          type: "sports_bet",
          amount: won ? winAmount - bet.betAmount : -bet.betAmount,
          status: "completed",
          description: `${bet.matchName}: ${bet.betDescription} (x${bet.odds.toFixed(2)}) — ${won ? `✅ Yutdi +${winAmount.toLocaleString()}` : "❌ Yutqazdi"}`,
        });
      }
    }
  } catch (e) {
    console.error("resolveBets error:", e);
  }
}

// ── Tick: update match states every second ────────────────────────────────────
async function tick() {
  const now = Date.now();
  for (const [id, m] of store) {
    if (m.isLive) {
      const min = (m.minute || 0) + 1;

      // Half-time: resolve first-half card bets once
      if (min === 46 && !m.halfResolved) {
        // Freeze half-time card stats before they accumulate further
        store.set(id, {
          ...m, minute: min,
          cards: {
            ...m.cards,
            halfHomeYellow: m.cards.homeYellow,
            halfAwayYellow: m.cards.awayYellow,
          },
          halfResolved: true,
        });
        resolveBetsForMatch(id, store.get(id), "half");
        continue;
      }

      if (min > 93) {
        // Full time — resolve all remaining bets then replace match
        await resolveBetsForMatch(id, m, "full");
        const idx = parseInt(id.split("_")[1]);
        store.set(id, createLive(id, idx));
      } else {
        const goalH  = (min % 23 === 0) && Math.random() < 0.38;
        const goalA  = (min % 31 === 0) && Math.random() < 0.32;
        const yelH   = Math.random() < 0.016;
        const yelA   = Math.random() < 0.016;
        const newHS  = m.homeScore + (goalH ? 1 : 0);
        const newAS  = m.awayScore + (goalA ? 1 : 0);
        const newBase = nudgeBase(m.baseOdds || m.odds);
        store.set(id, {
          ...m, minute: min,
          homeScore: newHS,
          awayScore: newAS,
          cards: {
            homeYellow:     m.cards.homeYellow + (yelH ? 1 : 0),
            awayYellow:     m.cards.awayYellow + (yelA ? 1 : 0),
            halfHomeYellow: m.cards.halfHomeYellow || 0,
            halfAwayYellow: m.cards.halfAwayYellow || 0,
          },
          corners: {
            home: m.corners.home + (Math.random() < 0.07 ? 1 : 0),
            away: m.corners.away + (Math.random() < 0.07 ? 1 : 0),
          },
          baseOdds: newBase,
          odds: calcOdds(newBase, newHS, newAS, min),
        });
      }
    } else {
      if (new Date(m.startTime).getTime() < now) {
        const idx = parseInt(id.split("_")[1]);
        store.set(id, createUpcoming(id, idx + 1));
      } else {
        const newBase = nudgeBase(m.baseOdds || m.odds, 0.02);
        store.set(id, { ...m, baseOdds: newBase, odds: calcOdds(newBase, 0, 0, 0) });
      }
    }
  }
}

initStore();
// 10 real seconds = 1 game minute → full 90-min match ≈ 15 real minutes
setInterval(tick, 10000);

// ── Market generators ─────────────────────────────────────────────────────────
function genTotals(count: number) {
  const thr = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
  return thr.slice(0, Math.ceil(count / 2)).map(t => {
    const b = parseFloat((1.4 + Math.random() * 1.8).toFixed(2));
    return { label: `${t}`, over: Math.max(1.01, b), under: Math.max(1.01, parseFloat((2.85 / b + 0.05).toFixed(2))) };
  });
}

function genHandicaps() {
  return [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2].map(h => {
    const b = parseFloat((1.5 + Math.random() * 1.5).toFixed(2));
    return { label: `${h >= 0 ? "+" : ""}${h}`, h1: Math.max(1.01, b), h2: Math.max(1.01, parseFloat((2.85 / b + 0.05).toFixed(2))) };
  });
}

function rnd(min: number, max: number) {
  return Math.max(1.01, parseFloat((min + Math.random() * (max - min)).toFixed(2)));
}

function buildMarkets(m: any) {
  const o = m.odds;
  return [
    {
      id: "1x2", name: "1X2", count: 3, pinned: true, type: "1x2",
      odds: [{ label: "1", value: o.home }, { label: "X", value: o.draw }, { label: "2", value: o.away }],
    },
    {
      id: "double", name: "Qo'shaloq imkoniyat", count: 3, pinned: false, type: "double",
      odds: [
        { label: "1X", value: Math.max(1.01, parseFloat((o.home * 0.62).toFixed(2))) },
        { label: "12", value: Math.max(1.01, parseFloat(((o.home + o.away) / 3.2).toFixed(2))) },
        { label: "X2", value: Math.max(1.01, parseFloat((o.away * 0.62).toFixed(2))) },
      ],
    },
    { id: "total_home", name: "1-ning Individual totali",      count: 18, pinned: true,  type: "total",    totals: genTotals(18) },
    { id: "total_away", name: "2-ning Individual totali",      count: 10, pinned: false, type: "total",    totals: genTotals(10) },
    {
      id: "btts", name: "Ikkala taymda hech kim gol urmaydi", count: 2, pinned: false, type: "yn",
      odds: [
        { label: "Ha",   value: rnd(1.55, 2.1) },
        { label: "Yo'q", value: rnd(1.6, 2.5)  },
      ],
    },
    { id: "handicap", name: "Fora", count: 20, pinned: true, type: "handicap", handicaps: genHandicaps() },
    {
      id: "next_stage", name: "Qaysi jamoa keyingi bosqichga o'tadi?", count: 2, pinned: false, type: "yn",
      odds: [
        { label: m.homeTeam, value: rnd(1.65, 2.5) },
        { label: m.awayTeam, value: rnd(1.75, 2.8) },
      ],
    },
    // ── Sariq kartochkalar (faqat o'yin oxirida hisoblanadi) ──
    {
      id: "cards_total", name: "🟨 Sariq kartochkalar (o'yin oxiri)", count: 8, pinned: false, type: "total",
      note: "O'yin oxirida hisoblanadi",
      totals: [1.5, 2.5, 3.5, 4.5].map(t => ({
        label: `${t}`,
        over:  rnd(1.55, 2.4),
        under: rnd(1.55, 2.4),
      })),
    },
    {
      id: "cards_half", name: "🟨 Sariq kartochkalar (1-taym oxiri)", count: 6, pinned: false, type: "total",
      note: "1-taym oxirida hisoblanadi",
      totals: [0.5, 1.5, 2.5].map(t => ({
        label: `${t}`,
        over:  rnd(1.7, 2.8),
        under: rnd(1.5, 2.2),
      })),
    },
    {
      id: "cards_home", name: `🟨 ${m.homeTeam} sariq kartochkalar`, count: 6, pinned: false, type: "total",
      note: "O'yin oxirida hisoblanadi",
      totals: [0.5, 1.5, 2.5].map(t => ({
        label: `${t}`,
        over:  rnd(1.6, 2.6),
        under: rnd(1.5, 2.2),
      })),
    },
    {
      id: "cards_away", name: `🟨 ${m.awayTeam} sariq kartochkalar`, count: 6, pinned: false, type: "total",
      note: "O'yin oxirida hisoblanadi",
      totals: [0.5, 1.5, 2.5].map(t => ({
        label: `${t}`,
        over:  rnd(1.6, 2.6),
        under: rnd(1.5, 2.2),
      })),
    },
    {
      id: "cards_first", name: "🟨 Birinchi sariq kartochka jamoasi", count: 3, pinned: false, type: "yn",
      note: "O'yin oxirida hisoblanadi",
      odds: [
        { label: m.homeTeam,   value: rnd(1.7, 2.4) },
        { label: m.awayTeam,   value: rnd(1.7, 2.4) },
        { label: "Kartochkasiz", value: rnd(8.0, 15.0) },
      ],
    },
  ];
}

// ── Routes ────────────────────────────────────────────────────────────────────
router.get("/matches", (_req, res) => {
  const all = Array.from(store.values());
  return res.json({
    live:     all.filter(m => m.isLive),
    upcoming: all.filter(m => !m.isLive),
  });
});

router.get("/match/:id", (req, res) => {
  const m = store.get(req.params.id);
  if (!m) return res.status(404).json({ error: "O'yin topilmadi" });
  return res.json({ match: { ...m, markets: buildMarkets(m) } });
});

// ── Place single bet (pending, resolves at match end) ────────────────────────
router.post("/bet", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { matchId, betDescription, betAmount, odds } = req.body;

  if (!betAmount || Number(betAmount) <= 0)
    return res.status(400).json({ error: "Stavka miqdori noto'g'ri" });
  if (Number(betAmount) > user.balance)
    return res.status(400).json({ error: "Balansingiz yetarli emas" });
  if (!odds || Number(odds) < 1.01)
    return res.status(400).json({ error: "Koeffitsient noto'g'ri" });

  const amount  = Number(betAmount);
  const oddsNum = Number(odds);
  const match   = store.get(matchId);
  const matchName = match ? `${match.homeTeam} — ${match.awayTeam}` : (matchId ?? "Sport");
  const desc = betDescription || "Sport tikish";

  const isCardBet      = desc.toLowerCase().includes("sariq") || desc.toLowerCase().includes("card");
  const isFirstHalfCard = isCardBet && (desc.toLowerCase().includes("1-taym") || desc.toLowerCase().includes("half"));

  // Deduct bet amount immediately
  await db.update(usersTable).set({
    balance: user.balance - amount,
    totalWagered: user.totalWagered + amount,
  }).where(eq(usersTable.userId, user.userId));

  // Store as pending
  await db.insert(sportsBetsTable).values({
    userId: user.userId,
    matchId,
    matchName,
    betDescription: desc,
    betAmount: amount,
    odds: oddsNum,
    status: "pending",
    isCardBet,
    isFirstHalfCard,
    isCoupon: false,
  });

  return res.json({
    pending: true,
    message: isCardBet
      ? `⏳ Kartochka stavkasi qabul qilindi! ${isFirstHalfCard ? "1-taym" : "O'yin"} oxirida natija aniqlanadi.`
      : `⏳ Stavka qabul qilindi! O'yin oxirida natija aniqlanadi.`,
  });
});

// ── Place coupon (accumulator) bet ──────────────────────────────────────────
router.post("/coupon-bet", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { selections, betAmount } = req.body;

  if (!Array.isArray(selections) || selections.length < 2)
    return res.status(400).json({ error: "Kamida 2 ta tanlov kerak" });
  if (!betAmount || Number(betAmount) <= 0)
    return res.status(400).json({ error: "Stavka miqdori noto'g'ri" });
  if (Number(betAmount) > user.balance)
    return res.status(400).json({ error: "Balansingiz yetarli emas" });

  const amount = Number(betAmount);
  const totalOdds = parseFloat(
    selections.reduce((acc: number, s: any) => acc * Number(s.odds), 1).toFixed(4)
  );

  // Build combined description
  const selDesc = selections.map((s: any) => {
    const m = store.get(s.matchId);
    const mName = m ? `${m.homeTeam} — ${m.awayTeam}` : s.matchId;
    return `${mName}: ${s.betDescription}`;
  }).join(" | ");

  // Deduct immediately
  await db.update(usersTable).set({
    balance: user.balance - amount,
    totalWagered: user.totalWagered + amount,
  }).where(eq(usersTable.userId, user.userId));

  // Store one coupon record per selection (resolved at respective match end)
  // But also store one master coupon record
  await db.insert(sportsBetsTable).values({
    userId: user.userId,
    matchId: selections.map((s: any) => s.matchId).join(","),
    matchName: `KUPON (${selections.length} ta o'yin)`,
    betDescription: selDesc,
    betAmount: amount,
    odds: totalOdds,
    status: "pending",
    isCardBet: false,
    isFirstHalfCard: false,
    isCoupon: true,
  });

  // For coupon, simulate resolution after 60s (since matches don't all end simultaneously)
  setTimeout(async () => {
    try {
      const won = Math.random() < 0.35;
      const winAmount = won ? Math.round(amount * totalOdds) : 0;
      const users = await db.select().from(usersTable).where(eq(usersTable.userId, user.userId));
      if (users.length > 0) {
        await db.update(usersTable).set({ balance: users[0].balance + winAmount })
          .where(eq(usersTable.userId, user.userId));
      }
      await db.insert(transactionsTable).values({
        userId: user.userId,
        type: "coupon_bet",
        amount: won ? winAmount - amount : -amount,
        status: "completed",
        description: `🎫 ${selDesc} (x${totalOdds.toFixed(2)}) — ${won ? `✅ Yutdi +${winAmount.toLocaleString()}` : "❌ Yutqazdi"}`,
      });
      // Resolve the pending record
      const rows = await db.select().from(sportsBetsTable)
        .where(and(
          eq(sportsBetsTable.userId, user.userId),
          eq(sportsBetsTable.isCoupon, true),
          eq(sportsBetsTable.status, "pending"),
        ));
      if (rows.length > 0) {
        await db.update(sportsBetsTable).set({
          status: "resolved", won, winAmount, resolvedAt: new Date(),
        }).where(eq(sportsBetsTable.id, rows[rows.length - 1].id));
      }
    } catch (e) {
      console.error("coupon resolve error:", e);
    }
  }, 60_000);

  return res.json({
    pending: true,
    totalOdds,
    potentialWin: Math.round(amount * totalOdds),
    message: `🎫 Kupon qabul qilindi! Jami odds: x${totalOdds.toFixed(2)}. Natija 60 soniyadan keyin aniqlanadi.`,
  });
});

// ── Get user's sports bet history ────────────────────────────────────────────
router.get("/my-bets", requireAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    const bets = await db.select().from(sportsBetsTable)
      .where(eq(sportsBetsTable.userId, user.userId));
    const sorted = bets.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return res.json({ bets: sorted.slice(0, 50) });
  } catch (e) {
    console.error("my-bets error:", e);
    return res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
