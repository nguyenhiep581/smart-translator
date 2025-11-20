/**
 * Content Script - Main entry point
 */

import { debug, error, initLogger } from '../utils/logger.js';
import { getSelection } from '../utils/dom.js';
import { showFloatingIcon, hideFloatingIcon } from './floatingIcon.js';

// Initialize logger with saved debug mode
(async () => {
  try {
    const result = await chrome.storage.local.get('config');
    const debugMode = result.config?.debugMode || false;
    initLogger(debugMode);
    debug('Content script initialized with debug mode:', debugMode);
  } catch (err) {
    console.error('Failed to initialize logger:', err);
  }
})();

let selectionTimeout = null;

// Listen for text selection
document.addEventListener('mouseup', handleMouseUp);
document.addEventListener('selectionchange', handleSelectionChange);

/**
 * Handle mouse up event
 */
function handleMouseUp(event) {
  // Ignore if clicking on our own UI elements
  if (
    event.target.closest(
      '.smart-translator-icon, .smart-translator-mini-popup, .smart-translator-expand-panel',
    )
  ) {
    return;
  }

  clearTimeout(selectionTimeout);
  selectionTimeout = setTimeout(() => {
    const selection = getSelection();

    if (selection.text && selection.text.length > 0) {
      showFloatingIcon(selection);
    } else {
      hideFloatingIcon();
    }
  }, 100);
}

/**
 * Handle selection change
 */
function handleSelectionChange() {
  const selection = window.getSelection();

  // Hide icon if selection is cleared
  if (!selection || selection.toString().trim().length === 0) {
    hideFloatingIcon();
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  hideFloatingIcon();
});
