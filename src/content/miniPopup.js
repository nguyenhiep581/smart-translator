/**
 * Mini Popup Component
 */

import { createElement, escapeHtml, positionNearRect } from '../utils/dom.js';
import { LANGUAGES } from '../config/defaults.js';
import { ExpandPanel } from './popupExpand.js';
import { debug, error as logError } from '../utils/logger.js';

let miniPopup = null;
let currentTranslation = null;
let expandPanel = null;

/**
 * Show mini popup with translation
 * @param {object} selection - Selection object
 */
export async function showMiniPopup(selection) {
  // Remove existing popup
  hideMiniPopup();

  // Get saved language preference
  let defaultToLang = 'vi';
  try {
    const result = await chrome.storage.local.get('config');
    const config = result.config || {};
    defaultToLang = config.defaultToLang || 'vi';
  } catch (err) {
    // Use default if loading fails
  }

  // Create popup
  miniPopup = createElement('div', 'smart-translator-mini-popup');
  miniPopup.innerHTML = `
    <div class="st-header">
      <select class="st-from-lang" disabled>
        <option value="auto">Auto Detect</option>
      </select>
      <span class="st-arrow">→</span>
      <select class="st-to-lang">
        ${Object.entries(LANGUAGES)
    .filter(([code]) => code !== 'auto')
    .map(
      ([code, lang]) =>
        `<option value="${code}" ${
          code === defaultToLang ? 'selected' : ''
        }>${lang.name}</option>`,
    )
    .join('')}
      </select>
    </div>
    <div class="st-original">${escapeHtml(selection.text)}</div>
    <div class="st-translation">
      <div class="st-loading">Translating...</div>
    </div>
    <div class="st-actions">
      <button class="st-btn st-btn--ghost st-btn-copy" disabled>Copy</button>
      <button class="st-btn st-btn--ghost st-btn-replace" disabled>Replace</button>
      <button class="st-btn st-btn--ghost st-btn-expand" disabled>Expand</button>
    </div>
  `;

  // Position near selection
  positionNearRect(miniPopup, selection.rect, 10);

  // Add event listeners
  miniPopup.querySelector('.st-to-lang').addEventListener('change', async (e) => {
    const newLang = e.target.value;

    // Save to settings
    try {
      const result = await chrome.storage.local.get('config');
      const config = result.config || {};
      config.defaultToLang = newLang;
      await chrome.storage.local.set({ config });
    } catch (err) {
      // Silently fail if storage update fails
    }

    translateText(selection);
  });

  miniPopup.querySelector('.st-btn-copy').addEventListener('click', () => {
    copyTranslation();
  });

  miniPopup.querySelector('.st-btn-replace').addEventListener('click', () => {
    replaceSelection(selection);
  });

  miniPopup.querySelector('.st-btn-expand').addEventListener('click', () => {
    openExpandMode(selection);
  });

  // Close on click outside
  document.addEventListener('click', handleOutsideClick);

  document.body.appendChild(miniPopup);

  // Start translation
  translateText(selection);
}

/**
 * Hide mini popup
 */
export function hideMiniPopup() {
  if (miniPopup && miniPopup.parentNode) {
    document.removeEventListener('click', handleOutsideClick);
    miniPopup.parentNode.removeChild(miniPopup);
    miniPopup = null;
    currentTranslation = null;
  }
}

/**
 * Translate text
 */
async function translateText(selection) {
  const toLang = miniPopup.querySelector('.st-to-lang').value;
  const translationEl = miniPopup.querySelector('.st-translation');

  // Warn for long text
  const textLength = selection.text.length;
  let loadingMsg = 'Translating...';
  if (textLength > 500) {
    const estimatedSeconds = Math.ceil(textLength / 20); // Rough estimate
    loadingMsg = `Translating long text (~${estimatedSeconds}s)...`;
  }

  translationEl.innerHTML = `<div class="st-loading">${loadingMsg}</div>`;

  const startTime = performance.now();

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'translate',
      payload: {
        text: selection.text,
        from: 'auto',
        to: toLang,
      },
    });

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    debug(`Translation took ${duration}ms ${response.fromCache ? '(cached)' : '(API call)'}`);

    if (response.success) {
      currentTranslation = response.data;

      // Show with typewriter effect
      translationEl.innerHTML = '<div class="st-translation-text"></div>';
      const textEl = translationEl.querySelector('.st-translation-text');

      await typewriterEffect(textEl, response.data);

      if (response.fromCache) {
        translationEl.innerHTML += '<div class="st-cache-indicator">⚡ From cache</div>';
      }

      // Enable buttons
      miniPopup.querySelectorAll('.st-btn').forEach((btn) => (btn.disabled = false));
    } else {
      const errorMsg = response.error || 'Translation failed';
      translationEl.innerHTML = `<div class="st-error">${escapeHtml(errorMsg)}</div>`;

      // Show helpful message for timeout errors
      if (errorMsg.includes('timeout')) {
        translationEl.innerHTML +=
          '<div class="st-help">💡 Try selecting shorter text or check your API endpoint speed</div>';
      }
    }
  } catch (err) {
    // Handle extension context invalidated error
    if (err.message.includes('Extension context invalidated')) {
      translationEl.innerHTML =
        '<div class="st-error">Extension was reloaded. Please refresh this page.</div>';
    } else if (err.message.includes('timeout')) {
      translationEl.innerHTML =
        '<div class="st-error">Translation timeout - API is too slow</div><div class="st-help">💡 Try shorter text or check API endpoint</div>';
    } else {
      translationEl.innerHTML = `<div class="st-error">Translation failed: ${escapeHtml(
        err.message,
      )}</div>`;
    }
  }
}

/**
 * Typewriter effect for displaying text
 */
async function typewriterEffect(element, text, speed = 20) {
  element.textContent = '';
  element.classList.add('fade-in');

  for (let i = 0; i < text.length; i++) {
    element.textContent += text[i];
    if (i % 3 === 0) {
      // Update every 3 characters for better performance
      await new Promise((resolve) => setTimeout(resolve, speed));
    }
  }

  // Ensure full text is shown
  element.textContent = text;
}

/**
 * Copy translation to clipboard
 */
async function copyTranslation() {
  if (!currentTranslation) {
    return;
  }

  try {
    await navigator.clipboard.writeText(currentTranslation);

    // Show feedback
    const btn = miniPopup.querySelector('.st-btn-copy');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  } catch (err) {
    logError('Copy failed:', err);
  }
}

/**
 * Replace selected text with translation
 */
function replaceSelection(selection) {
  if (!currentTranslation || !selection.range) {
    return;
  }

  try {
    selection.range.deleteContents();
    selection.range.insertNode(document.createTextNode(currentTranslation));
    hideMiniPopup();
  } catch (err) {
    logError('Replace failed:', err);
  }
}

/**
 * Open expand mode
 */
function openExpandMode(selection) {
  if (!expandPanel) {
    expandPanel = new ExpandPanel();
  }

  expandPanel.open(selection.text, currentTranslation || '');
  hideMiniPopup();
}

/**
 * Handle click outside popup
 */
function handleOutsideClick(event) {
  if (!event.target.closest('.smart-translator-mini-popup, .smart-translator-icon')) {
    hideMiniPopup();
  }
}
