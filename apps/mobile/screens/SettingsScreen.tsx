import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard, IlluminatedText, Screen } from "../components/ui";
import { ColorPickerModal } from "../components/ColorPicker";
import { NeonLogo } from "../components/brand/NeonLogo";
import { useTheme, type ThemeMode } from "../lib/theme-context";
import { MOOD_LIST, type MoodId } from "../lib/mood";
import { LOGO_BG_PRESETS } from "../lib/logo-style";
import { useI18n, type LocaleCode } from "../lib/i18n";
import {
  SOUND_PACKS,
  SOUND_SERVICES,
  useSoundPrefs,
  type SoundPackId,
} from "../lib/sound-prefs";
import {
  previewCustomUri,
  previewTacticalClick,
  type TacticalClick,
} from "../lib/tactical-clicks";
import { pickCustomSound, removeCustomSoundFile } from "../lib/custom-sound";
import { radii, space } from "../theme";
import type { Screen as Route } from "../App";

const PREVIEW_CLICKS: { id: TacticalClick; label: string }[] = [
  { id: "ui_tap", label: "UI tap" },
  { id: "tx_send", label: "Send" },
  { id: "tx_receive", label: "Receive" },
  { id: "tx_scan", label: "Scan" },
  { id: "svc_bills", label: "Bills" },
  { id: "svc_airtime", label: "Airtime" },
  { id: "sec_auth", label: "Authorise" },
  { id: "ok_settled", label: "Settled" },
  { id: "err_fail", label: "Failed" },
  { id: "voice_open", label: "Voice" },
];

export default function SettingsScreen({
  go,
  back,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
  back: () => void;
}) {
  const insets = useSafeAreaInsets();
  const {
    mode,
    setMode,
    colors,
    isDark,
    mood,
    moodId,
    setMoodId,
    setCustomRgb,
    customHex,
    logo,
    setLogoTube,
    setLogoBg,
    setLogoBgEnabled,
  } = useTheme();
  const { t, locale, setLocale, locales } = useI18n();
  const {
    tacticalClicks,
    setTacticalClicks,
    brandSonic,
    setBrandSonic,
    pack,
    setPack,
    services,
    setServiceEnabled,
    setAllServices,
    customUri,
    customName,
    setCustomSound,
    clearCustomSound,
  } = useSoundPrefs();
  const [uploading, setUploading] = useState(false);
  const [picker, setPicker] = useState<null | "hud" | "logoTube" | "logoBg">(null);

  async function onUploadSound() {
    setUploading(true);
    try {
      const picked = await pickCustomSound();
      if (!picked) return;
      if (customUri) await removeCustomSoundFile(customUri);
      await setCustomSound(picked.uri, picked.name);
      await previewCustomUri(picked.uri);
    } catch (e) {
      Alert.alert(
        "Upload failed",
        e instanceof Error ? e.message : "Could not import that audio file.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function onClearCustom() {
    if (customUri) await removeCustomSoundFile(customUri);
    await clearCustomSound();
  }

  const themes: { id: ThemeMode; label: string }[] = [
    { id: "system", label: t("settings.themeSystem") },
    { id: "light", label: t("settings.themeLight") },
    { id: "dark", label: t("settings.themeDark") },
  ];

  const moodOptions = MOOD_LIST;

  const global = locales.filter((l) => l.group === "global");
  const africa = locales.filter((l) => l.group === "africa");

  return (
    <Screen edges={false} style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12}>
          <Text style={{ color: colors.accentBright, fontWeight: "600", fontSize: 15 }}>
            ← {t("common.back")}
          </Text>
        </Pressable>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 17 }}>
          {t("settings.title")}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingBottom: Math.max(insets.bottom, 24) + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.section, { color: colors.textDim }]}>
          {t("settings.appearance")}
        </Text>
        <GlassCard style={{ padding: 8 }} halo>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            {t("settings.theme")}
          </Text>
          <View style={styles.themeRow}>
            {themes.map((th) => {
              const active = mode === th.id;
              return (
                <Pressable
                  key={th.id}
                  onPress={() => void setMode(th.id)}
                  style={[
                    styles.themeChip,
                    {
                      backgroundColor: active
                        ? colors.accentSoft
                        : isDark
                          ? "rgba(8,15,30,0.5)"
                          : "rgba(241,245,249,0.9)",
                      borderColor: active ? mood.edge : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.accentBright : colors.text,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    {th.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        {/* LOGO — separate from HUD mood */}
        <Text style={[styles.section, { color: colors.textDim, marginTop: space.lg }]}>
          LOGO
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 17 }}>
          Logo neon and plate colours are separate from app chrome. Small logos
          always render crisp so they stay readable.
        </Text>
        <GlassCard style={{ padding: 14 }} halo>
          <View style={{ alignItems: "center", marginBottom: 14 }}>
            <NeonLogo layout="horizontal" size={30} intensity="crisp" />
            <View style={{ height: 12 }} />
            <NeonLogo layout="symbol" size={48} intensity="crisp" />
          </View>

          <View style={styles.soundRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                Logo neon / tube
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                Light colour of the mark
              </Text>
            </View>
            <Pressable
              onPress={() => setPicker("logoTube")}
              style={[styles.colorChip, { backgroundColor: logo.tube, borderColor: mood.edge }]}
            />
          </View>

          <View
            style={[
              styles.soundRow,
              {
                marginTop: 14,
                paddingTop: 14,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                Logo background plate
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                Optional disc behind the mark
              </Text>
            </View>
            <Switch
              value={logo.bgEnabled}
              onValueChange={(v) => void setLogoBgEnabled(v)}
              trackColor={{ false: colors.border, true: mood.edge }}
              thumbColor={logo.bgEnabled ? mood.tube : colors.textDim}
            />
          </View>

          {logo.bgEnabled ? (
            <View style={{ marginTop: 12 }}>
              <View style={styles.soundRow}>
                <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }}>
                  Plate colour
                </Text>
                <Pressable
                  onPress={() => setPicker("logoBg")}
                  style={[styles.colorChip, { backgroundColor: logo.bg, borderColor: mood.edge }]}
                />
              </View>
              <View style={[styles.moodRow, { marginTop: 10 }]}>
                {LOGO_BG_PRESETS.map((hex) => (
                  <Pressable
                    key={hex}
                    onPress={() => void setLogoBg(hex)}
                    style={[
                      styles.moodDot,
                      {
                        backgroundColor: hex,
                        borderColor: logo.bg === hex ? "#FFF" : "rgba(255,255,255,0.2)",
                        borderWidth: logo.bg === hex ? 2 : StyleSheet.hairlineWidth,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={() => setPicker("logoTube")}
            style={[
              styles.uploadBtn,
              {
                marginTop: 14,
                borderColor: mood.edge,
                borderStyle: "solid",
                backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              },
            ]}
          >
            <Text style={{ color: isDark ? mood.tube : colors.accentBright, fontWeight: "700" }}>
              Open colour wheel · logo neon
            </Text>
          </Pressable>
        </GlassCard>

        {/* HUD mood — chrome only */}
        <Text style={[styles.section, { color: colors.textDim, marginTop: space.lg }]}>
          HUD MOOD
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 17 }}>
          App chrome only: glass edges, icons, tab glow. Does not change the logo
          unless you match the colours yourself.
        </Text>
        <GlassCard style={{ padding: 12 }} halo>
          <View style={styles.moodRow}>
            {moodOptions.map((m) => {
              const active = moodId === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => void setMoodId(m.id as MoodId)}
                  accessibilityLabel={m.label}
                  style={[
                    styles.moodDot,
                    {
                      backgroundColor: m.tube,
                      borderColor: active ? "#FFFFFF" : "transparent",
                      borderWidth: active ? 2 : 0,
                      shadowColor: m.halo,
                      shadowOpacity: active ? 0.9 : 0.35,
                      shadowRadius: active ? 10 : 4,
                      shadowOffset: { width: 0, height: 0 },
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={[styles.soundRow, { marginTop: 14 }]}>
            <View style={{ flex: 1 }}>
              <IlluminatedText
                tone="tube"
                style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.4 }}
              >
                Active · {mood.label}
              </IlluminatedText>
              <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                {mood.tube}
              </Text>
            </View>
            <Pressable
              onPress={() => setPicker("hud")}
              style={[styles.colorChip, { backgroundColor: mood.tube, borderColor: mood.edge }]}
            />
          </View>
          <Pressable
            onPress={() => setPicker("hud")}
            style={[
              styles.uploadBtn,
              {
                marginTop: 12,
                borderColor: mood.edge,
                borderStyle: "solid",
                backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              },
            ]}
          >
            <Text style={{ color: isDark ? mood.tube : colors.accentBright, fontWeight: "700" }}>
              Rainbow wheel · type hex
            </Text>
          </Pressable>
        </GlassCard>

        <ColorPickerModal
          visible={picker === "hud"}
          title="HUD mood colour"
          value={moodId === "custom" ? customHex : mood.tube}
          onChange={(hex) => void setCustomRgb(hex)}
          onClose={() => setPicker(null)}
        />
        <ColorPickerModal
          visible={picker === "logoTube"}
          title="Logo neon / tube"
          value={logo.tube}
          onChange={(hex) => void setLogoTube(hex)}
          onClose={() => setPicker(null)}
        />
        <ColorPickerModal
          visible={picker === "logoBg"}
          title="Logo background plate"
          value={logo.bg}
          onChange={(hex) => void setLogoBg(hex)}
          onClose={() => setPicker(null)}
        />

        {/* Sound system */}
        <Text style={[styles.section, { color: colors.textDim, marginTop: space.lg }]}>
          SOUND
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 17 }}>
          Choose a sound pack, pick which services make noise, or upload your own
          click / music. All preferences stay on this device.
        </Text>

        <GlassCard style={{ padding: 12 }} halo>
          {/* Master */}
          <View style={styles.soundRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
                Interface sounds
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 3 }}>
                Master switch for all keypress / service clicks
              </Text>
            </View>
            <Switch
              value={tacticalClicks}
              onValueChange={(v) => {
                void setTacticalClicks(v);
                if (v) void previewTacticalClick("ui_toggle");
              }}
              trackColor={{ false: colors.border, true: mood.edge }}
              thumbColor={tacticalClicks ? mood.tube : colors.textDim}
            />
          </View>

          <View
            style={[
              styles.soundRow,
              {
                marginTop: 14,
                paddingTop: 14,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
                Brand sonic signature
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 3 }}>
                Three-note voice / payment cues
              </Text>
            </View>
            <Switch
              value={brandSonic}
              onValueChange={(v) => void setBrandSonic(v)}
              trackColor={{ false: colors.border, true: mood.edge }}
              thumbColor={brandSonic ? mood.tube : colors.textDim}
            />
          </View>

          {tacticalClicks ? (
            <>
              {/* Packs */}
              <Text style={[styles.subHead, { color: colors.textDim }]}>Sound pack</Text>
              <View style={{ gap: 8 }}>
                {SOUND_PACKS.map((p) => {
                  const active = pack === p.id;
                  const disabled = p.id === "custom" && !customUri;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        if (p.id === "custom" && !customUri) {
                          void onUploadSound();
                          return;
                        }
                        void setPack(p.id as SoundPackId);
                        void previewTacticalClick("ui_tap");
                      }}
                      style={[
                        styles.packRow,
                        {
                          borderColor: active ? mood.edge : colors.border,
                          backgroundColor: active
                            ? `${mood.tube}18`
                            : isDark
                              ? "rgba(255,255,255,0.04)"
                              : "rgba(0,0,0,0.03)",
                          opacity: disabled && !active ? 0.75 : 1,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: active ? (isDark ? mood.tube : colors.accentBright) : colors.text,
                            fontWeight: "700",
                            fontSize: 13,
                          }}
                        >
                          {p.label}
                          {active ? "  · active" : ""}
                        </Text>
                        <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                          {p.description}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.radio,
                          {
                            borderColor: active ? mood.tube : colors.textDim,
                            backgroundColor: active ? mood.tube : "transparent",
                          },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom upload */}
              <Text style={[styles.subHead, { color: colors.textDim }]}>
                Custom sound / music
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 10, lineHeight: 17 }}>
                Upload a short click, jingle or music clip. When Custom pack is
                active it plays for every enabled service (clips longer than a few
                seconds will start from the beginning each tap).
              </Text>
              {customUri ? (
                <View
                  style={[
                    styles.customBox,
                    { borderColor: mood.edge, backgroundColor: `${mood.tube}10` },
                  ]}
                >
                  <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
                    {customName || "Custom audio"}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                    <Pressable
                      onPress={() => void previewCustomUri(customUri)}
                      style={[styles.smallBtn, { borderColor: mood.edge }]}
                    >
                      <Text style={{ color: mood.tube, fontWeight: "700", fontSize: 12 }}>
                        Preview
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void onUploadSound()}
                      style={[styles.smallBtn, { borderColor: colors.border }]}
                    >
                      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>
                        Replace
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void onClearCustom()}
                      style={[styles.smallBtn, { borderColor: colors.danger }]}
                    >
                      <Text style={{ color: colors.danger, fontWeight: "600", fontSize: 12 }}>
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => void onUploadSound()}
                  disabled={uploading}
                  style={[
                    styles.uploadBtn,
                    {
                      borderColor: mood.edge,
                      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                    },
                  ]}
                >
                  {uploading ? (
                    <ActivityIndicator color={mood.tube} />
                  ) : (
                    <Text style={{ color: isDark ? mood.tube : colors.accentBright, fontWeight: "700" }}>
                      Upload sound or music
                    </Text>
                  )}
                </Pressable>
              )}

              {/* Per-service */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 18,
                  marginBottom: 8,
                }}
              >
                <Text style={[styles.subHead, { color: colors.textDim, marginTop: 0, flex: 1 }]}>
                  Sounds by service
                </Text>
                <Pressable onPress={() => void setAllServices(true)} hitSlop={6}>
                  <Text style={{ color: colors.accentBright, fontSize: 11, fontWeight: "700" }}>
                    All
                  </Text>
                </Pressable>
                <Text style={{ color: colors.textDim, marginHorizontal: 6 }}>·</Text>
                <Pressable onPress={() => void setAllServices(false)} hitSlop={6}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700" }}>
                    None
                  </Text>
                </Pressable>
              </View>
              {SOUND_SERVICES.map((svc, i) => (
                <View
                  key={svc.id}
                  style={[
                    styles.soundRow,
                    i > 0 && {
                      marginTop: 10,
                      paddingTop: 10,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                      {svc.label}
                    </Text>
                    <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                      {svc.description}
                    </Text>
                  </View>
                  <Switch
                    value={services[svc.id]}
                    onValueChange={(v) => {
                      void setServiceEnabled(svc.id, v);
                      if (v) void previewTacticalClick("ui_tap");
                    }}
                    trackColor={{ false: colors.border, true: mood.edge }}
                    thumbColor={services[svc.id] ? mood.tube : colors.textDim}
                  />
                </View>
              ))}

              {/* Preview */}
              <Text style={[styles.subHead, { color: colors.textDim }]}>Preview</Text>
              <View style={styles.previewGrid}>
                {PREVIEW_CLICKS.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => void previewTacticalClick(p.id)}
                    style={[
                      styles.previewChip,
                      {
                        borderColor: mood.edge,
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.04)",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: isDark ? mood.tube : colors.text,
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 12 }}>
              Interface sounds are off. Enable the master switch to configure packs
              and services.
            </Text>
          )}
        </GlassCard>

        <Text style={[styles.section, { color: colors.textDim, marginTop: space.lg }]}>
          {t("settings.language")}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 10 }}>
          {t("settings.languageSub")}
        </Text>

        <Text style={[styles.group, { color: colors.accentBright }]}>
          {t("lang.group.global")} · 20
        </Text>
        <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4, marginBottom: 14 }}>
          {global.map((l, i) => (
            <LangRow
              key={l.code}
              active={locale === l.code}
              native={l.nativeName}
              english={l.englishName}
              last={i === global.length - 1}
              colors={colors}
              onPress={() => void setLocale(l.code as LocaleCode)}
            />
          ))}
        </GlassCard>

        <Text style={[styles.group, { color: colors.success }]}>
          {t("lang.group.africa")} · 20
        </Text>
        <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4 }}>
          {africa.map((l, i) => (
            <LangRow
              key={l.code}
              active={locale === l.code}
              native={l.nativeName}
              english={l.englishName}
              last={i === africa.length - 1}
              colors={colors}
              onPress={() => void setLocale(l.code as LocaleCode)}
            />
          ))}
        </GlassCard>

        <Text style={[styles.section, { color: colors.textDim, marginTop: space.lg }]}>
          Product
        </Text>
        <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4 }}>
          <Pressable
            onPress={() => go("board")}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 13,
                paddingHorizontal: 10,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={{ fontSize: 16, width: 28 }}>⊞</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
                Design dashboard
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                All screens overview · product board
              </Text>
            </View>
            <Text style={{ color: colors.textDim, fontSize: 18 }}>›</Text>
          </Pressable>
        </GlassCard>
      </ScrollView>
    </Screen>
  );
}

function LangRow({
  active,
  native,
  english,
  last,
  colors,
  onPress,
}: {
  active: boolean;
  native: string;
  english: string;
  last: boolean;
  colors: { text: string; textMuted: string; textDim: string; accent: string; border: string };
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.langRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{native}</Text>
        <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>{english}</Text>
      </View>
      {active ? (
        <View style={[styles.check, { backgroundColor: colors.accent }]}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>✓</Text>
        </View>
      ) : (
        <View style={[styles.checkEmpty, { borderColor: colors.border }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  section: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  themeRow: { flexDirection: "row", gap: 8 },
  themeChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  moodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
  },
  moodDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorChip: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 2,
  },
  soundRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subHead: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
  },
  packRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    gap: 10,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  uploadBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    borderStyle: "dashed",
  },
  customBox: {
    padding: 12,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  previewChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  group: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  checkEmpty: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
  },
});
