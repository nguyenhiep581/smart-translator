export function getAppVersion() {
  try {
    const manifest = chrome?.runtime?.getManifest?.();
    return manifest?.version || 'dev';
  } catch (err) {
    // Fallback for non-extension contexts
    return 'dev';
  }
}

export const APP_VERSION = getAppVersion();
