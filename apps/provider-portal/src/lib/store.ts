import type {
  ComplianceDocument,
  ItemConnection,
  LinkToken,
  ProviderApplication,
  SwiftMessage,
} from "@ephera/connect-layer";
import {
  createLinkToken,
  createSwiftMessage,
  exchangePublicToken,
  listInstitutions,
} from "@ephera/connect-layer";

let seq = 0;
function uid(prefix: string) {
  seq += 1;
  return `${prefix}_${Date.now()}_${seq}_${Math.random().toString(36).slice(2, 7)}`;
}

const applications: ProviderApplication[] = [
  {
    id: "app_seed_mtn",
    legalName: "MTN Mobile Money Ghana Ltd (sandbox demo)",
    tradingName: "MTN MoMo GH",
    category: "mobile_money",
    countries: ["GH"],
    primaryCountry: "GH",
    registrationNumber: "CS000000001",
    taxId: "C0000000001",
    website: "https://example.mtn",
    contactName: "Partner Ops",
    contactEmail: "ops@example-mtn.test",
    contactPhone: "+233200000000",
    servicesOffered: ["cash_in", "cash_out", "p2p", "merchant"],
    description: "Seed provider for Super Admin monitoring demos.",
    status: "approved",
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    documents: [
      {
        id: "doc_1",
        type: "licence",
        title: "BoG payment licence (sandbox copy)",
        version: "2025",
        jurisdiction: "GH",
        fileName: "bog-licence-sandbox.pdf",
        contentRef: "hash_demo_licence",
        submittedAt: new Date(Date.now() - 86400000 * 9).toISOString(),
        status: "approved",
      },
      {
        id: "doc_2",
        type: "terms_and_conditions",
        title: "Customer T&Cs Ghana",
        version: "3.2",
        jurisdiction: "GH",
        fileName: "tc-gh.pdf",
        contentRef: "hash_demo_tc",
        submittedAt: new Date(Date.now() - 86400000 * 9).toISOString(),
        status: "approved",
      },
    ],
    acceptedPlatformTosAt: new Date(Date.now() - 86400000 * 9).toISOString(),
    acceptedCountryTerms: [
      { country: "GH", termId: "tos_gh_v1", acceptedAt: new Date(Date.now() - 86400000 * 9).toISOString() },
    ],
    security: {
      wantsOpenBanking: false,
      wantsSwift: false,
      mtlsReady: true,
      webhookUrl: "https://provider.example/hooks/ephera",
      ipAllowlist: ["203.0.113.10/32"],
    },
    adminNotes: ["Seed approved for sandbox traffic."],
  },
];

const linkSessions: { token: LinkToken; providerAppId: string }[] = [];
const connections: { providerAppId: string; connection: ItemConnection }[] = [];
const swiftMessages: SwiftMessage[] = [];
const credentials: { providerAppId: string; publicId: string; fingerprint: string; scopes: string[] }[] =
  [];

export const providerStore = {
  applications,
  linkSessions,
  connections,
  swiftMessages,
  credentials,

  list() {
    return applications;
  },

  get(id: string) {
    return applications.find((a) => a.id === id) || null;
  },

  create(input: Omit<ProviderApplication, "id" | "createdAt" | "updatedAt" | "documents" | "acceptedCountryTerms" | "adminNotes" | "status"> & {
    status?: ProviderApplication["status"];
  }) {
    const app: ProviderApplication = {
      ...input,
      id: uid("app"),
      status: input.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
      acceptedCountryTerms: [],
      adminNotes: [],
    };
    applications.unshift(app);
    return app;
  },

  update(id: string, patch: Partial<ProviderApplication>) {
    const app = applications.find((a) => a.id === id);
    if (!app) return null;
    Object.assign(app, patch, { updatedAt: new Date().toISOString() });
    return app;
  },

  submit(id: string) {
    const app = applications.find((a) => a.id === id);
    if (!app) return null;
    app.status = "compliance_review";
    app.updatedAt = new Date().toISOString();
    app.adminNotes.push(`Submitted for compliance review at ${app.updatedAt}`);
    return app;
  },

  addDocument(id: string, doc: Omit<ComplianceDocument, "id" | "submittedAt" | "status">) {
    const app = applications.find((a) => a.id === id);
    if (!app) return null;
    const row: ComplianceDocument = {
      ...doc,
      id: uid("doc"),
      submittedAt: new Date().toISOString(),
      status: "submitted",
    };
    app.documents.unshift(row);
    app.updatedAt = new Date().toISOString();
    if (app.status === "draft") app.status = "submitted";
    return row;
  },

  acceptTerms(id: string, country: string, termId: string) {
    const app = applications.find((a) => a.id === id);
    if (!app) return null;
    app.acceptedCountryTerms.push({
      country,
      termId,
      acceptedAt: new Date().toISOString(),
    });
    if (termId.startsWith("tos_platform")) {
      app.acceptedPlatformTosAt = new Date().toISOString();
    }
    app.updatedAt = new Date().toISOString();
    return app;
  },

  /**
   * Record an approval decision.
   *
   * Credential issuance used to happen here, inline with the status change, and
   * returned the raw secret to the caller (D-09). It has moved out: approving a
   * provider is a control-plane change requiring a second operator, and the
   * secret is delivered once through a channel that is not this response body.
   */
  setAdminStatus(
    id: string,
    status: ProviderApplication["status"],
    note: string,
  ) {
    const app = applications.find((a) => a.id === id);
    if (!app) return null;
    app.status = status;
    app.adminNotes.push(note);
    app.updatedAt = new Date().toISOString();
    return { app };
  },

  reviewDocument(appId: string, docId: string, status: ComplianceDocument["status"], note?: string) {
    const app = applications.find((a) => a.id === appId);
    if (!app) return null;
    const doc = app.documents.find((d) => d.id === docId);
    if (!doc) return null;
    doc.status = status;
    doc.reviewerNote = note;
    app.updatedAt = new Date().toISOString();
    return doc;
  },

  issueLink(providerAppId: string, countryCodes: string[]) {
    const token = createLinkToken({
      clientUserId: providerAppId,
      products: ["ais", "pis", "account_verify"],
      countryCodes,
    });
    linkSessions.push({ token, providerAppId });
    const app = applications.find((a) => a.id === providerAppId);
    if (app) {
      app.openBanking = {
        linkTokensIssued: (app.openBanking?.linkTokensIssued || 0) + 1,
        connections: app.openBanking?.connections || 0,
      };
    }
    return token;
  },

  completeLink(providerAppId: string, institutionId: string) {
    const connection = exchangePublicToken(`public-${Date.now()}`, institutionId);
    connections.push({ providerAppId, connection });
    const app = applications.find((a) => a.id === providerAppId);
    if (app) {
      app.openBanking = {
        linkTokensIssued: app.openBanking?.linkTokensIssued || 0,
        connections: (app.openBanking?.connections || 0) + 1,
      };
    }
    return connection;
  },

  listInstitutions: listInstitutions,

  queueSwift(providerAppId: string, input: Parameters<typeof createSwiftMessage>[0]) {
    const msg = createSwiftMessage(input);
    swiftMessages.unshift(msg);
    const app = applications.find((a) => a.id === providerAppId);
    if (app) {
      app.swift = {
        bic: input.senderBic,
        messagesQueued: (app.swift?.messagesQueued || 0) + 1,
      };
    }
    return msg;
  },
};
