import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createSession,
  getTokenFromRequest,
  getUserFromToken,
  hashPassword,
  revokeSession,
  setSessionCookie,
  clearSessionCookie,
  verifyPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please send a valid request." }, { status: 400 });
  }

  const action = body.action;
  const token = getTokenFromRequest(request);

  if (action === "logout") {
    await revokeSession(token);
    return clearSessionCookie(NextResponse.json({ ok: true }));
  }

  if (action === "register") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: "Please enter a name between 2 and 100 characters." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8 || password.length > 200) {
      return NextResponse.json({ error: "Your password must be at least 8 characters." }, { status: 400 });
    }

    try {
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) {
        return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
      }

      const currentUser = await getUserFromToken(token);
      const passwordHash = hashPassword(password);
      if (currentUser?.isGuest) {
        const [updatedUser] = await db
          .update(users)
          .set({ name, email, passwordHash, isGuest: false })
          .where(eq(users.id, currentUser.id))
          .returning({ id: users.id, name: users.name, email: users.email, isGuest: users.isGuest });
        return NextResponse.json({ user: updatedUser });
      }

      const [inserted] = await db
        .insert(users)
        .values({ name, email, passwordHash, isGuest: false })
        .returning();
      const createdUser = { id: inserted.id, name: inserted.name, email: inserted.email, isGuest: inserted.isGuest };
      const newToken = await createSession(createdUser.id);
      return setSessionCookie(NextResponse.json({ user: createdUser }), newToken);
    } catch (error) {
      console.error("Account registration failed", error);
      return NextResponse.json({ error: "We couldn’t create your account. Please try again." }, { status: 500 });
    }
  }

  if (action === "login") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const [account] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isGuest: users.isGuest,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!account || !verifyPassword(password, account.passwordHash)) {
      return NextResponse.json({ error: "That email and password don’t match." }, { status: 401 });
    }

    await revokeSession(token);
    const newToken = await createSession(account.id);
    const user = { id: account.id, name: account.name, email: account.email, isGuest: account.isGuest };
    return setSessionCookie(NextResponse.json({ user }), newToken);
  }

  return NextResponse.json({ error: "Choose sign in, create account, or sign out." }, { status: 400 });
}
