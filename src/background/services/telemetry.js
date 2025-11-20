/**
 * Telemetry service for tracking local statistics
 */

import { getStorage, setStorage } from '../../utils/storage.js';
import { error as logError } from '../../utils/logger.js';

const TELEMETRY_KEY = 'telemetry';
const MAX_ENTRIES = 100;

/**
 * Get telemetry stats
 * @returns {Promise<object>}
 */
export async function getStats() {
  try {
    const { telemetry = [] } = await getStorage(TELEMETRY_KEY);

    const totalRequests = telemetry.length;
    const cacheHits = telemetry.filter((e) => e.cacheHit).length;
    const successfulRequests = telemetry.filter((e) => e.success).length;

    const avgLatency =
      telemetry.length > 0
        ? telemetry.reduce((sum, e) => sum + (e.duration || 0), 0) / telemetry.length
        : 0;

    const providerCounts = telemetry.reduce((acc, e) => {
      acc[e.provider] = (acc[e.provider] || 0) + 1;
      return acc;
    }, {});

    return {
      totalRequests,
      cacheHits,
      cacheHitRate: totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(1) : 0,
      successRate: totalRequests > 0 ? ((successfulRequests / totalRequests) * 100).toFixed(1) : 0,
      avgLatency: Math.round(avgLatency),
      providerCounts,
      lastProvider: telemetry[telemetry.length - 1]?.provider || 'none',
    };
  } catch (err) {
    logError('Get telemetry stats error:', err);
    return {
      totalRequests: 0,
      cacheHits: 0,
      cacheHitRate: 0,
      successRate: 0,
      avgLatency: 0,
      providerCounts: {},
      lastProvider: 'none',
    };
  }
}

/**
 * Clear telemetry data
 */
export async function clearTelemetry() {
  await setStorage({ [TELEMETRY_KEY]: [] });
}
