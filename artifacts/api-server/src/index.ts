import app from "./app";
import http from "http";
import https from "https";
import { loadOperatorsFromDB } from "./lib/operators.js";
import { getWinRate } from "./lib/settings.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);

  // Preload settings from DB so they're cached before first request
  try {
    const wr = await getWinRate();
    console.log(`[Startup] WIN_RATE loaded from DB: ${Math.round(wr * 100)}%`);
  } catch {
    console.warn("[Startup] WIN_RATE DB load failed, using default 40%");
  }

  await loadOperatorsFromDB().catch(() => {});
  console.log("[Startup] Operators loaded from DB");

  startKeepAlive(port);
});

// ── Keep-alive: ping self every 3 min ─────────────────────────────────────
function safePing(url: string) {
  try {
    const mod = url.startsWith("https") ? https : http;
    const req = (mod as typeof http).get(url, (res) => { res.resume(); });
    req.on("error", () => {});
    req.end();
  } catch {
    // ignore
  }
}

function startKeepAlive(p: number) {
  const INTERVAL = 3 * 60 * 1000;

  setInterval(() => {
    // Localhost ping
    safePing(`http://localhost:${p}/api/ping`);

    // Public Replit dev domain ping (keeps the dev tunnel alive)
    const devDomain = process.env["REPLIT_DEV_DOMAIN"];
    if (devDomain) {
      safePing(`https://${devDomain}/api/ping`);
    }
  }, INTERVAL);

  console.log("Keep-alive ping started (every 3 min)");
}
