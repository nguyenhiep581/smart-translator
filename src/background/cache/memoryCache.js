/**
 * Memory Cache with LRU eviction
 */

export class MemoryCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
    // Use Map to track access order for O(1) operations
    this.accessOrder = new Map();
    this.timestamp = 0;
  }

  /**
   * Get value from cache
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    // Update access order (move to end = most recently used)
    this.updateAccessOrder(key);

    return this.cache.get(key);
  }

  /**
   * Set value in cache
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    // If key exists, update it
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.updateAccessOrder(key);
      return;
    }

    // If cache is full, remove least recently used
    if (this.cache.size >= this.maxSize) {
      // Find LRU entry - O(n) but only when cache is full
      let lruKey = null;
      let lruTimestamp = Infinity;
      for (const [k, timestamp] of this.accessOrder.entries()) {
        if (timestamp < lruTimestamp) {
          lruTimestamp = timestamp;
          lruKey = k;
        }
      }
      if (lruKey) {
        this.cache.delete(lruKey);
        this.accessOrder.delete(lruKey);
      }
    }

    // Add new entry
    this.cache.set(key, value);
    this.updateAccessOrder(key);
  }

  /**
   * Update access order for LRU
   * @param {string} key
   */
  updateAccessOrder(key) {
    // Use timestamp for O(1) access order tracking
    this.accessOrder.set(key, ++this.timestamp);
  }

  /**
   * Check if key exists
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Delete entry
   * @param {string} key
   */
  delete(key) {
    this.accessOrder.delete(key);
    this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear() {
    this.cache.clear();
    this.accessOrder.clear();
    this.timestamp = 0;
  }

  /**
   * Get cache size
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }
}
