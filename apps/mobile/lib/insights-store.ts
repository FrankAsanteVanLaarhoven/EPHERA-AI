/**
 * Insights data — production-shaped client model.
 * Aggregates demo activity; can swap for API later.
 */

export type SpendCategory = {
  id: string;
  label: string;
  minor: number;
  color: string;
};

export type InsightAlert = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warn" | "ok";
};

export type InsightsSnapshot = {
  periodLabel: string;
  incomeMinor: number;
  spendMinor: number;
  forecastMinor: number;
  categories: SpendCategory[];
  subscriptions: { name: string; minor: number; next: string }[];
  alerts: InsightAlert[];
  feeMinor: number;
};

export function loadInsightsSnapshot(): InsightsSnapshot {
  return {
    periodLabel: "This month · Jul 2026",
    incomeMinor: 850_000,
    spendMinor: 412_500,
    forecastMinor: 520_000,
    feeMinor: 1_850,
    categories: [
      { id: "bills", label: "Bills & utilities", minor: 95_000, color: "#FBBF24" },
      { id: "airtime", label: "Airtime & data", minor: 42_000, color: "#22D3EE" },
      { id: "transfer", label: "Transfers out", minor: 180_000, color: "#60A5FA" },
      { id: "merchant", label: "Merchants", minor: 65_500, color: "#A78BFA" },
      { id: "other", label: "Other", minor: 30_000, color: "#94A3B8" },
    ],
    subscriptions: [
      { name: "DSTV Premium", minor: 32_000, next: "12 Aug" },
      { name: "Spotify Family", minor: 3_200, next: "3 Aug" },
      { name: "iCloud+", minor: 1_500, next: "18 Aug" },
    ],
    alerts: [
      {
        id: "a1",
        title: "Spending is 12% above last month",
        body: "Based on your last 30 days of settled transfers and bills.",
        severity: "warn",
      },
      {
        id: "a2",
        title: "3 active subscriptions",
        body: "Total GH₵ 367 / month. No sponsored offers hidden here.",
        severity: "info",
      },
      {
        id: "a3",
        title: "Cash-flow looks healthy",
        body: "Forecast remaining after scheduled bills: positive.",
        severity: "ok",
      },
    ],
  };
}
