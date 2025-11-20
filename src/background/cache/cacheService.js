/**
 * Two-Layer Cache Service
 *
 * Implements a high-performance caching system with:
 * - Memory cache (LRU) for instant access (max 500 entries by default)
 * - Persistent cache (chrome.storage.local) for durability across sessions
 * - Automatic key generation using hash functions
 * - TTL (Time To Live) support for cache expiration
 *
 * Cache Hit Flow:
 * 1. Check memory cache first (fastest)
 * 2. If miss, check persistent cache
 * 3. If found in persistent, populate memory cache
 * 4. Return value or null
 *
 * @class CacheService
 *
 * @example
 * const cache = new CacheService(500); // Max 500 entries in memory
 *
 * // Generate cache key
 * const key = await cache.generateKey('openai', 'gpt-4', 'en', 'vi', 'Hello');
 *
 * // Store translation
 * await cache.set(key, 'Xin chào', 86400000); // 24h TTL
 *
 * // Retrieve translation
 * const translation = await cache.get(key); // Returns from memory or persistent
 *
 * // Get cache statistics
 * const stats = await cache.getStats();
 * console.log(`Memory: ${stats.memory.size}/${stats.memory.maxSize}`);
 * console.log(`Persistent: ${stats.persistent.size} entries`);
 */

import { MemoryCache } from './memoryCache.js';
import { PersistentCache } from './persistentCache.js';
import { generateCacheKey } from '../../utils/hashing.js';

export class CacheService {
  /**
   * Create a cache service instance
   *
   * @param {number} maxMemorySize - Maximum entries in memory cache (default: 500)
   */
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
        maxSize: this.memoryCache.maxSize,
      },
      persistent: persistentStats,
    };
  }
}
