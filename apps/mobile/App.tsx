import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import DesignBoardScreen from "./screens/DesignBoardScreen";
import DesignScreen from "./screens/DesignScreen";
import SendScreen from "./screens/SendScreen";
import FreezeScreen from "./screens/FreezeScreen";

export type Screen =
  | "board"
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
 * Main entry = design board (all 6 screens in one window).
 * Tap a panel to open that experience; send/freeze stay live.
 */
export default function App() {
  const [nav, setNav] = useState<Nav>({ screen: "board" });

  function go(screen: Screen, params?: Record<string, string>) {
    setNav({ screen, params });
  }

  function back() {
    setNav({ screen: "board" });
  }

  function backHome() {
    setNav({ screen: "home" });
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />

      {nav.screen === "board" && <DesignBoardScreen go={go} />}

      {nav.screen === "splash" && (
        <DesignScreen
          source={require("./assets/splash.png")}
          hotspots={[
            { x: 0, y: 0, w: 1, h: 1, onPress: () => go("welcome") },
          ]}
        />
      )}

      {nav.screen === "welcome" && (
        <DesignScreen
          source={require("./assets/welcome.png")}
          hotspots={[
            { x: 0.08, y: 0.72, w: 0.84, h: 0.22, onPress: () => go("home") },
            { x: 0.2, y: 0.28, w: 0.6, h: 0.28, onPress: () => go("listening") },
            // back to board — top edge long press area via logo
            { x: 0.35, y: 0.02, w: 0.3, h: 0.05, onPress: () => go("board") },
          ]}
        />
      )}

      {nav.screen === "home" && (
        <DesignScreen
          source={require("./assets/home.png")}
          hotspots={[
            { x: 0.04, y: 0.05, w: 0.14, h: 0.07, onPress: () => go("services") },
            { x: 0.04, y: 0.28, w: 0.18, h: 0.1, onPress: () => go("send") },
            { x: 0.22, y: 0.28, w: 0.18, h: 0.1, onPress: () => go("listening") },
            { x: 0.4, y: 0.28, w: 0.18, h: 0.1, onPress: () => go("services") },
            { x: 0.58, y: 0.28, w: 0.18, h: 0.1, onPress: () => go("services") },
            { x: 0.76, y: 0.28, w: 0.18, h: 0.1, onPress: () => go("services") },
            { x: 0.06, y: 0.88, w: 0.88, h: 0.09, onPress: () => go("listening") },
            { x: 0.7, y: 0.05, w: 0.26, h: 0.07, onPress: () => go("freeze") },
            // board
            { x: 0.4, y: 0.0, w: 0.2, h: 0.04, onPress: () => go("board") },
          ]}
        />
      )}

      {nav.screen === "listening" && (
        <DesignScreen
          source={require("./assets/listening.png")}
          hotspots={[
            { x: 0.04, y: 0.05, w: 0.12, h: 0.06, onPress: () => go("board") },
            { x: 0.84, y: 0.05, w: 0.12, h: 0.06, onPress: () => go("services") },
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
            { x: 0.08, y: 0.65, w: 0.84, h: 0.06, onPress: () => go("home") },
            { x: 0.08, y: 0.71, w: 0.84, h: 0.12, onPress: () => go("services") },
          ]}
        />
      )}

      {nav.screen === "services" && (
        <DesignScreen
          source={require("./assets/services.png")}
          hotspots={[
            { x: 0.84, y: 0.05, w: 0.12, h: 0.06, onPress: () => go("board") },
            { x: 0.06, y: 0.14, w: 0.28, h: 0.16, onPress: () => go("send") },
            { x: 0.36, y: 0.14, w: 0.28, h: 0.16, onPress: () => go("listening") },
            { x: 0.66, y: 0.14, w: 0.28, h: 0.16, onPress: () => go("listening") },
            { x: 0.06, y: 0.32, w: 0.28, h: 0.16, onPress: () => go("send") },
            { x: 0.66, y: 0.68, w: 0.28, h: 0.16, onPress: () => go("voiceMode") },
            { x: 0.06, y: 0.5, w: 0.88, h: 0.35, onPress: () => go("listening") },
          ]}
        />
      )}

      {nav.screen === "voiceMode" && (
        <DesignScreen
          source={require("./assets/voicemode.png")}
          hotspots={[
            { x: 0.1, y: 0.82, w: 0.8, h: 0.1, onPress: () => go("listening") },
            { x: 0.1, y: 0.1, w: 0.8, h: 0.5, onPress: () => go("listening") },
            { x: 0.84, y: 0.04, w: 0.12, h: 0.06, onPress: () => go("board") },
          ]}
        />
      )}

      {nav.screen === "send" && (
        <SendScreen go={go} back={backHome} params={nav.params} />
      )}
      {nav.screen === "freeze" && <FreezeScreen go={go} back={backHome} />}
    </SafeAreaProvider>
  );
}
