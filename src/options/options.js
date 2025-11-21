/**
 * Options Page Script
 */

import { loadSettings, saveSettings } from '../utils/storage.js';
import { error as logError } from '../utils/logger.js';
import { DEFAULT_CONFIG, getTargetLanguages } from '../config/defaults.js';

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
  ['openai', 'claude', 'gemini', 'copilot'].forEach((provider) => {
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

  const config = { provider };

  if (provider === 'openai') {
    const modelSelect = document.getElementById('openai-model');
    const availableModels = Array.from(modelSelect.options).map((opt) => opt.value);

    config.openai = {
      apiKey: document.getElementById('openai-api-key').value,
      model: document.getElementById('openai-model').value,
      host: document.getElementById('openai-host').value || 'https://api.openai.com',
      path: document.getElementById('openai-path').value || '/v1/chat/completions',
      availableModels: availableModels,
    };
  } else if (provider === 'claude') {
    const modelSelect = document.getElementById('claude-model');
    const availableModels = Array.from(modelSelect.options).map((opt) => opt.value);

    config.claude = {
      apiKey: document.getElementById('claude-api-key').value,
      model: document.getElementById('claude-model').value,
      host: document.getElementById('claude-host').value || 'https://api.anthropic.com',
      path: document.getElementById('claude-path').value || '/v1/messages',
      availableModels: availableModels,
    };
  } else if (provider === 'gemini') {
    config.gemini = {
      apiKey: document.getElementById('gemini-api-key').value,
      model: document.getElementById('gemini-model').value || 'gemini-pro',
      host:
        document.getElementById('gemini-host').value || 'https://generativelanguage.googleapis.com',
      path:
        document.getElementById('gemini-path').value || '/v1beta/models/gemini-pro:generateContent',
      availableModels: [],
    };
  } else if (provider === 'copilot') {
    config.copilot = {
      apiKey: document.getElementById('copilot-api-key').value,
      model: document.getElementById('copilot-model').value || 'gpt-4o-mini',
      host: document.getElementById('copilot-host').value || 'https://api.githubcopilot.com',
      path: document.getElementById('copilot-path').value || '/chat/completions',
      availableModels: [],
    };
  }

  const systemPrompt = document.getElementById('system-prompt').value.trim();
  if (systemPrompt) {
    config.systemPrompt = systemPrompt;
  }

  try {
    await saveSettings(config);
    showNotification('Settings saved successfully', 'success');
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

// Get Copilot models
document.getElementById('copilot-get-models')?.addEventListener('click', async () => {
  await getAvailableModels('copilot', 'copilot-get-models');
});

// Helper function to test provider connection
async function testProviderConnection(provider, buttonId) {
  const btn = document.getElementById(buttonId);
  const originalText = btn.textContent;
  btn.textContent = 'Testing...';
  btn.disabled = true;

  try {
    const apiKey = document.getElementById(`${provider}-api-key`).value;
    const host = document.getElementById(`${provider}-host`)?.value || '';
    const path = document.getElementById(`${provider}-path`)?.value || '';
    const model = document.getElementById(`${provider}-model`).value;

    if (!apiKey) {
      showNotification('Please enter API key first', 'error');
      return;
    }

    // Test with a simple translation
    const defaultHost =
      provider === 'openai' ? 'https://api.openai.com' : 'https://api.anthropic.com';
    const defaultPath = provider === 'openai' ? '/v1/chat/completions' : '/v1/messages';

    const config = {
      provider,
      [provider]: {
        apiKey,
        host: host || defaultHost,
        path: path || defaultPath,
        model,
      },
    };

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
    const host = document.getElementById(`${provider}-host`)?.value;

    if (!apiKey) {
      showNotification('Please enter API key first', 'error');
      return;
    }

    let modelsEndpoint;
    let headers;

    if (provider === 'openai') {
      const apiHost = host || 'https://api.openai.com';
      modelsEndpoint = `${apiHost}/v1/models`;
      headers = {
        Authorization: `Bearer ${apiKey}`,
      };
    } else if (provider === 'claude') {
      // Claude doesn't have a models endpoint, show predefined list
      showNotification(
        'Claude models:\n• claude-haiku-4-5-20251001\n• claude-3-opus-20240229\n• claude-3-sonnet-20240229\n• claude-3-haiku-20240307',
        'success',
      );
      return;
    }

    let models = [];

    if (provider === 'openai') {
      const host = document.getElementById('openai-host').value || 'https://api.openai.com';
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
      models = [
        'claude-haiku-4-5-20251001',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ];
      updateModelSelect('claude-model', models, 'claude');
      showNotification('Claude models preset loaded', 'success');
    } else if (provider === 'gemini') {
      const host =
        document.getElementById('gemini-host').value || 'https://generativelanguage.googleapis.com';
      const apiKey = document.getElementById('gemini-api-key').value;
      if (!apiKey) {
        showNotification('Enter Gemini API key first', 'error');
        return;
      }
      const url = `${host.replace(/\/$/, '')}/v1beta/models?key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      models = (data.models || []).map((m) => m.name || '').filter(Boolean);
      updateModelSelect('gemini-model', models, 'gemini');
      showNotification(`Gemini models: ${models.slice(0, 6).join(', ')}`, 'success');
    } else if (provider === 'copilot') {
      models = ['gpt-4o-mini', 'gpt-4o'];
      updateModelSelect('copilot-model', models, 'copilot');
      showNotification('Copilot models preset loaded', 'success');
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

      if (settings.provider === 'openai' && settings.openai) {
        document.getElementById('openai-api-key').value = settings.openai.apiKey || '';
        document.getElementById('openai-host').value = settings.openai.host || '';
        document.getElementById('openai-path').value = settings.openai.path || '';

        // Restore available models list
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
        openaiModelSelect.value = settings.openai.model || 'gpt-5-mini';
      } else if (settings.provider === 'claude' && settings.claude) {
        document.getElementById('claude-api-key').value = settings.claude.apiKey || '';
        document.getElementById('claude-host').value = settings.claude.host || '';
        document.getElementById('claude-path').value = settings.claude.path || '';

        // Restore available models list
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
        claudeModelSelect.value = settings.claude.model || 'claude-haiku-4-5-20251001';
      } else if (settings.provider === 'gemini' && settings.gemini) {
        document.getElementById('gemini-api-key').value = settings.gemini.apiKey || '';
        document.getElementById('gemini-host').value = settings.gemini.host || '';
        document.getElementById('gemini-path').value = settings.gemini.path || '';
        document.getElementById('gemini-model').value = settings.gemini.model || 'gemini-pro';
      } else if (settings.provider === 'copilot' && settings.copilot) {
        document.getElementById('copilot-api-key').value = settings.copilot.apiKey || '';
        document.getElementById('copilot-host').value = settings.copilot.host || '';
        document.getElementById('copilot-path').value = settings.copilot.path || '';
        document.getElementById('copilot-model').value = settings.copilot.model || 'gpt-4o-mini';
      }
    }

    // System prompt
    if (settings.systemPrompt) {
      document.getElementById('system-prompt').value = settings.systemPrompt;
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

// Load cache statistics
async function loadCacheStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getCacheStats' });
    if (response.success) {
      const stats = response.data;
      document.getElementById('cache-memory-count').textContent = stats.memorySize || 0;
      document.getElementById('cache-persistent-count').textContent = stats.persistentSize || 0;
    }
  } catch (err) {
    logError('Load cache stats failed:', err);
  }
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
