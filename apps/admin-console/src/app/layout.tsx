import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EPHERA Super Admin",
  description:
    "Control plane for EPHERA Money — workflows, analytics, providers, feature flags, AI models, mandates, and communications.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050B18",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
