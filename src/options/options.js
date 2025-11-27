/**
 * Options Page Script
 */

import {
  exportConfigBundle,
  importConfigBundle,
  loadSettings,
  saveSettings,
} from '../utils/storage.js';
import { error as logError } from '../utils/logger.js';
import { APP_VERSION } from '../utils/version.js';
import { getTargetLanguages } from '../config/defaults.js';
import {
  CLAUDE_DEFAULT_MODEL,
  CLAUDE_FALLBACK_MODEL,
  GEMINI_DEFAULT_MODEL,
  GEMINI_FALLBACK_MODEL,
  DEFAULT_HOSTS,
  DEFAULT_PATHS,
} from '../config/constants.js';
import { filterModelsByProvider } from '../config/providers.js';

// Populate language dropdown
function populateLanguageSelect() {
  const languages = getTargetLanguages();
  const optionsHTML = languages
    .map(({ code, name }) => `<option value="${code}">${name}</option>`)
    .join('');

  document.getElementById('default-target').innerHTML = optionsHTML;

  // Populate supported languages list
  const langListHTML = languages
    .map(({ code, name, flag }) => `<li>${flag} ${name} (${code})</li>`)
    .join('');

  document.getElementById('supported-languages').innerHTML = langListHTML;
}

// Navigation
document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    const section = item.dataset.section;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');

    // Hide all sections
    document.querySelectorAll('.section').forEach((sec) => {
      sec.classList.remove('active');
      sec.style.display = 'none';
    });

    // Show selected section
    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
      sectionElement.classList.add('active');
      sectionElement.style.display = 'block';
    }
  });
});

// Provider selection
function hideAllProviderCards() {
  ['openai', 'claude', 'gemini'].forEach((provider) => {
    const el = document.getElementById(`${provider}-config`);
    if (el) {
      el.style.display = 'none';
    }
  });
}

document.getElementById('provider-select').addEventListener('change', (e) => {
  const provider = e.target.value;
  hideAllProviderCards();
  const card = document.getElementById(`${provider}-config`);
  if (card) {
    card.style.display = 'block';
  }
});

// Save provider settings
document.getElementById('save-provider')?.addEventListener('click', async () => {
  const provider = document.getElementById('provider-select').value;

  if (!provider) {
    alert('Please select a provider');
    return;
  }

  // Load existing config and merge with new settings
  const config = await loadSettings();
  config.provider = provider;
  config.systemPrompt = document.getElementById('system-prompt').value.trim();

  // Save OpenAI settings from form if API key is present
  const openaiApiKey = document.getElementById('openai-api-key').value.trim();
  if (openaiApiKey) {
    const openaiModelSelect = document.getElementById('openai-model');
    const openaiModels = Array.from(openaiModelSelect.options).map((opt) => opt.value);

    config.openai = {
      ...(config.openai || {}),
      apiKey: openaiApiKey,
      model: document.getElementById('openai-model').value,
      host: document.getElementById('openai-host').value || DEFAULT_HOSTS.OPENAI,
      path: document.getElementById('openai-path').value || DEFAULT_PATHS.OPENAI,
      availableModels:
        openaiModels.length > 0 ? openaiModels : config.openai?.availableModels || [],
    };
  }
  // Keep existing OpenAI config if field is empty (happens when on different tab)

  // Save Claude settings from form if API key is present
  const claudeApiKey = document.getElementById('claude-api-key').value.trim();
  if (claudeApiKey) {
    const claudeModelSelect = document.getElementById('claude-model');
    const claudeModels = Array.from(claudeModelSelect.options).map((opt) => opt.value);

    config.claude = {
      ...(config.claude || {}),
      apiKey: claudeApiKey,
      model: document.getElementById('claude-model').value,
      host: document.getElementById('claude-host').value || DEFAULT_HOSTS.CLAUDE,
      path: document.getElementById('claude-path').value || DEFAULT_PATHS.CLAUDE,
      availableModels:
        claudeModels.length > 0 ? claudeModels : config.claude?.availableModels || [],
    };
  }
  // Keep existing Claude config if field is empty (happens when on different tab)

  // Save Gemini settings from form if API key is present
  const geminiApiKey = document.getElementById('gemini-api-key').value.trim();
  if (geminiApiKey) {
    const geminiModelSelect = document.getElementById('gemini-model');
    const geminiModels = Array.from(geminiModelSelect.options).map((opt) => opt.value);

    config.gemini = {
      ...(config.gemini || {}),
      apiKey: geminiApiKey,
      model: document.getElementById('gemini-model').value || GEMINI_DEFAULT_MODEL,
      availableModels:
        geminiModels.length > 0 ? geminiModels : config.gemini?.availableModels || [],
    };
  }
  // Keep existing Gemini config if field is empty (happens when on different tab)

  try {
    await saveSettings(config);
    showNotification('Settings saved successfully', 'success');
    // Reload UI to refresh all fields from saved config
    await loadSettingsUI();
  } catch (err) {
    showNotification('Failed to save settings: ' + err.message, 'error');
  }
});

// Test OpenAI connection
document.getElementById('openai-test-connection')?.addEventListener('click', async () => {
  await testProviderConnection('openai', 'openai-test-connection');
});

// Test Claude connection
document.getElementById('claude-test-connection')?.addEventListener('click', async () => {
  await testProviderConnection('claude', 'claude-test-connection');
});

// Test Gemini connection
document.getElementById('gemini-test-connection')?.addEventListener('click', async () => {
  await testProviderConnection('gemini', 'gemini-test-connection');
});

// Get OpenAI models
document.getElementById('openai-get-models')?.addEventListener('click', async () => {
  await getAvailableModels('openai', 'openai-get-models');
});

// Get Claude models
document.getElementById('claude-get-models')?.addEventListener('click', async () => {
  await getAvailableModels('claude', 'claude-get-models');
});

// Get Gemini models
document.getElementById('gemini-get-models')?.addEventListener('click', async () => {
  await getAvailableModels('gemini', 'gemini-get-models');
});

// Helper function to test provider connection
async function testProviderConnection(provider, buttonId) {
  const btn = document.getElementById(buttonId);
  const originalText = btn.textContent;
  btn.textContent = 'Testing...';
  btn.disabled = true;

  try {
    const apiKey = document.getElementById(`${provider}-api-key`).value;
    const model = document.getElementById(`${provider}-model`).value;

    if (!apiKey) {
      showNotification('Please enter API key first', 'error');
      return;
    }

    // Build config based on provider
    const config = { provider };

    if (provider === 'gemini') {
      config.gemini = { apiKey, model };
    } else {
      const host = document.getElementById(`${provider}-host`)?.value || '';
      const path = document.getElementById(`${provider}-path`)?.value || '';
      const defaultHost = provider === 'openai' ? DEFAULT_HOSTS.OPENAI : DEFAULT_HOSTS.CLAUDE;
      const defaultPath = provider === 'openai' ? DEFAULT_PATHS.OPENAI : DEFAULT_PATHS.CLAUDE;

      config[provider] = {
        apiKey,
        host: host || defaultHost,
        path: path || defaultPath,
        model,
      };
    }

    // Save temp config and test
    await saveSettings(config);

    const response = await chrome.runtime.sendMessage({
      type: 'translate',
      payload: { text: 'Hello', from: 'en', to: 'vi' },
    });

    if (response.success) {
      showNotification(`✅ Connection successful! Translated: "${response.data}"`, 'success');
    } else {
      showNotification(`❌ Connection failed: ${response.error}`, 'error');
    }
  } catch (err) {
    showNotification(`❌ Error: ${err.message}`, 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// Helper function to get available models
async function getAvailableModels(provider, buttonId) {
  const btn = document.getElementById(buttonId);
  const originalText = btn.textContent;
  btn.textContent = 'Fetching...';
  btn.disabled = true;

  try {
    const apiKey = document.getElementById(`${provider}-api-key`).value;

    if (!apiKey) {
      showNotification('Please enter API key first', 'error');
      return;
    }

    let models = [];

    if (provider === 'openai') {
      const host = document.getElementById('openai-host').value || DEFAULT_HOSTS.OPENAI;
      const apiKey = document.getElementById('openai-api-key').value;
      if (!apiKey) {
        showNotification('Enter OpenAI API key first', 'error');
        return;
      }
      const response = await fetch(host.replace(/\/$/, '') + '/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      models = (data.data || [])
        .map((m) => m.id)
        .filter((id) => id.includes('gpt') || id.includes('o'));
      updateModelSelect('openai-model', models, 'openai');
      showNotification(`OpenAI models: ${models.slice(0, 6).join(', ')}`, 'success');
    } else if (provider === 'claude') {
      const host = document.getElementById('claude-host').value || DEFAULT_HOSTS.CLAUDE;
      const apiKey = document.getElementById('claude-api-key').value;
      if (!apiKey) {
        showNotification('Enter Claude API key first', 'error');
        return;
      }
      try {
        const response = await fetch(host.replace(/\/$/, '') + '/v1/models', {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        models = (data.data || []).map((m) => m.id || m.name).filter(Boolean);

        if (models.length === 0) {
          // Fallback to preset list if API doesn't return models
          models = [CLAUDE_DEFAULT_MODEL, CLAUDE_FALLBACK_MODEL];
        }
        updateModelSelect('claude-model', models, 'claude');
        showNotification(`Claude models: ${models.slice(0, 4).join(', ')}...`, 'success');
      } catch (err) {
        // Fallback to preset list if API call fails
        logError('Claude API models fetch failed, using preset:', err);
        models = [CLAUDE_DEFAULT_MODEL, CLAUDE_FALLBACK_MODEL];
        updateModelSelect('claude-model', models, 'claude');
        showNotification('Claude models preset loaded (API unavailable)', 'info');
      }
    } else if (provider === 'gemini') {
      const apiKey = document.getElementById('gemini-api-key').value;
      if (!apiKey) {
        showNotification('Enter Gemini API key first', 'error');
        return;
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      models = filterModelsByProvider(
        'gemini',
        (data.models || []).map((m) => (m.name || '').replace(/^models\//, '')),
      );
      if (models.length === 0) {
        models = [GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODEL];
      }
      updateModelSelect('gemini-model', models, 'gemini');
      showNotification(`Gemini models: ${models.slice(0, 6).join(', ')}`, 'success');
    }
  } catch (err) {
    showNotification(`❌ Failed to fetch models: ${err.message}`, 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function updateModelSelect(selectId, models, providerKey) {
  if (!models || models.length === 0) {
    return;
  }
  const select = document.getElementById(selectId);
  const currentValue = select.value;
  select.innerHTML = '';
  models.forEach((modelId) => {
    const option = document.createElement('option');
    option.value = modelId;
    option.textContent = modelId;
    select.appendChild(option);
  });
  select.value = models.includes(currentValue) ? currentValue : models[0];
  const settings = await loadSettings();
  settings[providerKey] = settings[providerKey] || {};
  settings[providerKey].availableModels = models;
  if (!settings[providerKey].model || !models.includes(settings[providerKey].model)) {
    settings[providerKey].model = models[0];
  }
  await saveSettings(settings);
}

// Save language settings
document.getElementById('save-language')?.addEventListener('click', async () => {
  const defaultTarget = document.getElementById('default-target').value;
  const enableCtrlShortcut = document.getElementById('enable-ctrl-shortcut').checked;

  try {
    const settings = await loadSettings();
    settings.defaultTargetLang = defaultTarget;
    settings.enableCtrlShortcut = enableCtrlShortcut;
    await saveSettings(settings);
    showNotification('Language settings saved', 'success');
  } catch (err) {
    showNotification('Failed to save: ' + err.message, 'error');
  }
});

// Save Web Search settings
document.getElementById('save-websearch')?.addEventListener('click', async () => {
  const provider = document.getElementById('search-provider').value;
  const apiKey = document.getElementById('google-search-api-key').value.trim();
  const cx = document.getElementById('google-search-cx').value.trim();

  try {
    const settings = await loadSettings();
    settings.webSearch = {
      provider,
      apiKey,
      cx,
    };
    await saveSettings(settings);
    showNotification('Web Search settings saved', 'success');
  } catch (err) {
    showNotification('Failed to save: ' + err.message, 'error');
  }
});

document.getElementById('search-provider')?.addEventListener('change', (e) => {
  const provider = e.target.value;
  document.getElementById('google-search-config').style.display =
    provider === 'google' ? 'block' : 'none';
  document.getElementById('ddg-search-config').style.display =
    provider === 'ddg' ? 'block' : 'none';
});

// Save cache settings
document.getElementById('save-cache')?.addEventListener('click', async () => {
  const maxEntries = parseInt(document.getElementById('cache-max-entries').value);
  const ttl = parseInt(document.getElementById('cache-ttl').value);

  try {
    const settings = await loadSettings();
    settings.cache = {
      maxEntries,
      ttl: ttl * 24 * 60 * 60 * 1000, // Convert days to milliseconds
    };
    await saveSettings(settings);
    showNotification('Cache settings saved', 'success');
  } catch (err) {
    showNotification('Failed to save: ' + err.message, 'error');
  }
});

// Clear all cache
document.getElementById('clear-cache')?.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear all cache?')) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ type: 'clearCache' });
    showNotification('Cache cleared successfully', 'success');
    await loadCacheStats();
  } catch (err) {
    showNotification('Failed to clear cache: ' + err.message, 'error');
  }
});

// Export/import configuration and prompts
const importFileInput = document.getElementById('import-file-input');

document.getElementById('export-config')?.addEventListener('click', async () => {
  await handleExportConfig();
});

document.getElementById('import-config')?.addEventListener('click', () => {
  importFileInput?.click();
});

importFileInput?.addEventListener('change', async (event) => {
  await handleImportFile(event);
});

async function handleExportConfig() {
  try {
    const includeSecrets = document.getElementById('export-include-secrets')?.checked;
    const bundle = await exportConfigBundle({ includeSecrets });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart-translator-config-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification(
      `Exported settings${includeSecrets ? ' (API keys included)' : ' (API keys excluded)'}`,
      'success',
    );
  } catch (err) {
    showNotification('Export failed: ' + err.message, 'error');
  }
}

async function handleImportFile(event) {
  const [file] = event?.target?.files || [];
  if (!file) {
    return;
  }
  try {
    const allowSecrets = document.getElementById('import-allow-secrets')?.checked;
    const text = await file.text();
    await importConfigBundle(text, { allowSecrets });
    showNotification(
      `Import successful${allowSecrets ? ' (API keys applied)' : ' (API keys skipped)'}`,
      'success',
    );
    await loadSettingsUI();
  } catch (err) {
    showNotification('Import failed: ' + err.message, 'error');
  } finally {
    if (event?.target) {
      event.target.value = '';
    }
  }
}

// Save about settings (debug mode)
document.getElementById('save-about')?.addEventListener('click', async () => {
  const debugMode = document.getElementById('debug-mode').checked;

  try {
    const settings = await loadSettings();
    settings.debugMode = debugMode;
    await saveSettings(settings);

    // Notify background to reinitialize logger
    await chrome.runtime.sendMessage({ type: 'updateDebugMode', payload: { debugMode } });

    showNotification(
      'Debug mode updated. Please reload the extension to apply changes.',
      'success',
    );
  } catch (err) {
    showNotification('Failed to save: ' + err.message, 'error');
  }
});

// Show toast notification
async function loadSettingsUI() {
  try {
    const settings = await loadSettings();

    // Provider
    if (settings.provider) {
      document.getElementById('provider-select').value = settings.provider;
      hideAllProviderCards();
      document.getElementById(`${settings.provider}-config`).style.display = 'block';
    }

    // Load OpenAI settings (always load, even if not active provider)
    if (settings.openai) {
      document.getElementById('openai-api-key').value = settings.openai.apiKey || '';
      document.getElementById('openai-host').value = settings.openai.host || '';
      document.getElementById('openai-path').value = settings.openai.path || '';

      const openaiModelSelect = document.getElementById('openai-model');
      if (settings.openai.availableModels && settings.openai.availableModels.length > 0) {
        openaiModelSelect.innerHTML = '';
        settings.openai.availableModels.forEach((modelId) => {
          const option = document.createElement('option');
          option.value = modelId;
          option.textContent = modelId;
          openaiModelSelect.appendChild(option);
        });
      }
      openaiModelSelect.value = settings.openai.model || 'gpt-4o-mini';
    }

    // Load Claude settings (always load, even if not active provider)
    if (settings.claude) {
      document.getElementById('claude-api-key').value = settings.claude.apiKey || '';
      document.getElementById('claude-host').value = settings.claude.host || '';
      document.getElementById('claude-path').value = settings.claude.path || '';

      const claudeModelSelect = document.getElementById('claude-model');
      if (settings.claude.availableModels && settings.claude.availableModels.length > 0) {
        claudeModelSelect.innerHTML = '';
        settings.claude.availableModels.forEach((modelId) => {
          const option = document.createElement('option');
          option.value = modelId;
          option.textContent = modelId;
          claudeModelSelect.appendChild(option);
        });
      }
      claudeModelSelect.value = settings.claude.model || 'claude-sonnet-4-5';
    }

    // Load Gemini settings (always load, even if not active provider)
    if (settings.gemini) {
      document.getElementById('gemini-api-key').value = settings.gemini.apiKey || '';

      const geminiModelSelect = document.getElementById('gemini-model');
      if (settings.gemini.availableModels && settings.gemini.availableModels.length > 0) {
        geminiModelSelect.innerHTML = '';
        settings.gemini.availableModels.forEach((modelId) => {
          const option = document.createElement('option');
          option.value = modelId;
          option.textContent = modelId;
          geminiModelSelect.appendChild(option);
        });
      }
      geminiModelSelect.value = settings.gemini.model || 'gemini-2.0-flash-exp';
    }

    // System prompt
    document.getElementById('system-prompt').value = settings.systemPrompt || '';

    // Web Search
    if (settings.webSearch) {
      document.getElementById('search-provider').value = settings.webSearch.provider || 'ddg';
      document.getElementById('google-search-api-key').value = settings.webSearch.apiKey || '';
      document.getElementById('google-search-cx').value = settings.webSearch.cx || '';

      // Trigger change event to set correct visibility
      document.getElementById('search-provider').dispatchEvent(new Event('change'));
    } else {
      // Default to DDG if no settings exist yet
      document.getElementById('search-provider').value = 'ddg';
      document.getElementById('search-provider').dispatchEvent(new Event('change'));
    }

    // Language
    if (settings.defaultTargetLang) {
      document.getElementById('default-target').value = settings.defaultTargetLang;
    }

    // Ctrl shortcut
    if (settings.enableCtrlShortcut !== undefined) {
      document.getElementById('enable-ctrl-shortcut').checked = settings.enableCtrlShortcut;
    } else {
      // Default to enabled
      document.getElementById('enable-ctrl-shortcut').checked = true;
    }

    // Cache
    if (settings.cache) {
      document.getElementById('cache-max-entries').value = settings.cache.maxEntries || 500;
      const ttlDays = Math.floor(
        (settings.cache.ttl || 7 * 24 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000),
      );
      document.getElementById('cache-ttl').value = ttlDays;
    }

    // Debug mode
    if (settings.debugMode !== undefined) {
      document.getElementById('debug-mode').checked = settings.debugMode;
    }
  } catch (err) {
    logError('Load settings failed:', err);
  }
}

function formatBytes(bytes) {
  if (bytes === undefined || bytes === null) {
    return '-';
  }
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const fixed = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${fixed} ${units[unitIndex]}`;
}

// Load cache statistics
async function loadCacheStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getCacheStats' });
    if (response.success) {
      const { memory = {}, persistent = {} } = response.data || {};
      const memorySize = memory.size ?? 0;
      const memoryMax = memory.maxSize ?? 0;
      const persistentCount = persistent.count ?? 0;
      const persistentBytes = persistent.size ?? 0;

      document.getElementById('cache-memory-count').textContent = memorySize;
      document.getElementById('cache-memory-meta').textContent = `Max ${memoryMax} entries`;
      document.getElementById('cache-persistent-count').textContent = persistentCount;
      document.getElementById('cache-persistent-meta').textContent = formatBytes(persistentBytes);
      return;
    }
  } catch (err) {
    logError('Load cache stats failed:', err);
  }

  // Fallback display when stats not available
  document.getElementById('cache-memory-count').textContent = '-';
  document.getElementById('cache-memory-meta').textContent = 'Max: -';
  document.getElementById('cache-persistent-count').textContent = '-';
  document.getElementById('cache-persistent-meta').textContent = 'Size: -';
}

// Show toast notification
function showNotification(message, type = 'info') {
  // Create a better notification UI
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 10000;
    max-width: 400px;
    white-space: pre-line;
    font-size: 14px;
    line-height: 1.5;
    animation: slideIn 0.3s ease;
  `;

  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 2000); // Reduced from 5000 to 2000ms
}

// Add animation styles
if (!document.getElementById('notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

const appVersionEl = document.querySelector('.app-version');
if (appVersionEl) {
  appVersionEl.textContent = `v${APP_VERSION}`;
}

// Initialize
populateLanguageSelect();
loadSettingsUI();
loadCacheStats();

// Show first section by default
document.addEventListener('DOMContentLoaded', () => {
  const firstNavItem = document.querySelector('.nav-item');
  if (firstNavItem) {
    const firstSection = firstNavItem.dataset.section;
    const sectionElement = document.getElementById(`${firstSection}-section`);
    if (sectionElement) {
      firstNavItem.classList.add('active');
      sectionElement.classList.add('active');
      sectionElement.style.display = 'block';
    }
  }
});
