/**
 * Background Service Worker - Main entry point
 */

import { initLogger, info, error as logError } from '../utils/logger.js';
import { getStorage, setStorage } from '../utils/storage.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { handleMessage } from './backgroundMessageRouter.js';

// Track side panel state per window
const sidePanelState = new Map();

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  info('Extension installed/updated:', details.reason);

  // Set default config on first install
  if (details.reason === 'install') {
    await setStorage({ config: DEFAULT_CONFIG });
    info('Default configuration saved');
  } else if (details.reason === 'update') {
    // Backfill new settings if missing
    const { config } = await getStorage('config');
    if (config && config.sidePanelHotkey === undefined) {
      await setStorage({ config: { ...config, sidePanelHotkey: DEFAULT_CONFIG.sidePanelHotkey } });
      info('Side panel hotkey default applied');
    }
  }

  // Load config and initialize logger
  const { config } = await getStorage('config');
  initLogger(config?.debugMode || false);
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'toggleSidePanel') {
    handleToggleSidePanel(sendResponse);
    return true;
  }

  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

// Handle keyboard command (restores user-gesture context)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle_sidepanel') {
    handleToggleSidePanel(() => {});
  }
});

// Explicitly disable side panel opening on extension icon click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((err) => info('Side panel behavior setting failed:', err));

// Create context menu to open side panel
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'open-sidepanel',
    title: 'Open Translation Side Panel',
    contexts: ['action'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-sidepanel') {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
// Log startup
info('Smart Translator background service worker started');

function handleToggleSidePanel(sendResponse) {
  const respond = typeof sendResponse === 'function' ? sendResponse : () => {};

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      logError('toggleSidePanel tabs.query error:', chrome.runtime.lastError);
      respond({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    const tab = tabs[0];
    if (!tab || !tab.windowId) {
      info('toggleSidePanel: no active tab');
      respond({ success: false, error: 'No active tab' });
      return;
    }

    const windowId = tab.windowId;
    const isOpen = sidePanelState.get(windowId) || false;

    if (isOpen) {
      chrome.tabs.update(tab.id, { active: true }, () => {
        sidePanelState.set(windowId, false);
        info('Side panel closed via hotkey for window:', windowId);
        respond({ success: true, open: false });
      });
      return;
    }

    chrome.sidePanel.open({ windowId }, () => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || 'sidePanel.open failed';
        logError('Side panel open failed:', msg);
        respond({ success: false, open: false, error: msg });
        return;
      }

      sidePanelState.set(windowId, true);
      info('Side panel opened via hotkey for window:', windowId);
      respond({ success: true, open: true });
    });
  });
}
