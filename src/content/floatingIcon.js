/**
 * Floating Icon Component
 */

import { createElement, positionNearRect } from '../utils/dom.js';
import { showMiniPopup } from './miniPopup.js';

let floatingIcon = null;
let currentSelection = null;

/**
 * Show floating icon near selection
 * @param {object} selection - Selection object with text, range, rect
 */
export function showFloatingIcon(selection) {
  // Remove existing icon
  hideFloatingIcon();

  currentSelection = selection;

  // Create icon
  floatingIcon = createElement('div', 'smart-translator-icon');
  floatingIcon.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 8h14M5 12h9m-9 4h6m4-8v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;

  // Position near selection
  positionNearRect(floatingIcon, selection.rect);

  // Add event listeners
  floatingIcon.addEventListener('mouseenter', handleIconHover);
  floatingIcon.addEventListener('click', handleIconClick);

  document.body.appendChild(floatingIcon);
}

/**
 * Hide floating icon
 */
export function hideFloatingIcon() {
  if (floatingIcon && floatingIcon.parentNode) {
    floatingIcon.removeEventListener('mouseenter', handleIconHover);
    floatingIcon.removeEventListener('click', handleIconClick);
    floatingIcon.parentNode.removeChild(floatingIcon);
    floatingIcon = null;
  }
}

/**
 * Handle icon hover
 */
function handleIconHover() {
  if (currentSelection) {
    showMiniPopup(currentSelection);
  }
}

/**
 * Handle icon click
 */
function handleIconClick(event) {
  event.stopPropagation();
  if (currentSelection) {
    showMiniPopup(currentSelection);
  }
}
