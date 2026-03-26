import { Router } from "express";
import { db, usersTable, transactionsTable, referralsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware.js";

const router = Router();

function formatUser(user: any) {
  return {
    id: user.id,
    userId: user.userId,
    username: user.username,
    phone: user.phone,
    balance: user.balance,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    country: user.country || "",
    city: user.city || "",
    isBlocked: user.isBlocked,
    isProfileComplete: user.isProfileComplete,
    totalDeposited: user.totalDeposited,
    totalWagered: user.totalWagered,
    referralCode: user.referralCode,
    createdAt: user.createdAt?.toISOString(),
  };
}

router.get("/profile", requireAuth, async (req, res) => {
  const user = (req as any).user;
  return res.json(formatUser(user));
});

router.put("/profile", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { firstName, lastName, country, city, phone } = req.body;
  const updateData: any = {};
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (country !== undefined) updateData.country = country;
  if (city !== undefined) updateData.city = city;
  if (phone !== undefined) updateData.phone = phone;
  const isComplete = !!(
    (firstName || user.firstName) &&
    (lastName || user.lastName) &&
    (country || user.country) &&
    (city || user.city) &&
    (phone || user.phone)
  );
  updateData.isProfileComplete = isComplete;
  const [updated] = await db.update(usersTable).set(updateData).where(eq(usersTable.userId, user.userId)).returning();
  return res.json(formatUser(updated));
});

router.get("/balance", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [fresh] = await db.select().from(usersTable).where(eq(usersTable.userId, user.userId));
  return res.json({ balance: fresh.balance });
});

router.get("/referral", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, user.userId));
  const qualifiedCount = referrals.filter(r => r.isQualified).length;
  const bonusEarned = Math.floor(qualifiedCount / 5) * 200000;
  return res.json({
    referralCode: user.referralCode,
    referredCount: referrals.length,
    qualifiedCount,
    bonusEarned,
    bonusAvailable: bonusEarned,
  });
});

router.get("/transactions", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const txns = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.userId, user.userId))
    .orderBy(transactionsTable.createdAt);
  return res.json({
    transactions: txns.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      status: t.status,
      description: t.description,
      createdAt: t.createdAt?.toISOString(),
    })),
  });
});

export default router;
