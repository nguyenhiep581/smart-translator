/**
 * Hashing utilities for cache keys
 */

/**
 * Generate SHA-256 hash of a string
 * @param {string} str - String to hash
 * @returns {Promise<string>} Hex string hash
 */
export async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  // Optimize: use Uint8Array directly without Array.from
  const hashArray = new Uint8Array(hashBuffer);
  let hashHex = '';
  for (let i = 0; i < hashArray.length; i++) {
    hashHex += hashArray[i].toString(16).padStart(2, '0');
  }
  return hashHex;
}

/**
 * Generate cache key for translation
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {string} from - Source language
 * @param {string} to - Target language
 * @param {string} text - Text to translate
 * @returns {Promise<string>} Cache key
 */
export async function generateCacheKey(provider, model, from, to, text) {
  const normalized = text.trim().toLowerCase();
  const hash = await hashString(normalized);
  return `${provider}-${model}-${from}-${to}-${hash}`;
}

/**
 * Simple fast hash for non-cryptographic purposes
 * @param {string} str - String to hash
 * @returns {string} Hash string
 */
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
