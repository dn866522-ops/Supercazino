import { Router } from "express";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware.js";
import { getWinRate } from "../lib/settings.js";

const router = Router();

const GAMES = [
  { id:"slots",       name:"Slots",         nameUz:"Slotlar",       type:"slots",       category:"popular", maxWin:"X100",   isHot:true,  isBest:true  },
  { id:"mines",       name:"Mines",         nameUz:"Minalar",       type:"mines",       category:"popular", maxWin:"X1000",  isHot:true,  isBest:true  },
  { id:"crash",       name:"Crash",         nameUz:"Crash",         type:"crash",       category:"popular", maxWin:"X1000",  isHot:true,  isBest:false },
  { id:"dice",        name:"Dice",          nameUz:"Zar",           type:"dice",        category:"classic", maxWin:"X99",    isHot:false, isBest:false },
  { id:"wheel",       name:"Wheel",         nameUz:"G'ildirak",     type:"wheel",       category:"popular", maxWin:"X50",    isHot:false, isBest:true  },
  { id:"roulette",    name:"Roulette",      nameUz:"Ruletka",       type:"roulette",    category:"classic", maxWin:"X35",    isHot:false, isBest:false },
  { id:"blackjack",   name:"Blackjack",     nameUz:"Blackjek",      type:"blackjack",   category:"cards",   maxWin:"X3",     isHot:false, isBest:false },
  { id:"plinko",      name:"Plinko",        nameUz:"Plinko",        type:"plinko",      category:"popular", maxWin:"X10",    isHot:true,  isBest:false },
  { id:"coinflip",    name:"Coin Flip",     nameUz:"Tanga",         type:"coinflip",    category:"classic", maxWin:"X2",     isHot:false, isBest:false },
  { id:"applefortune",name:"Apple Fortune", nameUz:"Apple Fortune", type:"applefortune",category:"popular", maxWin:"X50000", isHot:true,  isBest:false },
  { id:"wildwestgold", name:"Wild West Gold", nameUz:"Wild West Gold", type:"wildwestgold", category:"popular", maxWin:"X10", isHot:true, isBest:true },
  { id:"baccarat",    name:"Baccarat",      nameUz:"Bakkara",       type:"baccarat",    category:"cards",   maxWin:"X9",     isHot:false, isBest:false },
  { id:"keno",        name:"Keno",          nameUz:"Keno",          type:"keno",        category:"lottery", maxWin:"X500",   isHot:false, isBest:false },
  { id:"hilo",        name:"Hi-Lo",         nameUz:"Yuqori-Past",   type:"hilo",        category:"cards",   maxWin:"X200",   isHot:false, isBest:false },
  { id:"tower",       name:"Tower",         nameUz:"Minora",        type:"tower",       category:"popular", maxWin:"X1000",  isHot:false, isBest:false },
  { id:"crystal",     name:"Crystal",       nameUz:"Kristal",       type:"crystal",     category:"popular", maxWin:"X500",   isHot:false, isBest:true  },
  { id:"dragontiger", name:"Dragon Tiger",  nameUz:"Ajdaho",        type:"dragontiger", category:"cards",   maxWin:"X2",     isHot:false, isBest:false },
  { id:"sicbo",       name:"Sic Bo",        nameUz:"Sik Bo",        type:"sicbo",       category:"dice",    maxWin:"X180",   isHot:false, isBest:false },
  { id:"andarbahar",  name:"Andar Bahar",   nameUz:"Andar Bahar",   type:"andarbahar",  category:"cards",   maxWin:"X2",     isHot:false, isBest:false },
  { id:"teenpatii",   name:"Teen Patti",    nameUz:"Teen Patti",    type:"teenpatii",   category:"cards",   maxWin:"X5",     isHot:false, isBest:false },
  { id:"videopoker",  name:"Video Poker",   nameUz:"Video Poker",   type:"videopoker",  category:"cards",   maxWin:"X800",   isHot:false, isBest:false },
  { id:"gemsodyssey",     name:"Gems Odyssey",      nameUz:"Gems Odyssey",      type:"gemsodyssey",     category:"popular", maxWin:"X10",    isHot:true,  isBest:true  },
  { id:"moremagicapple",  name:"More Magic Apple",  nameUz:"More Magic Apple",  type:"moremagicapple",  category:"popular", maxWin:"X1000",  isHot:true,  isBest:true  },
];

// ── Slots ──────────────────────────────────────────────────────────────────
function playSlots(_bet: number, _gd: any, winRate: number) {
  const symbols = ["🍒","🍋","🍊","🍇","🔔","⭐","💎","7️⃣"];
  const won = Math.random() < winRate;
  let reels: string[];
  if (won) {
    const s = symbols[Math.floor(Math.random() * symbols.length)];
    reels = [s, s, s];
  } else {
    reels = Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
    while (reels[0] === reels[1] && reels[1] === reels[2])
      reels[2] = symbols[Math.floor(Math.random() * symbols.length)];
  }
  return { won, multiplier: won ? 2 : 0, result: { reels } };
}

// ── Mines ──────────────────────────────────────────────────────────────────
// 1xbet-style formula: 0.97 × ∏[(25-i)/(25-mines-i)] for each reveal
// More mines selected → higher multiplier growth per reveal step
function minesMult(mines: number, revealed: number): number {
  let m = 0.97;
  for (let i = 0; i < revealed; i++) m *= (25 - i) / (25 - mines - i);
  return parseFloat(m.toFixed(2));
}

function playMines(_bet: number, gd: any) {
  const { minesCount = 3, selectedCells = [] } = gd || {};
  const mines = Math.max(1, Math.min(24, Number(minesCount)));
  const pos = new Set<number>();
  while (pos.size < mines) pos.add(Math.floor(Math.random() * 25));
  const hit = (selectedCells as number[]).some(c => pos.has(c));
  const won = !hit && selectedCells.length > 0;
  const mult = won ? minesMult(mines, selectedCells.length) : 0;
  return { won, multiplier: mult, result: { minePositions: [...pos] } };
}

// ── Crash ──────────────────────────────────────────────────────────────────
function playCrash(_bet: number, gd: any) {
  const cashOut = Number(gd?.cashOutAt ?? 1.5);
  const crash = parseFloat(Math.max(1, 1 / (Math.random() * 0.97 + 0.01)).toFixed(2));
  const won = cashOut <= crash;
  return { won, multiplier: won ? cashOut : 0, result: { crashPoint: crash } };
}

// ── Dice ───────────────────────────────────────────────────────────────────
function playDice(_bet: number, gd: any) {
  const { prediction = "over", target = 50 } = gd || {};
  const roll = Math.floor(Math.random() * 100) + 1;
  const won = prediction === "over" ? roll > Number(target) : roll < Number(target);
  const chance = prediction === "over" ? (100 - Number(target)) / 100 : Number(target) / 100;
  return { won, multiplier: won ? parseFloat((0.97 / chance).toFixed(2)) : 0, result: { roll } };
}

// ── Coinflip ───────────────────────────────────────────────────────────────
function playCoinflip(_bet: number, gd: any, winRate: number) {
  const pick = gd?.pick ?? "heads";
  const won = Math.random() < winRate;
  const result = won ? pick : (pick === "heads" ? "tails" : "heads");
  return { won, multiplier: won ? 1.95 : 0, result: { result } };
}

// ── Roulette ───────────────────────────────────────────────────────────────
const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
function playRoulette(_bet: number, gd: any) {
  const betType: string = gd?.betType ?? "red";
  const num = Math.floor(Math.random() * 37);
  const map: Record<string, [() => boolean, number]> = {
    red:    [() => RED_NUMS.has(num), 2],
    black:  [() => num !== 0 && !RED_NUMS.has(num), 2],
    even:   [() => num !== 0 && num % 2 === 0, 2],
    odd:    [() => num % 2 === 1, 2],
    "1-18": [() => num >= 1 && num <= 18, 2],
    "19-36":[() => num >= 19 && num <= 36, 2],
    dozen1: [() => num >= 1 && num <= 12, 3],
    dozen2: [() => num >= 13 && num <= 24, 3],
    dozen3: [() => num >= 25 && num <= 36, 3],
  };
  const [check, mult] = map[betType] ?? [() => false, 2];
  const won = check();
  return { won, multiplier: won ? mult : 0, result: { number: num } };
}

// ── Blackjack ──────────────────────────────────────────────────────────────
function playBlackjack(_bet: number, gd: any) {
  const outcome: string = gd?.outcome ?? "lose";
  const multMap: Record<string, number> = { blackjack: 2.5, win: 2, push: 1, bust: 0, lose: 0 };
  const mult = multMap[outcome] ?? 0;
  const won = mult > 0;
  return { won, multiplier: mult, result: { outcome } };
}

// ── Plinko ─────────────────────────────────────────────────────────────────
// Multipliers: [10x, 3x, 1.5x, 1x, 0.5x, 1x, 1.5x, 3x, 10x]
// Weights biased to center → ~30% profit rate (mult > 1)
// Win (mult>1): slots 0,1,2,6,7,8 → weight = 1+2+8+8+2+1 = 22
// Loss (1x or 0.5x): slots 3,4,5 → weight = 15+20+15 = 50
// Total = 72 → win rate = 22/72 ≈ 30.5%
const PLINKO_MULTS  = [10, 3, 1.5, 1, 0.5, 1, 1.5, 3, 10];
const PLINKO_W      = [1, 2, 8, 15, 20, 15, 8, 2, 1];
const PLINKO_TOTAL  = PLINKO_W.reduce((a, b) => a + b, 0);

function playPlinko(_bet: number, _gd: any) {
  let r = Math.random() * PLINKO_TOTAL;
  let slot = PLINKO_W.length - 1;
  for (let i = 0; i < PLINKO_W.length; i++) {
    r -= PLINKO_W[i];
    if (r < 0) { slot = i; break; }
  }
  const mult = PLINKO_MULTS[slot];
  // won = true for ALL slots (player always gets back mult*bet)
  // front-end uses mult > 1 to show profit indicator
  return { won: mult > 0, multiplier: mult, result: { slot } };
}

// ── Wheel ──────────────────────────────────────────────────────────────────
// Must match frontend SEGMENTS array exactly (16 segments)
const WHEEL_SEGS = [0, 1.5, 0, 2, 0, 1.5, 0, 3, 0, 1.5, 0, 5, 0, 1.5, 0, 50];
function playWheel(_bet: number, _gd: any) {
  const idx = Math.floor(Math.random() * WHEEL_SEGS.length);
  const mult = WHEEL_SEGS[idx];
  return { won: mult > 0, multiplier: mult, result: { segment: idx, multiplier: mult } };
}

// ── Apple Fortune ──────────────────────────────────────────────────────────
// Same 1xbet formula: 0.97 × ∏[(25-i)/(25-bombs-i)]
const AF: Record<number, number[]> = {
  1: [1.01,1.05,1.1,1.15,1.21,1.28,1.35,1.43,1.52,1.62,1.73,1.87,2.02,2.2,2.42,2.69,3.03,3.46,4.04,4.85,6.06,8.08,12.12,24.25],
  2: [1.05,1.15,1.26,1.39,1.53,1.7,1.9,2.14,2.43,2.77,3.2,3.73,4.41,5.29,6.47,8.08,10.39,13.86,19.4,29.1,48.5,97,291],
  3: [1.1,1.26,1.45,1.68,1.96,2.3,2.73,3.28,3.98,4.9,6.13,7.8,10.14,13.52,18.59,26.56,39.84,63.74,111.55,223.1,557.75,2231],
  5: [1.21,1.53,1.96,2.53,3.32,4.43,6.01,8.33,11.8,17.16,25.74,40.04,65.07,111.55,204.51,409.02,920.29,2454.1,8589.35,51536.1],
  8: [1.43,2.14,3.28,5.16,8.33,13.88,23.98,43.16,81.52,163.03,349.36,815.17,2119.45,6358.35,23313.95,116569.75,1049127.75],
};
function playAppleFortune(_bet: number, gd: any) {
  const outcome: string = gd?.result ?? "lose";
  const bombs: number = [1,2,3,5,8].includes(Number(gd?.bombs)) ? Number(gd.bombs) : 3;
  const revealed: number = Math.max(0, Math.min(Number(gd?.revealed) || 0, 25 - bombs));
  if (outcome !== "win" || revealed === 0) return { won: false, multiplier: 0, result: { bombs } };
  const mult = (AF[bombs] ?? AF[3])[revealed - 1] ?? 1;
  return { won: true, multiplier: mult, result: { bombs, revealed } };
}

// ── Wild West Gold (interactive ladder) ─────────────────────────────────────
// On "start": deducts bet, returns rowGold for all 10 rows (won=false, winAmount=0)
// Winnings are credited via /api/games/wildwest-settle endpoint
function playWildWestGold(_bet: number, _gd: any) {
  const ROWS = 10;
  const sides: ("left" | "right")[] = ["left", "right"];
  const rowGold = Array.from({ length: ROWS }, () => sides[Math.floor(Math.random() * 2)]);
  return { won: false, multiplier: 0, result: { rowGold } };
}

// ── Gems Odyssey (Match-3, 5×5 grid) ────────────────────────────────────────
// 6 gem types with multipliers. RTP ≈ 96%.
// Gem ID → multiplier: 0→x0.2, 1→x0.5, 2→x1, 3→x2, 4→x5, 5→x10
const GEM_MULTS = [0.2, 0.5, 1, 2, 5, 10];
// Weighted probabilities summing to 1.0
const GEM_PROBS = [0.30, 0.25, 0.20, 0.13, 0.08, 0.04];

function pickGem(): number {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < GEM_PROBS.length; i++) {
    cum += GEM_PROBS[i];
    if (r < cum) return i;
  }
  return 0;
}

function findGemMatches(grid: number[]): number[] {
  const matched = new Set<number>();
  // Horizontal: check each row
  for (let row = 0; row < 5; row++) {
    let col = 0;
    while (col < 3) {
      const base = row * 5 + col;
      if (grid[base] === grid[base + 1] && grid[base] === grid[base + 2]) {
        let end = col + 2;
        while (end + 1 < 5 && grid[row * 5 + end + 1] === grid[base]) end++;
        for (let c = col; c <= end; c++) matched.add(row * 5 + c);
        col = end + 1;
      } else {
        col++;
      }
    }
  }
  // Vertical: check each column
  for (let col = 0; col < 5; col++) {
    let row = 0;
    while (row < 3) {
      const base = row * 5 + col;
      if (grid[base] === grid[base + 5] && grid[base] === grid[base + 10]) {
        let end = row + 2;
        while (end + 1 < 5 && grid[(end + 1) * 5 + col] === grid[base]) end++;
        for (let r = row; r <= end; r++) matched.add(r * 5 + col);
        row = end + 1;
      } else {
        row++;
      }
    }
  }
  return [...matched];
}

// Gravity: remove -1 slots, shift gems down, fill top with new gems
function applyGravity(grid: number[]): { newGrid: number[]; newPositions: number[] } {
  const newGrid = [...grid];
  const newPositions: number[] = [];
  for (let col = 0; col < 5; col++) {
    const existing: number[] = [];
    for (let row = 0; row < 5; row++) {
      if (newGrid[row * 5 + col] !== -1) existing.push(newGrid[row * 5 + col]);
    }
    const empty = 5 - existing.length;
    const fresh = Array.from({ length: empty }, pickGem);
    const fullCol = [...fresh, ...existing];
    for (let row = 0; row < 5; row++) {
      newGrid[row * 5 + col] = fullCol[row];
      if (row < empty) newPositions.push(row * 5 + col);
    }
  }
  return { newGrid, newPositions };
}

interface CascadeStep {
  matched: number[];
  gridAfter: number[];
  newPositions: number[];
  stepMult: number;
}

// ── Gems Odyssey: pre-determined outcome → visual grid ──────────────────────
// Odds table:
//   10×  → 1 in 30  (~3.3%)
//   5×   → 1 in 10  (6.7%, cumulative 10%)
//   2×   → 1 in 5   (10%, cumulative 20%)
//   loss → 80%
// Gem type used for match display:  2× → gem3(purple), 5× → gem4(green), 10× → gem5(pink)
function playGemsOdyssey(_bet: number, _gd: any) {
  const r = Math.random();

  let targetMult: number;
  let matchGemType: number;
  // 10 spins: 3×2×win + 3×1×win + 4×loss
  // 10×(3.3%), 5×(6.7%), 2×(20%), 1×(30%), loss(40%)
  if (r < 1 / 30) {
    targetMult = 10; matchGemType = 5;          // ~3.3%
  } else if (r < 1 / 10) {
    targetMult = 5;  matchGemType = 4;          // ~6.7%
  } else if (r < 0.30) {
    targetMult = 2;  matchGemType = 3;          // ~20% → 3 in 10 roughly
  } else if (r < 0.60) {
    targetMult = 1;  matchGemType = 1;          // ~30% → 3 in 10
  } else {
    // Loss: generate no-match grid
    let grid: number[] = Array.from({ length: 25 }, pickGem);
    let attempts = 0;
    while (findGemMatches(grid).length > 0 && attempts < 80) {
      grid = Array.from({ length: 25 }, pickGem);
      attempts++;
    }
    // If still has matches, break ties by swapping matched cells to a different gem
    const leftover = findGemMatches(grid);
    for (const idx of leftover) {
      grid[idx] = (grid[idx] + 1 + Math.floor(Math.random() * 3)) % 6;
    }
    return { won: false, multiplier: 0, result: { initialGrid: grid, cascades: [] } };
  }

  // Win — build grid with exactly one horizontal match of the target gem type
  const grid: number[] = Array.from({ length: 25 }, pickGem);
  const matchRow = Math.floor(Math.random() * 5);
  const matchCol = Math.floor(Math.random() * 3); // 0,1,2 → allows 3 consecutive
  grid[matchRow * 5 + matchCol]     = matchGemType;
  grid[matchRow * 5 + matchCol + 1] = matchGemType;
  grid[matchRow * 5 + matchCol + 2] = matchGemType;
  // Avoid accidental 4th or 5th in same row
  if (matchCol > 0)
    if (grid[matchRow * 5 + matchCol - 1] === matchGemType)
      grid[matchRow * 5 + matchCol - 1] = (matchGemType + 1) % 6;
  if (matchCol + 3 < 5)
    if (grid[matchRow * 5 + matchCol + 3] === matchGemType)
      grid[matchRow * 5 + matchCol + 3] = (matchGemType + 1) % 6;

  // Simulate one cascade step
  const matched = findGemMatches(grid);
  const tmp = [...grid];
  for (const idx of matched) tmp[idx] = -1;
  const { newGrid, newPositions } = applyGravity(tmp);

  const cascades: CascadeStep[] = [{
    matched,
    gridAfter: newGrid,
    newPositions,
    stepMult: targetMult,
  }];

  return { won: true, multiplier: targetMult, result: { initialGrid: grid, cascades } };
}

// ── Generic fallback ───────────────────────────────────────────────────────
function playGenericGame(_t: string, winRate: number) {
  const won = Math.random() < winRate;
  return { won, multiplier: won ? parseFloat((1.5 + Math.random() * 2).toFixed(2)) : 0, result: {} };
}

// ═══════════════════════════════════════════════════════════════════════════

router.get("/list", async (_req, res) => res.json({ games: GAMES }));

// POST /api/games/play
router.post("/play", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { gameType, betAmount, gameData } = req.body;
  const bet = Number(betAmount);

  if (!bet || bet <= 0) return res.status(400).json({ error: "Noto'g'ri stavka" });
  if (bet > user.balance)  return res.status(400).json({ error: "Balansingiz yetarli emas" });

  // Per-user win rate overrides global; null = use global setting
  const globalWinRate = await getWinRate();
  let winRate = (user.winRate !== null && user.winRate !== undefined)
    ? user.winRate
    : globalWinRate;

  // Adaptive RTP: new users (totalWagered < 50000 UZS) get a boost to 70% to build engagement
  if (user.winRate === null || user.winRate === undefined) {
    const isNewUser = (user.totalWagered || 0) < 50000;
    if (isNewUser) winRate = Math.max(winRate, 0.70);
  }

  let gr: { won: boolean; multiplier: number; result: any };

  switch (gameType) {
    case "slots":        gr = playSlots(bet, gameData, winRate);        break;
    case "mines":        gr = playMines(bet, gameData);                 break;
    case "crash":        gr = playCrash(bet, gameData);                 break;
    case "dice":         gr = playDice(bet, gameData);                  break;
    case "coinflip":     gr = playCoinflip(bet, gameData, winRate);     break;
    case "roulette":     gr = playRoulette(bet, gameData);              break;
    case "blackjack":    gr = playBlackjack(bet, gameData);             break;
    case "plinko":       gr = playPlinko(bet, gameData);                break;
    case "wheel":        gr = playWheel(bet, gameData);                 break;
    case "applefortune": gr = playAppleFortune(bet, gameData);          break;
    case "wildwestgold": gr = playWildWestGold(bet, gameData);          break;
    case "gemsodyssey":     gr = playGemsOdyssey(bet, gameData);                    break;
    case "moremagicapple":  gr = playMoreMagicApple(bet, gameData, winRate);       break;
    case "penalty": {
      const MULTS = [1.92, 3.84, 7.68, 15.36, 30.72];
      // Penalty has its own minimum kick rate (35%) so the game stays playable
      // regardless of how low the global win rate is set.
      const kickRate = Math.max(winRate, 0.35);
      let safeKicks = 0;
      for (let i = 0; i < 5; i++) { if (Math.random() < kickRate) safeKicks++; else break; }
      const kickOutcomes = Array.from({ length: 5 }, (_, i) => i < safeKicks);
      gr = { won: safeKicks > 0, multiplier: safeKicks > 0 ? MULTS[safeKicks - 1] : 0, result: { kickOutcomes, safeKicks } };
      break;
    }
    default:             gr = playGenericGame(gameType, winRate);        break;
  }

  // Deduct bet immediately, credit winnings
  const winAmount  = gr.won ? Math.floor(bet * gr.multiplier) : 0;
  const newBalance = user.balance - bet + winAmount;

  await db.update(usersTable)
    .set({ balance: newBalance, totalWagered: user.totalWagered + bet })
    .where(eq(usersTable.userId, user.userId));

  const label = GAMES.find(g => g.type === gameType)?.nameUz ?? gameType;
  await db.insert(transactionsTable).values({
    userId: user.userId,
    type: "game",
    amount: gr.won ? winAmount - bet : -bet,
    status: "completed",
    description: gr.won
      ? `${label}: +${winAmount.toLocaleString()} UZS (x${gr.multiplier})`
      : `${label}: -${bet.toLocaleString()} UZS`,
  });

  return res.json({
    won:        gr.won,
    winAmount,
    newBalance,
    multiplier: gr.multiplier,
    result:     gr.result,
    message: gr.won
      ? `🎉 ${winAmount.toLocaleString()} so'm yutdingiz! (x${gr.multiplier})`
      : `😞 ${bet.toLocaleString()} so'm yutqazdingiz`,
  });
});

// ── More Magic Apple ───────────────────────────────────────────────────────
const MMA_SYMS = ['J','Q','K','A','wild','red_apple','gold_apple','mini','minor','major','grand'] as const;
type MMASym = typeof MMA_SYMS[number];
// Weights: J  Q   K   A  wild red  gold mini minor major grand(0=never)
const MMA_W_NORMAL = [25, 22, 19, 16,  4,   8,   5,   2,   1,   1,   0];
const MMA_W_HOT    = [20, 18, 16, 13,  4,   9,   6,   3,   2,   1,   0];

function mmaSymbol(weights: number[]): MMASym {
  const total = weights.reduce((a,b) => a+b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < MMA_SYMS.length; i++) { r -= weights[i]; if (r <= 0) return MMA_SYMS[i]; }
  return 'J';
}
function isApple(s: string) { return ['red_apple','gold_apple','mini','minor','major','grand'].includes(s); }
function appleVal(s: string, bet: number): number {
  const r = () => Math.random();
  if (s === 'red_apple')  return Math.floor(bet * (0.5 + r() * 1.5));
  if (s === 'gold_apple') return Math.floor(bet * (1.5 + r() * 3));
  if (s === 'mini')       return Math.floor(bet * 4);
  if (s === 'minor')      return Math.floor(bet * 10);
  if (s === 'major')      return Math.floor(bet * 25);
  if (s === 'grand')      return Math.floor(bet * 80);
  return 0;
}
const MMA_LINES: number[][] = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],
  [0,6,12,13,14],[4,3,12,16,15],[0,1,7,16,19],[4,8,12,11,15],
  [0,6,7,8,19],[15,11,7,8,4],[0,1,2,8,19],[4,3,2,11,15],
  [5,1,2,3,9],[10,6,7,8,14],[0,6,12,8,4],[15,11,7,13,19],
  [5,6,12,13,9],[10,11,7,8,14],[0,1,7,13,14],[15,16,12,8,9],
];
const MMA_PAY: Record<string, number[]> = {
  J:[0,0,1,2,4], Q:[0,0,1,2,5], K:[0,0,1,3,6], A:[0,0,2,4,8],
  wild:[0,0,2,5,12], red_apple:[0,0,3,7,15],
};

function playMoreMagicApple(bet: number, _gd: any, _winRate: number) {
  // ── Pre-determined outcome probabilities (per 40 spins) ─────────────────
  // 15×: 1/40 (2.5%), 5×: 4/40 (10%), 2×: 8/40 (20%), 1×: 6/40 (15%), lose: 21/40 (52.5%)
  const r = Math.random();
  let targetMult: number;
  let winSym: string | null = null;
  let winCnt = 0;

  if (r < 1 / 40) {
    targetMult = 15; winSym = 'red_apple'; winCnt = 5;   // 5× red_apple = 15×
  } else if (r < 5 / 40) {
    targetMult = 5;  winSym = 'wild';      winCnt = 4;   // 4× wild = 5×
  } else if (r < 13 / 40) {
    targetMult = 2;  winSym = 'A';         winCnt = 3;   // 3× A = 2×
  } else if (r < 19 / 40) {
    targetMult = 1;  winSym = 'J';         winCnt = 3;   // 3× J = 1× (push)
  } else {
    targetMult = 0;                                       // lose
  }

  // ── Build visual grid ────────────────────────────────────────────────────
  const BASE = ['J', 'Q', 'K', 'A'];
  const grid: string[] = Array.from({ length: 20 }, () => BASE[Math.floor(Math.random() * BASE.length)]);

  if (winSym && winCnt > 0) {
    // Place winning symbols on first payline [0,1,2,3,4]
    for (let i = 0; i < winCnt; i++) grid[i] = winSym;
    // Break accidental extension: next cell must not match
    if (winCnt < 5) {
      const diff = BASE.filter(s => s !== winSym && s !== 'wild')[0] ?? 'K';
      grid[winCnt] = diff;
    }
  } else {
    // Lose: break any accidental 3-in-a-row on all paylines
    for (const line of MMA_LINES) {
      if (grid[line[0]] === grid[line[1]] && grid[line[1]] === grid[line[2]]) {
        const diff = BASE.filter(s => s !== grid[line[0]])[0] ?? 'Q';
        grid[line[2]] = diff;
      }
    }
  }

  const regWin = Math.floor(bet * targetMult);
  const winLines = winSym
    ? [{ line: MMA_LINES[0], sym: winSym, count: winCnt }]
    : [];

  return {
    won: targetMult > 0,
    multiplier: targetMult,
    result: {
      grid,
      values: Array(20).fill(0),
      appleIdxs: [],
      appleCount: 0,
      triggerHoldWin: false,
      regWin,
      winLines,
      jackpot: null,
    },
  };
}

// POST /api/games/wildwest-settle — credit Wild West Gold winnings
router.post("/wildwest-settle", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { winAmount } = req.body;
  const win = Number(winAmount);

  if (!win || win <= 0) return res.status(400).json({ error: "Noto'g'ri miqdor" });

  const newBalance = user.balance + win;
  await db.update(usersTable)
    .set({ balance: newBalance })
    .where(eq(usersTable.userId, user.userId));

  await db.insert(transactionsTable).values({
    userId: user.userId,
    type: "game",
    amount: win,
    status: "completed",
    description: `Wild West Gold: +${win.toLocaleString()} UZS`,
  });

  return res.json({ ok: true, newBalance });
});

export default router;
