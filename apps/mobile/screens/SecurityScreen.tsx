import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  GlassCard,
  Icon,
  IconWell,
  PrimaryButton,
  type IconName,
} from "../components/ui";
import { ScreenHeader } from "../components/ScreenHeader";
import { fetchBalance } from "../lib/api";
import {
  formatLimitGhs,
  loadSecurityState,
  patchSecurity,
  type SecurityState,
} from "../lib/security-store";
import { brandHaptic } from "../lib/brand-system/haptics";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { radii, space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

type PanelId =
  | "passkeys"
  | "devices"
  | "biometrics"
  | "pin"
  | "daily"
  | "monthly"
  | "newRecipient"
  | "login"
  | "sim"
  | "recovery"
  | "privacy"
  | "education"
  | null;

export default function SecurityScreen({ go, back }: { go: Go; back: () => void }) {
  const { colors, mood, isDark } = useTheme();
  const [sec, setSec] = useState<SecurityState | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [panel, setPanel] = useState<PanelId>(null);
  const [limitDraft, setLimitDraft] = useState("");
  const [pinDraft, setPinDraft] = useState("");
  const [recoveryDraft, setRecoveryDraft] = useState("");

  const refresh = useCallback(async () => {
    const [s, bal] = await Promise.all([loadSecurityState(), fetchBalance()]);
    setSec(s);
    if (bal) setFrozen(bal.status === "frozen");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save(patch: Partial<SecurityState>) {
    const next = await patchSecurity(patch);
    setSec(next);
    void brandHaptic("intentUnderstood");
  }

  function openLimit(id: "daily" | "monthly" | "newRecipient") {
    if (!sec) return;
    const minor =
      id === "daily"
        ? sec.dailyLimitMinor
        : id === "monthly"
          ? sec.monthlyLimitMinor
          : sec.newRecipientLimitMinor;
    setLimitDraft(String(minor / 100));
    setPanel(id);
  }

  async function applyLimit() {
    if (!sec || !panel) return;
    const ghs = Number(limitDraft.replace(/,/g, ""));
    if (!Number.isFinite(ghs) || ghs < 0) {
      Alert.alert("Invalid amount", "Enter a valid limit in GHS.");
      return;
    }
    const minor = Math.round(ghs * 100);
    if (panel === "daily") await save({ dailyLimitMinor: minor });
    if (panel === "monthly") await save({ monthlyLimitMinor: minor });
    if (panel === "newRecipient") await save({ newRecipientLimitMinor: minor });
    setPanel(null);
  }

  if (!sec) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Security centre" subtitle="Protect outbound money" onBack={back} />
      </View>
    );
  }

  const lastLogin = sec.loginHistory[0];
  const lastLoginLabel = lastLogin
    ? `Last login ${new Date(lastLogin.at).toLocaleString()}`
    : "No history";

  const rows: {
    id: PanelId;
    icon: IconName;
    title: string;
    sub: string;
    tone?: "tube" | "success" | "danger" | "warning" | "accent" | "cyan";
  }[] = [
    {
      id: "passkeys",
      icon: "passkey",
      title: "Passkeys",
      sub: sec.passkeysEnabled
        ? `Primary authentication · ${sec.passkeyCount} registered`
        : "Disabled",
      tone: "success",
    },
    {
      id: "devices",
      icon: "device",
      title: "Trusted devices",
      sub: `${sec.devices.length} devices · this device trusted`,
    },
    {
      id: "biometrics",
      icon: "eye",
      title: "Biometrics",
      sub: sec.biometricsEnabled ? sec.biometricsLabel : "Off",
      tone: sec.biometricsEnabled ? "success" : "tube",
    },
    {
      id: "pin",
      icon: "lock",
      title: "Transaction PIN",
      sub: sec.transactionPinEnabled
        ? sec.transactionPinSet
          ? "Required for new recipients"
          : "Not set"
        : "Off",
    },
    {
      id: "daily",
      icon: "chart",
      title: "Daily limit",
      sub: formatLimitGhs(sec.dailyLimitMinor),
      tone: "accent",
    },
    {
      id: "monthly",
      icon: "insights",
      title: "Monthly limit",
      sub: formatLimitGhs(sec.monthlyLimitMinor),
    },
    {
      id: "newRecipient",
      icon: "user",
      title: "New-recipient limit",
      sub: `${formatLimitGhs(sec.newRecipientLimitMinor)} / 24h`,
      tone: "warning",
    },
    {
      id: "login",
      icon: "clock",
      title: "Login history",
      sub: lastLoginLabel,
    },
    {
      id: "sim",
      icon: "phone",
      title: "SIM-change alerts",
      sub: sec.simChangeAlerts ? "On" : "Off",
      tone: sec.simChangeAlerts ? "success" : "tube",
    },
    {
      id: "recovery",
      icon: "contact",
      title: "Recovery contacts",
      sub: sec.recoveryContact ? "1 trusted contact" : "None set",
    },
    {
      id: "privacy",
      icon: "mic",
      title: "Privacy permissions",
      sub: `Camera ${sec.cameraPermission ? "on" : "off"} · Mic ${sec.micPermission ? "on" : "off"}`,
    },
    {
      id: "education",
      icon: "book",
      title: "Security education",
      sub: "Tips & scam patterns",
      tone: "cyan",
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Security centre" subtitle="Protect outbound money" onBack={back} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <PrimaryButton
          label={
            frozen ? "Wallet frozen · manage freeze" : "Freeze all outgoing transactions"
          }
          variant="danger"
          iconName="freeze"
          onPress={() => go("freeze")}
          click="sec_freeze"
        />
        <Text
          style={{
            color: colors.textDim,
            fontSize: 11,
            marginTop: 8,
            marginBottom: 18,
            lineHeight: 16,
          }}
        >
          Strong authentication is required to reverse a freeze. Voice alone cannot freeze or
          unfreeze.
        </Text>

        <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4 }} halo>
          {rows.map((item, i) => (
            <Pressable
              key={item.title}
              onPress={() => {
                if (item.id === "daily" || item.id === "monthly" || item.id === "newRecipient") {
                  openLimit(item.id);
                  return;
                }
                if (item.id === "pin") {
                  setPinDraft("");
                  setPanel("pin");
                  return;
                }
                if (item.id === "recovery") {
                  setRecoveryDraft(sec.recoveryContact ?? "");
                  setPanel("recovery");
                  return;
                }
                setPanel(item.id);
              }}
              style={[
                styles.row,
                i < rows.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <IconWell name={item.icon} size={40} tone={item.tone ?? "tube"} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
                  {item.title}
                </Text>
                <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                  {item.sub}
                </Text>
              </View>
              <Icon name="chevron" size={16} color={colors.textDim} />
            </Pressable>
          ))}
        </GlassCard>
      </ScrollView>

      {/* Detail panel */}
      <Modal visible={panel !== null} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: isDark ? "#0C1526" : "#FFF",
                borderColor: mood.edge,
              },
            ]}
          >
            <View style={styles.sheetHead}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>
                {rows.find((r) => r.id === panel)?.title ?? "Security"}
              </Text>
              <Pressable onPress={() => setPanel(null)} hitSlop={10}>
                <Icon name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {panel === "passkeys" && (
                <>
                  <Text style={[styles.p, { color: colors.textMuted }]}>
                    Passkeys are the primary way to authorise money movement. Voice proposes;
                    passkey releases funds.
                  </Text>
                  <View style={styles.switchRow}>
                    <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }}>
                      Passkeys enabled
                    </Text>
                    <Switch
                      value={sec.passkeysEnabled}
                      onValueChange={(v) => void save({ passkeysEnabled: v })}
                      trackColor={{ false: colors.border, true: mood.edge }}
                      thumbColor={sec.passkeysEnabled ? mood.tube : colors.textDim}
                    />
                  </View>
                  <PrimaryButton
                    label="Register another passkey"
                    variant="secondary"
                    iconName="passkey"
                    onPress={() => {
                      void save({ passkeyCount: sec.passkeyCount + 1 });
                      Alert.alert("Passkey", "Mock passkey registered on this device.");
                    }}
                    click="sec_auth"
                  />
                </>
              )}

              {panel === "devices" && (
                <>
                  {sec.devices.map((d) => (
                    <View key={d.id} style={[styles.deviceRow, { borderColor: colors.border }]}>
                      <IconWell name="device" size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>
                          {d.name}
                          {d.thisDevice ? " · this device" : ""}
                        </Text>
                        <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                          {d.platform} · last seen {new Date(d.lastSeen).toLocaleDateString()}
                        </Text>
                      </View>
                      {!d.thisDevice ? (
                        <Pressable
                          onPress={() => {
                            void save({
                              devices: sec.devices.filter((x) => x.id !== d.id),
                            });
                          }}
                        >
                          <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 12 }}>
                            Revoke
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </>
              )}

              {panel === "biometrics" && (
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600" }}>Biometrics</Text>
                    <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                      Face ID / Touch ID for unlock & send confirm
                    </Text>
                  </View>
                  <Switch
                    value={sec.biometricsEnabled}
                    onValueChange={(v) =>
                      void save({
                        biometricsEnabled: v,
                        biometricsLabel: v ? "Face ID enabled" : "Off",
                      })
                    }
                    trackColor={{ false: colors.border, true: mood.edge }}
                    thumbColor={sec.biometricsEnabled ? mood.tube : colors.textDim}
                  />
                </View>
              )}

              {panel === "pin" && (
                <>
                  <View style={styles.switchRow}>
                    <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }}>
                      Require PIN for new recipients
                    </Text>
                    <Switch
                      value={sec.transactionPinEnabled}
                      onValueChange={(v) => void save({ transactionPinEnabled: v })}
                      trackColor={{ false: colors.border, true: mood.edge }}
                      thumbColor={sec.transactionPinEnabled ? mood.tube : colors.textDim}
                    />
                  </View>
                  <Text style={[styles.p, { color: colors.textDim }]}>Set or change 4–6 digit PIN</Text>
                  <TextInput
                    value={pinDraft}
                    onChangeText={(t) => setPinDraft(t.replace(/\D/g, "").slice(0, 6))}
                    keyboardType="number-pad"
                    secureTextEntry
                    placeholder="••••"
                    placeholderTextColor={colors.textDim}
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "#F8FAFC",
                      },
                    ]}
                  />
                  <PrimaryButton
                    label="Save PIN"
                    onPress={() => {
                      if (pinDraft.length < 4) {
                        Alert.alert("PIN too short", "Use at least 4 digits.");
                        return;
                      }
                      void save({ transactionPinSet: true, transactionPinEnabled: true });
                      setPanel(null);
                      Alert.alert("Saved", "Transaction PIN updated on this device.");
                    }}
                    click="sec_auth"
                  />
                </>
              )}

              {(panel === "daily" || panel === "monthly" || panel === "newRecipient") && (
                <>
                  <Text style={[styles.p, { color: colors.textMuted }]}>
                    Limits apply to outbound transfers from this wallet. Changes take effect
                    immediately on this device and sync when online.
                  </Text>
                  <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 6 }}>
                    Amount (GHS)
                  </Text>
                  <TextInput
                    value={limitDraft}
                    onChangeText={(t) => setLimitDraft(t.replace(/[^0-9.]/g, ""))}
                    keyboardType="decimal-pad"
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "#F8FAFC",
                      },
                    ]}
                  />
                  <PrimaryButton label="Save limit" onPress={() => void applyLimit()} click="ok_confirm" />
                </>
              )}

              {panel === "login" && (
                <>
                  {sec.loginHistory.map((ev) => (
                    <View key={ev.id} style={[styles.deviceRow, { borderColor: colors.border }]}>
                      <IconWell
                        name={ev.ok ? "check" : "alert"}
                        size={36}
                        tone={ev.ok ? "success" : "danger"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "600" }}>{ev.device}</Text>
                        <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                          {new Date(ev.at).toLocaleString()} · {ev.location}
                          {ev.ok ? "" : " · blocked"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {panel === "sim" && (
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600" }}>SIM-change alerts</Text>
                    <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                      Notify and step-up auth if SIM is swapped
                    </Text>
                  </View>
                  <Switch
                    value={sec.simChangeAlerts}
                    onValueChange={(v) => void save({ simChangeAlerts: v })}
                    trackColor={{ false: colors.border, true: mood.edge }}
                    thumbColor={sec.simChangeAlerts ? mood.tube : colors.textDim}
                  />
                </View>
              )}

              {panel === "recovery" && (
                <>
                  <Text style={[styles.p, { color: colors.textMuted }]}>
                    Trusted contact for account recovery. They never receive money without your
                    passkey.
                  </Text>
                  <TextInput
                    value={recoveryDraft}
                    onChangeText={setRecoveryDraft}
                    placeholder="+233 …"
                    placeholderTextColor={colors.textDim}
                    keyboardType="phone-pad"
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "#F8FAFC",
                      },
                    ]}
                  />
                  <PrimaryButton
                    label="Save recovery contact"
                    onPress={() => {
                      void save({
                        recoveryContact: recoveryDraft.trim() || null,
                      });
                      setPanel(null);
                    }}
                    click="ok_confirm"
                  />
                </>
              )}

              {panel === "privacy" && (
                <>
                  <View style={styles.switchRow}>
                    <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }}>
                      Camera (QR / KYC)
                    </Text>
                    <Switch
                      value={sec.cameraPermission}
                      onValueChange={(v) => void save({ cameraPermission: v })}
                      trackColor={{ false: colors.border, true: mood.edge }}
                      thumbColor={sec.cameraPermission ? mood.tube : colors.textDim}
                    />
                  </View>
                  <View style={[styles.switchRow, { marginTop: 12 }]}>
                    <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }}>
                      Microphone (Ephera Voice)
                    </Text>
                    <Switch
                      value={sec.micPermission}
                      onValueChange={(v) => void save({ micPermission: v })}
                      trackColor={{ false: colors.border, true: mood.edge }}
                      thumbColor={sec.micPermission ? mood.tube : colors.textDim}
                    />
                  </View>
                </>
              )}

              {panel === "education" && (
                <>
                  {[
                    "Never share your passkey or PIN on a voice call.",
                    "Ephera staff will never ask you to freeze then send money.",
                    "Verify recipients before large first-time transfers.",
                    "Turn on SIM-change alerts if you use mobile money links.",
                  ].map((tip) => (
                    <View key={tip} style={styles.tipRow}>
                      <Icon name="shield" size={16} color={colors.success} />
                      <Text style={{ color: colors.textMuted, flex: 1, lineHeight: 20 }}>{tip}</Text>
                    </View>
                  ))}
                  <PrimaryButton
                    label="Mark tips as read"
                    variant="secondary"
                    onPress={() => {
                      void save({ securityTipsSeen: true });
                      setPanel(null);
                    }}
                  />
                </>
              )}
            </ScrollView>

            <PrimaryButton
              label="Close"
              variant="ghost"
              onPress={() => setPanel(null)}
              style={{ marginTop: 12 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  modalBg: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    paddingBottom: 28,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  p: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  switchRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 14,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tipRow: { flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "flex-start" },
});
