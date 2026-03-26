import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

let _cachedWinRate: number | null = null;

export async function getWinRate(): Promise<number> {
  if (_cachedWinRate !== null) return _cachedWinRate;
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "win_rate"));
    // Only cache if DB read succeeded
    _cachedWinRate = row ? Number(row.value) / 100 : 0.40;
    return _cachedWinRate;
  } catch (e) {
    console.warn("[Settings] DB read failed, using default 40%:", e);
    // DO NOT cache on failure — let next call retry the DB
    return 0.40;
  }
}

export async function setWinRate(pct: number): Promise<number> {
  const clamped = Math.max(1, Math.min(95, Math.round(pct)));
  await db
    .insert(settingsTable)
    .values({ key: "win_rate", value: String(clamped) })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: String(clamped), updatedAt: new Date() },
    });
  // Update cache only after successful DB write
  _cachedWinRate = clamped / 100;
  console.log(`[Settings] WIN_RATE saved → ${clamped}%`);
  return clamped;
}

export function invalidateWinRateCache() {
  _cachedWinRate = null;
}
