import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EPHERA · Design Dashboard",
  description: "Full product UI board — all screens in one window",
};

/** Desktop/web dashboard: entire design board in one browser window. */
export default function DesignDashboardPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#02060F",
        color: "#F4F8FF",
        fontFamily: "system-ui, sans-serif",
        padding: "24px 20px 48px",
      }}
    >
      <header
        style={{
          maxWidth: 960,
          margin: "0 auto 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              color: "#60A5FA",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.4,
            }}
          >
            EPHERA · PRODUCT DASHBOARD
          </p>
          <h1 style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 700 }}>
            All screens · one window
          </h1>
          <p style={{ margin: "8px 0 0", color: "#8B9BB8", fontSize: 14 }}>
            Exact UI benchmark — splash, welcome, listening, home, services, voice mode.
          </p>
        </div>
        <a
          href="/"
          style={{
            background: "#2563EB",
            color: "#fff",
            textDecoration: "none",
            padding: "10px 16px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Merchant sandbox →
        </a>
      </header>

      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          borderRadius: 20,
          border: "1px solid rgba(96,165,250,0.25)",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
          background: "#050B18",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ephera-design-board.jpg"
          alt="EPHERA full product UI board"
          style={{
            display: "block",
            width: "100%",
            height: "auto",
          }}
        />
      </div>

      <p
        style={{
          maxWidth: 960,
          margin: "16px auto 0",
          color: "#5C6B86",
          fontSize: 12,
          textAlign: "center",
        }}
      >
        Open this page on desktop for the full board. Mobile app starts on the same dashboard with
        tappable panels.
      </p>
    </main>
  );
}
