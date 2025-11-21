/**
 * Side Panel Script
 */

import { getTargetLanguages } from '../config/defaults.js';
import { error as logError } from '../utils/logger.js';

// Load saved language preferences
async function loadLanguagePreferences() {
  try {
    const result = await chrome.storage.local.get('sidePanelLanguages');
    return result.sidePanelLanguages || ['vi', 'en']; // Default: Vietnamese and English
  } catch (err) {
    logError('Failed to load language preferences:', err);
    return ['vi', 'en'];
  }
}

// Save language preferences
async function saveLanguagePreferences(langs) {
  try {
    await chrome.storage.local.set({ sidePanelLanguages: langs });
  } catch (err) {
    logError('Failed to save language preferences:', err);
  }
}

// Initialize language pills
async function initLanguages() {
  const allLanguages = getTargetLanguages();
  // Show only these 4 languages
  const allowedCodes = ['vi', 'ja', 'en', 'zh'];
  const languages = allLanguages.filter((lang) => allowedCodes.includes(lang.code));
  const selected = await loadLanguagePreferences();
  const container = document.getElementById('target-langs');

  languages.forEach(({ code, name, flag }) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'sp-lang-pill';
    pill.dataset.lang = code;
    pill.textContent = `${flag} ${name}`;

    if (selected.includes(code)) {
      pill.classList.add('active');
    }

    // Toggle selection on click
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
    });

    container.appendChild(pill);
  });
}

// Handle translation
async function handleTranslate() {
  const text = document.getElementById('input-text').value.trim();
  if (!text) {
    showError('Please enter text to translate');
    return;
  }

  const activePills = document.querySelectorAll('.sp-lang-pill.active');
  const targetLangs = Array.from(activePills).map((pill) => pill.dataset.lang);

  if (targetLangs.length === 0) {
    showError('Please select at least one target language');
    return;
  }

  // Save preferences
  await saveLanguagePreferences(targetLangs);

  // Show loading
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '<div class="sp-loading">Translating...</div>';

  // Translate to each language
  const results = {};
  for (const lang of targetLangs) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'translate',
        payload: { text, from: 'auto', to: lang },
      });

      if (response.success) {
        results[lang] = { success: true, data: response.data, fromCache: response.fromCache };
      } else {
        results[lang] = { success: false, error: response.error };
      }
    } catch (err) {
      results[lang] = { success: false, error: err.message };
    }
  }

  // Display results
  displayResults(results);
}

// Display translation results
function displayResults(results) {
  const languages = getTargetLanguages();
  const langMap = Object.fromEntries(languages.map((l) => [l.code, l]));

  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  Object.entries(results).forEach(([lang, result]) => {
    const langInfo = langMap[lang];
    const resultCard = document.createElement('div');
    resultCard.className = 'sp-result-card';

    if (result.success) {
      resultCard.innerHTML = `
        <div class="sp-result-header">
          <h4>${langInfo.flag} ${langInfo.name}</h4>
          <div class="sp-result-actions">
            ${result.fromCache ? '<span class="sp-cache-badge">⚡ Cache</span>' : ''}
            <button class="sp-btn-copy" data-text="${escapeHtml(result.data)}">Copy</button>
          </div>
        </div>
        <div class="sp-result-text">${escapeHtml(result.data)}</div>
      `;
    } else {
      resultCard.innerHTML = `
        <div class="sp-result-header">
          <h4>${langInfo.flag} ${langInfo.name}</h4>
        </div>
        <div class="sp-result-error">❌ ${escapeHtml(result.error)}</div>
      `;
    }

    resultsDiv.appendChild(resultCard);
  });

  // Add copy handlers
  document.querySelectorAll('.sp-btn-copy').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const text = e.target.dataset.text;
      try {
        await navigator.clipboard.writeText(text);
        e.target.textContent = 'Copied!';
        setTimeout(() => {
          e.target.textContent = 'Copy';
        }, 2000);
      } catch (err) {
        logError('Copy failed:', err);
      }
    });
  });
}

// Show error message
function showError(message) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = `
    <div class="sp-error-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Character count
function updateCharCount() {
  const text = document.getElementById('input-text').value;
  document.getElementById('char-count').textContent = `${text.length} characters`;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await initLanguages();

  document.getElementById('translate-btn').addEventListener('click', handleTranslate);

  document.getElementById('clear-btn').addEventListener('click', () => {
    document.getElementById('input-text').value = '';
    updateCharCount();
    document.getElementById('results').innerHTML = `
      <div class="sp-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <p>Select languages and click Translate</p>
      </div>
    `;
  });

  document.getElementById('input-text').addEventListener('input', updateCharCount);

  // Handle Enter key (Ctrl+Enter to translate)
  document.getElementById('input-text').addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      handleTranslate();
    }
  });
});
