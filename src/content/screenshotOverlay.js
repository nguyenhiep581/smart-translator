import { hideFloatingIcon } from './floatingIcon.js';
import { hideMiniPopup, showMiniPopupForText } from './miniPopup.js';
import { debug, error as logError } from '../utils/logger.js';

let overlay = null;
let selectionBox = null;
let startPoint = null;
let shadeTop = null;
let shadeBottom = null;
let shadeLeft = null;
let shadeRight = null;

export function startScreenshotTranslate() {
  if (overlay) {
    return;
  }
  hideFloatingIcon();
  hideMiniPopup();
  createOverlay();
}

function createOverlay() {
  overlay = document.createElement('div');
  overlay.className = 'st-shot-overlay';
  overlay.tabIndex = -1;
  overlay.innerHTML = `
    <div class="st-shot-instructions">
      Click and drag to select an area. Press Esc to cancel.
    </div>
  `;

  shadeTop = document.createElement('div');
  shadeBottom = document.createElement('div');
  shadeLeft = document.createElement('div');
  shadeRight = document.createElement('div');
  [shadeTop, shadeBottom, shadeLeft, shadeRight].forEach((el) => {
    el.className = 'st-shot-shade';
    overlay.appendChild(el);
  });

  overlay.addEventListener('mousedown', handleMouseDown);
  overlay.addEventListener('mousemove', handleMouseMove);
  overlay.addEventListener('mouseup', handleMouseUp);
  overlay.addEventListener('keydown', handleOverlayKeydown);

  document.body.appendChild(overlay);
  updateShades({ left: 0, top: 0, width: 0, height: 0 });
  overlay.focus();
}

function destroyOverlay() {
  if (overlay) {
    overlay.removeEventListener('mousedown', handleMouseDown);
    overlay.removeEventListener('mousemove', handleMouseMove);
    overlay.removeEventListener('mouseup', handleMouseUp);
    overlay.removeEventListener('keydown', handleOverlayKeydown);
    overlay.remove();
    overlay = null;
  }
  [shadeTop, shadeBottom, shadeLeft, shadeRight].forEach((el) => el && el.remove());
  shadeTop = shadeBottom = shadeLeft = shadeRight = null;
  if (selectionBox) {
    selectionBox.remove();
    selectionBox = null;
  }
  startPoint = null;
}

function handleOverlayKeydown(event) {
  if (event.key === 'Escape') {
    destroyOverlay();
  }
}

function handleMouseDown(event) {
  startPoint = { x: event.clientX, y: event.clientY };
  if (!selectionBox) {
    selectionBox = document.createElement('div');
    selectionBox.className = 'st-shot-selection';
    overlay.appendChild(selectionBox);
  }
  updateSelectionBox(startPoint.x, startPoint.y, startPoint.x, startPoint.y);
}

function handleMouseMove(event) {
  if (!startPoint || !selectionBox) {
    return;
  }
  updateSelectionBox(startPoint.x, startPoint.y, event.clientX, event.clientY);
}

function handleMouseUp(event) {
  if (!startPoint) {
    return;
  }
  const rect = normalizeRect(startPoint.x, startPoint.y, event.clientX, event.clientY);
  destroyOverlay();

  if (rect.width < 5 || rect.height < 5) {
    return;
  }
  processSelection(rect);
}

function updateSelectionBox(x1, y1, x2, y2) {
  const rect = normalizeRect(x1, y1, x2, y2);
  selectionBox.style.left = `${rect.left}px`;
  selectionBox.style.top = `${rect.top}px`;
  selectionBox.style.width = `${rect.width}px`;
  selectionBox.style.height = `${rect.height}px`;
  updateShades(rect);
}

function normalizeRect(x1, y1, x2, y2) {
  const rawLeft = Math.min(x1, x2);
  const rawTop = Math.min(y1, y2);
  const rawWidth = Math.abs(x2 - x1);
  const rawHeight = Math.abs(y2 - y1);

  const left = Math.max(0, Math.min(rawLeft, window.innerWidth));
  const top = Math.max(0, Math.min(rawTop, window.innerHeight));
  const right = Math.min(window.innerWidth, left + rawWidth);
  const bottom = Math.min(window.innerHeight, top + rawHeight);

  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function updateShades(rect) {
  if (!shadeTop || !shadeBottom || !shadeLeft || !shadeRight) {
    return;
  }
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  shadeTop.style.left = '0px';
  shadeTop.style.top = '0px';
  shadeTop.style.width = `${viewportWidth}px`;
  shadeTop.style.height = `${rect.top}px`;

  shadeBottom.style.left = '0px';
  shadeBottom.style.top = `${rect.top + rect.height}px`;
  shadeBottom.style.width = `${viewportWidth}px`;
  shadeBottom.style.height = `${Math.max(0, viewportHeight - (rect.top + rect.height))}px`;

  shadeLeft.style.left = '0px';
  shadeLeft.style.top = `${rect.top}px`;
  shadeLeft.style.width = `${rect.left}px`;
  shadeLeft.style.height = `${rect.height}px`;

  shadeRight.style.left = `${rect.left + rect.width}px`;
  shadeRight.style.top = `${rect.top}px`;
  shadeRight.style.width = `${Math.max(0, viewportWidth - (rect.left + rect.width))}px`;
  shadeRight.style.height = `${rect.height}px`;
}

async function processSelection(rect) {
  try {
    const capture = await chrome.runtime.sendMessage({ type: 'captureVisibleTab' });
    if (!capture?.success || !capture.dataUrl) {
      throw new Error(capture?.error || 'Screenshot capture failed');
    }

    showMiniPopupForText({
      text: '<div class="st-loading"><span class="st-spinner"></span><span>Extracting text...</span></div>',
      rect,
      translatedText:
        '<div class="st-loading"><span class="st-spinner"></span><span>Extracting text...</span></div>',
      disableReplace: true,
      disableExpand: true,
    });

    const imageBase64 = await cropAndOptimizeImage(capture.dataUrl, rect);
    const estimatedBytes = Math.ceil((imageBase64.length * 3) / 4);
    debug('OCR payload size', {
      base64Length: imageBase64.length,
      approxBytes: estimatedBytes,
      approxKB: Math.round(estimatedBytes / 1024),
    });

    const ocr = await chrome.runtime.sendMessage({
      type: 'ocrAndTranslate',
      payload: { imageBase64 },
    });

    showMiniPopupForText({
      text: ocr?.originalText || '',
      rect,
      translatedText: ocr?.translatedText || '',
      disableReplace: true,
      disableExpand: true,
    });
  } catch (err) {
    logError('Screenshot translate failed:', err);
    hideMiniPopup();
    alert(err.message || 'Screenshot translate failed');
  }
}

async function cropAndOptimizeImage(dataUrl, rect) {
  const img = await loadImage(dataUrl);
  const dpr = window.devicePixelRatio || 1;
  const maxDimension = 1600;
  const scaleLimit = Math.min(
    maxDimension / Math.max(rect.width, 1),
    maxDimension / Math.max(rect.height, 1),
  );
  const scale = Math.max(1, Math.min(dpr, scaleLimit, 2));

  let canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
  }

  debug('Screenshot crop info', {
    captureWidth: img.width,
    captureHeight: img.height,
    rectWidth: rect.width,
    rectHeight: rect.height,
    deviceScale: dpr,
    targetWidth: canvas.width,
    targetHeight: canvas.height,
    appliedScale: scale,
  });

  ctx.drawImage(
    img,
    Math.round(rect.left * scale),
    Math.round(rect.top * scale),
    Math.round(rect.width * scale),
    Math.round(rect.height * scale),
    0,
    0,
    canvas.width,
    canvas.height,
  );

  whitenBackground(canvas);
  increaseContrast(canvas);

  const maxSide = Math.max(canvas.width, canvas.height);
  if (maxSide < 800) {
    canvas = upscaleCanvas(canvas, 1.5);
  }

  applyGrayscale(canvas);

  const optimizedBase64 = canvas.toDataURL('image/png').split(',')[1];
  return optimizedBase64;
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

function applyGrayscale(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = avg;
    data[i + 1] = avg;
    data[i + 2] = avg;
  }
  ctx.putImageData(imageData, 0, 0);
}

function increaseContrast(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const contrast = 128;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte(factor * (data[i] - 128) + 128);
    data[i + 1] = clampByte(factor * (data[i + 1] - 128) + 128);
    data[i + 2] = clampByte(factor * (data[i + 2] - 128) + 128);
  }
  ctx.putImageData(imageData, 0, 0);
}

function clampByte(value) {
  return Math.max(0, Math.min(255, value));
}

function whitenBackground(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
}

function upscaleCanvas(canvas, scale = 2) {
  const newCanvas = document.createElement('canvas');
  newCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  newCanvas.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = newCanvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, newCanvas.width, newCanvas.height);
  }
  return newCanvas;
}
