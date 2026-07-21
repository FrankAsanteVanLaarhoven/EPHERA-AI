import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./screens/HomeScreen";
import SendScreen from "./screens/SendScreen";
import VoiceScreen from "./screens/VoiceScreen";
import FreezeScreen from "./screens/FreezeScreen";

export type Screen = "home" | "send" | "voice" | "freeze";

export type Nav = {
  screen: Screen;
  params?: Record<string, string>;
};

export default function App() {
  const [nav, setNav] = useState<Nav>({ screen: "home" });

  function go(screen: Screen, params?: Record<string, string>) {
    setNav({ screen, params });
  }

  function back() {
    setNav({ screen: "home" });
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {nav.screen === "home" && <HomeScreen go={go} />}
      {nav.screen === "send" && <SendScreen go={go} back={back} params={nav.params} />}
      {nav.screen === "voice" && <VoiceScreen go={go} back={back} />}
      {nav.screen === "freeze" && <FreezeScreen go={go} back={back} />}
    </SafeAreaProvider>
  );
}
