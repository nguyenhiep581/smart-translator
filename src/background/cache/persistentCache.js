/**
 * Persistent Cache using chrome.storage.local
 */

import { getStorage, setStorage } from '../../utils/storage.js';
import { error as logError } from '../../utils/logger.js';

const CACHE_KEY_PREFIX = 'cache_';

export class PersistentCache {
  constructor() {
    this.cacheKeyName = 'translationCache';
  }

  /**
   * Get value from persistent cache
   * @param {string} key
   * @returns {Promise<any>}
   */
  async get(key) {
    try {
      const storageKey = `${CACHE_KEY_PREFIX}${key}`;
      const result = await getStorage(storageKey);

      if (!result[storageKey]) {
        return null;
      }

      const entry = result[storageKey];

      // Check if expired
      if (this.isExpired(entry)) {
        await this.delete(key);
        return null;
      }

      return entry.value;
    } catch (err) {
      logError('Persistent cache get error:', err);
      return null;
    }
  }

  /**
   * Set value in persistent cache
   * @param {string} key
   * @param {any} value
   * @param {number} ttl - Time to live in milliseconds
   */
  async set(key, value, ttl = 86400000) {
    try {
      const storageKey = `${CACHE_KEY_PREFIX}${key}`;
      const entry = {
        value,
        timestamp: Date.now(),
        ttl,
      };

      await setStorage({ [storageKey]: entry });
    } catch (err) {
      logError('Persistent cache set error:', err);
    }
  }

  /**
   * Check if cache entry is expired
   * @param {object} entry
   * @returns {boolean}
   */
  isExpired(entry) {
    if (!entry.timestamp || !entry.ttl) {
      return true;
    }
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Delete entry from cache
   * @param {string} key
   */
  async delete(key) {
    try {
      const storageKey = `${CACHE_KEY_PREFIX}${key}`;
      await chrome.storage.local.remove(storageKey);
    } catch (err) {
      logError('Persistent cache delete error:', err);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear() {
    try {
      const all = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(all).filter((key) => key.startsWith(CACHE_KEY_PREFIX));

      if (cacheKeys.length > 0) {
        await chrome.storage.local.remove(cacheKeys);
      }
    } catch (err) {
      logError('Persistent cache clear error:', err);
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<{count: number, size: number}>}
   */
  async getStats() {
    try {
      const all = await chrome.storage.local.get(null);
      const cacheEntries = Object.keys(all).filter((key) => key.startsWith(CACHE_KEY_PREFIX));

      return {
        count: cacheEntries.length,
        size: await chrome.storage.local.getBytesInUse(cacheEntries),
      };
    } catch (err) {
      logError('Persistent cache stats error:', err);
      return { count: 0, size: 0 };
    }
  }
}
