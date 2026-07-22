/**
 * EpheraPasskeys surface.
 * Production: native Swift/Kotlin module via Expo Modules.
 * Sandbox: deterministic mock that still blocks voice-only paths.
 */

export interface PasskeyAuthRequest {
  transferId: string;
  amountMinor: number;
  currency: string;
  recipientName: string;
  /** Human-readable challenge bound to this transaction */
  challengeSummary: string;
}

export interface PasskeyAuthResult {
  ok: boolean;
  authorisationRef: string;
  method: "passkey" | "mock_passkey";
  deviceBound: boolean;
  error?: string;
}

export interface PasskeyModule {
  isAvailable(): Promise<boolean>;
  authorise(req: PasskeyAuthRequest): Promise<PasskeyAuthResult>;
}

/** Sandbox mock — never accept empty transaction binding. */
export class MockPasskeys implements PasskeyModule {
  async isAvailable() {
    return true;
  }

  async authorise(req: PasskeyAuthRequest): Promise<PasskeyAuthResult> {
    if (!req.transferId || !req.recipientName || req.amountMinor <= 0) {
      return {
        ok: false,
        authorisationRef: "",
        method: "mock_passkey",
        deviceBound: false,
        error: "incomplete_transaction_binding",
      };
    }
    const ref = `passkey_mock_${req.transferId}_${req.amountMinor}_${Date.now()}`;
    return {
      ok: true,
      authorisationRef: ref,
      method: "mock_passkey",
      deviceBound: true,
    };
  }
}

/**
 * Native bridge placeholder.
 *
 * The mock produces a reference the ledger no longer accepts (G2-A), so it can
 * no longer authorise anything on its own — it is only an on-device confirmation
 * affordance. It is therefore off by default: a caller must ask for it
 * explicitly, which keeps "did we accidentally ship the mock" answerable by
 * grep rather than by inspection.
 *
 * The real authorisation on browser surfaces is a WebAuthn ceremony (see
 * ./webauthn and the consumer surface). Native passkeys via an Expo module are
 * still outstanding — until then this returns an unavailable module rather than
 * silently substituting the mock.
 */
export function createPasskeyModule(opts?: { allowMock?: boolean }): PasskeyModule {
  // Native module name reserved: EpheraPasskeys
  // const Native = TurboModuleRegistry.get('EpheraPasskeys')
  if (opts?.allowMock === true) {
    return new MockPasskeys();
  }
  return {
    async isAvailable() {
      return false;
    },
    async authorise() {
      return {
        ok: false,
        authorisationRef: "",
        method: "passkey",
        deviceBound: false,
        error: "native_module_unavailable",
      };
    },
  };
}

export * from "./webauthn";
