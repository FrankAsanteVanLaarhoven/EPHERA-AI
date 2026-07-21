import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import SplashScreen from "./screens/SplashScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import HomeScreen from "./screens/HomeScreen";
import ListeningScreen from "./screens/ListeningScreen";
import ServicesScreen from "./screens/ServicesScreen";
import VoiceModeScreen from "./screens/VoiceModeScreen";
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
  | "freeze"
  | "voice";

export type Nav = {
  screen: Screen;
  params?: Record<string, string>;
};

export default function App() {
  const [nav, setNav] = useState<Nav>({ screen: "splash" });
  const [stack, setStack] = useState<Screen[]>(["splash"]);

  function go(screen: Screen, params?: Record<string, string>) {
    setStack((s) => [...s, screen]);
    setNav({ screen, params });
  }

  function back() {
    setStack((s) => {
      if (s.length <= 1) {
        setNav({ screen: "home" });
        return ["home"];
      }
      const next = s.slice(0, -1);
      setNav({ screen: next[next.length - 1] });
      return next;
    });
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {nav.screen === "splash" && <SplashScreen go={go} />}
      {nav.screen === "welcome" && <WelcomeScreen go={go} />}
      {nav.screen === "home" && <HomeScreen go={go} />}
      {nav.screen === "listening" && <ListeningScreen go={go} back={back} />}
      {nav.screen === "services" && <ServicesScreen go={go} back={back} />}
      {nav.screen === "voiceMode" && <VoiceModeScreen go={go} />}
      {nav.screen === "send" && (
        <SendScreen go={go} back={back} params={nav.params} />
      )}
      {nav.screen === "freeze" && <FreezeScreen go={go} back={back} />}
      {nav.screen === "voice" && <ListeningScreen go={go} back={back} />}
    </SafeAreaProvider>
  );
}
