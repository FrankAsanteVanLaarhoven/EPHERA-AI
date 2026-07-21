import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import DesignScreen from "./screens/DesignScreen";
import SendScreen from "./screens/SendScreen";
import FreezeScreen from "./screens/FreezeScreen";

export type Screen =
  | "splash"
  | "welcome"
  | "home"
  | "listening"
  | "services"
  | "voiceMode"
  | "send"
  | "freeze";

export type Nav = {
  screen: Screen;
  params?: Record<string, string>;
};

/**
 * Product benchmark UI: full-screen design panels from the approved mockups.
 * Money-moving flows (send / freeze) keep live functional screens.
 */
export default function App() {
  const [nav, setNav] = useState<Nav>({ screen: "splash" });

  function go(screen: Screen, params?: Record<string, string>) {
    setNav({ screen, params });
  }

  function back() {
    setNav({ screen: "home" });
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />

      {nav.screen === "splash" && (
        <DesignScreen
          source={require("./assets/splash.png")}
          hotspots={[
            // whole screen advances
            { x: 0, y: 0, w: 1, h: 1, onPress: () => go("welcome") },
          ]}
        />
      )}

      {nav.screen === "welcome" && (
        <DesignScreen
          source={require("./assets/welcome.png")}
          hotspots={[
            // Face ID / Passkey + Sign in buttons (lower third)
            { x: 0.08, y: 0.72, w: 0.84, h: 0.22, onPress: () => go("home") },
            // orb / voice area
            { x: 0.2, y: 0.28, w: 0.6, h: 0.28, onPress: () => go("listening") },
          ]}
        />
      )}

      {nav.screen === "home" && (
        <DesignScreen
          source={require("./assets/home.png")}
          hotspots={[
            // menu
            { x: 0.04, y: 0.05, w: 0.14, h: 0.07, onPress: () => go("services") },
            // Send
            { x: 0.04, y: 0.28, w: 0.18, h: 0.1, onPress: () => go("send") },
            // Receive / Pay / Cash out / More
            { x: 0.22, y: 0.28, w: 0.18, h: 0.1, onPress: () => go("listening") },
            { x: 0.4, y: 0.28, w: 0.18, h: 0.1, onPress: () => go("services") },
            { x: 0.58, y: 0.28, w: 0.18, h: 0.1, onPress: () => go("services") },
            { x: 0.76, y: 0.28, w: 0.18, h: 0.1, onPress: () => go("services") },
            // Ask Ephera bar
            { x: 0.06, y: 0.88, w: 0.88, h: 0.09, onPress: () => go("listening") },
            // long-press zone for freeze (security)
            { x: 0.7, y: 0.05, w: 0.26, h: 0.07, onPress: () => go("freeze") },
          ]}
        />
      )}

      {nav.screen === "listening" && (
        <DesignScreen
          source={require("./assets/listening.png")}
          hotspots={[
            // close
            { x: 0.04, y: 0.05, w: 0.12, h: 0.06, onPress: () => go("home") },
            // menu
            { x: 0.84, y: 0.05, w: 0.12, h: 0.06, onPress: () => go("services") },
            // suggestion: Send 100 cedis to Ama
            {
              x: 0.08,
              y: 0.58,
              w: 0.84,
              h: 0.07,
              onPress: () =>
                go("send", {
                  intentJson: JSON.stringify({
                    id: "voice_suggest",
                    name: "send_money",
                    language: "en",
                    confidence: 0.92,
                    amount: { amountMinor: 10000, currency: "GHS" },
                    recipient: {
                      displayName: "Ama Mensah",
                      verified: true,
                      accountHint: "wallet ending 4281",
                    },
                    createdAt: new Date().toISOString(),
                  }),
                }),
            },
            // check balance
            { x: 0.08, y: 0.65, w: 0.84, h: 0.06, onPress: () => go("home") },
            // pay dstv / transactions
            { x: 0.08, y: 0.71, w: 0.84, h: 0.12, onPress: () => go("services") },
          ]}
        />
      )}

      {nav.screen === "services" && (
        <DesignScreen
          source={require("./assets/services.png")}
          hotspots={[
            // close
            { x: 0.84, y: 0.05, w: 0.12, h: 0.06, onPress: () => go("home") },
            // Send Money tile
            { x: 0.06, y: 0.14, w: 0.28, h: 0.16, onPress: () => go("send") },
            // Receive
            { x: 0.36, y: 0.14, w: 0.28, h: 0.16, onPress: () => go("listening") },
            // Pay Bills
            { x: 0.66, y: 0.14, w: 0.28, h: 0.16, onPress: () => go("listening") },
            // Airtime
            { x: 0.06, y: 0.32, w: 0.28, h: 0.16, onPress: () => go("send") },
            // More (bottom right-ish)
            { x: 0.66, y: 0.68, w: 0.28, h: 0.16, onPress: () => go("voiceMode") },
            // rest of grid → listening
            { x: 0.06, y: 0.5, w: 0.88, h: 0.35, onPress: () => go("listening") },
          ]}
        />
      )}

      {nav.screen === "voiceMode" && (
        <DesignScreen
          source={require("./assets/voicemode.png")}
          hotspots={[
            // Got it, let's go
            { x: 0.1, y: 0.82, w: 0.8, h: 0.1, onPress: () => go("listening") },
            // info / whole upper area still ok
            { x: 0.1, y: 0.1, w: 0.8, h: 0.5, onPress: () => go("listening") },
          ]}
        />
      )}

      {nav.screen === "send" && (
        <SendScreen go={go} back={back} params={nav.params} />
      )}
      {nav.screen === "freeze" && <FreezeScreen go={go} back={back} />}
    </SafeAreaProvider>
  );
}
