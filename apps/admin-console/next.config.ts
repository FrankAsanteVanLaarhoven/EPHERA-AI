import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ephera/design-tokens"],
  allowedDevOrigins: ["*"],
};

export default nextConfig;
