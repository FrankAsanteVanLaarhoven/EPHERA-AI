import { useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Avatar } from "../components/Avatar";
import { GlassCard, PrimaryButton, Screen } from "../components/ui";
import { useProfile } from "../lib/profile";
import { useTheme } from "../lib/theme-context";
import { useT } from "../lib/i18n";
import { colors as themeColors, radii, space, typography } from "../theme";
import type { Screen as Route } from "../App";

export default function ProfileScreen({
  go,
  back,
}: {
  go: (screen: Route, params?: Record<string, string>) => void;
  back: () => void;
}) {
  const { profile, updateProfile, setAvatarUri } = useProfile();
  const { colors } = useTheme();
  const t = useT();
  const [name, setName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photos access needed",
        "Allow photo library access to set your profile picture.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await setAvatarUri(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera access needed", "Allow camera access to take a profile photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await setAvatarUri(result.assets[0].uri);
    }
  }

  function changePhoto() {
    const options = ["Take photo", "Choose from library", "Remove photo", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: 2,
          cancelButtonIndex: 3,
          title: "Profile photo",
        },
        (idx) => {
          if (idx === 0) void takePhoto();
          if (idx === 1) void pickFromLibrary();
          if (idx === 2) void setAvatarUri(null);
        },
      );
      return;
    }
    Alert.alert("Profile photo", "Choose a source", [
      { text: "Take photo", onPress: () => void takePhoto() },
      { text: "Choose from library", onPress: () => void pickFromLibrary() },
      {
        text: "Remove photo",
        style: "destructive",
        onPress: () => void setAvatarUri(null),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await updateProfile({
        displayName: name.trim() || profile.displayName,
        handle: handle.trim() || profile.handle,
        email: email.trim() || profile.email,
        phone: phone.trim() || profile.phone,
      });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={false} style={{ paddingTop: 56 }}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12}>
          <Text style={[styles.back, { color: colors.accentBright }]}>← {t("common.back")}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("profile.title")}</Text>
        <Pressable onPress={() => go("freeze")} hitSlop={12}>
          <Text style={[styles.security, { color: colors.danger }]}>{t("profile.security")}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Avatar size={104} editable onPress={changePhoto} />
          <Pressable onPress={changePhoto} style={styles.changePhotoBtn}>
            <Text style={[styles.changePhotoText, { color: colors.accentBright }]}>{t("profile.changePhoto")}</Text>
          </Pressable>
          <Text style={styles.displayName}>{name || profile.displayName}</Text>
          <Text style={styles.handle}>{handle || profile.handle}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.kycBadge}>
              <Text style={styles.kycText}>
                {profile.kycTier === "verified" ? "✓ Verified" : profile.kycTier}
              </Text>
            </View>
            <View style={styles.countryBadge}>
              <Text style={styles.countryText}>{profile.country} · {profile.currency}</Text>
            </View>
          </View>
        </View>

        <GlassCard style={{ gap: 14 }}>
          <Field label={t("profile.fullName")} value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label={t("profile.handle")} value={handle} onChangeText={setHandle} autoCapitalize="none" />
          <Field
            label={t("profile.email")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label={t("profile.phone")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </GlassCard>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t("profile.quickActions")}</Text>
        <GlassCard style={{ paddingVertical: 4, paddingHorizontal: 4 }}>
          <Row
            icon="💳"
            title={t("profile.accountsCards")}
            sub={t("profile.accountsSub")}
            onPress={() => go("servicesDrawer")}
          />
          <Row
            icon="🛡"
            title={t("profile.freeze")}
            sub={t("profile.freezeSub")}
            onPress={() => go("freeze")}
          />
          <Row
            icon="🎙"
            title={t("profile.voiceSettings")}
            sub={t("profile.voiceSub")}
            onPress={() => go("voice")}
          />
          <Row
            icon="⚙"
            title={t("settings.title")}
            sub={t("settings.languageSub")}
            onPress={() => go("settings")}
            last
          />
        </GlassCard>

        <View style={{ height: 16 }} />
        <PrimaryButton
          label={busy ? t("common.loading") : saved ? t("common.saved") + " ✓" : t("common.save")}
          onPress={() => void save()}
          disabled={busy}
        />
        <View style={{ height: 10 }} />
        <PrimaryButton
          label={t("profile.signOut")}
          variant="ghost"
          onPress={() => go("welcome")}
        />
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "words" | "sentences";
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={themeColors.textDim}
        style={styles.input}
      />
    </View>
  );
}

function Row({
  icon,
  title,
  sub,
  onPress,
  last,
}: {
  icon: string;
  title: string;
  sub: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, last && { borderBottomWidth: 0 }]}
    >
      <View style={styles.rowIcon}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
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
  back: { color: themeColors.accentBright, fontWeight: "600", fontSize: 15 },
  headerTitle: { color: themeColors.text, fontWeight: "700", fontSize: 17 },
  security: { color: themeColors.danger, fontWeight: "600", fontSize: 14 },
  scroll: { paddingHorizontal: space.lg, paddingBottom: 40 },
  hero: { alignItems: "center", marginBottom: space.lg },
  changePhotoBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: "rgba(59,130,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.35)",
  },
  changePhotoText: {
    color: themeColors.accentBright,
    fontWeight: "700",
    fontSize: 13,
  },
  displayName: {
    marginTop: 14,
    color: themeColors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  handle: { color: themeColors.textMuted, marginTop: 4, fontSize: 14 },
  badgeRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  kycBadge: {
    backgroundColor: "rgba(52,211,153,0.12)",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.35)",
  },
  kycText: { color: themeColors.success, fontSize: 11, fontWeight: "700" },
  countryBadge: {
    backgroundColor: "rgba(18,29,50,0.95)",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  countryText: { color: themeColors.textMuted, fontSize: 11, fontWeight: "600" },
  sectionLabel: {
    color: themeColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginTop: space.lg,
    marginBottom: space.sm,
    textTransform: "uppercase",
  },
  fieldLabel: {
    color: themeColors.textDim,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "rgba(8,15,30,0.65)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: themeColors.border,
    color: themeColors.text,
    fontSize: typography.body,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(59,130,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: themeColors.text, fontWeight: "700", fontSize: 15 },
  rowSub: { color: themeColors.textDim, fontSize: 12, marginTop: 2 },
  chevron: { color: themeColors.textDim, fontSize: 22, fontWeight: "300" },
});
