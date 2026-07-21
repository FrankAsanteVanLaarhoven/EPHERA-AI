import { useCallback, useEffect, useState } from "react";
import { LogBox, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ProfileProvider } from "./lib/profile";
import { ThemeProvider, useTheme } from "./lib/theme-context";
import { I18nProvider } from "./lib/i18n";
import { SoundPrefsProvider, useSoundPrefs } from "./lib/sound-prefs";
import {
  type GoTarget,
  type Nav,
  type Screen,
  type StackScreen,
  type TabId,
  isTab,
  resolveScreen,
} from "./lib/navigation";
import {
  clickForRoute,
  configureTacticalAudio,
  tacticalClick,
} from "./lib/tactical-clicks";
import { setBrandSonicEnabled } from "./lib/brand-system/sonic";
import { TabBar } from "./components/TabBar";
import { FloatingVoiceOrb } from "./components/FloatingVoiceOrb";

import SplashScreen from "./screens/SplashScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import HomeTab from "./screens/tabs/HomeTab";
import PaymentsTab from "./screens/tabs/PaymentsTab";
import MoneyTab from "./screens/tabs/MoneyTab";
import ActivityTab from "./screens/tabs/ActivityTab";
import ProfileTab from "./screens/tabs/ProfileTab";
import ListeningScreen from "./screens/ListeningScreen";
import VoiceModeScreen from "./screens/VoiceModeScreen";
import SendScreen from "./screens/SendScreen";
import ReceiveScreen from "./screens/ReceiveScreen";
import FreezeScreen from "./screens/FreezeScreen";
import SettingsScreen from "./screens/SettingsScreen";
import InvestScreen from "./screens/InvestScreen";
import DesignBoardScreen from "./screens/DesignBoardScreen";
import AccountsScreen from "./screens/AccountsScreen";
import CrossBorderScreen from "./screens/CrossBorderScreen";
import BillsScreen from "./screens/BillsScreen";
import AirtimeScreen from "./screens/AirtimeScreen";
import FailedPaymentScreen from "./screens/FailedPaymentScreen";
import SecurityScreen from "./screens/SecurityScreen";
import SupportScreen from "./screens/SupportScreen";
import ServicesDrawerScreen from "./screens/ServicesDrawerScreen";
import ReceiptScreen from "./screens/ReceiptScreen";
import ProductStubScreen from "./screens/ProductStubScreen";
import ScanQrScreen from "./screens/ScanQrScreen";
import MerchantScreen from "./screens/MerchantScreen";
import CardsScreen from "./screens/CardsScreen";
import SavingsScreen from "./screens/SavingsScreen";
import IdentityScreen from "./screens/IdentityScreen";
import InsightsScreen from "./screens/InsightsScreen";

// Re-export for older screens that import Screen from App
export type { Screen, Nav, GoTarget } from "./lib/navigation";

LogBox.ignoreLogs([
  "Ledger",
  "ledger",
  "Postg",
  "Network request failed",
  "Possible Unhandled Promise",
]);

/**
 * Shell: auth → five-tab banking app + stack flows.
 * Ephera Voice appears only when the user opens the orb / voice route.
 */
function AppShell() {
  const { colors, isDark } = useTheme();
  const {
    tacticalClicks,
    brandSonic,
    pack,
    services,
    customUri,
  } = useSoundPrefs();
  const [nav, setNav] = useState<Nav>({
    tab: "home",
    stack: "splash",
  });

  useEffect(() => {
    configureTacticalAudio({
      enabled: tacticalClicks,
      pack,
      services,
      customUri,
    });
  }, [tacticalClicks, pack, services, customUri]);

  useEffect(() => {
    setBrandSonicEnabled(brandSonic);
  }, [brandSonic]);

  const go = useCallback((target: GoTarget, params?: Record<string, string>) => {
    const screen = resolveScreen(target);
    // Distinct military click per destination / service
    void tacticalClick(clickForRoute(String(target)));

    if (isTab(screen)) {
      setNav({ tab: screen, stack: null, params });
      return;
    }

    // Auth flows always sit above home
    if (screen === "welcome" || screen === "splash") {
      setNav({ tab: "home", stack: screen, params });
      return;
    }

    setNav((n) => ({
      tab: n.tab,
      stack: screen as StackScreen,
      params,
    }));
  }, []);

  const setTab = useCallback((tab: TabId) => {
    void tacticalClick("ui_tab");
    setNav({ tab, stack: null });
  }, []);

  const back = useCallback(() => {
    void tacticalClick("ui_back");
    setNav((n) => ({ tab: n.tab, stack: null }));
  }, []);

  const backHome = useCallback(() => {
    setNav({ tab: "home", stack: null });
  }, []);

  const stack = nav.stack;
  const showTabs = stack === null;
  const showOrb = showTabs;

  // Full-screen auth
  if (stack === "splash") {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <SplashScreen go={go} />
      </View>
    );
  }
  if (stack === "welcome") {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <WelcomeScreen go={go} />
      </View>
    );
  }

  // Design dashboard (2×3 board) — full window, no tab chrome
  if (stack === "board") {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StatusBar style="light" />
        <DesignBoardScreen go={go} back={back} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Tab content — Home tab is the live financial dashboard */}
      {showTabs && (
        <View style={styles.flex}>
          {nav.tab === "home" && <HomeTab go={go} setTab={setTab} />}
          {nav.tab === "payments" && <PaymentsTab go={go} />}
          {nav.tab === "money" && <MoneyTab go={go} />}
          {nav.tab === "activity" && <ActivityTab go={go} />}
          {nav.tab === "profile" && <ProfileTab go={go} />}
        </View>
      )}

      {/* Stack / modal routes */}
      {stack === "voice" && (
        <ListeningScreen go={go} back={back} />
      )}
      {stack === "servicesDrawer" && (
        <ServicesDrawerScreen go={go} back={back} />
      )}
      {stack === "accounts" && <AccountsScreen go={go} back={back} />}
      {stack === "send" && (
        <SendScreen go={go} back={back} params={nav.params} />
      )}
      {stack === "receive" && <ReceiveScreen go={go} back={back} />}
      {stack === "scan" && <ScanQrScreen go={go} back={back} />}
      {stack === "crossBorder" && <CrossBorderScreen go={go} back={back} />}
      {stack === "bills" && <BillsScreen go={go} back={back} />}
      {stack === "airtime" && <AirtimeScreen go={go} back={back} />}
      {stack === "receipt" && (
        <ReceiptScreen go={go} back={back} params={nav.params} />
      )}
      {stack === "failedPayment" && (
        <FailedPaymentScreen go={go} back={back} params={nav.params} />
      )}
      {stack === "security" && <SecurityScreen go={go} back={back} />}
      {stack === "support" && <SupportScreen go={go} back={back} />}
      {stack === "freeze" && <FreezeScreen go={go} back={back} />}
      {stack === "settings" && <SettingsScreen go={go} back={back} />}
      {stack === "invest" && <InvestScreen go={go} back={back} />}
      {stack === "cards" && <CardsScreen go={go} back={back} />}
      {stack === "savings" && <SavingsScreen go={go} back={back} />}
      {stack === "merchant" && <MerchantScreen go={go} back={back} />}
      {stack === "insurance" && (
        <ProductStubScreen kind="insurance" go={go} back={back} />
      )}
      {stack === "credit" && (
        <ProductStubScreen kind="credit" go={go} back={back} />
      )}
      {stack === "exchange" && (
        <ProductStubScreen kind="exchange" go={go} back={back} />
      )}
      {stack === "family" && (
        <ProductStubScreen kind="family" go={go} back={back} />
      )}
      {stack === "insights" && <InsightsScreen go={go} back={back} />}
      {stack === "identity" && <IdentityScreen go={go} back={back} />}
      {stack === "disputes" && (
        <ProductStubScreen kind="disputes" go={go} back={back} />
      )}
      {stack === "accessibility" && (
        <ProductStubScreen kind="accessibility" go={go} back={back} />
      )}
      {stack === "notifications" && (
        <ProductStubScreen kind="notifications" go={go} back={back} />
      )}

      {showOrb && <FloatingVoiceOrb onPress={() => go("voice")} />}
      {showTabs && <TabBar active={nav.tab} onChange={setTab} />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SoundPrefsProvider>
          <I18nProvider>
            <ProfileProvider>
              <AppShell />
            </ProfileProvider>
          </I18nProvider>
        </SoundPrefsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
});

