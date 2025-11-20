/**
 * Popup Script
 */

// Navigation
document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    const section = item.dataset.section;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');

    // Show section
    document.querySelectorAll('.section').forEach((sec) => (sec.style.display = 'none'));
    document.getElementById(`${section}-section`).style.display = 'block';
  });
});

// Quick Translate
document.getElementById('translate-btn').addEventListener('click', async () => {
  const text = document.getElementById('input-text').value.trim();
  const toLang = document.getElementById('to-lang').value;

  if (!text) {
    return;
  }

  const outputArea = document.getElementById('output-area');
  const outputText = document.getElementById('output-text');

  outputArea.style.display = 'block';
  outputText.textContent = 'Translating...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'translate',
      payload: { text, from: 'auto', to: toLang },
    });

    if (response.success) {
      outputText.textContent = response.data;
    } else {
      outputText.textContent = `Error: ${response.error}`;
      outputText.style.color = '#EF4444';
    }
  } catch (err) {
    outputText.textContent = `Error: ${err.message}`;
    outputText.style.color = '#EF4444';
  }
});

// Copy output
document.getElementById('copy-output').addEventListener('click', async () => {
  const text = document.getElementById('output-text').textContent;
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('copy-output');
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.textContent = original;
    }, 2000);
  } catch (err) {
    console.error('Copy failed:', err);
  }
});

// Open full options
document.getElementById('open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
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

// Load settings
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getSettings' });
    if (response.success) {
      const config = response.data;
      document.getElementById('current-provider').textContent =
        config.provider.charAt(0).toUpperCase() + config.provider.slice(1);
    }
  } catch (err) {
    console.error('Load settings failed:', err);
  }
}

// Load cache status
async function loadCacheStatus() {
  try {
    // This would need a new message type to get cache stats
    document.getElementById('cache-status').textContent = 'Enabled';
  } catch (err) {
    console.error('Load cache status failed:', err);
  }
}

// Initialize
loadSettings();
loadCacheStatus();
