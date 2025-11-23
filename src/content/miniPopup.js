/**
 * Mini Popup Component
 */

import { createElement, escapeHtml, positionNearRect } from '../utils/dom.js';
import { generateLanguageOptions } from '../config/defaults.js';
import { ExpandPanel } from './popupExpand.js';
import { debug, error as logError } from '../utils/logger.js';

let miniPopup = null;
let currentTranslation = null;
let expandPanel = null;

/**
 * Check if mini popup is currently visible
 * @returns {boolean}
 */
export function isMiniPopupVisible() {
  return miniPopup !== null && document.body.contains(miniPopup);
}

/**
 * Check if expand panel is currently open
 * @returns {boolean}
 */
export function isExpandPanelOpen() {
  return expandPanel !== null && expandPanel.isOpen;
}

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
        ${generateLanguageOptions(defaultToLang)}
      </select>
    </div>
    <div class="st-original">${escapeHtml(selection.text)}</div>
    <div class="st-translation">
      <div class="st-loading">
        <span class="st-spinner" aria-hidden="true"></span>
        <span>Translating...</span>
      </div>
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
  currentTranslation = '';
  miniPopup.querySelectorAll('.st-btn').forEach((btn) => (btn.disabled = true));

  // Warn for long text
  const textLength = selection.text.length;
  let loadingMsg = 'Translating...';
  if (textLength > 500) {
    const estimatedSeconds = Math.ceil(textLength / 20); // Rough estimate
    loadingMsg = `Translating long text (~${estimatedSeconds}s)...`;
  }

  translationEl.innerHTML = `
    <div class="st-loading">
      <span class="st-spinner" aria-hidden="true"></span>
      <span>${escapeHtml(loadingMsg)}</span>
    </div>
    <div class="st-translation-text"></div>
  `;
  const textEl = translationEl.querySelector('.st-translation-text');
  const loadingEl = translationEl.querySelector('.st-loading');

  const startTime = performance.now();

  try {
    // Use port-based streaming for better UX
    const port = chrome.runtime.connect({ name: 'translate-stream' });

    let translatedText = '';
    let isComplete = false;

    port.onMessage.addListener((response) => {
      if (response.type === 'chunk') {
        // Append streaming chunk
        translatedText += response.chunk;
        textEl.textContent = translatedText;
      } else if (response.type === 'complete') {
        isComplete = true;
        currentTranslation = response.data;
        textEl.textContent = response.data;
        if (loadingEl) {
          loadingEl.remove();
        }

        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        debug(`Translation took ${duration}ms ${response.fromCache ? '(cached)' : '(streamed)'}`);

        if (response.fromCache) {
          translationEl.innerHTML = `<div class="st-translation-text">${escapeHtml(response.data)}</div>`;
          translationEl.innerHTML += '<div class="st-cache-indicator">⚡ From cache</div>';
        }

        // Enable buttons
        miniPopup.querySelectorAll('.st-btn').forEach((btn) => (btn.disabled = false));

        port.disconnect();
      } else if (response.type === 'error') {
        const errorMsg = response.error || 'Translation failed';
        translationEl.innerHTML = `<div class="st-error">${escapeHtml(errorMsg)}</div>`;

        // Show helpful message for timeout errors
        if (errorMsg.includes('timeout')) {
          translationEl.innerHTML +=
            '<div class="st-help">💡 Try selecting shorter text or check your API endpoint speed</div>';
        }

        port.disconnect();
      }
    });

    port.onDisconnect.addListener(() => {
      if (!isComplete && translatedText) {
        // Partial result received
        currentTranslation = translatedText;
      }
    });

    // Send translation request
    port.postMessage({
      text: selection.text,
      from: 'auto',
      to: toLang,
    });
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
