/**
 * Options Page Script
 */

import { loadSettings, saveSettings } from '../utils/storage.js';

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const section = item.dataset.section;
    
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(sec => {
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
document.querySelectorAll('input[name="provider"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const provider = e.target.value;
    
    // Hide all config cards
    document.getElementById('openai-config').style.display = 'none';
    document.getElementById('claude-config').style.display = 'none';
    
    // Show selected provider config
    document.getElementById(`${provider}-config`).style.display = 'block';
  });
});

// Save provider settings
document.getElementById('save-provider')?.addEventListener('click', async () => {
  const provider = document.querySelector('input[name="provider"]:checked')?.value;
  
  if (!provider) {
    alert('Please select a provider');
    return;
  }
  
  const config = { provider };
  
  if (provider === 'openai') {
    config.openai = {
      apiKey: document.getElementById('openai-api-key').value,
      model: document.getElementById('openai-model').value,
      host: document.getElementById('openai-host').value || 'https://api.openai.com',
      path: document.getElementById('openai-path').value || '/v1/chat/completions'
    };
  } else if (provider === 'claude') {
    config.claude = {
      apiKey: document.getElementById('claude-api-key').value,
      model: document.getElementById('claude-model').value,
      host: document.getElementById('claude-host').value || 'https://api.anthropic.com',
      path: document.getElementById('claude-path').value || '/v1/messages'
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
    const defaultHost = provider === 'openai' ? 'https://api.openai.com' : 'https://api.anthropic.com';
    const defaultPath = provider === 'openai' ? '/v1/chat/completions' : '/v1/messages';
    
    const config = {
      provider,
      [provider]: {
        apiKey,
        host: host || defaultHost,
        path: path || defaultPath,
        model
      }
    };
    
    // Save temp config and test
    await saveSettings(config);
    
    const response = await chrome.runtime.sendMessage({
      type: 'translate',
      payload: { text: 'Hello', from: 'en', to: 'vi' }
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
        'Authorization': `Bearer ${apiKey}`
      };
    } else if (provider === 'claude') {
      // Claude doesn't have a models endpoint, show predefined list
      showNotification('Claude models:\n• claude-haiku-4-5-20251001\n• claude-3-opus-20240229\n• claude-3-sonnet-20240229\n• claude-3-haiku-20240307', 'success');
      return;
    }
    
    const response = await fetch(modelsEndpoint, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (provider === 'openai' && data.data) {
      // Filter for GPT models
      const gptModels = data.data
        .filter(m => m.id.includes('gpt'))
        .map(m => m.id)
        .slice(0, 10);
      
      if (gptModels.length > 0) {
        showNotification(`Available models:\n${gptModels.join('\n')}`, 'success');
        
        // Update select dropdown with available models
        const select = document.getElementById('openai-model');
        const currentValue = select.value;
        
        // Add new models to dropdown if not already present
        gptModels.forEach(modelId => {
          if (!Array.from(select.options).some(opt => opt.value === modelId)) {
            const option = document.createElement('option');
            option.value = modelId;
            option.textContent = modelId;
            select.appendChild(option);
          }
        });
        
        // Restore current value
        select.value = currentValue;
      } else {
        showNotification('No GPT models found', 'error');
      }
    }
  } catch (err) {
    showNotification(`❌ Failed to fetch models: ${err.message}`, 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// Save language settings
document.getElementById('save-language')?.addEventListener('click', async () => {
  const defaultTarget = document.getElementById('default-target').value;
  
  try {
    const settings = await loadSettings();
    settings.defaultTargetLang = defaultTarget;
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
      ttl: ttl * 24 * 60 * 60 * 1000 // Convert days to milliseconds
    };
    await saveSettings(settings);
    showNotification('Cache settings saved', 'success');
  } catch (err) {
    showNotification('Failed to save: ' + err.message, 'error');
  }
});

// Clear all cache
document.getElementById('clear-cache')?.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear all cache?')) return;
  
  try {
    await chrome.runtime.sendMessage({ type: 'clearCache' });
    showNotification('Cache cleared successfully', 'success');
    await loadCacheStats();
  } catch (err) {
    showNotification('Failed to clear cache: ' + err.message, 'error');
  }
});

// Reset statistics
document.getElementById('reset-stats')?.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to reset all statistics?')) return;
  
  try {
    await chrome.runtime.sendMessage({ type: 'resetTelemetry' });
    showNotification('Statistics reset successfully', 'success');
    await loadTelemetry();
  } catch (err) {
    showNotification('Failed to reset: ' + err.message, 'error');
  }
});

// Load settings from storage
async function loadSettingsUI() {
  try {
    const settings = await loadSettings();
    
    // Provider
    if (settings.provider) {
      document.querySelector(`input[name="provider"][value="${settings.provider}"]`).checked = true;
      document.getElementById(`${settings.provider}-config`).style.display = 'block';
      
      if (settings.provider === 'openai' && settings.openai) {
        document.getElementById('openai-api-key').value = settings.openai.apiKey || '';
        document.getElementById('openai-model').value = settings.openai.model || 'gpt-5-mini';
        document.getElementById('openai-host').value = settings.openai.host || '';
        document.getElementById('openai-path').value = settings.openai.path || '';
      } else if (settings.provider === 'claude' && settings.claude) {
        document.getElementById('claude-api-key').value = settings.claude.apiKey || '';
        document.getElementById('claude-model').value = settings.claude.model || 'claude-haiku-4-5-20251001';
        document.getElementById('claude-host').value = settings.claude.host || '';
        document.getElementById('claude-path').value = settings.claude.path || '';
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
    
    // Cache
    if (settings.cache) {
      document.getElementById('cache-max-entries').value = settings.cache.maxEntries || 500;
      const ttlDays = Math.floor((settings.cache.ttl || (7 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
      document.getElementById('cache-ttl').value = ttlDays;
    }
  } catch (err) {
    console.error('Load settings failed:', err);
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
    console.error('Load cache stats failed:', err);
  }
}

// Load telemetry
async function loadTelemetry() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getTelemetry' });
    if (response.success) {
      const stats = response.data;
      document.getElementById('total-translations').textContent = stats.totalTranslations || 0;
      document.getElementById('cache-hits').textContent = stats.cacheHits || 0;
      document.getElementById('api-calls').textContent = stats.apiCalls || 0;
      document.getElementById('errors').textContent = stats.errors || 0;
    }
  } catch (err) {
    console.error('Load telemetry failed:', err);
  }
}

// Show notification
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
  }, 5000);
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
loadSettingsUI();
loadCacheStats();
loadTelemetry();

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
