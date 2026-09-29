import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loanCalculations } from "@/db/schema";
import { getTokenFromRequest, getUserFromToken } from "@/lib/auth";
import { parseCalculationInput, serializeCalculation } from "@/lib/calculations";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getUserFromToken(getTokenFromRequest(request));
  if (!user) return NextResponse.json({ error: "Your session expired. Refresh the page and try again." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please send a valid scenario." }, { status: 400 });
  }

  const input = parseCalculationInput(body);
  if (!input) return NextResponse.json({ error: "Check your scenario details and try again." }, { status: 400 });

  try {
    const [created] = await db
      .insert(loanCalculations)
      .values({
        userId: user.id,
        name: input.name,
        vehicle: input.vehicle,
        vehiclePrice: input.vehiclePrice.toFixed(2),
        downPayment: input.downPayment.toFixed(2),
        termMonths: input.termMonths,
        interestRate: input.interestRate.toFixed(2),
        annualInsurance: input.annualInsurance.toFixed(2),
        annualMaintenance: input.annualMaintenance.toFixed(2),
      })
      .returning();
    return NextResponse.json({ calculation: serializeCalculation(created) }, { status: 201 });
  } catch (error) {
    console.error("Could not save scenario", error);
    return NextResponse.json({ error: "We couldn’t save that scenario. Please try again." }, { status: 500 });
  }
}
