"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Calculator,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  HeartHandshake,
  LayoutDashboard,
  Lightbulb,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
  Wallet,
  X,
} from "lucide-react";
import { ArcElement, Chart as ChartJS, Tooltip, type ChartOptions } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import type { CalculationInput, SavedCalculation } from "@/lib/calculations";

ChartJS.register(ArcElement, Tooltip);

type DashboardUser = { id: string; name: string; email: string | null; isGuest: boolean };
type AuthMode = "register" | "login";
type BreakdownView = "monthly" | "yearly";
type NumericField = "vehiclePrice" | "downPayment" | "termMonths" | "interestRate" | "annualInsurance" | "annualMaintenance";
type FinanceSummary = {
  principal: number;
  monthlyPayment: number;
  totalInterest: number;
  insuranceCost: number;
  maintenanceCost: number;
  ownershipTotal: number;
  monthlyRunningCost: number;
};
type BreakdownItem = { label: string; amount: number; color: string };

const DEFAULT_SCENARIO: CalculationInput = {
  name: "New vehicle scenario",
  vehicle: "2025 Vehicle model",
  vehiclePrice: 34990,
  downPayment: 5000,
  termMonths: 60,
  interestRate: 5.25,
  annualInsurance: 1800,
  annualMaintenance: 650,
};

const RANGE_COLORS = ["#b7c2b7", "#a9e66b", "#4d8769", "#f3c877"];

function currency(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

function calculateFinance(input: CalculationInput): FinanceSummary {
  const vehiclePrice = Math.max(0, Number(input.vehiclePrice) || 0);
  const downPayment = Math.max(0, Number(input.downPayment) || 0);
  const principal = Math.max(0, vehiclePrice - downPayment);
  const months = Math.max(1, Math.round(Number(input.termMonths) || 1));
  const monthlyRate = (Math.max(0, Number(input.interestRate) || 0) / 100) / 12;
  const monthlyPayment =
    principal === 0
      ? 0
      : monthlyRate === 0
        ? principal / months
        : (principal * monthlyRate * (1 + monthlyRate) ** months) / ((1 + monthlyRate) ** months - 1);
  const totalInterest = Math.max(0, monthlyPayment * months - principal);
  const insuranceCost = Math.max(0, Number(input.annualInsurance) || 0) * (months / 12);
  const maintenanceCost = Math.max(0, Number(input.annualMaintenance) || 0) * (months / 12);
  const monthlyRunningCost =
    (Math.max(0, Number(input.annualInsurance) || 0) + Math.max(0, Number(input.annualMaintenance) || 0)) / 12;

  return {
    principal,
    monthlyPayment,
    totalInterest,
    insuranceCost,
    maintenanceCost,
    ownershipTotal: vehiclePrice + totalInterest + insuranceCost + maintenanceCost,
    monthlyRunningCost,
  };
}

function inputFromScenario(scenario: SavedCalculation): CalculationInput {
  return {
    name: scenario.name,
    vehicle: scenario.vehicle,
    vehiclePrice: scenario.vehiclePrice,
    downPayment: scenario.downPayment,
    termMonths: scenario.termMonths,
    interestRate: scenario.interestRate,
    annualInsurance: scenario.annualInsurance,
    annualMaintenance: scenario.annualMaintenance,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return payload as T;
}

const chartOptions: ChartOptions<"doughnut"> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "77%",
  layout: { padding: 5 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#142b26",
      padding: 12,
      displayColors: true,
      callbacks: {
        label(context) {
          return ` ${context.label ?? "Cost"}: ${currency(Number(context.parsed))}`;
        },
      },
    },
  },
};

export default function HomePage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [calculations, setCalculations] = useState<SavedCalculation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inputs, setInputs] = useState<CalculationInput>(DEFAULT_SCENARIO);
  const [view, setView] = useState<BreakdownView>("monthly");
  const [activeNav, setActiveNav] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [scenarioSearch, setScenarioSearch] = useState("");
  const [toast, setToast] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavedCalculation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchJson<{ user: DashboardUser; calculations: SavedCalculation[] }>("/api/dashboard", {
        cache: "no-store",
      });
      setUser(data.user);
      setCalculations(data.calculations);
      const firstScenario = data.calculations[0];
      if (firstScenario) {
        setSelectedId(firstScenario.id);
        setInputs(inputFromScenario(firstScenario));
      } else {
        setSelectedId(null);
        setInputs(DEFAULT_SCENARIO);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "We couldn’t load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const finance = useMemo(() => calculateFinance(inputs), [inputs]);
  const months = Math.max(1, inputs.termMonths);
  const annualFactor = 12 / months;
  const breakdown = useMemo<BreakdownItem[]>(() => {
    const factor = view === "monthly" ? 1 / Math.max(1, inputs.termMonths) : 12 / Math.max(1, inputs.termMonths);
    return [
      { label: "Vehicle price", amount: inputs.vehiclePrice * factor, color: RANGE_COLORS[0] },
      { label: "Loan interest", amount: finance.totalInterest * factor, color: RANGE_COLORS[1] },
      { label: "Insurance", amount: finance.insuranceCost * factor, color: RANGE_COLORS[2] },
      { label: "Maintenance", amount: finance.maintenanceCost * factor, color: RANGE_COLORS[3] },
    ];
  }, [finance, inputs.termMonths, inputs.vehiclePrice, view]);
  const averagePeriodCost = breakdown.reduce((total, item) => total + item.amount, 0);
  const chartData = useMemo(
    () => ({
      labels: breakdown.map((item) => item.label),
      datasets: [
        {
          data: breakdown.map((item) => item.amount),
          backgroundColor: breakdown.map((item) => item.color),
          borderColor: "#ffffff",
          borderWidth: 4,
          borderRadius: 3,
          hoverOffset: 5,
        },
      ],
    }),
    [breakdown],
  );

  const isValid =
    inputs.name.trim().length > 0 &&
    inputs.name.trim().length <= 100 &&
    inputs.vehicle.trim().length > 0 &&
    inputs.vehicle.trim().length <= 120 &&
    inputs.vehiclePrice >= 1000 &&
    inputs.vehiclePrice <= 1_000_000_000 &&
    inputs.downPayment >= 0 &&
    inputs.downPayment <= inputs.vehiclePrice &&
    Number.isInteger(inputs.termMonths) &&
    inputs.termMonths >= 1 &&
    inputs.termMonths <= 120 &&
    inputs.interestRate >= 0 &&
    inputs.interestRate <= 40 &&
    inputs.annualInsurance >= 0 &&
    inputs.annualInsurance <= 500_000 &&
    inputs.annualMaintenance >= 0 &&
    inputs.annualMaintenance <= 500_000;

  function updateNumber(field: NumericField, rawValue: string) {
    const value = rawValue === "" ? 0 : Number(rawValue);
    if (!Number.isFinite(value)) return;
    setInputs((current) => {
      const next = { ...current, [field]: value };
      if (field === "vehiclePrice") next.downPayment = Math.min(current.downPayment, value);
      if (field === "downPayment") next.downPayment = Math.min(value, current.vehiclePrice);
      if (field === "termMonths") next.termMonths = Math.round(value);
      return next;
    });
  }

  function startNewScenario() {
    setSelectedId(null);
    setInputs({ ...DEFAULT_SCENARIO });
    setActiveNav("Overview");
    setToast("Fresh scenario started — make it yours.");
    document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function loadScenario(scenario: SavedCalculation) {
    setSelectedId(scenario.id);
    setInputs(inputFromScenario(scenario));
    setActiveNav("My scenarios");
    setToast(`${scenario.name} loaded into your calculator.`);
    document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveScenario() {
    if (!isValid || saving) return;
    setSaving(true);
    const currentId = selectedId;
    const tempId = currentId ?? `pending-${Date.now()}`;
    const previous = calculations;
    const now = new Date().toISOString();
    const optimistic: SavedCalculation = {
      ...inputs,
      id: tempId,
      userId: user?.id ?? "",
      createdAt: previous.find((item) => item.id === currentId)?.createdAt ?? now,
      updatedAt: now,
    };
    setCalculations((current) => [optimistic, ...current.filter((item) => item.id !== tempId)]);

    try {
      const result = await fetchJson<{ calculation: SavedCalculation }>(
        currentId ? `/api/calculations/${currentId}` : "/api/calculations",
        { method: currentId ? "PATCH" : "POST", body: JSON.stringify(inputs) },
      );
      setCalculations((current) =>
        [result.calculation, ...current.filter((item) => item.id !== tempId && item.id !== result.calculation.id)].sort(
          (a, b) => b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
      setSelectedId(result.calculation.id);
      setToast(currentId ? "Scenario changes saved." : "Scenario saved to your garage.");
    } catch (error) {
      setCalculations(previous);
      setToast(error instanceof Error ? error.message : "We couldn’t save that scenario.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const target = deleteTarget;
    const previous = calculations;
    const previousSelected = selectedId;
    const previousInputs = inputs;
    const remaining = calculations.filter((scenario) => scenario.id !== target.id);
    setDeleting(true);
    setCalculations(remaining);
    setDeleteTarget(null);

    if (selectedId === target.id) {
      const nextScenario = remaining[0];
      setSelectedId(nextScenario?.id ?? null);
      setInputs(nextScenario ? inputFromScenario(nextScenario) : { ...DEFAULT_SCENARIO });
    }

    try {
      await fetchJson<{ ok: true }>(`/api/calculations/${target.id}`, { method: "DELETE" });
      setToast("Scenario removed from your garage.");
    } catch (error) {
      setCalculations(previous);
      setSelectedId(previousSelected);
      setInputs(previousInputs);
      setToast(error instanceof Error ? error.message : "We couldn’t delete that scenario.");
    } finally {
      setDeleting(false);
    }
  }

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthError("");
    setAuthOpen(true);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    try {
      const result = await fetchJson<{ user: DashboardUser }>("/api/auth", {
        method: "POST",
        body: JSON.stringify({
          action: authMode,
          name: authName,
          email: authEmail,
          password: authPassword,
        }),
      });
      setUser(result.user);
      setAuthOpen(false);
      setAuthPassword("");
      if (authMode === "login") {
        await loadWorkspace();
      } else {
        setToast("Your workspace is now saved to your account.");
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "We couldn’t complete that request.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    try {
      await fetchJson<{ ok: true }>("/api/auth", { method: "POST", body: JSON.stringify({ action: "logout" }) });
      await loadWorkspace();
      setToast("Signed out. A fresh demo workspace is ready.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "We couldn’t sign out.");
    }
  }

  function navigate(label: string, target: string) {
    setActiveNav(label);
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function showPartnerNotice() {
    setToast("Partner buttons are ready for your insurance or lender affiliate links.");
  }

  const filteredScenarios = calculations.filter((scenario) => {
    const searchText = scenarioSearch.trim().toLowerCase();
    return !searchText || `${scenario.name} ${scenario.vehicle}`.toLowerCase().includes(searchText);
  });
  const initials = (user?.name ?? "A M")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-lockup">
            <span className="brand-mark"><CarFront size={22} strokeWidth={2.2} /></span>
            <span className="brand-name">autocost<span>.</span></span>
          </div>
          <span className="brand-caption">YOUR MONEY, IN THE DRIVER’S SEAT</span>
        </div>

        <div className="sidebar-nav-wrap">
          <p className="sidebar-label">WORKSPACE</p>
          <nav className="sidebar-nav" aria-label="Main navigation">
            <button className={`nav-item ${activeNav === "Overview" ? "active" : ""}`} onClick={() => navigate("Overview", "overview")}>
              <LayoutDashboard size={17} /><span>Overview</span><span className="nav-active-dot" />
            </button>
            <button className={`nav-item ${activeNav === "My scenarios" ? "active" : ""}`} onClick={() => navigate("My scenarios", "scenarios")}>
              <FileText size={17} /><span>My scenarios</span><span className="nav-count">{calculations.length}</span>
            </button>
            <button className={`nav-item ${activeNav === "Compare rates" ? "active" : ""}`} onClick={() => navigate("Compare rates", "compare-rates")}>
              <HeartHandshake size={17} /><span>Compare rates</span>
            </button>
          </nav>
          <p className="sidebar-label tools-label">TOOLS</p>
          <nav className="sidebar-nav" aria-label="Tools">
            <button className={`nav-item ${activeNav === "Cost guide" ? "active" : ""}`} onClick={() => navigate("Cost guide", "cost-guide")}>
              <Lightbulb size={17} /><span>Ownership guide</span>
            </button>
            <button className="nav-item" onClick={() => setToast("Every estimate is yours to adjust — no account or credit check required.")}>
              <CircleHelp size={17} /><span>How it works</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-grow">
          <div className="sidebar-promo-icon"><Gauge size={18} /></div>
          <p className="sidebar-promo-kicker">A LITTLE MORE CLARITY</p>
          <p className="sidebar-promo-copy">The smartest car budget starts before the test drive.</p>
          <button onClick={() => navigate("Cost guide", "cost-guide")}>Explore the guide <ArrowUpRight size={14} /></button>
          <div className="promo-orbit promo-orbit-one" />
          <div className="promo-orbit promo-orbit-two" />
        </div>

        <div className="sidebar-footer">
          <div className="profile-card">
            <div className="profile-avatar">{initials || "AM"}</div>
            <div className="profile-details">
              <strong>{user?.name ?? "Your workspace"}</strong>
              <span>{user?.isGuest ? "Demo workspace" : user?.email ?? "Personal account"}</span>
            </div>
            <button
              className="profile-action"
              aria-label={user?.isGuest ? "Create an account" : "Sign out"}
              title={user?.isGuest ? "Create an account" : "Sign out"}
              onClick={() => (user?.isGuest ? openAuth("register") : void signOut())}
            >
              {user?.isGuest ? <ArrowUpRight size={16} /> : <LogOut size={16} />}
            </button>
          </div>
          {user?.isGuest && <button className="save-workspace-link" onClick={() => openAuth("register")}>Create an account to keep your work <ArrowRight size={13} /></button>}
        </div>
      </aside>

      <main className="main-area" id="overview">
        <div className="dashboard-content-grid">
          <section className="main-column">
            <div className="topbar">
              <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>Overview</strong></div>
              <div className="topbar-actions">
                <span className="live-pill"><span className="live-dot" /> LIVE ESTIMATES</span>
                <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setToast("You’re all caught up — your numbers are up to date.")}><Bell size={17} /><span /></button>
                {user?.isGuest ? (
                  <button className="top-account-button" onClick={() => openAuth("register")}>
                    <span className="small-avatar">{initials || "AM"}</span><span>Save workspace</span><ChevronDown size={14} />
                  </button>
                ) : user ? (
                  <button className="top-account-button" onClick={() => void signOut()} title="Sign out">
                    <span className="small-avatar">{initials || "AM"}</span><span>{user.name.split(" ")[0]}</span><LogOut size={14} />
                  </button>
                ) : (
                  <span className="account-skeleton" />
                )}
              </div>
            </div>

            <LeaderboardAd />

            <div className="page-intro">
              <div>
                <p className="eyebrow"><Sparkles size={13} /> YOUR AUTO FINANCE DASHBOARD</p>
                <h1>A clearer picture,<br className="mobile-break" /> <span>before you buy.</span></h1>
                <p className="intro-copy">A car payment is just the beginning. See the full cost, then make the call that feels right.</p>
              </div>
              <button className="button-outline new-scenario-top" onClick={startNewScenario}><Plus size={16} /> New scenario</button>
            </div>

            {loading ? (
              <LoadingDashboard />
            ) : loadError ? (
              <div className="load-error-card">
                <div className="error-icon"><CircleHelp size={20} /></div>
                <div><strong>Your garage is taking a moment.</strong><p>{loadError}</p></div>
                <button className="button-primary compact" onClick={() => void loadWorkspace()}>Try again <ArrowRight size={15} /></button>
              </div>
            ) : (
              <>
                <div className="metric-grid" aria-label="Current scenario summary">
                  <MetricCard
                    tone="mint"
                    icon={<CreditCard size={17} />}
                    label="MONTHLY LOAN PAYMENT"
                    value={currency(finance.monthlyPayment, 2)}
                    suffix="/ mo"
                    foot={`Plus ${currency(finance.monthlyRunningCost)} / mo for insurance & upkeep`}
                    footIcon={<ArrowDownRight size={13} />}
                  />
                  <MetricCard
                    tone="cream"
                    icon={<TrendingDown size={17} />}
                    label="TOTAL INTEREST"
                    value={currency(finance.totalInterest)}
                    foot={`Across ${months} monthly payments`}
                    footIcon={<Calculator size={13} />}
                  />
                  <MetricCard
                    tone="white"
                    icon={<Wallet size={17} />}
                    label="FULL OWNERSHIP COST"
                    value={currency(finance.ownershipTotal)}
                    foot={`Averages ${currency(finance.ownershipTotal / months)} / mo all-in`}
                    footIcon={<BadgeCheck size={13} />}
                  />
                </div>

                <div className="calculator-grid" id="calculator">
                  <section className="panel calculator-panel">
                    <div className="panel-heading calculator-panel-heading">
                      <div className="panel-icon calculator-icon"><Calculator size={17} /></div>
                      <div className="panel-heading-copy"><p className="eyebrow">MAKE IT YOURS</p><h2>Build your scenario</h2></div>
                      {selectedId && <span className="saved-indicator"><span /> SAVED PLAN</span>}
                    </div>
                    <div className="vehicle-details-grid">
                      <label className="text-field">
                        <span>Scenario name</span>
                        <input maxLength={100} value={inputs.name} onChange={(event) => setInputs((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Family road trip" />
                      </label>
                      <label className="text-field">
                        <span>Vehicle</span>
                        <input maxLength={120} value={inputs.vehicle} onChange={(event) => setInputs((current) => ({ ...current, vehicle: event.target.value }))} placeholder="Year, make & model" />
                      </label>
                    </div>

                    <div className="control-block price-control">
                      <div className="control-topline">
                        <label htmlFor="vehicle-price-range">Vehicle price</label>
                        <span className="control-readout">{currency(inputs.vehiclePrice)}</span>
                      </div>
                      <input
                        className="range-input"
                        id="vehicle-price-range"
                        type="range"
                        min="1000"
                        max="200000"
                        step="250"
                        value={Math.min(200000, Math.max(1000, inputs.vehiclePrice))}
                        onChange={(event) => updateNumber("vehiclePrice", event.target.value)}
                        aria-label="Vehicle price slider"
                      />
                      <div className="field-bottom-row">
                        <span className="field-hint">Before taxes & fees</span>
                        <div className="currency-input"><DollarSign size={14} /><input type="number" min="1000" max="1000000000" step="100" value={inputs.vehiclePrice} onChange={(event) => updateNumber("vehiclePrice", event.target.value)} aria-label="Vehicle price in dollars" /></div>
                      </div>
                    </div>

                    <div className="control-block downpayment-control">
                      <div className="control-topline">
                        <label htmlFor="down-payment-range">Down payment</label>
                        <span className="control-readout">{currency(inputs.downPayment)} <span className="readout-detail">· {inputs.vehiclePrice > 0 ? Math.round((inputs.downPayment / inputs.vehiclePrice) * 100) : 0}%</span></span>
                      </div>
                      <input
                        className="range-input"
                        id="down-payment-range"
                        type="range"
                        min="0"
                        max={Math.max(1, inputs.vehiclePrice)}
                        step="100"
                        value={Math.min(inputs.downPayment, inputs.vehiclePrice)}
                        onChange={(event) => updateNumber("downPayment", event.target.value)}
                        aria-label="Down payment slider"
                      />
                      <div className="field-bottom-row">
                        <span className="field-hint">Financing {currency(finance.principal)}</span>
                        <div className="currency-input"><DollarSign size={14} /><input type="number" min="0" max={inputs.vehiclePrice} step="100" value={inputs.downPayment} onChange={(event) => updateNumber("downPayment", event.target.value)} aria-label="Down payment in dollars" /></div>
                      </div>
                    </div>

                    <div className="control-block term-control">
                      <div className="control-topline">
                        <label htmlFor="term-range">Loan term</label>
                        <span className="control-readout">{inputs.termMonths} <span className="readout-detail">months</span></span>
                      </div>
                      <input className="range-input" id="term-range" type="range" min="1" max="120" step="1" value={inputs.termMonths} onChange={(event) => updateNumber("termMonths", event.target.value)} aria-label="Loan term in months" />
                      <div className="preset-row" aria-label="Quick loan term presets">
                        {[36, 48, 60, 72].map((term) => (
                          <button key={term} className={`preset-button ${inputs.termMonths === term ? "selected" : ""}`} onClick={() => updateNumber("termMonths", String(term))} type="button" aria-pressed={inputs.termMonths === term}>{term} months</button>
                        ))}
                      </div>
                    </div>

                    <div className="control-block rate-control">
                      <div className="control-topline">
                        <label htmlFor="interest-rate-range">Interest rate (APR)</label>
                        <span className="control-readout">{inputs.interestRate.toFixed(2)}<span className="readout-detail">%</span></span>
                      </div>
                      <input className="range-input" id="interest-rate-range" type="range" min="0" max="40" step="0.05" value={inputs.interestRate} onChange={(event) => updateNumber("interestRate", event.target.value)} aria-label="Annual interest rate slider" />
                      <div className="field-bottom-row">
                        <span className="field-hint">Your estimated annual APR</span>
                        <div className="suffix-input"><input type="number" min="0" max="40" step="0.05" value={inputs.interestRate} onChange={(event) => updateNumber("interestRate", event.target.value)} aria-label="Interest rate percentage" /><span>%</span></div>
                      </div>
                    </div>

                    <div className="annual-cost-grid">
                      <label className="text-field annual-field">
                        <span>Annual insurance</span>
                        <div className="currency-input"><DollarSign size={14} /><input type="number" min="0" step="50" value={inputs.annualInsurance} onChange={(event) => updateNumber("annualInsurance", event.target.value)} aria-label="Estimated annual insurance" /></div>
                      </label>
                      <label className="text-field annual-field">
                        <span>Annual maintenance</span>
                        <div className="currency-input"><DollarSign size={14} /><input type="number" min="0" step="50" value={inputs.annualMaintenance} onChange={(event) => updateNumber("annualMaintenance", event.target.value)} aria-label="Estimated annual maintenance" /></div>
                      </label>
                    </div>

                    <div className="calculator-footer">
                      <span className="estimate-note"><ShieldCheck size={14} /> Estimates update as you type</span>
                      <button className="button-primary save-button" onClick={() => void saveScenario()} disabled={saving || !isValid}>
                        {saving ? <span className="button-spinner" /> : selectedId ? <Check size={16} /> : <Plus size={16} />}
                        {saving ? "Saving…" : selectedId ? "Save changes" : "Save scenario"}
                      </button>
                    </div>
                    {!isValid && <p className="validation-hint">Enter a vehicle price of at least $1,000 and valid scenario details to save.</p>}
                  </section>

                  <section className="panel breakdown-panel" id="breakdown">
                    <div className="panel-heading breakdown-heading">
                      <div className="panel-heading-copy"><p className="eyebrow">THE BIG PICTURE</p><h2>Where your money goes</h2></div>
                      <div className="segmented-control" role="group" aria-label="Breakdown period">
                        <button type="button" className={view === "monthly" ? "selected" : ""} onClick={() => setView("monthly")} aria-pressed={view === "monthly"}>Monthly</button>
                        <button type="button" className={view === "yearly" ? "selected" : ""} onClick={() => setView("yearly")} aria-pressed={view === "yearly"}>Yearly</button>
                      </div>
                    </div>
                    <div className="chart-summary-row">
                      <div className="chart-wrap">
                        <Doughnut data={chartData} options={chartOptions} aria-label={`${view} ownership cost donut chart`} />
                        <div className="chart-center" aria-hidden="true">
                          <span>AVERAGE / {view === "monthly" ? "MO" : "YR"}</span>
                          <strong>{currency(averagePeriodCost)}</strong>
                          <small>full ownership</small>
                        </div>
                      </div>
                      <div className="chart-legend">
                        {breakdown.map((item) => (
                          <div className="legend-item" key={item.label}>
                            <span className="legend-dot" style={{ backgroundColor: item.color }} />
                            <span className="legend-name">{item.label}</span>
                            <strong>{currency(item.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="breakdown-total-row">
                      <div><span>{view === "monthly" ? "Total per month, averaged" : "Total per year, averaged"}</span><small>Includes vehicle, financing &amp; running costs</small></div>
                      <strong>{currency(averagePeriodCost)}<small> / {view === "monthly" ? "mo" : "yr"}</small></strong>
                    </div>
                    <p className="chart-disclaimer">The vehicle price is spread across your loan term for an apples-to-apples ownership view. Your upfront down payment is included.</p>
                  </section>
                </div>

                <section className="panel scenarios-panel" id="scenarios">
                  <div className="scenarios-heading">
                    <div className="panel-heading">
                      <div className="panel-icon saved-icon"><FileText size={17} /></div>
                      <div className="panel-heading-copy"><p className="eyebrow">YOUR GARAGE</p><h2>Saved scenarios <span className="scenario-count">{calculations.length}</span></h2></div>
                    </div>
                    <div className="scenario-tools">
                      <label className="search-field"><Search size={15} /><input value={scenarioSearch} onChange={(event) => setScenarioSearch(event.target.value)} placeholder="Find a scenario" aria-label="Search saved scenarios" /></label>
                      <button className="button-outline compact" onClick={startNewScenario}><Plus size={15} /> New</button>
                    </div>
                  </div>

                  {calculations.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon"><CarFront size={23} /></div>
                      <h3>Your garage is ready for its first car.</h3>
                      <p>Run the numbers on a vehicle you’re considering, then save it here to compare later.</p>
                      <button className="button-primary compact" onClick={startNewScenario}>Build a scenario <ArrowRight size={15} /></button>
                    </div>
                  ) : filteredScenarios.length === 0 ? (
                    <div className="search-empty"><Search size={17} /> No matching scenarios. <button onClick={() => setScenarioSearch("")}>Clear search</button></div>
                  ) : (
                    <div className="scenario-list">
                      {filteredScenarios.map((scenario, index) => {
                        const scenarioFinance = calculateFinance(inputFromScenario(scenario));
                        const isSelected = selectedId === scenario.id;
                        return (
                          <article className={`scenario-row ${isSelected ? "selected" : ""}`} key={scenario.id}>
                            <button className="scenario-main" onClick={() => loadScenario(scenario)} aria-label={`Load ${scenario.name}`}>
                              <span className={`scenario-car-icon car-tone-${index % 3}`}><CarFront size={19} /></span>
                              <span className="scenario-description"><strong>{scenario.name}</strong><span>{scenario.vehicle}</span></span>
                              <span className="scenario-detail"><strong>{scenario.termMonths} mo</strong><span>{scenario.interestRate.toFixed(2)}% APR</span></span>
                              <span className="scenario-payment"><strong>{currency(scenarioFinance.monthlyPayment, 2)}</strong><span>per month</span></span>
                              {isSelected ? <span className="scenario-current"><Check size={12} /> IN CALCULATOR</span> : <span className="scenario-load-icon"><ArrowUpRight size={16} /></span>}
                            </button>
                            <button className="scenario-delete" onClick={() => setDeleteTarget(scenario)} aria-label={`Delete ${scenario.name}`} title="Delete scenario"><Trash2 size={15} /></button>
                          </article>
                        );
                      })}
                    </div>
                  )}
                  <div className="scenarios-footnote"><LockKeyhole size={13} /> Scenarios are private to this workspace. Create an account to keep them synced.</div>
                </section>

                <footer className="page-footer">
                  <span>AutoCost helps make car math a little less mysterious.</span>
                  <button onClick={() => setToast("This calculator is for planning only. Verify final terms with your lender and insurer.")}>How we estimate <ArrowUpRight size={12} /></button>
                </footer>
              </>
            )}
          </section>

          <aside className="right-rail" aria-label="Helpful resources">
            <section className="affiliate-card" id="compare-rates">
              <div className="affiliate-topline"><span className="partner-label"><Sparkles size={12} /> SMART SHOPPING</span><span className="affiliate-spark"><ArrowUpRight size={14} /></span></div>
              <div className="affiliate-illustration"><div className="affiliate-orbit" /><div className="affiliate-coin coin-one">%</div><div className="affiliate-coin coin-two"><Check size={14} /></div><div className="affiliate-shield"><ShieldCheck size={25} /></div></div>
              <p className="eyebrow">THE NEXT SMART MOVE</p>
              <h2>Find a rate that<br /><span>fits your road.</span></h2>
              <p className="affiliate-copy">A quick comparison could help you find a better fit for both your coverage and your monthly payment.</p>
              <button className="affiliate-button" onClick={showPartnerNotice}><span className="affiliate-button-icon"><ShieldCheck size={15} /></span> Compare insurance rates <ArrowRight size={15} /></button>
              <button className="affiliate-button secondary-affiliate" onClick={showPartnerNotice}><span className="affiliate-button-icon"><CreditCard size={15} /></span> Explore financing <ArrowRight size={15} /></button>
              <p className="affiliate-disclosure">Partner link placeholders · add your affiliate URLs to activate.</p>
            </section>

            <section className="snapshot-card">
              <div className="snapshot-heading"><div className="snapshot-icon"><Wallet size={16} /></div><div><p className="eyebrow">CURRENT PLAN</p><h3>Financing snapshot</h3></div></div>
              <p className="snapshot-vehicle">{inputs.vehicle || "Your vehicle"}</p>
              <div className="snapshot-line"><span>Vehicle price</span><strong>{currency(inputs.vehiclePrice)}</strong></div>
              <div className="snapshot-line"><span>Down payment</span><strong>{currency(inputs.downPayment)}</strong></div>
              <div className="snapshot-line"><span>Amount financed</span><strong>{currency(finance.principal)}</strong></div>
              <div className="snapshot-line"><span>Insurance + upkeep</span><strong>{currency(finance.monthlyRunningCost)}<small> / mo</small></strong></div>
              <div className="snapshot-total"><span>Estimated monthly outlay</span><strong>{currency(finance.monthlyPayment + finance.monthlyRunningCost, 2)}<small> / mo</small></strong></div>
              <p className="snapshot-note">Your actual payment depends on lender terms, taxes and fees.</p>
            </section>

            <section className="money-tip" id="cost-guide">
              <div className="tip-icon"><Lightbulb size={17} /></div>
              <p className="eyebrow">A GOOD THING TO KNOW</p>
              <h3>Shop the total,<br />not just the sticker.</h3>
              <p>Insurance, routine care and interest can add thousands to the real cost. Build them into your budget before you fall in love with the car.</p>
              <button onClick={() => document.getElementById("breakdown")?.scrollIntoView({ behavior: "smooth", block: "center" })}>See your breakdown <ArrowDown size={14} /></button>
              <span className="tip-decoration">01</span>
            </section>

            <SidebarAd />
            <p className="rail-disclaimer">Ad placements are illustrative. AutoCost doesn’t provide lending or insurance products.</p>
          </aside>
        </div>
      </main>

      {toast && <div className="toast-message" role="status"><span className="toast-check"><Check size={14} /></span>{toast}<button aria-label="Dismiss message" onClick={() => setToast("")}><X size={15} /></button></div>}

      {authOpen && (
        <AuthDialog
          mode={authMode}
          busy={authBusy}
          error={authError}
          name={authName}
          email={authEmail}
          password={authPassword}
          onNameChange={setAuthName}
          onEmailChange={setAuthEmail}
          onPasswordChange={setAuthPassword}
          onModeChange={(mode) => { setAuthMode(mode); setAuthError(""); }}
          onClose={() => setAuthOpen(false)}
          onSubmit={submitAuth}
        />
      )}

      {deleteTarget && (
        <div className="modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}>
          <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
            <div className="confirm-icon"><Trash2 size={19} /></div>
            <button className="dialog-close" onClick={() => setDeleteTarget(null)} aria-label="Close dialog"><X size={17} /></button>
            <p className="eyebrow">REMOVE SCENARIO</p>
            <h2 id="delete-title">Delete this plan?</h2>
            <p id="delete-description">“{deleteTarget.name}” will be removed from your garage. You can always build it again.</p>
            <div className="confirm-actions"><button className="button-outline" onClick={() => setDeleteTarget(null)}>Keep scenario</button><button className="button-danger" onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? "Removing…" : "Delete scenario"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  tone,
  icon,
  label,
  value,
  suffix,
  foot,
  footIcon,
}: {
  tone: "mint" | "cream" | "white";
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  foot: string;
  footIcon: React.ReactNode;
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-card-top"><span className="metric-icon">{icon}</span><span className="metric-dot" /></div>
      <p className="metric-label">{label}</p>
      <div className="metric-value">{value}{suffix && <small>{suffix}</small>}</div>
      <div className="metric-foot">{footIcon}{foot}</div>
      {tone === "mint" && <div className="metric-decoration" />}
    </article>
  );
}

function LeaderboardAd() {
  return (
    <div className="leaderboard-ad" aria-label="Responsive display advertisement placeholder, 728 by 90">
      <div className="leaderboard-art"><div className="leaderboard-wheel wheel-left" /><div className="leaderboard-wheel wheel-right" /><span><CarFront size={27} /></span></div>
      <div className="leaderboard-copy"><span className="ad-label">ADVERTISEMENT <i /> RESPONSIVE DISPLAY</span><strong>Good journeys start with a good plan.</strong><span>Reach drivers who are ready to move.</span></div>
      <div className="ad-specification"><strong>728 × 90</strong><span>LEADERBOARD SLOT</span></div>
      <span className="ad-corner-mark">AD</span>
    </div>
  );
}

function SidebarAd() {
  return (
    <div className="sidebar-ad" aria-label="Right sidebar advertisement placeholder, 300 by 250">
      <span className="sidebar-ad-label">ADVERTISEMENT</span>
      <div className="sidebar-ad-art"><span className="ad-sun" /><span className="ad-road road-one" /><span className="ad-road road-two" /><CarFront size={34} strokeWidth={1.3} /></div>
      <span className="sidebar-ad-message">Your brand, on the road ahead.</span>
      <span className="sidebar-ad-spec">300 × 250 · DISPLAY SLOT</span>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="loading-dashboard" aria-label="Loading your dashboard" role="status">
      <div className="loading-metrics"><span /><span /><span /></div>
      <div className="loading-panels"><div className="loading-panel"><span /><span /><span /><span /><span /></div><div className="loading-panel chart-skeleton"><span /><span /></div></div>
      <div className="loading-scenarios"><span /><span /><span /></div>
      <p><span className="button-spinner" /> Bringing your garage up to speed…</p>
    </div>
  );
}

function AuthDialog({
  mode,
  busy,
  error,
  name,
  email,
  password,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onModeChange,
  onClose,
  onSubmit,
}: {
  mode: AuthMode;
  busy: boolean;
  error: string;
  name: string;
  email: string;
  password: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="dialog-close" onClick={onClose} aria-label="Close account dialog"><X size={18} /></button>
        <div className="auth-brand-mark"><CarFront size={21} /></div>
        <p className="eyebrow">A BETTER WAY TO PLAN</p>
        <h2 id="auth-title">{mode === "register" ? "Keep your plans in the garage." : "Welcome back."}</h2>
        <p className="auth-subtitle">{mode === "register" ? "Create a free account and keep this workspace, wherever the road takes you." : "Sign in to pick up right where you left off."}</p>
        <div className="auth-mode-switch" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => onModeChange("register")}>Create account</button>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          {mode === "register" && <label className="auth-input"><span>Your name</span><div><Pencil size={15} /><input autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Alex Morgan" /></div></label>}
          <label className="auth-input"><span>Email address</span><div><Mail size={15} /><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@example.com" /></div></label>
          <label className="auth-input"><span>Password</span><div><LockKeyhole size={15} /><input type={showPassword ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : 1} maxLength={200} value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} /><button className="password-visibility" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button-primary auth-submit" disabled={busy}>{busy ? <span className="button-spinner" /> : mode === "register" ? <Check size={16} /> : <ArrowRight size={16} />}{busy ? "One moment…" : mode === "register" ? "Create my account" : "Sign in to AutoCost"}</button>
        </form>
        <div className="auth-trust"><ShieldCheck size={14} /><span>Your scenarios stay private. No credit check, ever.</span></div>
      </section>
    </div>
  );
}
