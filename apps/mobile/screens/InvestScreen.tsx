import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme-context";
import { useT } from "../lib/i18n";
import { GlassIconButton } from "../components/ui";
import type { Screen as Route } from "../lib/navigation";

const { width: WIN_W } = Dimensions.get("window");
const PAD = 14;
const GAP = 8;
const COL = (WIN_W - PAD * 2 - GAP) / 2;

const MARKETS = [
  { city: "NYSE", labelKey: "invest.marketNy" as const, offsetH: -4 },
  { city: "LSE", labelKey: "invest.marketLon" as const, offsetH: 0 },
  { city: "NSE", labelKey: "invest.marketLag" as const, offsetH: 1 },
  { city: "JSE", labelKey: "invest.marketJhb" as const, offsetH: 2 },
];

const TICKERS = [
  { symbol: "GSE-CI", value: "3,842", up: true },
  { symbol: "NGXASI", value: "98,210", up: false },
  { symbol: "GOLD", value: "$2,418", up: true },
  { symbol: "BTC", value: "$67,420", up: true },
];

const BARS = [0.45, 0.35, 0.62, 0.48, 0.78, 0.55, 0.85, 0.65, 0.9, 0.72, 0.8, 0.95];

function marketClockHands(offsetH: number, now: Date) {
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc + offsetH * 3600000);
  const h = local.getHours() % 12;
  const m = local.getMinutes();
  const here = now.getDate();
  const there = local.getDate();
  const dayKey =
    there > here
      ? "invest.dayTomorrow"
      : there < here
        ? "invest.dayYesterday"
        : "invest.dayToday";
  const deviceOffsetH = -now.getTimezoneOffset() / 60;
  const diff = offsetH - deviceOffsetH;
  const sign = diff >= 0 ? "+" : "";
  return {
    hourDeg: h * 30 + m * 0.5,
    minDeg: m * 6,
    dayKey,
    offsetLabel: `${sign}${Math.round(diff)}H`,
  };
}

function AnalogClock({
  hourDeg,
  minDeg,
  size,
  faceBg,
  faceBorder,
  handColor,
}: {
  hourDeg: number;
  minDeg: number;
  size: number;
  faceBg: string;
  faceBorder: string;
  handColor: string;
}) {
  const r = size / 2;
  const hourLen = size * 0.2;
  const minLen = size * 0.28;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: faceBg,
        borderColor: faceBorder,
        borderWidth: 1.2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: `${minDeg}deg` }] },
        ]}
      >
        <View
          style={{
            position: "absolute",
            width: 1.2,
            height: minLen,
            top: r - minLen,
            left: r - 0.6,
            backgroundColor: handColor,
            opacity: 0.8,
            borderRadius: 1,
          }}
        />
      </View>
      <View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: `${hourDeg}deg` }] },
        ]}
      >
        <View
          style={{
            position: "absolute",
            width: 2,
            height: hourLen,
            top: r - hourLen,
            left: r - 1,
            backgroundColor: handColor,
            borderRadius: 1,
          }}
        />
      </View>
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: handColor,
        }}
      />
    </View>
  );
}

function Panel({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: object | object[];
  onPress?: () => void;
}) {
  const { isDark } = useTheme();
  const body = (
    <View
      style={[
        {
          backgroundColor: isDark
            ? "rgba(18, 29, 50, 0.88)"
            : "rgba(255,255,255,0.92)",
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark
            ? "rgba(148, 163, 184, 0.16)"
            : "rgba(15, 23, 42, 0.08)",
          padding: 12,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
      >
        {body}
      </Pressable>
    );
  }
  return body;
}

export default function InvestScreen({
  go,
  back,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
  back: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const t = useT();
  const [now, setNow] = useState(() => new Date());
  const portfolio = 8000;
  const dayPnl = 126.4;
  const dayPct = 1.61;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const clocks = useMemo(
    () => MARKETS.map((m) => ({ ...m, ...marketClockHands(m.offsetH, now) })),
    [now],
  );

  const holdings = [
    { name: t("invest.holdingGrowth"), alloc: 42, value: "GH₵ 3,360", change: "+4.2%", up: true },
    { name: t("invest.holdingTbills"), alloc: 28, value: "GH₵ 2,240", change: "+1.1%", up: true },
    { name: t("invest.holdingGold"), alloc: 18, value: "GH₵ 1,440", change: "+0.8%", up: true },
    { name: t("invest.holdingUsd"), alloc: 12, value: "GH₵ 960", change: "-0.3%", up: false },
  ];

  const bottomPad = Math.max(insets.bottom, 12) + 32;

  return (
    <View style={[styles.root, { backgroundColor: colors.bgDeep }]}>
      <LinearGradient
        colors={
          isDark
            ? ["#050B18", "#0A1628", "#050B18"]
            : ["#E8EEF7", "#F3F6FB", "#E8EEF7"]
        }
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <GlassIconButton label="←" onPress={back} size={32} />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
          {t("invest.title")}
        </Text>
        <GlassIconButton label="🎙" onPress={() => go("voice")} size={32} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAD,
          paddingBottom: bottomPad,
          gap: GAP,
        }}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* Portfolio + actions — flex, never overflow */}
        <View style={styles.row}>
          <Panel style={{ flex: 1.35, minWidth: 0 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "600" }}>
              {t("invest.portfolio")}  ↗
            </Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 28,
                fontWeight: "300",
                letterSpacing: -0.8,
                marginTop: 2,
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              GH₵ {portfolio.toLocaleString("en-GH")}
            </Text>
            <Text style={{ color: colors.success, fontSize: 12, fontWeight: "700", marginTop: 4 }}>
              ▲ GH₵ {dayPnl.toFixed(2)}  +{dayPct}%
            </Text>
            <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 8 }}>
              {t("invest.today")}
            </Text>
            <Text style={{ color: colors.textDim, fontSize: 10, marginTop: 2 }}>
              H: +2.4%  L: −0.3%
            </Text>
          </Panel>

          <View style={{ width: COL * 0.72, gap: GAP }}>
            <Panel
              style={styles.miniBtn}
              onPress={() => go("send")}
            >
              <Text style={{ color: colors.text, fontSize: 18 }}>＋</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
                {t("invest.buy")}
              </Text>
            </Panel>
            <Panel
              style={styles.miniBtn}
              onPress={() => go("exchange")}
            >
              <Text style={{ color: colors.text, fontSize: 16 }}>⇄</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
                {t("invest.move")}
              </Text>
            </Panel>
          </View>
        </View>

        {/* Market clocks — compact */}
        <Panel style={{ paddingVertical: 12, paddingHorizontal: 6 }}>
          <View style={styles.clocksRow}>
            {clocks.map((c) => (
              <View key={c.city} style={styles.clockItem}>
                <AnalogClock
                  hourDeg={c.hourDeg}
                  minDeg={c.minDeg}
                  size={44}
                  faceBg={isDark ? "rgba(15,23,42,0.85)" : "rgba(241,245,249,0.95)"}
                  faceBorder={isDark ? "rgba(96,165,250,0.35)" : "rgba(37,99,235,0.25)"}
                  handColor={colors.text}
                />
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 10,
                    fontWeight: "700",
                    marginTop: 6,
                    textAlign: "center",
                  }}
                  numberOfLines={1}
                >
                  {t(c.labelKey)}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 9, marginTop: 1 }}>
                  {t(c.dayKey)}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 9 }}>{c.offsetLabel}</Text>
              </View>
            ))}
          </View>
        </Panel>

        {/* News + tickers */}
        <View style={styles.row}>
          <Panel style={{ flex: 1, minWidth: 0 }} onPress={() => go("insights")}>
            <LinearGradient
              colors={["#1e40af", "#7c3aed"]}
              style={styles.newsThumb}
            >
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "200" }}>Ξ</Text>
            </LinearGradient>
            <Text
              style={{
                color: colors.textDim,
                fontSize: 9,
                fontWeight: "800",
                letterSpacing: 0.4,
                marginTop: 8,
              }}
              numberOfLines={1}
            >
              {t("invest.newsSource")}
            </Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 12,
                fontWeight: "700",
                lineHeight: 16,
                marginTop: 4,
              }}
              numberOfLines={3}
            >
              {t("invest.newsTitle")}
            </Text>
          </Panel>

          <Panel style={{ flex: 1, minWidth: 0 }} onPress={() => go("exchange")}>
            {TICKERS.map((tk) => (
              <View key={tk.symbol} style={styles.tickerRow}>
                <Text
                  style={{
                    color: tk.up ? colors.success : colors.danger,
                    fontSize: 9,
                    width: 10,
                  }}
                >
                  {tk.up ? "▲" : "▼"}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                  numberOfLines={1}
                >
                  {tk.symbol}
                </Text>
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600" }}>
                  {tk.value}
                </Text>
              </View>
            ))}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 11,
                fontWeight: "600",
                lineHeight: 14,
              }}
              numberOfLines={2}
            >
              {t("invest.tickerHeadline")}
            </Text>
          </Panel>
        </View>

        {/* Activity chart — no absolute overlap */}
        <Panel onPress={() => go("insights")}>
          <View style={styles.chartHead}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>E</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600", flex: 1 }}>
              6h 25m
            </Text>
            <Text style={{ color: colors.textDim, fontSize: 10 }}>
              {t("invest.marketsWatched")}
            </Text>
          </View>
          <View style={styles.chartBody}>
            <View style={{ flex: 1 }}>
              <View style={styles.bars}>
                {BARS.map((h, i) => (
                  <View key={i} style={styles.barCol}>
                    <View
                      style={{
                        height: 40 * h,
                        width: "100%",
                        borderRadius: 2,
                        backgroundColor: isDark
                          ? "rgba(147,197,253,0.85)"
                          : colors.accent,
                      }}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.axis}>
                {["00", "06", "12", "18"].map((x) => (
                  <Text key={x} style={{ color: colors.textDim, fontSize: 9 }}>
                    {x}
                  </Text>
                ))}
              </View>
            </View>
            <View style={styles.sideStats}>
              {[
                { icon: "📈", val: "2h 12m" },
                { icon: "🥇", val: "1h 29m" },
                { icon: "💵", val: "53m" },
                { icon: "📰", val: "19m" },
              ].map((s) => (
                <View key={s.val} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ fontSize: 11 }}>{s.icon}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
                    {s.val}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Panel>

        <Text
          style={{
            color: colors.textDim,
            fontSize: 11,
            fontWeight: "800",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          {t("invest.holdings")}
        </Text>

        <Panel style={{ paddingVertical: 2, paddingHorizontal: 4 }}>
          {holdings.map((h, i) => (
            <Pressable
              key={h.name}
              onPress={() => go("insights")}
              style={({ pressed }) => [
                styles.holdRow,
                i < holdings.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 1.5,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.text, fontSize: 10, fontWeight: "800" }}>
                  {h.alloc}%
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}
                  numberOfLines={1}
                >
                  {h.name}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 1 }}>
                  {h.value}
                </Text>
              </View>
              <Text
                style={{
                  fontWeight: "700",
                  fontSize: 12,
                  color: h.up ? colors.success : colors.danger,
                }}
              >
                {h.change}
              </Text>
            </Pressable>
          ))}
        </Panel>

        <Pressable
          onPress={() => go("voice")}
          style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
        >
          <LinearGradient
            colors={["rgba(59,130,246,0.45)", "rgba(37,99,235,0.22)"]}
            style={styles.cta}
          >
            <Text style={{ color: "#F0F7FF", fontWeight: "600", fontSize: 13 }}>
              {t("invest.ask")}  🎙
            </Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PAD,
    marginBottom: 6,
  },
  row: { flexDirection: "row", gap: GAP, alignItems: "stretch" },
  miniBtn: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  clocksRow: { flexDirection: "row", justifyContent: "space-between" },
  clockItem: { flex: 1, alignItems: "center", minWidth: 0 },
  newsThumb: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tickerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 4,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  chartHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  chartBody: { flexDirection: "row", gap: 12, alignItems: "flex-end" },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 44,
    gap: 3,
  },
  barCol: { flex: 1, justifyContent: "flex-end" },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sideStats: { gap: 6, paddingBottom: 14 },
  holdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  cta: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    borderColor: "rgba(147,197,253,0.4)",
    marginTop: 2,
  },
});
