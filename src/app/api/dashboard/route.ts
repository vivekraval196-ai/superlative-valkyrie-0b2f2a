import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loanCalculations } from "@/db/schema";
import { createGuestUser, getTokenFromRequest, getUserFromToken, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

const demoScenarios = [
  {
    name: "Electric daily driver",
    vehicle: "2024 Volvo XC40 Recharge",
    vehiclePrice: "54990",
    downPayment: "9000",
    termMonths: 60,
    interestRate: "4.9",
    annualInsurance: "2400",
    annualMaintenance: "850",
  },
  {
    name: "Family hybrid",
    vehicle: "2024 Toyota RAV4 Hybrid",
    vehiclePrice: "36940",
    downPayment: "6500",
    termMonths: 60,
    interestRate: "5.4",
    annualInsurance: "1720",
    annualMaintenance: "640",
  },
  {
    name: "City commuter",
    vehicle: "2025 Honda Civic Sport",
    vehiclePrice: "28800",
    downPayment: "4500",
    termMonths: 48,
    interestRate: "4.5",
    annualInsurance: "1620",
    annualMaintenance: "490",
  },
];

function serializeCalculation(row: typeof loanCalculations.$inferSelect) {
  return {
    ...row,
    vehiclePrice: Number(row.vehiclePrice),
    downPayment: Number(row.downPayment),
    interestRate: Number(row.interestRate),
    annualInsurance: Number(row.annualInsurance),
    annualMaintenance: Number(row.annualMaintenance),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    let user = await getUserFromToken(token);
    let guestToken: string | null = null;

    if (!user) {
      const guest = await createGuestUser();
      user = guest.user;
      guestToken = guest.token;
      await db.insert(loanCalculations).values(
        demoScenarios.map((scenario) => ({ ...scenario, userId: user!.id })),
      );
    }

    const rows = await db
      .select()
      .from(loanCalculations)
      .where(eq(loanCalculations.userId, user.id))
      .orderBy(desc(loanCalculations.updatedAt));

    const response = NextResponse.json({
      user,
      calculations: rows.map(serializeCalculation),
    });
    return guestToken ? setSessionCookie(response, guestToken) : response;
  } catch (error) {
    console.error("Could not load dashboard", error);
    return NextResponse.json({ error: "We couldn’t load your workspace. Please refresh and try again." }, { status: 500 });
  }
}
