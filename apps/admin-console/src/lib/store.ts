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
  SecurityChallenge,
  SecurityQuestion,
  TransactionRow,
  UserRow,
  WorkflowBlueprint,
  WorkflowEvent,
} from "./types";

function iso(minsAgo = 0) {
  return new Date(Date.now() - minsAgo * 60_000).toISOString();
}

let idSeq = 0;
/** Always-unique ids (avoids React key collisions when Date.now() collides). */
export function uid(prefix: string) {
  idSeq += 1;
  return `${prefix}_${Date.now()}_${idSeq}_${Math.random().toString(36).slice(2, 9)}`;
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
    id: "feat_ai_ops_assistant",
    name: "Ops AI assistant",
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
    name: "Sandbox Mobile Money GH",
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
    to: "Sandbox Self",
    region: "Greater Accra",
    provider: "Sandbox Mobile Money GH",
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
    name: "Ops decision assistant",
    role: "ops_assistant",
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
    id: "act_bootstrap_0",
    action: "console.bootstrap",
    target: "admin-console",
    actor: "system",
    result: "Super Admin control plane initialised",
    at: iso(0),
  },
];

const securityQuestions: SecurityQuestion[] = [
  {
    id: "sq_mother_maiden",
    prompt: "What is your mother's maiden name?",
    category: "recovery",
    requiredFor: ["password_reset", "device_transfer"],
    active: true,
    minAnswerLength: 2,
    createdAt: iso(10_000),
  },
  {
    id: "sq_first_school",
    prompt: "What was the name of your first school?",
    category: "identity",
    requiredFor: ["high_value_send", "unfreeze"],
    active: true,
    minAnswerLength: 2,
    createdAt: iso(9_000),
  },
  {
    id: "sq_city_born",
    prompt: "In which city were you born?",
    category: "identity",
    requiredFor: ["kyc_step_up", "receive_verify"],
    active: true,
    minAnswerLength: 2,
    createdAt: iso(8_000),
  },
  {
    id: "sq_last_txn",
    prompt: "What was the approximate amount of your last successful transfer?",
    category: "transaction",
    requiredFor: ["high_value_send", "card_unlock"],
    active: true,
    minAnswerLength: 1,
    createdAt: iso(7_000),
  },
  {
    id: "sq_device_model",
    prompt: "What is the model of your primary phone?",
    category: "device",
    requiredFor: ["new_device_login"],
    active: true,
    minAnswerLength: 2,
    createdAt: iso(6_000),
  },
  {
    id: "sq_ops_pin_phrase",
    prompt: "Ops only — state the daily authorisation phrase",
    category: "ops",
    requiredFor: ["admin_kill_switch", "mass_freeze"],
    active: true,
    minAnswerLength: 4,
    createdAt: iso(5_000),
  },
];

const securityChallenges: SecurityChallenge[] = [
  {
    id: "sc_1",
    userId: "user_demo",
    userName: "Demo Self",
    questionId: "sq_last_txn",
    questionPrompt: "What was the approximate amount of your last successful transfer?",
    status: "failed",
    purpose: "high_value_send · step-up after insufficient_funds retry",
    createdAt: iso(40),
    resolvedAt: iso(39),
  },
  {
    id: "sc_2",
    userId: "user_kojo",
    userName: "Kojo Asante",
    questionId: "sq_first_school",
    questionPrompt: "What was the name of your first school?",
    status: "pending",
    purpose: "unfreeze wallet · passkey + security question",
    createdAt: iso(12),
  },
  {
    id: "sc_3",
    userId: "user_ama",
    userName: "Ama Mensah",
    questionId: "sq_city_born",
    questionPrompt: "In which city were you born?",
    status: "passed",
    purpose: "receive_verify · account name match",
    createdAt: iso(80),
    resolvedAt: iso(79),
  },
];

const workflowBlueprints: WorkflowBlueprint[] = [
  {
    id: "bp_domestic",
    name: "Domestic transfer (sim)",
    workflowType: "DomesticTransferSim",
    taskQueue: "ephera-payments",
    description: "Quote → authorise → ledger hold → rail execute → capture → receipt",
    version: "1.0.0",
    status: "published",
    updatedAt: iso(20),
    createdBy: "platform",
    steps: [
      { id: "s1", activity: "Quote", label: "Quote fee & route", required: true, timeoutSec: 30, retries: 3 },
      { id: "s2", activity: "RequireAuthorisation", label: "Passkey / auth gate", required: true, timeoutSec: 30, retries: 3 },
      { id: "s3", activity: "PostLedgerHold", label: "Ledger hold funds", required: true, timeoutSec: 30, retries: 3 },
      { id: "s4", activity: "ExecuteRail", label: "Execute MM / bank rail", required: true, timeoutSec: 30, retries: 3 },
      { id: "s5", activity: "CaptureLedger", label: "Capture hold → journal", required: true, timeoutSec: 30, retries: 3 },
      { id: "s6", activity: "CreateReceipt", label: "Evidence receipt", required: true, timeoutSec: 30, retries: 2 },
    ],
  },
  {
    id: "bp_bill",
    name: "Utility bill pay",
    workflowType: "BillPaySim",
    taskQueue: "ephera-payments",
    description: "Lookup → quote → auth → hold → provider settle → receipt",
    version: "0.2.0",
    status: "draft",
    updatedAt: iso(50),
    createdBy: "superadmin",
    steps: [
      { id: "b1", activity: "AccountLookup", label: "Utility account lookup", required: true, timeoutSec: 20, retries: 2 },
      { id: "b2", activity: "Quote", label: "Quote amount", required: true, timeoutSec: 20, retries: 2 },
      { id: "b3", activity: "RequireAuthorisation", label: "Authorise", required: true, timeoutSec: 30, retries: 2 },
      { id: "b4", activity: "PostLedgerHold", label: "Hold", required: true, timeoutSec: 30, retries: 3 },
      { id: "b5", activity: "ExecuteUtility", label: "Pay utility", required: true, timeoutSec: 45, retries: 3 },
      { id: "b6", activity: "CreateReceipt", label: "Receipt", required: true, timeoutSec: 20, retries: 2 },
    ],
  },
  {
    id: "bp_video_auth",
    name: "Video receive verification",
    workflowType: "VideoReceiveVerify",
    taskQueue: "ephera-payments",
    description: "Bank-style video/call verification before releasing inbound funds",
    version: "0.1.0",
    status: "draft",
    updatedAt: iso(5),
    createdBy: "superadmin",
    steps: [
      { id: "v1", activity: "RiskScore", label: "Score inbound risk", required: true, timeoutSec: 15, retries: 2 },
      { id: "v2", activity: "SecurityQuestions", label: "Security questions", required: true, timeoutSec: 120, retries: 1 },
      { id: "v3", activity: "StartVideoSession", label: "Open video session", required: false, timeoutSec: 300, retries: 1 },
      { id: "v4", activity: "AgentDecision", label: "Ops approve/reject", required: true, timeoutSec: 600, retries: 1 },
      { id: "v5", activity: "ReleaseInbound", label: "Credit wallet", required: true, timeoutSec: 30, retries: 3 },
    ],
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
  securityQuestions,
  securityChallenges,
  workflowBlueprints,

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
      id: uid("act"),
      action,
      target,
      actor,
      result,
      at: new Date().toISOString(),
    });
    if (actions.length > 200) actions.length = 200;
  },

  ingestWorkflow(event: Omit<WorkflowEvent, "id">) {
    const row: WorkflowEvent = { ...event, id: uid("wf") };
    workflows.unshift(row);
    if (workflows.length > 500) workflows.length = 500;
    return row;
  },

  setSecurityQuestion(id: string, patch: Partial<SecurityQuestion>, actor = "superadmin") {
    const q = securityQuestions.find((x) => x.id === id);
    if (!q) return null;
    Object.assign(q, patch);
    this.logAction("security.question.update", id, actor, JSON.stringify(patch));
    return q;
  },

  addSecurityQuestion(input: Omit<SecurityQuestion, "id" | "createdAt">, actor = "superadmin") {
    const q: SecurityQuestion = {
      ...input,
      id: uid("sq"),
      createdAt: new Date().toISOString(),
    };
    securityQuestions.unshift(q);
    this.logAction("security.question.create", q.id, actor, q.prompt);
    return q;
  },

  resolveChallenge(id: string, status: SecurityChallenge["status"], actor = "superadmin") {
    const c = securityChallenges.find((x) => x.id === id);
    if (!c) return null;
    c.status = status;
    c.resolvedAt = new Date().toISOString();
    this.logAction("security.challenge", id, actor, status);
    return c;
  },

  issueChallenge(
    input: Omit<SecurityChallenge, "id" | "createdAt" | "status" | "resolvedAt">,
    actor = "superadmin",
  ) {
    const c: SecurityChallenge = {
      ...input,
      id: uid("sc"),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    securityChallenges.unshift(c);
    this.logAction("security.challenge.issue", c.id, actor, c.purpose);
    return c;
  },

  saveBlueprint(bp: WorkflowBlueprint, actor = "superadmin") {
    const i = workflowBlueprints.findIndex((x) => x.id === bp.id);
    const next = { ...bp, updatedAt: new Date().toISOString() };
    if (i >= 0) workflowBlueprints[i] = next;
    else workflowBlueprints.unshift(next);
    this.logAction("workflow.blueprint.save", next.id, actor, next.status);
    return next;
  },

  publishBlueprint(id: string, actor = "superadmin") {
    const bp = workflowBlueprints.find((x) => x.id === id);
    if (!bp) return null;
    bp.status = "published";
    bp.updatedAt = new Date().toISOString();
    this.logAction("workflow.blueprint.publish", id, actor, bp.workflowType);
    return bp;
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

  // The console no longer reads a customer balance from the ledger.
  //
  // The ledger authenticates its callers (D-02), and a console must not hold a
  // ledger credential — that is what the control plane is for (ADR 0003). This
  // probe used to fetch the demo wallet directly and, when it failed, told the
  // operator to "start ledger on :8092" even when the ledger was running
  // perfectly well and simply refusing an unauthenticated caller. A control
  // surface that misdiagnoses its own failure is worse than one that stays
  // quiet.
  //
  // Live balances return when the control plane exposes them to an
  // authenticated operator.

  return {
    payments: await ok(`${base.paymentsUrl}/health`),
    ledger: await ok(`${base.ledgerUrl}/health`),
    voice: await ok(`${base.voiceUrl}/health`),
    temporalUi: base.temporalUi,
  };
}
