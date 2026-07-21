import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@ephera/payment-sdk",
    "@ephera/intent-schema",
    "@ephera/validation",
    "@ephera/design-tokens",
  ],
};

export default nextConfig;
