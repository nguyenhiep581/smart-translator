# 📄 **PLAN.md — Smart Translator Chrome Extension (Final Updated Plan)**

---

# #️⃣ **0. Overview**

Smart Translator is a Chrome Extension for translating selected text on any webpage.  
Features:

- OpenAI, Claude, or any custom AI provider (configurable)
- Floating icon + DeepL-style mini popup
- Full popup mode (DeepL-like)
- Minimal enterprise UI for Popup + Options Page
- CacheService (TTL + LRU)
- Optimized architecture, UX, performance, and security

Stack:

- Vite
- pnpm
- Makefile
- Manifest V3
- JavaScript

---

# #️⃣ **1. Core Features**

## **1.1 Selection → Floating Action Icon**
- Detect when user selects text
- Display DeepL-style icon near selection
- Hover → open mini translate popup

## **1.2 DeepL-style Mini Translation Popup**
- UI similar to DeepL's mini-panel:
  - From language (auto-detect)
  - To language
  - Original text box (auto-resize)
  - Translated text box (smooth fade animation)
- Buttons:
  - Copy
  - Replace selected text inline
  - Expand mode

## **1.3 Expand Mode (Full Translation Panel)**
- Open large interface similar to DeepL
- Suitable for translating long content
- Layout with 2 large sections:
  - Input text
  - Output translated text

## **1.4 Translation Providers**
Support 2 providers:
  - **OpenAI** (default endpoint: `https://api.openai.com/v1/chat/completions`)
  - **Claude** (default endpoint: `https://api.anthropic.com/v1/messages`)
  - Both support custom endpoints for compatibility with alternative APIs
- Communication with content script via chrome.runtime.sendMessage

## **1.5 System Prompt**
Use format:

```
You are a professional {{to}} native translator who needs to fluently translate text into {{to}}.

## Translation Rules
1. Output only the translated content, without explanations or additional content (such as "Here's the translation:" or "Translation as follows:")
2. The returned translation must maintain exactly the same number of paragraphs and format as the original text
3. If the text contains HTML tags, consider where the tags should be placed in the translation while maintaining fluency
4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.
5. If input contains %%, use %% in your output, if input has no %%, don't use %% in your output
```

## **1.6 Auto Language Detection**
- Heuristic offline detection (quick)
- If enabled in settings → detect using API provider

## **1.7 Supported Target Languages**
- **English** (en)
- **Japanese** (ja)
- **Vietnamese** (vi)
- **Chinese** (zh)

**Note**: Source language can be any language (auto-detect), but translation output is limited to the 4 languages above.

## **1.8 CacheService (strong optimization)**
Two-layer cache:

### Layer 1 – Memory Cache  
- Fast  
- LRU eviction  
- Max entries: 500

### Layer 2 – Persistent Cache (chrome.storage.local)  
- TTL: configurable (default 24h)
- Store translations offline

Cache Key:
```
{provider}-{model}-{from}-{to}-{hash(originalText)}
```

---

# #️⃣ **2. Architecture**

## **2.1 File Structure**

```
/extension/
│── manifest.json
│── package.json
│── pnpm-lock.yaml
│── Makefile
│── vite.config.js
│
├── src/
│   ├── background/
│   │   ├── background.js
│   │   ├── translator/
│   │   │   ├── baseTranslator.js
│   │   │   ├── openAITranslator.js
│   │   │   ├── claudeTranslator.js
│   │   │   └── customTranslator.js
│   │   ├── cache/
│   │   │   ├── memoryCache.js
│   │   │   └── persistentCache.js
│   │   ├── services/
│   │   │   ├── detectLanguage.js
│   │   │   └── telemetry.js
│   │   └── backgroundMessageRouter.js
│   │
│   ├── content/
│   │   ├── content.js
│   │   ├── floatingIcon.js
│   │   ├── miniPopup.js
│   │   ├── popupExpand.js
│   │   ├── ui.css
│   │   └── utils/dom.js
│   │
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   │
│   ├── options/
│   │   ├── options.html
│   │   ├── options.js
│   │   └── options.css
│   │
│   ├── utils/
│   │   ├── storage.js
│   │   ├── hashing.js
│   │   ├── logger.js
│   │   └── keyboardShortcuts.js
│   │
│   └── assets/
│       ├── icon.png
│       ├── icon16.png
│       ├── icon32.png
│       ├── icon128.png
│
└── dist/
```

---

# #️⃣ **3. Manifest Configuration**

## Manifest v3 (Flexible Provider)

```json
{
  "manifest_version": 3,
  "name": "Smart Translator",
  "version": "1.0.0",
  "description": "Translate selected text using OpenAI, Claude, or Custom providers.",
  "permissions": ["storage", "activeTab", "scripting"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_icon": "assets/icon.png",
    "default_popup": "popup/popup.html"
  },
  "options_page": "options/options.html",
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "css": ["content/ui.css"]
    }
  ]
}
```

**No host_permissions needed**  
→ because fetch in background doesn't require special domains.

---

# #️⃣ **4. UI / UX SPEC**

---

# **4.1 Floating Icon**
- 32×32 px
- Circular DeepL-like icon
- Hover → scale 1.1
- Placement: near selected text (calculate bounding rect)

---

# **4.2 Mini Popup UI**
DeepL style:

- White card
- Rounded 12px
- Soft shadow
- Smooth fade animation
- Layout:

```
From ▼    →    To ▼
---------------------------------
Original text
---------------------------------
Translated text (fade in)
---------------------------------
[ Copy ] [ Replace ] [ Expand ]
```

---

# **4.3 Expand Mode**
- Open panel occupying 40–60% of screen width
- Drag top bar to resize (optional)
- Large editor similar to DeepL

---

# **4.4 Popup (extension action popup)**
Minimal Enterprise Style:

```
Smart Translator

• Translate History
• Settings
• Provider Status
• About
```

---

# **4.5 Options Page**
Enterprise SaaS UI:

- Use cards:

```
╔ Provider ═════════╗
  OpenAI / Claude / Custom
╚═══════════════════╝

╔ API Config ═══════╗
  URL, Path, Model
  API Key (masked)
╚═══════════════════╝

╔ Defaults ═════════╗
  Languages
  Auto-detect
╚═══════════════════╝

╔ System Prompt ════╗
  Editor box
╚═══════════════════╝
```

Other Features:

- Keyboard shortcuts
- TTL for cache
- Debug logs toggle
- Telemetry (local only)

---

# #️⃣ **5. BACKGROUND LOGIC**

---

# **5.1 Message Router**
Receive messages from content script:

| Message | Purpose |
|--------|----------|
| `translate` | translate text |
| `detectLanguage` | detect language |
| `expandMode` | open large UI |
| `getSettings` | get config |
| `setSettings` | save config |

---

# **5.2 Translator Strategy Pattern**

```
BaseTranslator
 ├── OpenAITranslator
 ├── ClaudeTranslator
 └── CustomTranslator
```

Background will choose:

```javascript
translator = new OpenAITranslator(config)
```

---

# **5.3 CacheService**

### Memory Cache
- Map()
- LRU queue
- max size = 500 entries

### Persistent Cache
- chrome.storage.local
- TTL default 24h

Flow:

```
if (cache.hit(key)):
    return cached_result

else:
    result = await translator.translate()
    cache.store(key, result)
    return result
```

---

# #️⃣ **6. MAKEFILE**

```makefile
dev:
    pnpm run dev

build:
    pnpm run build

zip:
    cd dist && zip -r ../smart-translator.zip .
```

---

# #️⃣ **7. VITE CONFIG**

- Build multiple entry points:
  - background.js
  - content.js
  - options.html
  - popup.html

Define:

```javascript
rollupOptions:
  input:
    background: "src/background/background.js"
    content: "src/content/content.js"
    popup: "src/popup/popup.html"
    options: "src/options/options.html"
```

---

# #️⃣ **8. SECURITY**

- API key only stored in chrome.storage → never injected into content script
- Validate custom URLs
- Escape HTML before sending to API
- Remove console logs if debug mode is not enabled

---

# #️⃣ **9. TELEMETRY (LOCAL ONLY)**

Store local stats:

- Total requests
- Cache hit rate
- Avg latency
- Last provider used

Display nicely in Options Page.

---

# #️⃣ **10. OPTIONAL FEATURES (PHASE 2)**

- Model auto-selection
- Speech-to-translate
- TTS output
- Sync history across devices

---

# ✔ END OF PLAN
