# 🏗️ Architecture Documentation

## **Project Overview**

Smart Translator is a Chrome Extension built with Manifest V3 that provides AI-powered translation with a DeepL-like user experience.

---

## **📁 Directory Structure**

```
smart-translator/
├── src/
│   ├── background/          # Service Worker (background script)
│   │   ├── background.js    # Main entry point
│   │   ├── backgroundMessageRouter.js  # Message handler
│   │   ├── cache/          # Caching system
│   │   │   ├── cacheService.js      # Two-layer cache orchestrator
│   │   │   ├── memoryCache.js       # LRU memory cache
│   │   │   └── persistentCache.js   # chrome.storage.local wrapper
│   │   ├── services/       # Business logic services
│   │   │   ├── chatService.js      # Chat feature logic
│   │   │   └── detectLanguage.js   # Language detection
│   │   └── translator/     # Translation providers
│   │       ├── baseTranslator.js   # Abstract base class
│   │       ├── openAITranslator.js # OpenAI implementation
│   │       ├── claudeTranslator.js # Claude implementation
│   │       └── geminiTranslator.js # Gemini implementation
│   │
│   ├── content/            # Content Scripts (injected into pages)
│   │   ├── content.js      # Main entry point
│   │   ├── floatingIcon.js # Icon that appears on text selection
│   │   ├── miniPopup.js    # Translation popup UI
│   │   ├── popupExpand.js  # Expanded translation panel
│   │   ├── ui.css          # Content script styles
│   │   └── expandPanel.css # Expand panel styles
│   │
│   ├── popup/              # Extension Popup (toolbar icon)
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   │
│   ├── chat/               # ChatGPT-style page (new tab)
│   │   ├── chat.html
│   │   ├── chat.js
│   │   └── chat.css
│   │
│   ├── sidepanel/          # Side Panel (persistent UI)
│   │   ├── sidepanel.html
│   │   ├── sidepanel.js
│   │   └── sidepanel.css
│   │
│   ├── options/            # Settings Page
│   │   ├── options.html
│   │   ├── options.js
│   │   └── options.css
│   │
│   ├── utils/              # Shared Utilities
│   │   ├── storage.js      # Chrome storage wrappers
│   │   ├── logger.js       # Logging service
│   │   ├── dom.js          # DOM manipulation helpers
│   │   └── hashing.js      # Cache key generation
│   │
│   └── config/             # Configuration
│       └── defaults.js     # Default settings
│
├── docs/                   # Documentation
│   ├── PLAN.md            # Original project plan
│   ├── AGENTS.md          # AI agent guidelines
│   ├── API_SPECS.md       # API integration specs
│   └── ARCHITECTURE.md    # This file
│
├── dist/                   # Build output (generated)
├── public/                 # Static assets
│   ├── manifest.json      # Chrome extension manifest
│   └── icons/             # Extension icons
│
├── vite.config.js         # Vite build configuration
├── package.json           # Dependencies
└── Makefile               # Build commands
```

---

## **🔄 System Architecture**

### **High-Level Flow**

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Page                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  User selects text                                 │    │
│  │  ↓                                                 │    │
│  │  Content Script detects selection                 │    │
│  │  ↓                                                 │    │
│  │  Show Floating Icon                               │    │
│  │  ↓                                                 │    │
│  │  User hovers/clicks → Show Mini Popup             │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           ↓
                  chrome.runtime.sendMessage
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  Background Service Worker                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Message Router receives request                  │    │
│  │  ↓                                                 │    │
│  │  Check Cache (Memory → Persistent)                │    │
│  │  ├─ Cache Hit → Return immediately                │    │
│  │  └─ Cache Miss → Call Translator                  │    │
│  │     ↓                                              │    │
│  │     OpenAI/Claude/Gemini API Request (30s timeout)│    │
│  │     ↓                                              │    │
│  │     Store in Cache (Memory + Persistent)          │    │
│  │     ↓                                              │    │
│  │     Return translation                            │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           ↓
                    sendResponse callback
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                     Content Script                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Display translation with typewriter effect       │    │
│  │  ↓                                                 │    │
│  │  Show Copy/Replace/Expand buttons                 │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## **🧩 Component Breakdown**

### **1. Content Scripts**

**Purpose**: Inject UI into web pages for text selection and translation display.

**Key Components**:

- **`content.js`**: Main entry point
  - Listens for `mouseup` and `selectionchange` events
  - Initializes logger with debug mode from settings
  - Coordinates floating icon display

- **`floatingIcon.js`**: Small icon near selected text
  - Shows on text selection (24x24px)
  - Positioned at selection end, 5px below
  - Hides after user interaction
  - Triggers mini popup on hover/click

- **`miniPopup.js`**: Translation popup (DeepL-style)
  - Language selection dropdowns
  - Original text display
  - Translation with typewriter effect (20ms delay)
  - Action buttons (Copy, Replace, Expand)
  - Smart viewport positioning
  - Handles long text warnings (>200 chars)

- **`popupExpand.js`**: Full-screen translation editor
  - Side-by-side source/target layout
  - Editable text areas
  - Language switching with auto-translate
  - Typewriter effect (15ms delay)
  - Copy translation button

**Communication**:
```javascript
// Content → Background
chrome.runtime.sendMessage({
  type: 'translate',
  payload: { text, from: 'auto', to: 'vi' }
}, (response) => {
  if (response.success) {
    displayTranslation(response.data);
  }
});
```

---

### **2. Background Service Worker**

**Purpose**: Handle translation requests, manage cache, and coordinate with AI APIs.

**Key Components**:

- **`background.js`**: Entry point
  - Initializes logger on startup
  - Sets default config on first install
  - Registers message listener

- **`backgroundMessageRouter.js`**: Message dispatcher
  - Routes messages to appropriate handlers
  - Handles: `translate`, `detectLanguage`, `getSettings`, `clearCache`, `updateDebugMode`, `chat`
  - Tracks telemetry (last 100 translations)

- **`services/chatService.js`**:
  - Manages chat sessions (history, system prompt)
  - Handles streaming responses (OpenAI/Claude)
  - Summarizes long conversations automatically

**Message Handlers**:
```javascript
switch(message.type) {
  case 'translate':
    // 1. Check cache (memory → persistent)
    // 2. If miss, call translator.translate()
    // 3. Store in cache
    // 4. Return result
    break;
  
  case 'detectLanguage':
    // Use franc-min library
    break;
  
  case 'clearCache':
    // Clear memory + persistent cache
    break;
}
```

---

### **3. Translation System**

**Architecture**: Strategy Pattern

```
BaseTranslator (abstract)
├── OpenAITranslator
├── ClaudeTranslator
└── GeminiTranslator
```

**`BaseTranslator`**: Defines interface
- `async translate(text, from, to, onStream)` - must be implemented
- `buildSystemPrompt(to)` - generates translation instructions
- `getModel()` - returns current model
- `hasValidApiKey()` - validates API key

**`OpenAITranslator`**: OpenAI implementation
- Endpoint: `{host}{path}` (default: https://api.openai.com/v1/chat/completions)
- Model: configurable (default: gpt-4o-mini)
- Timeout: 30 seconds
- Supports streaming via SSE

**`ClaudeTranslator`**: Claude implementation
- Endpoint: `{host}{path}` (default: https://api.anthropic.com/v1/messages)
- Model: configurable (default: claude-haiku-4-5-20251001)
- Timeout: 30 seconds
- Supports streaming via content_block_delta events

**`GeminiTranslator`**: Google Gemini implementation
- Endpoint: `generativelanguage.googleapis.com`
- Model: configurable (default: gemini-2.0-flash-exp)
- Key-based authentication (simplified config)

**System Prompt Optimization**:
```javascript
// Optimized to 75 characters for faster API processing
`Translate to ${targetLang}. Output only translation. Keep format/paragraphs. Preserve HTML/code/names.`
```

---

### **4. Cache System**

**Architecture**: Two-Layer Cache

```
CacheService
├── MemoryCache (LRU, max 500 entries)
└── PersistentCache (chrome.storage.local)
```

**Cache Key Format**:
```javascript
`${provider}-${model}-${from}-${to}-${hash(text)}`
// Example: "openai-gpt-4-en-vi-a3f2e9d8"
```

**Cache Flow**:
1. **GET**: Memory → Persistent → null
2. **SET**: Memory + Persistent (with TTL)
3. **CLEAR**: Memory + Persistent

**TTL**: Default 24 hours (86400000ms), configurable

---

### **5. Settings & Configuration**

**Storage Structure**:
```javascript
{
  config: {
    provider: 'openai' | 'claude' | 'gemini',
    defaultToLang: 'vi',
    debugMode: false,
    
    openai: {
      apiKey: 'sk-...',
      model: 'gpt-4o-mini',
      host: 'https://api.openai.com',
      path: '/v1/chat/completions',
      availableModels: ['gpt-4o', 'gpt-3.5-turbo', ...]
    },
    
    claude: {
      apiKey: 'sk-ant-...',
      model: 'claude-haiku-4-5-20251001',
      host: 'https://api.anthropic.com',
      path: '/v1/messages',
      availableModels: ['claude-3-opus-20240229', ...]
    },

    gemini: {
      apiKey: 'AIza...',
      model: 'gemini-2.0-flash-exp',
      availableModels: ['gemini-1.5-pro', ...]
    },
    
    cache: {
      maxEntries: 500,
      ttl: 604800000 // 7 days in ms
    }
  },
  
  telemetry: [
    {
      provider: 'openai',
      duration: 1234,
      cacheHit: false,
      success: true,
      timestamp: 1700000000000
    },
    // ... last 100 entries
  ]
}
```

---

## **🔒 Security**

### **API Key Handling**
- ✅ Stored in `chrome.storage.local` (encrypted by Chrome)
- ✅ Never logged to console
- ✅ Never exposed to content scripts
- ✅ Only accessed in background service worker

### **XSS Prevention**
- ✅ All user input escaped via `escapeHtml()`
- ✅ No `eval()` or `innerHTML` with raw user data
- ✅ Content Security Policy in manifest

### **Input Validation**
- ✅ Text length warnings for >5000 chars
- ✅ API timeout prevents hanging (30s max)
- ✅ Error messages sanitized

---

## **⚡ Performance Optimizations**

### **1. Caching**
- Two-layer cache reduces API calls by ~80%
- LRU memory cache for instant access
- Persistent cache survives restarts

### **2. Timeouts**
- 30-second timeout prevents hanging
- AbortController for proper cancellation

### **3. UI**
- Typewriter effect gives perception of speed
- Shows loading indicators with time estimates
- Debounced text selection (300ms)

---

## **🧪 Testing Checklist**

### **Functionality**
- [ ] Text selection shows floating icon
- [ ] Mini popup displays translation
- [ ] Expand panel works with all features
- [ ] Copy button copies to clipboard
- [ ] Language preference persists
- [ ] Cache works (memory + persistent)
- [ ] Timeout works after 30s
- [ ] Side panel opens and translates
- [ ] Chat page works with streaming

### **API Integration**
- [ ] OpenAI translation works
- [ ] Claude translation works
- [ ] Gemini translation works
- [ ] Custom endpoints work (OpenAI/Claude)
- [ ] Model selection persists

---

## **📊 Build System**

### **Vite Configuration**

**Dual Build Strategy**:
```javascript
// Main build: ES modules
vite build

// Content script: IIFE bundle
BUILD_TARGET=content vite build
```

**Why Two Builds?**
- Chrome content scripts cannot use ES modules
- Background/options/popup can use modules
- Content script needs IIFE with `inlineDynamicImports: true`

### **Makefile Commands**

```bash
make dev       # Build once for development
make watch     # Auto-rebuild on file changes
make build     # Production build (main + content)
make zip       # Create distributable .zip
make clean     # Remove dist/ and node_modules/
```

---

## **📝 Coding Standards**

### **File Organization**
- One class per file
- Descriptive filenames (no `translator1.js`)
- Max 300 lines per file

### **Naming Conventions**
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- CSS: `kebab-case` with `st-` prefix

---

## **📚 References**

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Claude API](https://docs.anthropic.com/claude/reference)
- [Google Gemini API](https://ai.google.dev/docs)
- [Vite Documentation](https://vitejs.dev/)

---

**Last Updated**: November 23, 2025  
**Version**: 1.0.0  
**Maintained by**: Smart Translator Team