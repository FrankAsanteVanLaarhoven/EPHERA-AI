import type { CountryTerms, RegulatoryRequirement } from "@ephera/connect-layer";

/** Country banking / payments regulatory catalogue (sandbox summaries — not legal advice). */
export const REGULATORY_REQUIREMENTS: RegulatoryRequirement[] = [
  {
    id: "reg_gh_bocg_psp",
    country: "GH",
    authority: "Bank of Ghana",
    title: "Payment Service Provider / EMI licensing posture",
    description:
      "Entities offering payment, wallet, or remittance services in Ghana must hold or partner under an appropriate BoG licence and maintain AML/CFT controls aligned with BoG directives.",
    requiredDocs: ["licence", "aml_policy", "kyc_policy", "terms_and_conditions", "data_protection"],
    appliesTo: ["mobile_money", "fintech", "merchant", "open_banking"],
    mandatory: true,
  },
  {
    id: "reg_gh_data",
    country: "GH",
    authority: "Data Protection Commission (Ghana)",
    title: "Data protection registration",
    description: "Processing personal data of Ghana residents requires DPC compliance and privacy notices.",
    requiredDocs: ["privacy_policy", "data_protection"],
    appliesTo: ["mobile_money", "bank", "merchant", "utility", "fintech", "open_banking"],
    mandatory: true,
  },
  {
    id: "reg_ng_cbn",
    country: "NG",
    authority: "Central Bank of Nigeria",
    title: "CBN payments / PSSP / MMO framework",
    description:
      "Payment service providers and mobile money operators must meet CBN licensing, consumer protection, and AML requirements for Nigerian corridors.",
    requiredDocs: ["licence", "aml_policy", "kyc_policy", "terms_and_conditions", "incident_response"],
    appliesTo: ["mobile_money", "fintech", "bank", "open_banking", "merchant"],
    mandatory: true,
  },
  {
    id: "reg_ng_ndpr",
    country: "NG",
    authority: "NDPC / NDPR",
    title: "Nigeria Data Protection Act",
    description: "Controllers/processors must implement lawful basis, security, and breach notification.",
    requiredDocs: ["privacy_policy", "data_protection"],
    appliesTo: ["mobile_money", "bank", "merchant", "utility", "fintech", "open_banking"],
    mandatory: true,
  },
  {
    id: "reg_ke_cbk",
    country: "KE",
    authority: "Central Bank of Kenya",
    title: "Payment service provider / e-money issuer",
    description: "CBK oversight for payment systems participants and e-money issuance.",
    requiredDocs: ["licence", "aml_policy", "kyc_policy", "terms_and_conditions"],
    appliesTo: ["mobile_money", "fintech", "bank", "merchant"],
    mandatory: true,
  },
  {
    id: "reg_multi_swift",
    country: "MULTI",
    authority: "SWIFT / correspondent banks",
    title: "SWIFT onboarding & customer security programme",
    description:
      "Correspondents require BIC registration, CSP controls, dual control for high-value messages, and signed/encrypted traffic.",
    requiredDocs: ["incident_response", "aml_policy", "insurance"],
    appliesTo: ["swift_correspondent", "bank", "fx"],
    mandatory: true,
  },
  {
    id: "reg_multi_ob",
    country: "MULTI",
    authority: "Open banking / AIS-PIS frameworks",
    title: "Open banking security profile",
    description:
      "OAuth2 + PKCE, mTLS, signed webhooks, consent management, and strong customer authentication for AIS/PIS.",
    requiredDocs: ["terms_and_conditions", "privacy_policy", "data_protection", "incident_response"],
    appliesTo: ["open_banking", "bank", "fintech"],
    mandatory: true,
  },
  {
    id: "reg_pci",
    country: "MULTI",
    authority: "PCI DSS (if card data)",
    title: "Card data security",
    description: "Card acquirers and processors must evidence PCI scope reduction or full DSS compliance.",
    requiredDocs: ["pci_attestation", "incident_response"],
    appliesTo: ["card_acquirer", "merchant"],
    mandatory: true,
  },
];

export const COUNTRY_TERMS: CountryTerms[] = [
  {
    id: "tos_gh_v1",
    country: "GH",
    title: "EPHERA Ghana Provider Terms",
    version: "1.0.0",
    authority: "EPHERA · governed by Ghana law + BoG-aligned operating rules",
    effectiveAt: "2026-01-01",
    summary: "Settlement windows, consumer redress, AML cooperation, and data residency expectations for Ghana.",
    body: `EPHERA GHANA PROVIDER TERMS (SANDBOX SUMMARY — NOT LEGAL ADVICE)

1. Licence & authorisation. Provider represents it holds, or is sponsored under, all licences required by the Bank of Ghana and other Ghanaian authorities for the services listed in its application.

2. Consumer protection. Fees, FX, and failure states must be disclosed before authorisation. Disputes are escalated via EPHERA Support with SLA targets.

3. AML/CFT. Provider maintains risk-based KYC, sanctions screening, and will freeze/release funds only under lawful instruction coordinated with EPHERA policy.

4. Data. Personal data of Ghana users is processed under the Data Protection Act; cross-border transfers require appropriate safeguards.

5. Settlement. Sandbox rails are simulated. Production settlement cycles, chargebacks, and float rules will be annexed per rail.

6. Termination. EPHERA or BoG-directed suspension may halt traffic immediately for compliance breaches.`,
  },
  {
    id: "tos_ng_v1",
    country: "NG",
    title: "EPHERA Nigeria Provider Terms",
    version: "1.0.0",
    authority: "EPHERA · CBN-aligned operating rules (sandbox)",
    effectiveAt: "2026-01-01",
    summary: "CBN consumer protection, NDPR, and transaction monitoring cooperation for Nigeria.",
    body: `EPHERA NIGERIA PROVIDER TERMS (SANDBOX SUMMARY)

1. Regulatory standing. Provider warrants appropriate CBN authorisation category for offered payment services.

2. NDPR. Provider is a controller/processor as applicable and maintains security, DPIAs where required, and breach notification to EPHERA within contractual windows.

3. Transaction monitoring. Provider supplies metadata required for AML, fraud, and dispute reconstruction.

4. Open banking. If AIS/PIS is enabled, consent, SCA, and TPP security profiles apply.

5. Sandbox disclaimer. No live funds; production go-live requires separate certification.`,
  },
  {
    id: "tos_ke_v1",
    country: "KE",
    title: "EPHERA Kenya Provider Terms",
    version: "1.0.0",
    authority: "EPHERA · CBK-aligned operating rules (sandbox)",
    effectiveAt: "2026-01-01",
    summary: "CBK payments participation, consumer disclosure, and AML cooperation for Kenya.",
    body: `EPHERA KENYA PROVIDER TERMS (SANDBOX SUMMARY)

1. Authorisation. Provider maintains CBK-required licences or partner arrangements for payment services.

2. Transparency. All fees and failure reasons surface to end users before consent.

3. AML. Provider cooperates with EPHERA freezes, SARs, and law-enforcement lawful requests per policy.

4. Continuity. Incident response contacts and RTO/RPO targets are declared in onboarding.`,
  },
  {
    id: "tos_platform_v1",
    country: "MULTI",
    title: "EPHERA Platform Provider Master Terms",
    version: "1.0.0",
    authority: "EPHERA Money platform",
    effectiveAt: "2026-01-01",
    summary: "Master terms: security, audit, SLA, IP, liability caps, and Super Admin oversight.",
    body: `EPHERA PLATFORM PROVIDER MASTER TERMS (SANDBOX)

1. Super Admin oversight. EPHERA may monitor, throttle, or suspend providers for risk, fraud, or compliance.

2. Security. API keys, mTLS, webhook HMAC, IP allowlists, and least-privilege scopes are mandatory for production.

3. Open banking & SWIFT. Optional layers; activation requires security review and country eligibility.

4. Audit. Provider grants EPHERA audit rights over logs relevant to payment integrity (sandbox: simulated).

5. No legal advice. Country annexes summarise expectations; counsel must review before production.`,
  },
];

export function requirementsFor(country: string, category: string) {
  return REGULATORY_REQUIREMENTS.filter(
    (r) =>
      (r.country === country || r.country === "MULTI") &&
      r.appliesTo.includes(category as never),
  );
}
