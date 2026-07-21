import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ephera/design-tokens"],
  // Allow LAN device testing (phone on same Wi‑Fi)
  allowedDevOrigins: ["*"],
};

export default nextConfig;
