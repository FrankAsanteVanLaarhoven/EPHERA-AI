import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EPHERA Compliance",
  description: "KYC review and payment case work",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: "20px 24px 4px" }}>
          <div style={{ fontWeight: 300, letterSpacing: "0.28em", fontSize: 16 }}>
            EPHERA COMPLIANCE
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Held payments and verification review. Every decision is recorded against the analyst who made it.
          </p>
        </header>
        <main style={{ padding: 24, maxWidth: 1100 }}>{children}</main>
      </body>
    </html>
  );
}
