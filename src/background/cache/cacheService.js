/**
 * Cache Service - Combines memory and persistent cache
 */

import { MemoryCache } from './memoryCache.js';
import { PersistentCache } from './persistentCache.js';
import { generateCacheKey } from '../../utils/hashing.js';

export class CacheService {
  constructor(maxMemorySize = 500) {
    this.memoryCache = new MemoryCache(maxMemorySize);
    this.persistentCache = new PersistentCache();
  }

  /**
   * Generate cache key
   * @param {string} provider
   * @param {string} model
   * @param {string} from
   * @param {string} to
   * @param {string} text
   * @returns {Promise<string>}
   */
  async generateKey(provider, model, from, to, text) {
    return await generateCacheKey(provider, model, from, to, text);
  }

  /**
   * Get value from cache (memory first, then persistent)
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  async get(key) {
    // Try memory cache first
    let value = this.memoryCache.get(key);
    if (value) {
      return value;
    }

    // Try persistent cache
    value = await this.persistentCache.get(key);
    if (value) {
      // Populate memory cache
      this.memoryCache.set(key, value);
      return value;
    }

    return null;
  }

  /**
   * Set value in both caches
   * @param {string} key
   * @param {string} value
   * @param {number} ttl
   */
  async set(key, value, ttl = 86400000) {
    this.memoryCache.set(key, value);
    await this.persistentCache.set(key, value, ttl);
  }

  /**
   * Clear all caches
   */
  async clear() {
    this.memoryCache.clear();
    await this.persistentCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Promise<object>}
   */
  async getStats() {
    const persistentStats = await this.persistentCache.getStats();
    
    return {
      memory: {
        size: this.memoryCache.size(),
        maxSize: this.memoryCache.maxSize
      },
      persistent: persistentStats
    };
  }
}
