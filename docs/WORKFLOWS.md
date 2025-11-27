# Workflows Overview

Developer-facing descriptions of how major user flows work and where to look in code. Use this to trace data across popup/content/background.

---

## Screenshot Translate (OCR)

**Trigger**
- Alt+D (manifest `screenshot_translate`) or popup button `#screenshot-translate`.
- Background (`src/background/background.js`) listens to commands and sends `{type: 'startScreenshotTranslate'}` to active tab.
- Content listener in `src/content/content.js` calls `startScreenshotTranslate` from `screenshotOverlay.js`.

**Overlay + selection**
- `screenshotOverlay.js` builds a clear overlay with four shade divs (`.st-shot-shade`), dimming everything except the selection hole.
- User drags; `normalizeRect` clamps to viewport; `updateShades` redraws the mask while keeping the selected area clear.

**Image prep**
- `cropAndOptimizeImage`:
  - Captures via `chrome.tabs.captureVisibleTab` (PNG data URL).
  - Scales selection up to `scale<=2` and `maxDimension=1600`; smoothing off.
  - Draws selection, then:
    - `whitenBackground` fills white behind content.
    - `increaseContrast` (strong factor) to boost edges.
    - `applyGrayscale` removes color noise.
    - `upscaleCanvas` to 1.5x if the region is small (<800px max side).
  - Exports as PNG base64 for best OCR fidelity.
  - Logs crop + payload sizes (`debug`).

**Send to background**
- Content calls `chrome.runtime.sendMessage({ type: 'ocrAndTranslate', payload: { imageBase64 } })`.
- Mini popup shows loading spinner via `showMiniPopupForText` (HTML allowed; replace/expand disabled).

**Background OCR + translate**
- `backgroundMessageRouter.handleMessage('ocrAndTranslate')`:
  - Resolves provider (OpenAI/Claude/Gemini).
  - Calls provider OCR (image_url/base64 for OpenAI; image block for Claude; inlineData for Gemini).
  - Then translates OCR text using existing translator pipeline (cache-aware).
  - Returns `{ originalText, translatedText, fromCache }`.

**UI response**
- Content updates the shared mini popup with OCR text + translation (copy enabled; replace/expand disabled).
- Errors: hides popup and alerts the user.

**Key files**
- Content: `src/content/screenshotOverlay.js`, `src/content/ui.css`, `src/content/miniPopup.js`
- Background: `src/background/backgroundMessageRouter.js`, translators
- Manifest: `manifest.json` (commands)

---

## Inline Translate (selection → mini popup)

**Trigger**
- User selects text; content script (`content.js`) shows floating icon/mini popup.
- Ctrl/Cmd shortcut can open mini popup directly if enabled in settings.

**Flow**
- `miniPopup.js` opens near selection; connects to background via port `translate-stream`.
- Background resolves provider, checks cache, streams translation chunks to the port; caches final text.
- Mini popup updates as chunks arrive; shows cache badge if returned from cache.
- Actions: copy, replace selection, expand panel.

**Key files**
- Content: `src/content/content.js`, `src/content/miniPopup.js`, `src/content/floatingIcon.js`, `src/content/ui.css`
- Background: `src/background/backgroundMessageRouter.js` (stream handler)

---

## Chat (popup page)

**Trigger**
- Popup button `#open-chat` (Alt+A) or direct navigation to `src/chat/chat.html`.

**Flow**
- Chat UI loads config/models from storage.
- Sending a message posts to background (`chatSend`/`chat-stream`) with conversation, provider config, optional web search flag.
- Background streams assistant chunks over port `chat-stream`; may run web search if enabled and configured.
- UI updates message list and saves history/summaries.

**Key files**
- Frontend: `src/chat/chat.js`, `src/chat/chat.html`, `src/chat/chat.css`
- Background: `src/background/backgroundMessageRouter.js` (chat handlers)

---

## Sidepanel Chat

**Trigger**
- Alt+S (toggle), action icon, or context menu.

**Flow**
- Loads `src/sidepanel/sidepanel.html` with the same chat logic as popup.
- Uses the same background `chat-stream` and storage/cache paths.

**Key files**
- Frontend: `src/sidepanel/sidepanel.html`, `src/sidepanel/sidepanel.js`, `src/sidepanel/sidepanel.css`
- Background: shared chat handlers in `backgroundMessageRouter.js`

---

## Storage & Config
- `chrome.storage.local`: `config`, chat history, cache metadata.
- Background initializes logger from config; applies defaults.
- Cache: in-memory LRU + persistent storage (`CacheService`).

---

## Errors & Timeouts
- Translators: 30s timeout; errors shown in UI.
- OCR: errors surfaced via alert; popup loading hidden on failure.

---

## Shortcuts
- Alt+D: Screenshot Translate.
- Alt+A: Open Chat (popup).
- Alt+S: Toggle sidepanel.

