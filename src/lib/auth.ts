import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const SESSION_COOKIE = "autocost_session";
const SESSION_LENGTH_MS = 1000 * 60 * 60 * 24 * 30;

export type AppUser = {
  id: string;
  name: string;
  email: string | null;
  isGuest: boolean;
};

export function getTokenFromRequest(request: NextRequest) {
  return request.cookies.get(SESSION_COOKIE)?.value;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getUserFromToken(token?: string | null): Promise<AppUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isGuest: users.isGuest,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return row ?? null;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_LENGTH_MS),
  });
  return token;
}

export async function createGuestUser() {
  const [inserted] = await db
    .insert(users)
    .values({ name: "Alex Morgan", isGuest: true })
    .returning();
  const user = { id: inserted.id, name: inserted.name, email: inserted.email, isGuest: inserted.isGuest };
  const token = await createSession(user.id);
  return { user, token };
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_LENGTH_MS / 1000),
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function revokeSession(token?: string | null) {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

export function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) return false;
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
