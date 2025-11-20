/**
 * Memory Cache with LRU eviction
 */

export class MemoryCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
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
      const lru = this.accessOrder.shift();
      this.cache.delete(lru);
    }

    // Add new entry
    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  /**
   * Update access order for LRU
   * @param {string} key
   */
  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
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
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache size
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }
}
