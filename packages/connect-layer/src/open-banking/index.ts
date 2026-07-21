/**
 * EPHERA Open Banking layer — Plaid-like AIS/PIS abstraction.
 * Sandbox only: no live bank credentials. Swap adapters for licensed markets.
 */

export type OpenBankingProduct = "ais" | "pis" | "account_verify" | "balance" | "transactions" | "identity";

export type Institution = {
  id: string;
  name: string;
  country: string;
  products: OpenBankingProduct[];
  logoHint: string;
  status: "sandbox" | "live" | "degraded";
};

export type LinkToken = {
  linkToken: string;
  expiration: string;
  requestId: string;
  products: OpenBankingProduct[];
  countryCodes: string[];
};

export type ItemConnection = {
  itemId: string;
  institutionId: string;
  accessTokenRef: string;
  status: "good" | "login_required" | "error";
  accounts: BankAccount[];
  createdAt: string;
};

export type BankAccount = {
  accountId: string;
  name: string;
  mask: string;
  type: "depository" | "credit" | "loan" | "investment";
  currency: string;
  balances: { available?: number; current?: number };
};

export type PaymentInitiation = {
  paymentId: string;
  status: "pending" | "authorised" | "settled" | "failed" | "cancelled";
  amountMinor: number;
  currency: string;
  debtorName?: string;
  creditorName: string;
  creditorIban?: string;
  reference: string;
  createdAt: string;
};

const SANDBOX_INSTITUTIONS: Institution[] = [
  {
    id: "ins_gcb_gh",
    name: "GCB Bank (sandbox)",
    country: "GH",
    products: ["ais", "pis", "account_verify", "balance", "transactions"],
    logoHint: "gcb",
    status: "sandbox",
  },
  {
    id: "ins_ecobank_gh",
    name: "Ecobank Ghana (sandbox)",
    country: "GH",
    products: ["ais", "pis", "balance"],
    logoHint: "ecobank",
    status: "sandbox",
  },
  {
    id: "ins_gtb_ng",
    name: "GTBank Nigeria (sandbox)",
    country: "NG",
    products: ["ais", "pis", "account_verify", "transactions"],
    logoHint: "gtb",
    status: "sandbox",
  },
  {
    id: "ins_equity_ke",
    name: "Equity Bank Kenya (sandbox)",
    country: "KE",
    products: ["ais", "pis", "balance"],
    logoHint: "equity",
    status: "sandbox",
  },
  {
    id: "ins_demo_eu",
    name: "Demo EU Open Banking Bank",
    country: "DE",
    products: ["ais", "pis", "identity", "transactions"],
    logoHint: "eu-ob",
    status: "sandbox",
  },
];

export function listInstitutions(country?: string): Institution[] {
  if (!country) return [...SANDBOX_INSTITUTIONS];
  return SANDBOX_INSTITUTIONS.filter((i) => i.country === country.toUpperCase());
}

export function createLinkToken(input: {
  clientUserId: string;
  products: OpenBankingProduct[];
  countryCodes: string[];
}): LinkToken {
  const token = `link-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  return {
    linkToken: token,
    expiration: new Date(Date.now() + 30 * 60_000).toISOString(),
    requestId: `req_${Date.now()}`,
    products: input.products,
    countryCodes: input.countryCodes,
  };
}

export function exchangePublicToken(publicToken: string, institutionId: string): ItemConnection {
  void publicToken;
  const inst = SANDBOX_INSTITUTIONS.find((i) => i.id === institutionId) || SANDBOX_INSTITUTIONS[0];
  return {
    itemId: `item_${Date.now()}`,
    institutionId: inst.id,
    accessTokenRef: `access-ref_${Math.random().toString(36).slice(2, 10)}`,
    status: "good",
    createdAt: new Date().toISOString(),
    accounts: [
      {
        accountId: `acc_${Math.random().toString(36).slice(2, 8)}`,
        name: `${inst.name} · Current`,
        mask: "4821",
        type: "depository",
        currency: inst.country === "NG" ? "NGN" : inst.country === "KE" ? "KES" : "GHS",
        balances: { available: 12500.5, current: 12840.0 },
      },
      {
        accountId: `acc_${Math.random().toString(36).slice(2, 8)}`,
        name: `${inst.name} · Savings`,
        mask: "1190",
        type: "depository",
        currency: inst.country === "NG" ? "NGN" : inst.country === "KE" ? "KES" : "GHS",
        balances: { available: 4200, current: 4200 },
      },
    ],
  };
}

export function initiatePayment(input: {
  amountMinor: number;
  currency: string;
  creditorName: string;
  creditorIban?: string;
  reference: string;
}): PaymentInitiation {
  return {
    paymentId: `pay_${Date.now()}`,
    status: "pending",
    amountMinor: input.amountMinor,
    currency: input.currency,
    creditorName: input.creditorName,
    creditorIban: input.creditorIban,
    reference: input.reference,
    createdAt: new Date().toISOString(),
  };
}

export function verifyAccountName(input: {
  accountNumber: string;
  sortOrBankCode: string;
  expectedName: string;
}): { match: "exact" | "close" | "none"; providerScore: number } {
  // Sandbox heuristic
  const ok = input.accountNumber.length >= 8 && input.expectedName.trim().length > 2;
  return {
    match: ok ? "exact" : "none",
    providerScore: ok ? 0.97 : 0.12,
  };
}
