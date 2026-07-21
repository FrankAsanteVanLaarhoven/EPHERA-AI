import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

function BoardChip({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={chip.btn} onPress={onPress} hitSlop={12}>
      <Text style={chip.text}>⊞ Board</Text>
    </Pressable>
  );
}

const chip = StyleSheet.create({
  btn: {
    position: "absolute",
    right: 14,
    bottom: 28,
    zIndex: 50,
    backgroundColor: "rgba(37,99,235,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.5)",
  },
  text: { color: "#fff", fontWeight: "700", fontSize: 13 },
});

/**
 * Main entry = design board. Individual screens fit fully (contain).
 * Floating Board chip always returns to overview. Send/freeze stay live.
 */
export default function App() {
  const [nav, setNav] = useState<Nav>({ screen: "board" });

  function go(screen: Screen, params?: Record<string, string>) {
    setNav({ screen, params });
  }

  function backHome() {
    setNav({ screen: "home" });
  }

  const showBoardChip = nav.screen !== "board" && nav.screen !== "send" && nav.screen !== "freeze";

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {nav.screen === "board" && <DesignBoardScreen go={go} />}

        {nav.screen === "splash" && (
          <DesignScreen
            source={require("./assets/splash.png")}
            hotspots={[
              { x: 0, y: 0, w: 1, h: 1, onPress: () => go("welcome"), label: "Continue" },
            ]}
          />
        )}

        {nav.screen === "welcome" && (
          <DesignScreen
            source={require("./assets/welcome.png")}
            hotspots={[
              {
                x: 0.08,
                y: 0.7,
                w: 0.84,
                h: 0.1,
                onPress: () => go("home"),
                label: "Sign in",
              },
              {
                x: 0.08,
                y: 0.8,
                w: 0.84,
                h: 0.1,
                onPress: () => go("home"),
                label: "Face ID / Passkey",
              },
              {
                x: 0.15,
                y: 0.26,
                w: 0.7,
                h: 0.32,
                onPress: () => go("listening"),
                label: "Voice",
              },
              {
                x: 0.08,
                y: 0.9,
                w: 0.84,
                h: 0.07,
                onPress: () => go("home"),
                label: "Other sign in",
              },
            ]}
          />
        )}

        {nav.screen === "home" && (
          <DesignScreen
            source={require("./assets/home.png")}
            hotspots={[
              // menu
              { x: 0.03, y: 0.04, w: 0.14, h: 0.07, onPress: () => go("services"), label: "Menu" },
              // Send / Receive / Pay / Cash out / More — full action row
              { x: 0.02, y: 0.26, w: 0.19, h: 0.12, onPress: () => go("send"), label: "Send" },
              {
                x: 0.21,
                y: 0.26,
                w: 0.19,
                h: 0.12,
                onPress: () => go("listening"),
                label: "Receive",
              },
              {
                x: 0.4,
                y: 0.26,
                w: 0.19,
                h: 0.12,
                onPress: () => go("services"),
                label: "Pay",
              },
              {
                x: 0.59,
                y: 0.26,
                w: 0.19,
                h: 0.12,
                onPress: () => go("services"),
                label: "Cash out",
              },
              {
                x: 0.78,
                y: 0.26,
                w: 0.19,
                h: 0.12,
                onPress: () => go("services"),
                label: "More",
              },
              // Accounts chip
              {
                x: 0.62,
                y: 0.16,
                w: 0.34,
                h: 0.07,
                onPress: () => go("services"),
                label: "Accounts",
              },
              // Ask Ephera bar
              {
                x: 0.05,
                y: 0.86,
                w: 0.9,
                h: 0.1,
                onPress: () => go("listening"),
                label: "Ask Ephera",
              },
              // avatar / freeze
              {
                x: 0.82,
                y: 0.04,
                w: 0.14,
                h: 0.07,
                onPress: () => go("freeze"),
                label: "Security",
              },
              // recent activity area → listening for voice help
              {
                x: 0.05,
                y: 0.42,
                w: 0.9,
                h: 0.4,
                onPress: () => go("listening"),
                label: "Activity",
              },
            ]}
          />
        )}

        {nav.screen === "listening" && (
          <DesignScreen
            source={require("./assets/listening.png")}
            hotspots={[
              { x: 0.03, y: 0.03, w: 0.14, h: 0.07, onPress: () => go("board"), label: "Close" },
              {
                x: 0.83,
                y: 0.03,
                w: 0.14,
                h: 0.07,
                onPress: () => go("services"),
                label: "Menu",
              },
              // full suggestion list rows
              {
                x: 0.06,
                y: 0.55,
                w: 0.88,
                h: 0.08,
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
                label: "Send 100 cedis to Ama",
              },
              {
                x: 0.06,
                y: 0.63,
                w: 0.88,
                h: 0.07,
                onPress: () => go("home"),
                label: "Check balance",
              },
              {
                x: 0.06,
                y: 0.7,
                w: 0.88,
                h: 0.07,
                onPress: () => go("services"),
                label: "Pay DSTV",
              },
              {
                x: 0.06,
                y: 0.77,
                w: 0.88,
                h: 0.07,
                onPress: () => go("home"),
                label: "Transactions",
              },
              // orb
              {
                x: 0.15,
                y: 0.12,
                w: 0.7,
                h: 0.35,
                onPress: () => go("send"),
                label: "Voice",
              },
            ]}
          />
        )}

        {nav.screen === "services" && (
          <DesignScreen
            source={require("./assets/services.png")}
            hotspots={[
              { x: 0.84, y: 0.04, w: 0.12, h: 0.07, onPress: () => go("board"), label: "Close" },
              // 3x4 grid — each tile
              { x: 0.05, y: 0.14, w: 0.29, h: 0.16, onPress: () => go("send"), label: "Send Money" },
              {
                x: 0.355,
                y: 0.14,
                w: 0.29,
                h: 0.16,
                onPress: () => go("listening"),
                label: "Receive Money",
              },
              {
                x: 0.66,
                y: 0.14,
                w: 0.29,
                h: 0.16,
                onPress: () => go("listening"),
                label: "Pay Bills",
              },
              {
                x: 0.05,
                y: 0.31,
                w: 0.29,
                h: 0.16,
                onPress: () => go("send"),
                label: "Airtime",
              },
              {
                x: 0.355,
                y: 0.31,
                w: 0.29,
                h: 0.16,
                onPress: () => go("listening"),
                label: "Savings",
              },
              {
                x: 0.66,
                y: 0.31,
                w: 0.29,
                h: 0.16,
                onPress: () => go("listening"),
                label: "Invest",
              },
              {
                x: 0.05,
                y: 0.48,
                w: 0.29,
                h: 0.16,
                onPress: () => go("listening"),
                label: "Loans",
              },
              {
                x: 0.355,
                y: 0.48,
                w: 0.29,
                h: 0.16,
                onPress: () => go("listening"),
                label: "Insurance",
              },
              {
                x: 0.66,
                y: 0.48,
                w: 0.29,
                h: 0.16,
                onPress: () => go("listening"),
                label: "Cards",
              },
              {
                x: 0.05,
                y: 0.65,
                w: 0.29,
                h: 0.16,
                onPress: () => go("listening"),
                label: "Merchant",
              },
              {
                x: 0.355,
                y: 0.65,
                w: 0.29,
                h: 0.16,
                onPress: () => go("listening"),
                label: "Remittances",
              },
              {
                x: 0.66,
                y: 0.65,
                w: 0.29,
                h: 0.16,
                onPress: () => go("voiceMode"),
                label: "More",
              },
            ]}
          />
        )}

        {nav.screen === "voiceMode" && (
          <DesignScreen
            source={require("./assets/voicemode.png")}
            hotspots={[
              {
                x: 0.08,
                y: 0.8,
                w: 0.84,
                h: 0.12,
                onPress: () => go("listening"),
                label: "Got it, let's go",
              },
              {
                x: 0.1,
                y: 0.12,
                w: 0.8,
                h: 0.55,
                onPress: () => go("listening"),
                label: "Voice mode",
              },
              {
                x: 0.84,
                y: 0.03,
                w: 0.12,
                h: 0.07,
                onPress: () => go("board"),
                label: "Info / Board",
              },
            ]}
          />
        )}

        {nav.screen === "send" && (
          <SendScreen go={go} back={backHome} params={nav.params} />
        )}
        {nav.screen === "freeze" && <FreezeScreen go={go} back={backHome} />}

        {showBoardChip && <BoardChip onPress={() => go("board")} />}
      </View>
    </SafeAreaProvider>
  );
}
