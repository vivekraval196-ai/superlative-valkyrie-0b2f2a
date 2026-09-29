import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoCost — Car Loan EMI & Ownership Cost Calculator",
  description:
    "Plan your next car with a live auto loan EMI calculator. Compare monthly payments, interest, insurance and maintenance in one clear ownership cost breakdown.",
  keywords: [
    "auto loan calculator",
    "car loan EMI calculator",
    "vehicle ownership cost",
    "car payment calculator",
    "auto financing",
  ],
  applicationName: "AutoCost",
  openGraph: {
    title: "AutoCost — Know your full car cost",
    description: "See the real monthly payment and total cost of owning your next vehicle.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AutoCost — Car Loan & Ownership Calculator",
    description: "A clearer way to plan your next vehicle purchase.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
