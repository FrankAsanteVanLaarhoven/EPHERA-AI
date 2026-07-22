/** Local sandbox endpoints. Use machine LAN IP for physical devices. */
export const PAYMENTS_URL = process.env.EXPO_PUBLIC_PAYMENTS_URL ?? "http://localhost:8090";
export const VOICE_INTENT_URL =
  process.env.EXPO_PUBLIC_VOICE_INTENT_URL ?? "http://localhost:8091";
export const IDENTITY_URL =
  process.env.EXPO_PUBLIC_IDENTITY_URL ?? "http://localhost:8093";
