/**
 * In-process Super Admin control plane store (sandbox).
 * Feature flags and remote actions mutate here; analytics/workflows seed from ops reality.
 */
import type {
  AdminAction,
  AiModel,
  AiSubscription,
  CommunicationEvent,
  DeviceStat,
  FeatureFlag,
  Mandate,
  Provider,
  RegionVolume,
  TransactionRow,
  UserRow,
  WorkflowEvent,
} from "./types";

function iso(minsAgo = 0) {
  return new Date(Date.now() - minsAgo * 60_000).toISOString();
}

const featureFlags: FeatureFlag[] = [
  {
    id: "feat_voice_send",
    name: "Voice send money",
    description: "Allow voice-compiled domestic transfers in consumer apps",
    category: "voice",
    enabled: true,
    rolloutPercent: 100,
    environments: ["sandbox", "staging"],
    lastChangedBy: "superadmin",
    lastChangedAt: iso(120),
  },
  {
    id: "feat_pwa_send",
    name: "PWA transfers",
    description: "Enable send flow on consumer PWA",
    category: "pwa",
    enabled: true,
    rolloutPercent: 100,
    environments: ["sandbox"],
    lastChangedBy: "superadmin",
    lastChangedAt: iso(90),
  },
  {
    id: "feat_wallet_freeze",
    name: "Remote wallet freeze",
    description: "Ops can freeze/unfreeze wallets from admin",
    category: "security",
    enabled: true,
    rolloutPercent: 100,
    environments: ["sandbox", "staging", "prod"],
    lastChangedBy: "superadmin",
    lastChangedAt: iso(200),
  },
  {
    id: "feat_cross_border",
    name: "Cross-border rails",
    description: "International transfer product surface",
    category: "payments",
    enabled: false,
    rolloutPercent: 0,
    environments: ["sandbox"],
    lastChangedBy: "superadmin",
    lastChangedAt: iso(400),
  },
  {
    id: "feat_crypto_assets",
    name: "Crypto assets & trade",
    description: "eToro-style crypto hold/send/trade (roadmap)",
    category: "crypto",
    enabled: false,
    rolloutPercent: 0,
    environments: ["sandbox"],
    lastChangedBy: "superadmin",
    lastChangedAt: iso(500),
  },
  {
    id: "feat_video_verify",
    name: "In-app video verification",
    description: "Video call authorisation for high-value receives / KYC",
    category: "comms",
    enabled: false,
    rolloutPercent: 5,
    environments: ["sandbox"],
    lastChangedBy: "superadmin",
    lastChangedAt: iso(30),
  },
  {
    id: "feat_voice_call_bank",
    name: "Direct bank-style voice calls",
    description: "Receive/place support & auth calls from the app",
    category: "comms",
    enabled: false,
    rolloutPercent: 0,
    environments: ["sandbox"],
    lastChangedBy: "superadmin",
    lastChangedAt: iso(15),
  },
  {
    id: "feat_direct_debit",
    name: "Direct debit mandates",
    description: "Standing orders, recurrent & utility collections",
    category: "payments",
    enabled: true,
    rolloutPercent: 40,
    environments: ["sandbox"],
    lastChangedBy: "superadmin",
    lastChangedAt: iso(60),
  },
  {
    id: "feat_ai_recommendations",
    name: "AI recommendations engine",
    description: "Client-facing spending/savings recommendations",
    category: "ai",
    enabled: true,
    rolloutPercent: 25,
    environments: ["sandbox"],
    lastChangedBy: "superadmin",
    lastChangedAt: iso(45),
  },
  {
    id: "feat_ai_ops_copilot",
    name: "Ops AI copilot",
    description: "Super-admin decision support over workflows & risk",
    category: "ai",
    enabled: true,
    rolloutPercent: 100,
    environments: ["sandbox"],
    lastChangedBy: "superadmin",
    lastChangedAt: iso(10),
  },
  {
    id: "feat_merchant_qr",
    name: "Merchant QR checkout",
    description: "Business acceptance network",
    category: "merchant",
    enabled: true,
    rolloutPercent: 60,
    environments: ["sandbox"],
    lastChangedBy: "superadmin",
    lastChangedAt: iso(80),
  },
  {
    id: "feat_open_banking",
    name: "Open banking connectors",
    description: "Account verification & bank rails via open banking",
    category: "payments",
    enabled: true,
    rolloutPercent: 30,
    environments: ["sandbox"],
    lastChangedBy: "superadmin",
    lastChangedAt: iso(70),
  },
];

/** Seeded from real Temporal worker logs observed in sandbox (insufficient_funds). */
const workflows: WorkflowEvent[] = [
  {
    id: "wf-1",
    workflowType: "DomesticTransferSim",
    workflowId: "transfer-pwa_1784617797470",
    runId: "1ca4a598-1017-4b11-ac0f-bd1eb2fa78ad",
    activityType: "PostLedgerHold",
    attempt: 1,
    status: "failed",
    severity: "error",
    message:
      'activity error (type: PostLedgerHold): ledger POST /v1/holds: 409 Conflict — {"error":"insufficient_funds"}',
    errorCode: "insufficient_funds",
    occurredAt: "2026-07-21T08:09:58.000Z",
    namespace: "default",
    taskQueue: "ephera-payments",
    workerId: "61658@FRANKs-MacBook-Pro.local@",
  },
  {
    id: "wf-2",
    workflowType: "DomesticTransferSim",
    workflowId: "transfer-idem_intent_demo_001_1784606200711",
    runId: "aaf2c079-ad6b-499f-84d9-d6e7868b1660",
    activityType: "PostLedgerHold",
    attempt: 3,
    status: "failed",
    severity: "error",
    message:
      'Activity error ActivityType PostLedgerHold Attempt 3 Error ledger POST /v1/holds: 409 Conflict — {"error":"insufficient_funds"}',
    errorCode: "insufficient_funds",
    occurredAt: "2026-07-21T04:56:43.000Z",
    namespace: "default",
    taskQueue: "ephera-payments",
    workerId: "61658@FRANKs-MacBook-Pro.local@",
  },
  {
    id: "wf-3",
    workflowType: "DomesticTransferSim",
    workflowId: "transfer-idem_voice_suggest_1784606877926",
    runId: "08739917-727e-4478-9dc1-e69ef4ed7752",
    activityType: "PostLedgerHold",
    attempt: 1,
    status: "failed",
    severity: "error",
    message: 'ledger POST /v1/holds: 409 Conflict — {"error":"insufficient_funds"}',
    errorCode: "insufficient_funds",
    occurredAt: "2026-07-21T05:07:58.000Z",
    namespace: "default",
    taskQueue: "ephera-payments",
    workerId: "61658@FRANKs-MacBook-Pro.local@",
  },
  {
    id: "wf-4",
    workflowType: "DomesticTransferSim",
    workflowId: "transfer-idem_voice_suggest_1784612637275",
    runId: "20707bad-e9d5-49e4-8605-aa5c3a8047c1",
    activityType: "PostLedgerHold",
    attempt: 1,
    status: "failed",
    severity: "error",
    message: 'ledger POST /v1/holds: 409 Conflict — {"error":"insufficient_funds"}',
    errorCode: "insufficient_funds",
    occurredAt: "2026-07-21T06:43:57.000Z",
    namespace: "default",
    taskQueue: "ephera-payments",
    workerId: "61658@FRANKs-MacBook-Pro.local@",
  },
  {
    id: "wf-5",
    workflowType: "DomesticTransferSim",
    workflowId: "transfer-idem_intent_demo_001_1784606200711",
    runId: "aaf2c079-ad6b-499f-84d9-d6e7868b1660",
    activityType: "RequireAuthorisation",
    attempt: 1,
    status: "completed",
    severity: "info",
    message: "ExecuteActivity RequireAuthorisation — passkey demo accepted",
    occurredAt: "2026-07-21T04:56:40.000Z",
    namespace: "default",
    taskQueue: "ephera-payments",
    workerId: "61658@FRANKs-MacBook-Pro.local@",
  },
  {
    id: "wf-6",
    workflowType: "DomesticTransferSim",
    workflowId: "transfer-settled_demo_ok_001",
    runId: "b2c3d4e5-0001-4000-8000-aaaaaaaaaaaa",
    activityType: "PostLedgerTransfer",
    attempt: 1,
    status: "completed",
    severity: "success",
    message: "Domestic transfer settled successfully (sandbox)",
    occurredAt: iso(15),
    namespace: "default",
    taskQueue: "ephera-payments",
  },
];

const devices: DeviceStat[] = [
  { platform: "android", count: 18420, share: 48.2, activeToday: 4120 },
  { platform: "ios", count: 12680, share: 33.2, activeToday: 2890 },
  { platform: "pwa_desktop", count: 4120, share: 10.8, activeToday: 640 },
  { platform: "web", count: 2980, share: 7.8, activeToday: 510 },
];

const regions: RegionVolume[] = [
  { region: "Greater Accra", country: "GH", currency: "GHS", txCount: 8420, volumeMinor: 4_820_000_00, failedCount: 112 },
  { region: "Lagos", country: "NG", currency: "NGN", txCount: 12100, volumeMinor: 890_000_000_00, failedCount: 240 },
  { region: "Nairobi", country: "KE", currency: "KES", txCount: 6100, volumeMinor: 62_000_000_00, failedCount: 88 },
  { region: "Kumasi", country: "GH", currency: "GHS", txCount: 2100, volumeMinor: 980_000_00, failedCount: 41 },
  { region: "Abuja", country: "NG", currency: "NGN", txCount: 3400, volumeMinor: 210_000_000_00, failedCount: 55 },
];

const providers: Provider[] = [
  {
    id: "prov_mtn_gh",
    name: "MTN Mobile Money GH",
    type: "mobile_money",
    status: "sandbox",
    region: "GH",
    successRate: 98.4,
    latencyMs: 420,
    lastHeartbeat: iso(1),
    capabilities: ["cash_in", "cash_out", "p2p", "merchant"],
  },
  {
    id: "prov_vodafone_gh",
    name: "Telecel Cash GH",
    type: "mobile_money",
    status: "sandbox",
    region: "GH",
    successRate: 97.1,
    latencyMs: 510,
    lastHeartbeat: iso(2),
    capabilities: ["cash_in", "cash_out", "p2p"],
  },
  {
    id: "prov_airtel_ng",
    name: "AirtelTigo / Partner MM",
    type: "mobile_money",
    status: "degraded",
    region: "NG",
    successRate: 91.2,
    latencyMs: 980,
    lastHeartbeat: iso(8),
    capabilities: ["cash_in", "p2p"],
  },
  {
    id: "prov_ghipss",
    name: "GHIPSS / Bank rail",
    type: "bank",
    status: "online",
    region: "GH",
    successRate: 99.1,
    latencyMs: 310,
    lastHeartbeat: iso(1),
    capabilities: ["transfer", "name_enquiry"],
  },
  {
    id: "prov_open_banking",
    name: "Open Banking Hub",
    type: "open_banking",
    status: "sandbox",
    region: "MULTI",
    successRate: 96.0,
    latencyMs: 640,
    lastHeartbeat: iso(3),
    capabilities: ["ais", "pis", "account_verify"],
  },
  {
    id: "prov_ecg",
    name: "ECG Electricity",
    type: "utility",
    status: "online",
    region: "GH",
    successRate: 99.5,
    latencyMs: 280,
    lastHeartbeat: iso(4),
    capabilities: ["bill_pay", "lookup"],
  },
  {
    id: "prov_gwcl",
    name: "Ghana Water",
    type: "utility",
    status: "online",
    region: "GH",
    successRate: 98.9,
    latencyMs: 350,
    lastHeartbeat: iso(5),
    capabilities: ["bill_pay", "lookup"],
  },
  {
    id: "prov_dstv",
    name: "DStv / MultiChoice",
    type: "utility",
    status: "online",
    region: "MULTI",
    successRate: 97.8,
    latencyMs: 400,
    lastHeartbeat: iso(6),
    capabilities: ["bill_pay", "subscription"],
  },
  {
    id: "prov_visa",
    name: "Card scheme (sandbox)",
    type: "card",
    status: "sandbox",
    region: "MULTI",
    successRate: 99.0,
    latencyMs: 220,
    lastHeartbeat: iso(2),
    capabilities: ["auth", "capture", "refund"],
  },
];

const users: UserRow[] = [
  {
    id: "user_demo",
    name: "Demo Self",
    phone: "+233200000001",
    kycLevel: "L2",
    status: "active",
    device: "PWA · Chrome macOS",
    region: "Greater Accra",
    currency: "GHS",
    balanceMinor: 4650,
    lastSeen: iso(2),
    channels: ["pwa", "push"],
  },
  {
    id: "user_ama",
    name: "Ama Mensah",
    phone: "+233244000111",
    kycLevel: "L1",
    status: "active",
    device: "Android · Expo",
    region: "Greater Accra",
    currency: "GHS",
    balanceMinor: 250_00,
    lastSeen: iso(12),
    channels: ["mobile", "sms", "push"],
  },
  {
    id: "user_kojo",
    name: "Kojo Asante",
    phone: "+233201112233",
    kycLevel: "L3",
    status: "frozen",
    device: "iOS · Expo",
    region: "Kumasi",
    currency: "GHS",
    balanceMinor: 1_200_00,
    lastSeen: iso(40),
    channels: ["mobile", "email"],
  },
  {
    id: "user_chioma",
    name: "Chioma Okafor",
    phone: "+2348012345678",
    kycLevel: "L2",
    status: "active",
    device: "Android",
    region: "Lagos",
    currency: "NGN",
    balanceMinor: 85_000_00,
    lastSeen: iso(5),
    channels: ["mobile", "whatsapp", "push"],
  },
  {
    id: "user_merchant_1",
    name: "Accra Fresh Market",
    phone: "+233302000999",
    kycLevel: "L3",
    status: "active",
    device: "Merchant tablet · Web",
    region: "Greater Accra",
    currency: "GHS",
    balanceMinor: 45_000_00,
    lastSeen: iso(8),
    channels: ["merchant", "email"],
  },
];

const transactions: TransactionRow[] = [
  {
    id: "tx_pwa_1",
    type: "send",
    status: "failed",
    amountMinor: 50_00,
    currency: "GHS",
    from: "Demo Self",
    to: "Ama Mensah",
    region: "Greater Accra",
    provider: "Ledger",
    workflowId: "transfer-pwa_1784617797470",
    createdAt: "2026-07-21T08:09:57.000Z",
    failReason: "insufficient_funds",
  },
  {
    id: "tx_voice_1",
    type: "send",
    status: "failed",
    amountMinor: 50_00,
    currency: "GHS",
    from: "Demo Self",
    to: "Ama Mensah",
    region: "Greater Accra",
    provider: "Ledger",
    workflowId: "transfer-idem_voice_suggest_1784612637275",
    createdAt: "2026-07-21T06:43:57.000Z",
    failReason: "insufficient_funds",
  },
  {
    id: "tx_ok_1",
    type: "send",
    status: "settled",
    amountMinor: 20_00,
    currency: "GHS",
    from: "Demo Self",
    to: "Kojo Asante",
    region: "Greater Accra",
    provider: "GHIPSS",
    workflowId: "transfer-settled_demo_ok_001",
    createdAt: iso(15),
  },
  {
    id: "tx_bill_1",
    type: "bill",
    status: "settled",
    amountMinor: 85_00,
    currency: "GHS",
    from: "Ama Mensah",
    to: "ECG",
    region: "Greater Accra",
    provider: "ECG Electricity",
    createdAt: iso(55),
  },
  {
    id: "tx_dd_1",
    type: "direct_debit",
    status: "pending",
    amountMinor: 120_00,
    currency: "GHS",
    from: "Kojo Asante",
    to: "DStv",
    region: "Kumasi",
    provider: "DStv / MultiChoice",
    createdAt: iso(100),
  },
  {
    id: "tx_air_1",
    type: "airtime",
    status: "settled",
    amountMinor: 10_00,
    currency: "GHS",
    from: "Ama Mensah",
    to: "MTN Self",
    region: "Greater Accra",
    provider: "MTN Mobile Money GH",
    createdAt: iso(130),
  },
];

const mandates: Mandate[] = [
  {
    id: "man_1",
    kind: "direct_debit",
    userId: "user_kojo",
    userName: "Kojo Asante",
    provider: "DStv / MultiChoice",
    amountMinor: 120_00,
    currency: "GHS",
    frequency: "monthly",
    nextRunAt: iso(-60 * 24 * 3),
    status: "active",
  },
  {
    id: "man_2",
    kind: "standing_order",
    userId: "user_ama",
    userName: "Ama Mensah",
    provider: "Internal · Savings pot",
    amountMinor: 50_00,
    currency: "GHS",
    frequency: "weekly",
    nextRunAt: iso(-60 * 24),
    status: "active",
  },
  {
    id: "man_3",
    kind: "recurring",
    userId: "user_chioma",
    userName: "Chioma Okafor",
    provider: "Utility · Ikeja Electric",
    amountMinor: 15_000_00,
    currency: "NGN",
    frequency: "monthly",
    nextRunAt: iso(-60 * 48),
    status: "paused",
  },
  {
    id: "man_4",
    kind: "subscription",
    userId: "user_merchant_1",
    userName: "Accra Fresh Market",
    provider: "EPHERA AI · Growth",
    amountMinor: 299_00,
    currency: "GHS",
    frequency: "monthly",
    nextRunAt: iso(-60 * 10),
    status: "active",
  },
];

const communications: CommunicationEvent[] = [
  {
    id: "com_1",
    channel: "push",
    direction: "outbound",
    userId: "user_demo",
    subject: "Transfer failed — insufficient funds",
    status: "delivered",
    createdAt: "2026-07-21T08:09:59.000Z",
    purpose: "notify",
  },
  {
    id: "com_2",
    channel: "sms",
    direction: "outbound",
    userId: "user_ama",
    subject: "Passkey challenge for receive verification",
    status: "delivered",
    createdAt: iso(20),
    purpose: "auth",
  },
  {
    id: "com_3",
    channel: "video_call",
    direction: "outbound",
    userId: "user_kojo",
    subject: "High-value receive — video identity check (planned)",
    status: "queued",
    createdAt: iso(25),
    purpose: "verify_account",
  },
  {
    id: "com_4",
    channel: "voice_call",
    direction: "inbound",
    userId: "user_ama",
    subject: "Customer support — freeze dispute",
    status: "answered",
    createdAt: iso(90),
    purpose: "support",
  },
  {
    id: "com_5",
    channel: "in_app",
    direction: "outbound",
    userId: "user_demo",
    subject: "Wallet available balance low for requested transfer",
    status: "delivered",
    createdAt: iso(5),
    purpose: "notify",
  },
  {
    id: "com_6",
    channel: "whatsapp",
    direction: "outbound",
    userId: "user_chioma",
    subject: "Standing order reminder",
    status: "sent",
    createdAt: iso(110),
    purpose: "collection",
  },
];

const aiModels: AiModel[] = [
  {
    id: "ai_voice_intent",
    name: "Voice Intent Compiler",
    role: "voice_intent",
    provider: "EPHERA · services/voice-intent",
    version: "0.1.0-sandbox",
    status: "active",
    requests24h: 1840,
    avgLatencyMs: 95,
    errorRate: 0.4,
    costUsd24h: 12.4,
    maxTpm: 600,
    subscriptionTiers: ["starter", "growth", "enterprise"],
  },
  {
    id: "ai_fraud",
    name: "Fraud & velocity scorer",
    role: "fraud",
    provider: "EPHERA policy (planned)",
    version: "0.0.3-canary",
    status: "canary",
    requests24h: 920,
    avgLatencyMs: 40,
    errorRate: 0.1,
    costUsd24h: 8.1,
    maxTpm: 2000,
    subscriptionTiers: ["growth", "enterprise"],
  },
  {
    id: "ai_reco",
    name: "Personal finance recommendations",
    role: "recommendations",
    provider: "EPHERA AI",
    version: "0.2.1",
    status: "active",
    requests24h: 640,
    avgLatencyMs: 180,
    errorRate: 1.2,
    costUsd24h: 22.0,
    maxTpm: 300,
    subscriptionTiers: ["growth", "enterprise", "custom"],
  },
  {
    id: "ai_ops",
    name: "Ops decision copilot",
    role: "ops_copilot",
    provider: "EPHERA Super Admin",
    version: "0.1.0",
    status: "active",
    requests24h: 210,
    avgLatencyMs: 320,
    errorRate: 0.0,
    costUsd24h: 18.5,
    maxTpm: 120,
    subscriptionTiers: ["enterprise"],
  },
  {
    id: "ai_kyc",
    name: "KYC document assist",
    role: "kyc",
    provider: "Partner OCR + EPHERA",
    version: "0.0.9",
    status: "disabled",
    requests24h: 0,
    avgLatencyMs: 0,
    errorRate: 0,
    costUsd24h: 0,
    maxTpm: 100,
    subscriptionTiers: ["enterprise", "custom"],
  },
  {
    id: "ai_support",
    name: "Support agent assist",
    role: "support",
    provider: "EPHERA AI",
    version: "0.3.0",
    status: "active",
    requests24h: 410,
    avgLatencyMs: 210,
    errorRate: 0.8,
    costUsd24h: 9.2,
    maxTpm: 400,
    subscriptionTiers: ["starter", "growth", "enterprise"],
  },
];

const aiSubscriptions: AiSubscription[] = [
  {
    id: "sub_1",
    clientName: "Accra Fresh Market",
    clientType: "merchant",
    plan: "growth",
    models: ["ai_voice_intent", "ai_reco", "ai_support"],
    monthlyQuota: 50_000,
    usedThisMonth: 12_400,
    status: "active",
    renewsAt: iso(-60 * 24 * 12),
  },
  {
    id: "sub_2",
    clientName: "Partner Bank West",
    clientType: "bank",
    plan: "enterprise",
    models: ["ai_voice_intent", "ai_fraud", "ai_ops", "ai_kyc"],
    monthlyQuota: 500_000,
    usedThisMonth: 88_200,
    status: "active",
    renewsAt: iso(-60 * 24 * 20),
  },
  {
    id: "sub_3",
    clientName: "Demo Consumer Pool",
    clientType: "consumer",
    plan: "starter",
    models: ["ai_voice_intent", "ai_reco"],
    monthlyQuota: 10_000,
    usedThisMonth: 9_100,
    status: "trial",
    renewsAt: iso(-60 * 24 * 2),
  },
  {
    id: "sub_4",
    clientName: "Telco Bundle NG",
    clientType: "partner",
    plan: "custom",
    models: ["ai_voice_intent", "ai_fraud", "ai_support"],
    monthlyQuota: 250_000,
    usedThisMonth: 40_000,
    status: "past_due",
    renewsAt: iso(60 * 24),
  },
];

const actions: AdminAction[] = [
  {
    id: "act_0",
    action: "console.bootstrap",
    target: "admin-console",
    actor: "system",
    result: "Super Admin control plane initialised",
    at: iso(0),
  },
];

export const store = {
  featureFlags,
  workflows,
  devices,
  regions,
  providers,
  users,
  transactions,
  mandates,
  communications,
  aiModels,
  aiSubscriptions,
  actions,

  setFeature(id: string, patch: Partial<FeatureFlag>, actor = "superadmin") {
    const f = featureFlags.find((x) => x.id === id);
    if (!f) return null;
    Object.assign(f, patch, {
      lastChangedBy: actor,
      lastChangedAt: new Date().toISOString(),
    });
    this.logAction("feature.update", id, actor, JSON.stringify(patch));
    return f;
  },

  setProviderStatus(id: string, status: Provider["status"], actor = "superadmin") {
    const p = providers.find((x) => x.id === id);
    if (!p) return null;
    p.status = status;
    p.lastHeartbeat = new Date().toISOString();
    this.logAction("provider.status", id, actor, status);
    return p;
  },

  setAiModelStatus(id: string, status: AiModel["status"], actor = "superadmin") {
    const m = aiModels.find((x) => x.id === id);
    if (!m) return null;
    m.status = status;
    this.logAction("ai.model.status", id, actor, status);
    return m;
  },

  setMandateStatus(id: string, status: Mandate["status"], actor = "superadmin") {
    const m = mandates.find((x) => x.id === id);
    if (!m) return null;
    m.status = status;
    this.logAction("mandate.status", id, actor, status);
    return m;
  },

  setUserStatus(id: string, status: UserRow["status"], actor = "superadmin") {
    const u = users.find((x) => x.id === id);
    if (!u) return null;
    u.status = status;
    this.logAction("user.status", id, actor, status);
    return u;
  },

  logAction(action: string, target: string, actor: string, result: string) {
    actions.unshift({
      id: `act_${Date.now()}`,
      action,
      target,
      actor,
      result,
      at: new Date().toISOString(),
    });
    if (actions.length > 200) actions.length = 200;
  },

  ingestWorkflow(event: Omit<WorkflowEvent, "id">) {
    const row: WorkflowEvent = { ...event, id: `wf_${Date.now()}` };
    workflows.unshift(row);
    if (workflows.length > 500) workflows.length = 500;
    return row;
  },
};

export async function probeLive() {
  const base = {
    paymentsUrl: process.env.PAYMENTS_URL || "http://localhost:8090",
    ledgerUrl: process.env.LEDGER_URL || "http://localhost:8092",
    voiceUrl: process.env.VOICE_INTENT_URL || "http://localhost:8091",
    temporalUi: process.env.TEMPORAL_UI_URL || "http://localhost:8088",
  };

  async function ok(url: string) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
      return r.ok;
    } catch {
      return false;
    }
  }

  let demoWallet: {
    externalRef: string;
    availableMinor: number;
    balanceMinor: number;
    holdMinor: number;
    status: string;
    currency: string;
  } | undefined;

  try {
    const r = await fetch(`${base.ledgerUrl}/v1/accounts/user:demo-self:GHS`, {
      signal: AbortSignal.timeout(1500),
    });
    if (r.ok) {
      const a = (await r.json()) as {
        externalRef: string;
        availableMinor: number;
        balanceMinor: number;
        holdMinor: number;
        status: string;
        currency: string;
      };
      demoWallet = {
        externalRef: a.externalRef,
        availableMinor: a.availableMinor,
        balanceMinor: a.balanceMinor,
        holdMinor: a.holdMinor,
        status: a.status,
        currency: a.currency,
      };
      const u = users.find((x) => x.id === "user_demo");
      if (u) u.balanceMinor = a.availableMinor;
    }
  } catch {
    /* offline */
  }

  return {
    payments: await ok(`${base.paymentsUrl}/health`),
    ledger: await ok(`${base.ledgerUrl}/health`),
    voice: await ok(`${base.voiceUrl}/health`),
    temporalUi: base.temporalUi,
    demoWallet,
  };
}
