/**
 * DOM Utility Functions for Content Scripts
 *
 * Provides safe DOM manipulation utilities with:
 * - XSS prevention through HTML escaping
 * - Smart element positioning that respects viewport boundaries
 * - Text selection handling
 * - Viewport detection utilities
 *
 * @module dom
 *
 * @example
 * import { createElement, escapeHtml, getSelection } from './utils/dom.js';
 *
 * // Create safe element
 * const div = createElement('div', 'my-class', { 'data-id': '123' });
 *
 * // Escape user input
 * div.innerHTML = escapeHtml(userInput);
 *
 * // Get current text selection
 * const { text, rect } = getSelection();
 */

/**
 * Escape HTML to prevent XSS attacks
 *
 * Converts HTML special characters to their entity equivalents to prevent
 * malicious code execution when inserting user-provided content.
 *
 * @param {string} html - HTML string to escape
 * @returns {string} Escaped HTML safe for innerHTML
 *
 * @example
 * const userInput = '<script>alert("xss")</script>';
 * const safe = escapeHtml(userInput);
 * element.innerHTML = safe; // Displays as text, not executed
 * // Output: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;
 */
export function escapeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Create element with class and attributes
 * @param {string} tag - HTML tag name
 * @param {string|string[]} className - Class name(s)
 * @param {object} attributes - Additional attributes
 * @returns {HTMLElement}
 */
export function createElement(tag, className = '', attributes = {}) {
  const element = document.createElement(tag);

  if (className) {
    if (Array.isArray(className)) {
      element.classList.add(...className);
    } else {
      element.className = className;
    }
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
}

/**
 * Remove all children from an element
 * @param {HTMLElement} element - Element to clear
 */
export function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Get selected text and range
 * @returns {{text: string, range: Range|null, rect: DOMRect|null}}
 */
export function getSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { text: '', range: null, rect: null };
  }

  const range = selection.getRangeAt(0);
  const text = selection.toString().trim();
  const rect = range.getBoundingClientRect();

  return { text, range, rect };
}

/**
 * Check if element is in viewport
 * @param {HTMLElement} element - Element to check
 * @returns {boolean}
 */
export function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Position element near a rect
 * @param {HTMLElement} element - Element to position
 * @param {DOMRect} rect - Reference rect
 * @param {number} offset - Offset in pixels
 */
export function positionNearRect(element, rect, offset = 5) {
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // Add element to DOM temporarily to get its dimensions
  const tempParent = element.parentNode;
  if (!tempParent) {
    document.body.appendChild(element);
  }

  const elementRect = element.getBoundingClientRect();
  const elementWidth = elementRect.width || element.offsetWidth || 320; // fallback width
  const elementHeight = elementRect.height || element.offsetHeight || 100; // fallback height

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  // Get actual selection end position
  const selection = window.getSelection();
  let actualRight = rect.right;
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    // Use the last rect (end of selection)
    if (rects.length > 0) {
      const lastRect = rects[rects.length - 1];
      actualRight = lastRect.right;
    }
  }

  let left = actualRight + scrollX + offset;
  let top = rect.bottom + scrollY + 5;

  // Check if element goes beyond right edge
  if (actualRight + offset + elementWidth > viewportWidth) {
    // Position to the left of selection
    left = actualRight + scrollX - elementWidth - offset;

    // If still off-screen, align to right edge
    if (left < scrollX) {
      left = viewportWidth + scrollX - elementWidth - 10;
    }
  }

  // Check if element goes beyond bottom edge
  if (rect.bottom + 5 + elementHeight > scrollY + viewportHeight) {
    // Position above selection
    top = rect.top + scrollY - elementHeight - 5;

    // If still off-screen, align to bottom edge
    if (top < scrollY) {
      top = scrollY + 10;
    }
  }

  element.style.position = 'absolute';
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.zIndex = '999999';
}
