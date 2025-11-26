/* eslint-disable no-console */
/**
 * Logger utility with debug mode support
 */

let debugMode = false;

/**
 * Initialize logger with config
 * @param {boolean} isDebugMode - Enable debug logging
 */
export function initLogger(isDebugMode) {
  debugMode = isDebugMode;
}

/**
 * Log debug message
 * @param {...any} args - Arguments to log
 */
export function debug(...args) {
  if (debugMode) {
    console.log('[Smart Translator]', ...args);
  }
}

/**
 * Log info message
 * @param {...any} args - Arguments to log
 */
export function info(...args) {
  console.info('[Smart Translator]', ...args);
}

/**
 * Log warning message
 * @param {...any} args - Arguments to log
 */
export function warn(...args) {
  console.warn('[Smart Translator]', ...args);
}

/**
 * Log error message
 * @param {...any} args - Arguments to log
 */
export function error(...args) {
  console.error('[Smart Translator]', ...args);
}

/**
 * Log API call (sanitized - never log API keys)
 * @param {string} provider - Provider name
 * @param {string} endpoint - API endpoint
 * @param {number} duration - Request duration in ms
 */
export function logAPICall(provider, endpoint, duration) {
  debug(`API Call: ${provider} | ${endpoint} | ${duration}ms`);
}
