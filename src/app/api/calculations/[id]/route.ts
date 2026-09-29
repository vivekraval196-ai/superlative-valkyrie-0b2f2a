import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loanCalculations } from "@/db/schema";
import { getTokenFromRequest, getUserFromToken } from "@/lib/auth";
import { parseCalculationInput, serializeCalculation } from "@/lib/calculations";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getUserFromToken(getTokenFromRequest(request));
  if (!user) return NextResponse.json({ error: "Your session expired. Refresh the page and try again." }, { status: 401 });

  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "That scenario could not be found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please send valid scenario details." }, { status: 400 });
  }
  const input = parseCalculationInput(body);
  if (!input) return NextResponse.json({ error: "Check your scenario details and try again." }, { status: 400 });

  try {
    const [updated] = await db
      .update(loanCalculations)
      .set({
        name: input.name,
        vehicle: input.vehicle,
        vehiclePrice: input.vehiclePrice.toFixed(2),
        downPayment: input.downPayment.toFixed(2),
        termMonths: input.termMonths,
        interestRate: input.interestRate.toFixed(2),
        annualInsurance: input.annualInsurance.toFixed(2),
        annualMaintenance: input.annualMaintenance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(and(eq(loanCalculations.id, id), eq(loanCalculations.userId, user.id)))
      .returning();

    if (!updated) return NextResponse.json({ error: "That scenario could not be found." }, { status: 404 });
    return NextResponse.json({ calculation: serializeCalculation(updated) });
  } catch (error) {
    console.error("Could not update scenario", error);
    return NextResponse.json({ error: "We couldn’t update that scenario. Please try again." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const user = await getUserFromToken(getTokenFromRequest(request));
  if (!user) return NextResponse.json({ error: "Your session expired. Refresh the page and try again." }, { status: 401 });

  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "That scenario could not be found." }, { status: 404 });

  try {
    const [deleted] = await db
      .delete(loanCalculations)
      .where(and(eq(loanCalculations.id, id), eq(loanCalculations.userId, user.id)))
      .returning();
    if (!deleted) return NextResponse.json({ error: "That scenario could not be found." }, { status: 404 });
    return NextResponse.json({ ok: true, id: deleted.id });
  } catch (error) {
    console.error("Could not delete scenario", error);
    return NextResponse.json({ error: "We couldn’t delete that scenario. Please try again." }, { status: 500 });
  }
}
