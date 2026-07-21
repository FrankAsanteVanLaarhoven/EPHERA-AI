/**
 * Client custom sound / music upload for the Custom pack.
 * Copies into app document directory so the URI stays stable.
 */
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

export type PickedSound = {
  uri: string;
  name: string;
};

function destDir(): string | null {
  const root = FileSystem.documentDirectory;
  if (!root) return null;
  return `${root}ephera-sounds/`;
}

async function ensureDir(dir: string) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

/**
 * Open system picker for audio (mp3, wav, m4a, aac, caf…).
 * Returns a durable local URI or null if cancelled.
 */
export async function pickCustomSound(): Promise<PickedSound | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["audio/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const name = asset.name || `custom-${Date.now()}.audio`;
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");

  const dir = destDir();
  // Web / restricted: use picker URI directly (may not persist)
  if (!dir) {
    return { uri: asset.uri, name };
  }

  await ensureDir(dir);
  const dest = `${dir}${Date.now()}-${safe}`;
  await FileSystem.copyAsync({ from: asset.uri, to: dest });

  return { uri: dest, name };
}

export async function removeCustomSoundFile(uri: string | null) {
  if (!uri || !uri.includes("ephera-sounds")) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    /* ignore */
  }
}
