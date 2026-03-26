import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "betuz-secret-key-2024";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Avtorizatsiya talab etiladi" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, decoded.userId));
    if (!user) return res.status(401).json({ error: "Foydalanuvchi topilmadi" });
    if (user.isBlocked) return res.status(401).json({ error: "Akkauntingiz bloklangan" });
    (req as any).user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Token yaroqsiz" });
  }
}
