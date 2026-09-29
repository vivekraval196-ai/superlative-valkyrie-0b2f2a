import type { loanCalculations } from "@/db/schema";

export type CalculationInput = {
  name: string;
  vehicle: string;
  vehiclePrice: number;
  downPayment: number;
  termMonths: number;
  interestRate: number;
  annualInsurance: number;
  annualMaintenance: number;
};

export type SavedCalculation = CalculationInput & {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export function serializeCalculation(row: typeof loanCalculations.$inferSelect): SavedCalculation {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    vehicle: row.vehicle,
    vehiclePrice: Number(row.vehiclePrice),
    downPayment: Number(row.downPayment),
    termMonths: row.termMonths,
    interestRate: Number(row.interestRate),
    annualInsurance: Number(row.annualInsurance),
    annualMaintenance: Number(row.annualMaintenance),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function parseCalculationInput(value: unknown): CalculationInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const vehicle = typeof input.vehicle === "string" ? input.vehicle.trim() : "";
  const vehiclePrice = Number(input.vehiclePrice);
  const downPayment = Number(input.downPayment);
  const termMonths = Number(input.termMonths);
  const interestRate = Number(input.interestRate);
  const annualInsurance = Number(input.annualInsurance);
  const annualMaintenance = Number(input.annualMaintenance);

  if (!name || name.length > 100 || !vehicle || vehicle.length > 120) return null;
  if (!Number.isFinite(vehiclePrice) || vehiclePrice < 1000 || vehiclePrice > 1_000_000_000) return null;
  if (!Number.isFinite(downPayment) || downPayment < 0 || downPayment > vehiclePrice) return null;
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 120) return null;
  if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 40) return null;
  if (!Number.isFinite(annualInsurance) || annualInsurance < 0 || annualInsurance > 500_000) return null;
  if (!Number.isFinite(annualMaintenance) || annualMaintenance < 0 || annualMaintenance > 500_000) return null;

  return {
    name,
    vehicle,
    vehiclePrice,
    downPayment,
    termMonths,
    interestRate,
    annualInsurance,
    annualMaintenance,
  };
}
