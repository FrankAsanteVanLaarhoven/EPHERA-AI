import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EPHERA Provider Portal",
  description:
    "Register as an EPHERA service provider — merchants, MMOs, banks, utilities. Submit compliance, open banking, and SWIFT onboarding.",
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
