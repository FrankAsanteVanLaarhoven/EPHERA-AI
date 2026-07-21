/**
 * EPHERA SWIFT / cross-border messaging layer (future scale).
 * Models MT and ISO 20022 pacs messages without live SWIFT network access.
 */

export type SwiftMessageType =
  | "MT103"
  | "MT202"
  | "pacs.008"
  | "pacs.009"
  | "camt.053"
  | "pain.001";

export type SwiftEndpoint = {
  bic: string;
  name: string;
  country: string;
  connectivity: "sandbox_fileact" | "alliance_lite" | "planned_gpi";
  status: "not_onboarded" | "sandbox" | "certified" | "live";
};

export type SwiftMessage = {
  id: string;
  type: SwiftMessageType;
  uetr: string;
  senderBic: string;
  receiverBic: string;
  currency: string;
  amountMinor: number;
  status: "queued" | "submitted" | "ack" | "nack" | "settled" | "rejected";
  createdAt: string;
  purpose: string;
  security: {
    signed: boolean;
    encrypted: boolean;
    dualControl: boolean;
  };
};

export const SANDBOX_BIC_DIRECTORY: SwiftEndpoint[] = [
  {
    bic: "EPHRGHAC",
    name: "EPHERA Settlement GH (sandbox)",
    country: "GH",
    connectivity: "sandbox_fileact",
    status: "sandbox",
  },
  {
    bic: "ECOCGHAC",
    name: "Correspondent Bank GH (sandbox)",
    country: "GH",
    connectivity: "alliance_lite",
    status: "sandbox",
  },
  {
    bic: "GTBINGLA",
    name: "Correspondent NG (sandbox)",
    country: "NG",
    connectivity: "planned_gpi",
    status: "not_onboarded",
  },
  {
    bic: "EQBLKENA",
    name: "Correspondent KE (sandbox)",
    country: "KE",
    connectivity: "planned_gpi",
    status: "not_onboarded",
  },
];

export function createSwiftMessage(input: {
  type: SwiftMessageType;
  senderBic: string;
  receiverBic: string;
  currency: string;
  amountMinor: number;
  purpose: string;
}): SwiftMessage {
  const uetr = cryptoRandomUetr();
  return {
    id: `swift_${Date.now()}`,
    type: input.type,
    uetr,
    senderBic: input.senderBic,
    receiverBic: input.receiverBic,
    currency: input.currency,
    amountMinor: input.amountMinor,
    status: "queued",
    createdAt: new Date().toISOString(),
    purpose: input.purpose,
    security: {
      signed: true,
      encrypted: true,
      dualControl: input.amountMinor >= 1_000_000_00,
    },
  };
}

export function advanceSwiftStatus(msg: SwiftMessage): SwiftMessage {
  const order: SwiftMessage["status"][] = ["queued", "submitted", "ack", "settled"];
  const i = order.indexOf(msg.status);
  if (i < 0 || i >= order.length - 1) return msg;
  return { ...msg, status: order[i + 1] };
}

function cryptoRandomUetr(): string {
  // UUID-shaped UETR for sandbox GPI tracking
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
}
