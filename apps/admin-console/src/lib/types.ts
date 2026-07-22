export type Severity = "critical" | "error" | "warn" | "info" | "success";

export type SecurityQuestion = {
  id: string;
  prompt: string;
  category: "identity" | "device" | "transaction" | "recovery" | "ops";
  requiredFor: string[];
  active: boolean;
  minAnswerLength: number;
  createdAt: string;
};

export type SecurityChallenge = {
  id: string;
  userId: string;
  userName: string;
  questionId: string;
  questionPrompt: string;
  status: "pending" | "passed" | "failed" | "expired";
  purpose: string;
  createdAt: string;
  resolvedAt?: string;
};

export type WorkflowStep = {
  id: string;
  activity: string;
  label: string;
  required: boolean;
  timeoutSec: number;
  retries: number;
};

export type WorkflowBlueprint = {
  id: string;
  name: string;
  workflowType: string;
  taskQueue: string;
  description: string;
  steps: WorkflowStep[];
  version: string;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  createdBy: string;
};

export type FeatureFlag = {
  id: string;
  name: string;
  description: string;
  category: "payments" | "voice" | "security" | "pwa" | "merchant" | "ai" | "comms" | "crypto";
  enabled: boolean;
  rolloutPercent: number;
  environments: string[];
  lastChangedBy: string;
  lastChangedAt: string;
};

export type WorkflowEvent = {
  id: string;
  workflowType: string;
  workflowId: string;
  runId: string;
  activityType?: string;
  attempt?: number;
  status: "running" | "completed" | "failed" | "retrying";
  severity: Severity;
  message: string;
  errorCode?: string;
  occurredAt: string;
  namespace: string;
  taskQueue: string;
  workerId?: string;
};

export type DeviceStat = {
  platform: "ios" | "android" | "web" | "pwa_desktop";
  count: number;
  share: number;
  activeToday: number;
};

export type RegionVolume = {
  region: string;
  country: string;
  currency: string;
  txCount: number;
  volumeMinor: number;
  failedCount: number;
};

export type Provider = {
  id: string;
  name: string;
  type: "mobile_money" | "bank" | "utility" | "open_banking" | "card" | "telecom" | "fx";
  status: "online" | "degraded" | "offline" | "sandbox";
  region: string;
  successRate: number;
  latencyMs: number;
  lastHeartbeat: string;
  capabilities: string[];
};

export type UserRow = {
  id: string;
  name: string;
  phone: string;
  kycLevel: "L0" | "L1" | "L2" | "L3";
  status: "active" | "frozen" | "suspended" | "pending";
  device: string;
  region: string;
  currency: string;
  balanceMinor: number;
  lastSeen: string;
  channels: string[];
};

export type TransactionRow = {
  id: string;
  type: "send" | "receive" | "bill" | "airtime" | "fx" | "merchant" | "direct_debit" | "standing_order";
  status: "pending" | "held" | "settled" | "failed" | "reversed";
  amountMinor: number;
  currency: string;
  from: string;
  to: string;
  region: string;
  provider?: string;
  workflowId?: string;
  createdAt: string;
  failReason?: string;
};

export type Mandate = {
  id: string;
  kind: "direct_debit" | "standing_order" | "recurring" | "subscription";
  userId: string;
  userName: string;
  provider: string;
  amountMinor: number;
  currency: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  nextRunAt: string;
  status: "active" | "paused" | "cancelled" | "failed";
  remainingRuns?: number;
};

export type CommunicationEvent = {
  id: string;
  channel: "push" | "sms" | "email" | "in_app" | "voice_call" | "video_call" | "whatsapp";
  direction: "outbound" | "inbound";
  userId: string;
  subject: string;
  status: "queued" | "sent" | "delivered" | "failed" | "answered" | "missed";
  createdAt: string;
  purpose: "auth" | "notify" | "support" | "verify_account" | "collection" | "marketing";
};

export type AiModel = {
  id: string;
  name: string;
  role: "voice_intent" | "fraud" | "support" | "recommendations" | "kyc" | "pricing" | "ops_assistant";
  provider: string;
  version: string;
  status: "active" | "canary" | "disabled" | "training";
  requests24h: number;
  avgLatencyMs: number;
  errorRate: number;
  costUsd24h: number;
  maxTpm: number;
  subscriptionTiers: string[];
};

export type AiSubscription = {
  id: string;
  clientName: string;
  clientType: "consumer" | "merchant" | "partner" | "bank";
  plan: "starter" | "growth" | "enterprise" | "custom";
  models: string[];
  monthlyQuota: number;
  usedThisMonth: number;
  status: "active" | "trial" | "suspended" | "past_due";
  renewsAt: string;
};

export type AdminAction = {
  id: string;
  action: string;
  target: string;
  actor: string;
  result: string;
  at: string;
};

export type Overview = {
  generatedAt: string;
  live: {
    payments: boolean;
    ledger: boolean;
    voice: boolean;
    temporalUi: string;
  };
  demoWallet?: {
    externalRef: string;
    availableMinor: number;
    balanceMinor: number;
    holdMinor: number;
    status: string;
    currency: string;
  };
  kpis: {
    activeUsers24h: number;
    txVolume24hMinor: number;
    txCount24h: number;
    failRate: number;
    openWorkflowErrors: number;
    providersOnline: number;
    providersTotal: number;
    aiRequests24h: number;
    mandatesActive: number;
  };
  recommendations: {
    id: string;
    priority: "P0" | "P1" | "P2";
    title: string;
    detail: string;
    actionLabel: string;
    actionId: string;
  }[];
};
