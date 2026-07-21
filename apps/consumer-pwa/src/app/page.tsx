export default function ConsumerPwaHome() {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 32 }}>
      <p style={{ color: "#4C8DFF", fontWeight: 700, letterSpacing: 0.5 }}>EPHERA MONEY · PWA</p>
      <h1>Lightweight access layer</h1>
      <p style={{ color: "#9AA8BC", lineHeight: 1.6 }}>
        This Progressive Web App supports diaspora transfers, history, and prepare-only flows. The
        security root for high-value device credentials, passkeys, offline signing and native voice
        remains the <strong>React Native + Expo development build</strong>.
      </p>
      <ul style={{ color: "#9AA8BC", lineHeight: 1.8 }}>
        <li>History and receipts (Gate 1)</li>
        <li>Prepare send → confirm on native when high risk</li>
        <li>Installable home-screen access</li>
      </ul>
    </main>
  );
}
