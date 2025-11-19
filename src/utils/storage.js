/**
 * Chrome Storage utility functions
 */

/**
 * Get item from chrome.storage.local
 * @param {string|string[]|object} keys - Key(s) to retrieve
 * @returns {Promise<any>}
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
