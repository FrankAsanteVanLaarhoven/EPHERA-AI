/**
 * Partner capability manifests (banks, telcos, merchants).
 * Level 2 operating windows — approved functions only.
 */

export type CapabilityChannel = "api" | "deep_link" | "app_intent" | "app_action" | "embedded";

export interface Capability {
  id: string;
  partnerId: string;
  name: string;
  channel: CapabilityChannel;
  description: string;
  requiresStepUp: boolean;
  financial: boolean;
}

export interface CapabilityManifest {
  partnerId: string;
  partnerName: string;
  version: string;
  capabilities: Capability[];
}
