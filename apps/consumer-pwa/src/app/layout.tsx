import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EPHERA Money",
  description: "Voice-native financial access — lightweight PWA (not the security root)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#0B0F14",
          color: "#F4F7FB",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
