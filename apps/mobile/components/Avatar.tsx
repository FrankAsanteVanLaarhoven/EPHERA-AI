import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme";
import { initialsOf, useProfile } from "../lib/profile";

type Props = {
  size?: number;
  uri?: string | null;
  name?: string;
  onPress?: () => void;
  style?: ViewStyle;
  /** Show small camera badge when editable */
  editable?: boolean;
};

export function Avatar({
  size = 44,
  uri,
  name,
  onPress,
  style,
  editable,
}: Props) {
  const { profile } = useProfile();
  const avatarUri = uri !== undefined ? uri : profile.avatarUri;
  const label = initialsOf(name ?? profile.displayName);
  const r = size / 2;

  const body = avatarUri ? (
    <Image
      source={{ uri: avatarUri }}
      style={{ width: size, height: size, borderRadius: r }}
    />
  ) : (
    <LinearGradient
      colors={["#3B82F6", "#8B5CF6"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{label}</Text>
    </LinearGradient>
  );

  const content = (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: r,
          },
        ]}
      >
        {body}
      </View>
      {editable ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>📷</Text>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  ring: {
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(147,197,253,0.45)",
  },
  initials: {
    color: colors.white,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10 },
});
