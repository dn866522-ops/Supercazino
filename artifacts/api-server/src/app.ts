import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import path from "path";
import fs from "fs";

const app: Express = express();

// Ensure upload dirs exist
["/tmp/receipts", "/tmp/support-files"].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use("/api/uploads/receipts", express.static("/tmp/receipts"));
app.use("/api/uploads/support", express.static("/tmp/support-files"));

app.use("/api", router);

// ── Production: serve Vite-built frontend ─────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.join(process.cwd(), "artifacts/betuz/dist");
  if (fs.existsSync(frontendDist)) {
    app.use("/betuz", express.static(frontendDist));
    // SPA fallback — all /betuz/* routes go to index.html
    app.get("/betuz/*splat", (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
    // Root redirect → frontend
    app.get("/", (_req, res) => res.redirect(301, "/betuz/"));
    console.log("[Static] Serving frontend from:", frontendDist);
  } else {
    console.warn("[Static] Frontend dist not found at:", frontendDist);
  }
}

export default app;
