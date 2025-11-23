/**
 * Popup Script
 */

import { error as logError } from '../utils/logger.js';
import { getTargetLanguages } from '../config/defaults.js';
import { loadSettings, saveSettings } from '../utils/storage.js';

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

// Open chat
document.getElementById('open-chat').addEventListener('click', () => {
  const url = chrome.runtime.getURL('src/chat/chat.html');
  chrome.tabs.create({ url });
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
    const config = await loadSettings();
    config.defaultTargetLang = newLang;
    await saveSettings(config);
  } catch (err) {
    logError('Failed to save default language:', err);
  }
});

// Handle Ctrl shortcut toggle
document.getElementById('ctrl-shortcut').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  try {
    const config = await loadSettings();
    config.enableCtrlShortcut = enabled;
    await saveSettings(config);
  } catch (err) {
    logError('Failed to save Ctrl shortcut setting:', err);
  }
});

// Load settings
async function loadPopupSettings() {
  try {
    const config = await loadSettings();

    // Load provider with model
    if (config.provider) {
      const providerName = config.provider.charAt(0).toUpperCase() + config.provider.slice(1);
      const model = config[config.provider]?.model || 'Not set';
      document.getElementById('current-provider').textContent = `${providerName} (${model})`;
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
    const response = await chrome.runtime.sendMessage({ type: 'getCacheStats' });
    if (response.success) {
      const { memory, persistent } = response.data;
      const totalEntries = persistent.size || 0;
      const memoryEntries = memory.size || 0;
      document.getElementById('cache-status').textContent =
        `${totalEntries} entries (${memoryEntries} in memory)`;
    } else {
      document.getElementById('cache-status').textContent = 'Enabled';
    }
  } catch (err) {
    logError('Load cache status failed:', err);
    document.getElementById('cache-status').textContent = 'Enabled';
  }
}

// Initialize
populateLanguageSelects();
loadPopupSettings();
loadCacheStatus();
