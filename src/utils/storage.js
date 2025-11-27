/**
 * Chrome Storage Utility Functions
 *
 * Provides Promise-based wrappers around Chrome's storage API with:
 * - Automatic error handling
 * - Type-safe storage operations
 * - Settings management with defaults
 * - Storage usage tracking
 *
 * All functions return Promises for async/await compatibility.
 *
 * @module storage
 *
 * @example
 * import { getStorage, setStorage } from './utils/storage.js';
 *
 * // Save settings
 * await setStorage({ config: { provider: 'openai', apiKey: 'sk-...' } });
 *
 * // Load settings
 * const { config } = await getStorage('config');
 * console.log(config.provider); // 'openai'
 */

/**
 * Get item(s) from chrome.storage.local
 *
 * @param {string|string[]|Object} keys - Key(s) to retrieve. Can be:
 *   - Single key: 'config'
 *   - Multiple keys: ['config', 'cache']
 *   - Object with defaults: { config: defaultConfig }
 *
 * @returns {Promise<Object>} Object with requested keys and values
 *
 * @throws {Error} If Chrome storage API fails
 *
 * @example
 * // Get single key
 * const { config } = await getStorage('config');
 *
 * // Get multiple keys
 * const { config, cache } = await getStorage(['config', 'cache']);
 *
 * // Get with defaults
 * const result = await getStorage({ config: DEFAULT_CONFIG });
 */
export async function getStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Set item in chrome.storage.local
 * @param {object} items - Key-value pairs to store
 * @returns {Promise<void>}
 */
export async function setStorage(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Remove item from chrome.storage.local
 * @param {string|string[]} keys - Key(s) to remove
 * @returns {Promise<void>}
 */
export async function removeStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Clear all items from chrome.storage.local
 * @returns {Promise<void>}
 */
export async function clearStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get storage usage
 * @returns {Promise<number>} Bytes in use
 */
export async function getStorageUsage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.getBytesInUse(null, (bytes) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(bytes);
      }
    });
  });
}

/**
 * Load settings from storage with defaults
 * @returns {Promise<object>}
 */
export async function loadSettings() {
  const { DEFAULT_CONFIG } = await import('../config/defaults.js');
  const stored = await getStorage('config');
  const merged = mergeConfigWithDefaults(stored.config || {}, DEFAULT_CONFIG);
  merged.cache = sanitizeCache(merged.cache, DEFAULT_CONFIG.cache.ttl);
  return merged;
}

/**
 * Save settings to storage
 * @param {object} settings - Settings object
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  const { DEFAULT_CONFIG } = await import('../config/defaults.js');
  const current = await loadSettings();
  const merged = mergeConfigWithDefaults(
    {
      ...current,
      ...settings,
      openai: { ...current.openai, ...(settings?.openai || {}) },
      claude: { ...current.claude, ...(settings?.claude || {}) },
      gemini: { ...current.gemini, ...(settings?.gemini || {}) },
      webSearch: { ...current.webSearch, ...(settings?.webSearch || {}) },
      cache: { ...current.cache, ...(settings?.cache || {}) },
      shortcuts: { ...current.shortcuts, ...(settings?.shortcuts || {}) },
    },
    DEFAULT_CONFIG,
  );

  merged.cache = sanitizeCache(merged.cache, DEFAULT_CONFIG.cache.ttl);

  await setStorage({ config: merged });
}

export const EXPORT_BUNDLE_VERSION = 1;

function mergeConfigWithDefaults(config, defaults) {
  const safeConfig = config || {};
  const base = {
    ...defaults,
    ...safeConfig,
  };

  base.openai = { ...defaults.openai, ...(safeConfig.openai || {}) };
  base.claude = { ...defaults.claude, ...(safeConfig.claude || {}) };
  base.gemini = { ...defaults.gemini, ...(safeConfig.gemini || {}) };
  base.webSearch = { ...defaults.webSearch, ...(safeConfig.webSearch || {}) };
  base.cache = { ...defaults.cache, ...(safeConfig.cache || {}) };
  base.shortcuts = { ...defaults.shortcuts, ...(safeConfig.shortcuts || {}) };

  return base;
}

function stripSecrets(config) {
  const cloned = JSON.parse(JSON.stringify(config || {}));
  ['openai', 'claude', 'gemini'].forEach((provider) => {
    if (cloned[provider] && cloned[provider].apiKey !== undefined) {
      delete cloned[provider].apiKey;
    }
  });
  if (cloned.webSearch && cloned.webSearch.apiKey !== undefined) {
    delete cloned.webSearch.apiKey;
  }
  return cloned;
}

function validateImportBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') {
    throw new Error('Import data must be an object');
  }
  if (bundle.version !== EXPORT_BUNDLE_VERSION) {
    throw new Error(`Unsupported version ${bundle.version || 'unknown'}`);
  }
  if (!bundle.config || typeof bundle.config !== 'object') {
    throw new Error('Missing config in import file');
  }
  if (bundle.prompts && !Array.isArray(bundle.prompts)) {
    throw new Error('Prompts must be an array');
  }
}

function sanitizeCache(cache, fallbackTtl) {
  if (!cache) {
    return { ttl: fallbackTtl, maxEntries: 500 };
  }
  const ttl = Number.isFinite(Number(cache.ttl)) ? Number(cache.ttl) : fallbackTtl;
  const maxEntries = Number.isFinite(Number(cache.maxEntries)) ? Number(cache.maxEntries) : 500;
  return { ...cache, ttl, maxEntries };
}

export async function exportConfigBundle(options = {}) {
  const { includeSecrets = false } = options;
  const { DEFAULT_CONFIG } = await import('../config/defaults.js');
  const [configResult, promptsResult] = await Promise.all([
    getStorage('config'),
    getStorage('chatPrompts'),
  ]);

  const mergedConfig = mergeConfigWithDefaults(configResult.config || {}, DEFAULT_CONFIG);
  mergedConfig.cache = sanitizeCache(mergedConfig.cache, DEFAULT_CONFIG.cache.ttl);

  const configToExport = includeSecrets ? mergedConfig : stripSecrets(mergedConfig);

  return {
    version: EXPORT_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    includeSecrets,
    config: configToExport,
    prompts: promptsResult.chatPrompts || [],
  };
}

export async function importConfigBundle(raw, options = {}) {
  const { allowSecrets = false } = options;
  const { DEFAULT_CONFIG } = await import('../config/defaults.js');
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

  validateImportBundle(parsed);

  const withDefaults = mergeConfigWithDefaults(parsed.config, DEFAULT_CONFIG);
  withDefaults.cache = sanitizeCache(withDefaults.cache, DEFAULT_CONFIG.cache.ttl);

  const configToSave = allowSecrets ? withDefaults : stripSecrets(withDefaults);

  const items = { config: configToSave };
  if (Array.isArray(parsed.prompts)) {
    items.chatPrompts = parsed.prompts;
  }

  await setStorage(items);

  return {
    savedPrompts: Array.isArray(parsed.prompts),
    savedSecrets: allowSecrets,
  };
}
