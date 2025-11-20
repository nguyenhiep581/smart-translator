/**
 * Expand Mode Panel - Full Translation Editor
 */

import { debug, error as logError } from '../utils/logger.js';

export class ExpandPanel {
  constructor() {
    this.panel = null;
    this.sourceText = '';
    this.translatedText = '';
    this.isOpen = false;
  }

  /**
   * Open expand panel with text
   */
  async open(sourceText, translatedText = '') {
    this.sourceText = sourceText;
    this.translatedText = translatedText;
    this.isOpen = true;

    if (!this.panel) {
      await this.createPanel();
    }

    this.updateContent();
    this.show();

    // Focus on target textarea if no translation yet
    if (!translatedText) {
      this.panel.querySelector('#expand-target').focus();
    }
  }

  /**
   * Close expand panel
   */
  close() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    this.isOpen = false;
  }

  /**
   * Create panel DOM structure
   */
  async createPanel() {
    // Get saved language preference
    let defaultToLang = 'vi';
    try {
      const result = await chrome.storage.local.get('config');
      const config = result.config || {};
      defaultToLang = config.defaultToLang || 'vi';
    } catch (err) {
      // Use default if loading fails
    }

    this.panel = document.createElement('div');
    this.panel.id = 'st-expand-panel';
    this.panel.innerHTML = `
      <div class="st-expand-overlay"></div>
      <div class="st-expand-container">
        <div class="st-expand-header">
          <h2 class="st-expand-title">Translation Editor</h2>
          <div class="st-expand-actions">
            <button class="st-expand-btn st-btn-copy" title="Copy Translation">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
            <button class="st-expand-btn st-btn-close" title="Close (Esc)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="st-expand-content">
          <div class="st-expand-pane">
            <div class="st-pane-header">
              <div class="st-pane-header-left">
                <span class="st-pane-label">Source</span>
                <span class="st-pane-info" id="source-info"></span>
              </div>
            </div>
            <div class="st-pane-body">
              <textarea
                id="expand-source"
                class="st-expand-textarea"
                readonly
              ></textarea>
            </div>
          </div>

          <div class="st-expand-divider"></div>

          <div class="st-expand-pane">
            <div class="st-pane-header">
              <div class="st-pane-header-left">
                <span class="st-pane-label">Translation</span>
              </div>
              <select id="expand-target-lang" class="st-lang-select">
                <option value="en" ${defaultToLang === 'en' ? 'selected' : ''}>English</option>
                <option value="ja" ${defaultToLang === 'ja' ? 'selected' : ''}>Japanese</option>
                <option value="vi" ${defaultToLang === 'vi' ? 'selected' : ''}>Vietnamese</option>
                <option value="zh" ${defaultToLang === 'zh' ? 'selected' : ''}>Chinese</option>
              </select>
            </div>
            <div class="st-pane-body">
              <textarea
                id="expand-target"
                class="st-expand-textarea"
                placeholder="Translation will appear here..."
              ></textarea>
            </div>
          </div>
        </div>

        <div class="st-expand-footer">
          <button id="expand-translate-btn" class="st-btn st-btn-primary">
            Translate
          </button>
          <button id="expand-replace-btn" class="st-btn st-btn-secondary">
            Replace Original
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.panel);
    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    this.panel.querySelector('.st-btn-close').addEventListener('click', () => {
      this.close();
    });

    // Overlay click
    this.panel.querySelector('.st-expand-overlay').addEventListener('click', () => {
      this.close();
    });

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Language change - save to settings and auto-translate
    this.panel.querySelector('#expand-target-lang').addEventListener('change', async (e) => {
      const newLang = e.target.value;
      try {
        const result = await chrome.storage.local.get('config');
        const config = result.config || {};
        config.defaultToLang = newLang;
        await chrome.storage.local.set({ config });
      } catch (err) {
        // Silently fail if storage update fails
      }

      // Auto-translate with new language
      await this.translate();
    });

    // Copy button
    this.panel.querySelector('.st-btn-copy').addEventListener('click', async () => {
      const text = this.panel.querySelector('#expand-target').value;
      try {
        await navigator.clipboard.writeText(text);
        this.showNotification('Copied to clipboard');
      } catch (err) {
        logError('Copy failed:', err);
      }
    });

    // Translate button
    this.panel.querySelector('#expand-translate-btn').addEventListener('click', async () => {
      await this.translate();
    });

    // Replace button
    this.panel.querySelector('#expand-replace-btn').addEventListener('click', () => {
      this.replaceOriginal();
    });
  }

  /**
   * Update panel content
   */
  updateContent() {
    const sourceTextarea = this.panel.querySelector('#expand-source');
    const targetTextarea = this.panel.querySelector('#expand-target');

    sourceTextarea.value = this.sourceText;
    targetTextarea.value = this.translatedText;

    // Update source info
    const wordCount = this.sourceText.split(/\s+/).filter((w) => w).length;
    const charCount = this.sourceText.length;
    this.panel.querySelector('#source-info').textContent = `${wordCount} words, ${charCount} chars`;
  }

  /**
   * Show panel with animation
   */
  show() {
    requestAnimationFrame(() => {
      this.panel.classList.add('st-expand-open');
    });
  }

  /**
   * Translate text
   */
  async translate() {
    const targetLang = this.panel.querySelector('#expand-target-lang').value;
    const targetTextarea = this.panel.querySelector('#expand-target');
    const translateBtn = this.panel.querySelector('#expand-translate-btn');

    translateBtn.textContent = 'Translating...';
    translateBtn.disabled = true;
    targetTextarea.value = '';

    const startTime = performance.now();

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'translate',
        payload: {
          text: this.sourceText,
          from: 'auto',
          to: targetLang,
        },
      });

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      debug(
        `Expand translation took ${duration}ms ${response.fromCache ? '(cached)' : '(API call)'}`,
      );

      if (response.success) {
        this.translatedText = response.data;

        // Typewriter effect
        await this.typewriterEffect(targetTextarea, this.translatedText);
      } else {
        targetTextarea.value = `Error: ${response.error}`;
      }
    } catch (err) {
      // Handle extension context invalidated error
      if (err.message.includes('Extension context invalidated')) {
        targetTextarea.value = 'Extension was reloaded. Please refresh this page.';
      } else {
        targetTextarea.value = `Error: ${err.message}`;
      }
    } finally {
      translateBtn.textContent = 'Translate';
      translateBtn.disabled = false;
    }
  }

  /**
   * Typewriter effect for textarea
   */
  async typewriterEffect(textarea, text, speed = 15) {
    textarea.value = '';

    for (let i = 0; i < text.length; i++) {
      textarea.value += text[i];
      if (i % 3 === 0) {
        // Update every 3 characters
        await new Promise((resolve) => setTimeout(resolve, speed));
      }
    }

    // Ensure full text is shown
    textarea.value = text;
  }

  /**
   * Replace original text with translation
   */
  replaceOriginal() {
    const translatedText = this.panel.querySelector('#expand-target').value;
    if (!translatedText) {
      return;
    }

    // Send message to content script to replace text
    chrome.runtime.sendMessage({
      type: 'replaceText',
      payload: { text: translatedText },
    });

    this.showNotification('Text replaced');
    this.close();
  }

  /**
   * Show temporary notification
   */
  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'st-expand-notification';
    notification.textContent = message;
    this.panel.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('st-fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }
}

// Export singleton instance
export const expandPanel = new ExpandPanel();
