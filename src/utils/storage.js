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
  return stored.config || DEFAULT_CONFIG;
}

/**
 * Save settings to storage
 * @param {object} settings - Settings object
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  await setStorage({ config: settings });
}
