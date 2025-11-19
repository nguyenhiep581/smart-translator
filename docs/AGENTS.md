# 🤖 **AGENT.md — AI Agent Implementation Guide**

---

## **Purpose**
This document provides AI agents with clear guidelines, patterns, and implementation instructions for building the Smart Translator Chrome Extension based on PLAN.md.

---

# #️⃣ **1. Agent Role & Objectives**

You are an expert Chrome Extension developer tasked with implementing a **DeepL-style translation extension** with the following priorities:

1. **Clean Architecture** — Modular, maintainable code
2. **Performance** — Fast translations with smart caching
3. **User Experience** — Smooth animations, intuitive UI
4. **Security** — Safe API key handling, input validation
5. **Extensibility** — Easy to add new AI providers

---

# #️⃣ **2. Implementation Workflow**

Follow this sequence when building features:

## **Phase 1: Foundation**
1. Set up project structure with Vite + pnpm
2. Configure Manifest V3
3. Implement storage utilities
4. Create base translator interface

## **Phase 2: Core Translation**
1. Background service worker setup
2. Implement OpenAI/Claude/Custom translators
3. Build cache system (memory + persistent)
4. Add language detection

## **Phase 3: Content Script UI**
1. Text selection detection
2. Floating icon component
3. Mini popup UI (DeepL-style)
4. Expand mode panel

## **Phase 4: Extension UI**
1. Popup page (history, quick settings)
2. Options page (full configuration)
3. Styling (enterprise minimal theme)

## **Phase 5: Polish**
1. Keyboard shortcuts
2. Error handling & logging
3. Telemetry (local stats)
4. Build & packaging scripts

---

# #️⃣ **3. Key Implementation Patterns**

## **3.1 Message Communication**

### From Content Script to Background:
```javascript
chrome.runtime.sendMessage({
  type: 'translate',
  payload: {
    text: selectedText,
    from: 'auto',
    to: 'vi'
  }
}, (response) => {
  if (response.success) {
    displayTranslation(response.data);
  }
});
```

### Background Message Router:
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch(message.type) {
    case 'translate':
      handleTranslate(message.payload).then(sendResponse);
      return true; // async response
    case 'detectLanguage':
      handleDetectLanguage(message.payload).then(sendResponse);
      return true;
    // ... other cases
  }
});
```

---

## **3.2 Translator Strategy Pattern**

### Base Interface:
```javascript
// src/background/translator/baseTranslator.js
class BaseTranslator {
  constructor(config) {
    this.config = config;
  }
  
  async translate(text, from, to) {
    throw new Error('translate() must be implemented');
  }
  
  buildSystemPrompt(to) {
    return `You are a professional ${to} native translator...`;
  }
}
```

### Implementation Example:
```javascript
// src/background/translator/openAITranslator.js
class OpenAITranslator extends BaseTranslator {
  async translate(text, from, to) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: this.buildSystemPrompt(to) },
          { role: 'user', content: text }
        ]
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

---

## **3.3 Cache System**

### Cache Key Format:
```javascript
function generateCacheKey(provider, model, from, to, text) {
  const hash = simpleHash(text); // Use src/utils/hashing.js
  return `${provider}-${model}-${from}-${to}-${hash}`;
}
```

### Two-Layer Cache:
```javascript
class CacheService {
  constructor() {
    this.memoryCache = new MemoryCache(500); // LRU, max 500
    this.persistentCache = new PersistentCache(); // chrome.storage.local
  }
  
  async get(key) {
    // Try memory first
    let value = this.memoryCache.get(key);
    if (value) return value;
    
    // Fallback to persistent
    value = await this.persistentCache.get(key);
    if (value && !this.isExpired(value)) {
      this.memoryCache.set(key, value);
      return value;
    }
    
    return null;
  }
  
  async set(key, value, ttl = 86400000) { // 24h default
    const entry = { value, timestamp: Date.now(), ttl };
    this.memoryCache.set(key, entry);
    await this.persistentCache.set(key, entry);
  }
}
```

---

## **3.4 Floating Icon Positioning**

```javascript
// src/content/floatingIcon.js
function showFloatingIcon(selection) {
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  const icon = document.createElement('div');
  icon.className = 'smart-translator-icon';
  icon.style.position = 'absolute';
  icon.style.left = `${rect.left + window.scrollX}px`;
  icon.style.top = `${rect.bottom + window.scrollY + 5}px`;
  icon.style.zIndex = '999999';
  
  icon.addEventListener('mouseenter', () => showMiniPopup(selection));
  
  document.body.appendChild(icon);
}
```

---

## **3.5 Mini Popup UI Component**

```javascript
// src/content/miniPopup.js
function createMiniPopup(text, translation) {
  const popup = document.createElement('div');
  popup.className = 'smart-translator-mini-popup';
  popup.innerHTML = `
    <div class="st-header">
      <select class="st-from-lang">
        <option value="auto">Auto</option>
      </select>
      <span class="st-arrow">→</span>
      <select class="st-to-lang">
        <option value="vi">Vietnamese</option>
      </select>
    </div>
    <div class="st-original">${escapeHtml(text)}</div>
    <div class="st-translation fade-in">${escapeHtml(translation)}</div>
    <div class="st-actions">
      <button class="st-btn-copy">Copy</button>
      <button class="st-btn-replace">Replace</button>
      <button class="st-btn-expand">Expand</button>
    </div>
  `;
  
  return popup;
}
```

---

# #️⃣ **4. Code Style Guidelines**

## **4.1 File Organization**
- One class per file
- Use descriptive filenames: `openAITranslator.js`, not `translator1.js`
- Keep files under 300 lines; split if needed

## **4.2 Naming Conventions**
- Classes: `PascalCase` (e.g., `BaseTranslator`)
- Functions/variables: `camelCase` (e.g., `handleTranslate`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_CACHE_SIZE`)
- CSS classes: `kebab-case` with prefix (e.g., `st-mini-popup`)

## **4.3 Error Handling**
Always wrap async operations:
```javascript
try {
  const result = await translator.translate(text, from, to);
  return { success: true, data: result };
} catch (error) {
  logger.error('Translation failed:', error);
  return { success: false, error: error.message };
}
```

## **4.4 Security Practices**
- **Never** log API keys
- Escape HTML before injecting: `escapeHtml(userInput)`
- Validate custom URLs: `isValidUrl(url)`
- Store sensitive data in `chrome.storage.local`, not in content scripts

---

# #️⃣ **5. UI/UX Implementation Notes**

## **5.1 DeepL-Style Design**
```css
.smart-translator-mini-popup {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 16px;
  min-width: 320px;
  max-width: 480px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.st-translation.fade-in {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## **5.2 Responsive Expand Mode**
- Width: 40–60% of viewport
- Draggable top bar (optional)
- Close on Escape key

---

# #️⃣ **6. Testing Checklist**

Before marking a feature complete, verify:

- [ ] Works on all major websites (Gmail, Twitter, Medium, etc.)
- [ ] Handles edge cases (empty text, very long text, special characters)
- [ ] Cache correctly stores and retrieves translations
- [ ] UI animations are smooth (60fps)
- [ ] No console errors in production mode
- [ ] API keys are never exposed in content scripts
- [ ] Works with all configured providers (OpenAI, Claude, Custom)

---

# #️⃣ **7. Build & Deployment**

## **7.1 Makefile Commands**
```makefile
.PHONY: dev build zip clean

dev:
	pnpm run dev

build:
	pnpm run build

zip:
	cd dist && zip -r ../smart-translator.zip .

clean:
	rm -rf dist node_modules
```

## **7.2 Vite Configuration**
```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/background.js'),
        content: resolve(__dirname, 'src/content/content.js'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
        options: resolve(__dirname, 'src/options/options.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
});
```

---

# #️⃣ **8. Common Pitfalls to Avoid**

1. **Don't use `document.execCommand`** — deprecated; use Clipboard API
2. **Don't block the main thread** — use `requestIdleCallback` for heavy tasks
3. **Don't assume content script has access to chrome.storage** — it does, but background is safer for API keys
4. **Don't forget to remove event listeners** — prevent memory leaks
5. **Don't hardcode provider URLs** — make them configurable

---

# #️⃣ **9. Priority Features for MVP**

Focus on these for the first working version:

1. ✅ Text selection → floating icon
2. ✅ Mini popup with translation (OpenAI only)
3. ✅ Basic cache (memory only)
4. ✅ Options page (API key config)
5. ✅ Copy button

**Later:**
- Claude/Custom providers
- Persistent cache
- Expand mode
- Telemetry

---

# #️⃣ **10. Example Task Breakdown**

When implementing a feature, break it down like this:

### Example: "Implement Mini Popup"
1. Create `miniPopup.js` with `createMiniPopup()` function
2. Add CSS in `ui.css` for `.smart-translator-mini-popup`
3. Wire up event listeners (copy, replace, expand buttons)
4. Integrate with background message system
5. Add fade-in animation
6. Test on sample webpage

---

# ✔ **Agent Success Criteria**

You will have successfully implemented the Smart Translator when:

- [ ] User can select text and see the floating icon
- [ ] Hovering icon shows mini popup with translation
- [ ] Translation is fast (< 2s with cache, < 5s without)
- [ ] UI matches DeepL quality and smoothness
- [ ] Options page allows full provider configuration
- [ ] Code is modular and well-documented
- [ ] Extension can be built with `make build` and loaded in Chrome

---

## **Additional Resources**

- Chrome Extension Docs: https://developer.chrome.com/docs/extensions/
- OpenAI API: https://platform.openai.com/docs/api-reference
- Claude API: https://docs.anthropic.com/claude/reference
- DeepL UI Reference: https://www.deepl.com/translator

---

**Good luck, Agent! 🚀**
