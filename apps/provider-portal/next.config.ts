import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ephera/design-tokens", "@ephera/connect-layer"],
  allowedDevOrigins: ["*"],
};

export default nextConfig;
