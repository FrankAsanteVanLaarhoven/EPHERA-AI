/**
 * Shared provider registry types for portal + Super Admin monitoring.
 */

export type ProviderCategory =
  | "mobile_money"
  | "bank"
  | "merchant"
  | "utility"
  | "telecom"
  | "open_banking"
  | "card_acquirer"
  | "fx"
  | "swift_correspondent"
  | "fintech";

export type ComplianceDocType =
  | "terms_and_conditions"
  | "privacy_policy"
  | "licence"
  | "aml_policy"
  | "kyc_policy"
  | "data_protection"
  | "incident_response"
  | "insurance"
  | "pci_attestation"
  | "central_bank_approval"
  | "other";

export type CountryCode = "GH" | "NG" | "KE" | "ZA" | "RW" | "CI" | "SN" | "MULTI" | string;

export type RegulatoryRequirement = {
  id: string;
  country: CountryCode;
  authority: string;
  title: string;
  description: string;
  requiredDocs: ComplianceDocType[];
  appliesTo: ProviderCategory[];
  mandatory: boolean;
};

export type ComplianceDocument = {
  id: string;
  type: ComplianceDocType;
  title: string;
  version: string;
  jurisdiction: CountryCode;
  fileName: string;
  /** Sandbox: content hash / reference only */
  contentRef: string;
  submittedAt: string;
  status: "submitted" | "under_review" | "approved" | "rejected" | "expired";
  reviewerNote?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
};

export type ProviderApplication = {
  /**
   * The authenticated subject that owns this application. Reads and writes are
   * scoped to it: before this existed, every endpoint returned every
   * provider's record to any caller (D-08).
   */
  ownerSubject?: string;
  id: string;
  legalName: string;
  tradingName: string;
  category: ProviderCategory;
  countries: CountryCode[];
  primaryCountry: CountryCode;
  registrationNumber: string;
  taxId: string;
  website?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  servicesOffered: string[];
  description: string;
  status:
    | "draft"
    | "submitted"
    | "compliance_review"
    | "security_review"
    | "approved"
    | "rejected"
    | "suspended";
  createdAt: string;
  updatedAt: string;
  documents: ComplianceDocument[];
  acceptedPlatformTosAt?: string;
  acceptedCountryTerms: { country: CountryCode; termId: string; acceptedAt: string }[];
  security: {
    wantsOpenBanking: boolean;
    wantsSwift: boolean;
    mtlsReady: boolean;
    webhookUrl?: string;
    ipAllowlist: string[];
  };
  openBanking?: {
    linkTokensIssued: number;
    connections: number;
  };
  swift?: {
    bic?: string;
    messagesQueued: number;
  };
  adminNotes: string[];
};

export type CountryTerms = {
  id: string;
  country: CountryCode;
  title: string;
  version: string;
  summary: string;
  body: string;
  authority: string;
  effectiveAt: string;
};
