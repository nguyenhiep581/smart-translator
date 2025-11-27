/**
 * Content Script - Main entry point
 */

import { debug, error, initLogger } from '../utils/logger.js';
import { getSelection } from '../utils/dom.js';
import { showFloatingIcon, hideFloatingIcon } from './floatingIcon.js';
import { isMiniPopupVisible, isExpandPanelOpen, showMiniPopup } from './miniPopup.js';
import { startScreenshotTranslate } from './screenshotOverlay.js';

let ctrlShortcutEnabled = false; // Default to disabled
// Initialize logger with saved debug mode
(async () => {
  try {
    const result = await chrome.storage.local.get('config');
    const debugMode = result.config?.debugMode || false;
    ctrlShortcutEnabled = result.config?.enableCtrlShortcut === true; // Default to false
    initLogger(debugMode);
    debug('Content script initialized with debug mode:', debugMode);
    debug('Ctrl shortcut enabled:', ctrlShortcutEnabled);
  } catch (err) {
    error('Failed to initialize logger:', err);
  }
})();

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.config) {
    const newConfig = changes.config.newValue;
    if (newConfig && newConfig.enableCtrlShortcut !== undefined) {
      ctrlShortcutEnabled = newConfig.enableCtrlShortcut;
      debug('Ctrl shortcut setting updated:', ctrlShortcutEnabled);
    }
    if (newConfig && newConfig.debugMode !== undefined) {
      initLogger(newConfig.debugMode);
    }
  }
});

let selectionTimeout = null;

// Listen for text selection
document.addEventListener('mouseup', handleMouseUp);
document.addEventListener('selectionchange', handleSelectionChange);
document.addEventListener('keydown', handleKeyDown);

/**
 * Handle keyboard shortcut (Ctrl to show translation)
 */
function handleKeyDown(event) {
  // Check if shortcut is enabled
  if (!ctrlShortcutEnabled) {
    return;
  }

  // Only trigger on Ctrl/Cmd key alone (no other keys like C, V, A, etc.)
  // event.key will be 'Control' or 'Meta' when only modifier is pressed
  const isOnlyModifier = event.key === 'Control' || event.key === 'Meta';

  if (!isOnlyModifier) {
    return;
  }

  // Check if Ctrl/Cmd is pressed
  if (event.ctrlKey || event.metaKey) {
    const selection = getSelection();

    // If there's selected text and no UI is visible, show mini popup directly
    if (
      selection.text &&
      selection.text.length > 0 &&
      !isMiniPopupVisible() &&
      !isExpandPanelOpen()
    ) {
      event.preventDefault();
      hideFloatingIcon(); // Hide floating icon if visible
      showMiniPopup(selection);
    }
  }
}

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

    // Don't show floating icon if mini popup or expand panel is already visible
    const hasVisibleUI = isMiniPopupVisible() || isExpandPanelOpen();

    if (selection.text && selection.text.length > 0 && !hasVisibleUI) {
      showFloatingIcon(selection);
    } else if (!hasVisibleUI) {
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'startScreenshotTranslate') {
    startScreenshotTranslate();
    sendResponse?.({ success: true });
  }
});
