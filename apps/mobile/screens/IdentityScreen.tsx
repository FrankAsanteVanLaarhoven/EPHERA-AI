import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import {
  loadIdentity,
  patchIdentity,
  tierLimits,
  type IdentityDoc,
  type IdentityState,
  type KycTier,
} from "../lib/identity-store";
import { useProfile } from "../lib/profile";
import { brandHaptic } from "../lib/brand-system/haptics";
import { useTheme } from "../lib/theme-context";
import type { Screen as Route } from "../lib/navigation";
import { space } from "../theme";

type Go = (s: Route, p?: Record<string, string>) => void;

const TIER_ORDER: KycTier[] = ["basic", "verified", "premium"];

function statusTone(s: IdentityDoc["status"]): "success" | "warning" | "danger" | "tube" {
  if (s === "approved") return "success";
  if (s === "pending") return "warning";
  if (s === "rejected") return "danger";
  return "tube";
}

function statusIcon(s: IdentityDoc["status"]): IconName {
  if (s === "approved") return "check";
  if (s === "pending") return "clock";
  if (s === "rejected") return "alert";
  return "book";
}

export default function IdentityScreen({ go, back }: { go: Go; back: () => void }) {
  const { colors, mood, isDark } = useTheme();
  const { profile, updateProfile } = useProfile();
  const [id, setId] = useState<IdentityState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const state = await loadIdentity();
    // Keep tier in sync with profile when possible
    if (profile.kycTier && profile.kycTier !== state.tier) {
      state.tier = profile.kycTier;
    }
    setId(state);
  }, [profile.kycTier]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submitDoc(docId: string) {
    if (!id) return;
    setBusy(true);
    try {
      const docs = id.docs.map((d) =>
        d.id === docId
          ? { ...d, status: "pending" as const, note: "Submitted · under review" }
          : d,
      );
      const next = await patchIdentity({
        docs,
        lastReviewAt: new Date().toISOString(),
      });
      setId(next);
      void brandHaptic("intentUnderstood");
      Alert.alert("Submitted", "Document queued for review. You will be notified.");
    } finally {
      setBusy(false);
    }
  }

  async function requestUpgrade() {
    if (!id) return;
    const idx = TIER_ORDER.indexOf(id.tier);
    if (idx >= TIER_ORDER.length - 1) {
      Alert.alert("Premium", "You are already on the highest tier.");
      return;
    }
    const missing = id.docs.filter((d) => d.status === "missing" || d.status === "rejected");
    if (missing.length && id.tier === "verified") {
      Alert.alert(
        "Documents needed",
        `Complete: ${missing.map((m) => m.label).join(", ")}`,
      );
      return;
    }
    // Simulate approval path for demo when pending docs are ok
    const nextTier = TIER_ORDER[idx + 1];
    if (id.tier === "basic") {
      const next = await patchIdentity({ tier: "verified" });
      setId(next);
      await updateProfile({ kycTier: "verified" });
      void brandHaptic("paymentCompleted");
      Alert.alert("Verified", "Identity upgraded to Verified.");
      return;
    }
    // premium path
    const next = await patchIdentity({
      tier: nextTier,
      docs: id.docs.map((d) =>
        d.id === "sof" ? { ...d, status: "pending", note: "Under review" } : d,
      ),
    });
    setId(next);
    void brandHaptic("intentUnderstood");
    Alert.alert("Review started", "Premium upgrade submitted for human review.");
  }

  async function requestHumanReview() {
    if (!id) return;
    const next = await patchIdentity({ lastReviewAt: new Date().toISOString() });
    setId(next);
    void brandHaptic("intentUnderstood");
    Alert.alert(
      "Human review requested",
      "Case opened. Expected response within 1 business day.",
    );
  }

  if (!id) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Identity & verification" onBack={back} />
      </View>
    );
  }

  const limits = tierLimits(id.tier);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Identity & verification"
        subtitle="Progressive tiers, clear reasons"
        onBack={back}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
        <GlassCard halo style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <IconWell name="passkey" size={48} tone="success" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "800" }}>
                CURRENT TIER
              </Text>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 2 }}>
                {id.tier.toUpperCase()}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                {id.fullName}
                {id.nationalId ? ` · ${id.nationalId}` : ""}
              </Text>
            </View>
          </View>
          <View style={styles.limitGrid}>
            {(
              [
                ["Daily send", limits.daily],
                ["Corridors", limits.send],
                ["Receive", limits.receive],
              ] as const
            ).map(([k, v]) => (
              <View key={k} style={styles.limitCell}>
                <Text style={{ color: colors.textDim, fontSize: 10, fontWeight: "700" }}>{k}</Text>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, marginTop: 3 }}>
                  {v}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <Text style={[styles.sec, { color: colors.textDim }]}>Documents</Text>
        <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4 }} halo>
          {id.docs.map((doc, i) => (
            <View
              key={doc.id}
              style={[
                styles.docRow,
                i < id.docs.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <IconWell name={statusIcon(doc.status)} size={40} tone={statusTone(doc.status)} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{doc.label}</Text>
                <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                  {doc.status.toUpperCase()}
                  {doc.note ? ` · ${doc.note}` : ""}
                </Text>
              </View>
              {(doc.status === "missing" || doc.status === "rejected") && (
                <Pressable
                  onPress={() => void submitDoc(doc.id)}
                  disabled={busy}
                  style={[styles.smallBtn, { borderColor: mood.edge }]}
                >
                  <Text style={{ color: mood.tube, fontWeight: "700", fontSize: 11 }}>
                    Submit
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </GlassCard>

        <Text style={[styles.sec, { color: colors.textDim, marginTop: 16 }]}>Next steps</Text>
        <GlassCard halo>
          <View style={styles.bulletRow}>
            <Icon name="info" size={16} color={mood.tube} />
            <Text style={{ color: colors.textMuted, flex: 1, lineHeight: 19 }}>
              You always see why more information is requested. No silent blocks.
            </Text>
          </View>
          {id.lastReviewAt ? (
            <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 8 }}>
              Last review activity: {new Date(id.lastReviewAt).toLocaleString()}
            </Text>
          ) : null}
        </GlassCard>

        <View style={{ marginTop: 18, gap: 10 }}>
          <PrimaryButton
            label="Request tier upgrade"
            iconName="passkey"
            onPress={() => void requestUpgrade()}
            disabled={busy}
            click="sec_auth"
          />
          <PrimaryButton
            label="Request human review"
            variant="secondary"
            iconName="support"
            onPress={() => void requestHumanReview()}
            click="ui_nav"
          />
          <PrimaryButton
            label="Open support"
            variant="ghost"
            onPress={() => go("support")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sec: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  limitGrid: { flexDirection: "row", gap: 8, marginTop: 14 },
  limitCell: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bulletRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
});
