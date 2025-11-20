/**
 * Background Service Worker - Main entry point
 */

import { initLogger, info, error } from '../utils/logger.js';
import { getStorage, setStorage } from '../utils/storage.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { handleMessage } from './backgroundMessageRouter.js';

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  info('Extension installed/updated:', details.reason);

  // Set default config on first install
  if (details.reason === 'install') {
    await setStorage({ config: DEFAULT_CONFIG });
    info('Default configuration saved');
  }

  // Load config and initialize logger
  const { config } = await getStorage('config');
  initLogger(config?.debugMode || false);
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

// Log startup
info('Smart Translator background service worker started');
