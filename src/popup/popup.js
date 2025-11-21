/**
 * Popup Script
 */

import { error as logError } from '../utils/logger.js';
import { getTargetLanguages } from '../config/defaults.js';

// Populate language dropdowns
function populateLanguageSelects() {
  const languages = getTargetLanguages();
  const optionsHTML = languages
    .map(({ code, name }) => `<option value="${code}">${name}</option>`)
    .join('');

  document.getElementById('default-lang').innerHTML = optionsHTML;
}

// Open full options
document.getElementById('open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Open Chrome shortcuts page to set keyboard shortcut
document.getElementById('open-shortcuts').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// Clear cache
document.getElementById('clear-cache').addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'clearCache' });
    if (response.success) {
      alert('Cache cleared successfully');
      loadCacheStatus();
    }
  } catch (err) {
    alert('Failed to clear cache');
  }
});

// Open side panel
document.getElementById('open-sidepanel').addEventListener('click', async () => {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: currentWindow.id });
    // Close the popup after opening side panel
    self.close();
  } catch (err) {
    logError('Failed to open side panel:', err);
    alert('Failed to open side panel. Please try again.');
  }
});

// Handle default language change
document.getElementById('default-lang').addEventListener('change', async (e) => {
  const newLang = e.target.value;
  try {
    const result = await chrome.storage.local.get('config');
    const config = result.config || {};
    config.defaultTargetLang = newLang;
    await chrome.storage.local.set({ config });
  } catch (err) {
    logError('Failed to save default language:', err);
  }
});

// Handle Ctrl shortcut toggle
document.getElementById('ctrl-shortcut').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  try {
    const result = await chrome.storage.local.get('config');
    const config = result.config || {};
    config.enableCtrlShortcut = enabled;
    await chrome.storage.local.set({ config });
  } catch (err) {
    logError('Failed to save Ctrl shortcut setting:', err);
  }
});

// Load settings
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get('config');
    const config = result.config || {};

    // Load provider
    if (config.provider) {
      document.getElementById('current-provider').textContent =
        config.provider.charAt(0).toUpperCase() + config.provider.slice(1);
    }

    // Load default target language
    const defaultLang = config.defaultTargetLang || 'vi';
    document.getElementById('default-lang').value = defaultLang;

    // Load Ctrl shortcut setting
    const ctrlShortcut = config.enableCtrlShortcut !== false; // Default true
    document.getElementById('ctrl-shortcut').checked = ctrlShortcut;
  } catch (err) {
    logError('Load settings failed:', err);
  }
}

// Load cache status
async function loadCacheStatus() {
  try {
    // This would need a new message type to get cache stats
    document.getElementById('cache-status').textContent = 'Enabled';
  } catch (err) {
    logError('Load cache status failed:', err);
  }
}

// Initialize
populateLanguageSelects();
loadSettings();
loadCacheStatus();
