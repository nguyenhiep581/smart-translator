# 🚀 Side Panel Implementation Roadmap

**Feature**: Right Side Translation Panel using Chrome Side Panel API  
**Status**: 📝 Planned  
**Target**: Chrome 114+

---

## 📋 Overview

Implement a persistent translation panel on the right side of the browser using Chrome's native Side Panel API. This provides a dedicated workspace for translating longer texts and comparing translations across multiple languages.

---

## 🎯 Goals

- ✅ Native Chrome Side Panel (no DOM injection)
- ✅ Persistent across tabs
- ✅ Multi-language batch translation
- ✅ Keyboard shortcut (Alt+S)
- ✅ Reuse existing translation infrastructure
- ✅ Clean, isolated UI

---

## 📐 Architecture

### Current Project Structure
```
smart-translator/
├── src/
│   ├── background/          ✅ Existing
│   ├── content/             ✅ Existing
│   ├── popup/               ✅ Existing
│   ├── options/             ✅ Existing
│   ├── utils/               ✅ Existing
│   ├── config/              ✅ Existing
│   └── sidepanel/           🆕 NEW
│       ├── sidepanel.html
│       ├── sidepanel.js
│       └── sidepanel.css
```

### New Files to Create

#### 1. `src/sidepanel/sidepanel.html`
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Smart Translator</title>
  <link rel="stylesheet" href="sidepanel.css">
</head>
<body>
  <div class="sidepanel-container">
    <header class="sp-header">
      <h1>Smart Translator</h1>
    </header>
    
    <main class="sp-main">
      <!-- Input Section -->
      <section class="sp-input">
        <textarea id="input-text" placeholder="Enter text to translate..."></textarea>
        <div class="sp-input-footer">
          <span id="char-count">0 characters</span>
          <button id="clear-btn">Clear</button>
        </div>
      </section>
      
      <!-- Language Selection -->
      <section class="sp-languages">
        <h3>Target Languages</h3>
        <div id="lang-checkboxes"></div>
      </section>
      
      <!-- Translate Button -->
      <button id="translate-btn" class="sp-btn-primary">Translate</button>
      
      <!-- Results Section -->
      <section class="sp-results" id="results">
        <!-- Results will be dynamically inserted here -->
      </section>
    </main>
    
    <footer class="sp-footer">
      <button id="open-settings" class="sp-btn-icon">⚙️</button>
    </footer>
  </div>
  
  <script src="sidepanel.js" type="module"></script>
</body>
</html>
```

#### 2. `src/sidepanel/sidepanel.js`
```javascript
import { getTargetLanguages } from '../config/defaults.js';
import { error as logError } from '../utils/logger.js';

// Load saved language preferences
async function loadLanguagePreferences() {
  const result = await chrome.storage.local.get('sidePanelLanguages');
  return result.sidePanelLanguages || ['vi', 'en']; // Default
}

// Save language preferences
async function saveLanguagePreferences(langs) {
  await chrome.storage.local.set({ sidePanelLanguages: langs });
}

// Initialize language checkboxes
async function initLanguages() {
  const languages = getTargetLanguages();
  const selected = await loadLanguagePreferences();
  const container = document.getElementById('lang-checkboxes');
  
  languages.forEach(({ code, name, flag }) => {
    const checkbox = document.createElement('label');
    checkbox.className = 'sp-lang-checkbox';
    checkbox.innerHTML = `
      <input type="checkbox" value="${code}" ${selected.includes(code) ? 'checked' : ''}>
      <span>${flag} ${name}</span>
    `;
    container.appendChild(checkbox);
  });
}

// Handle translation
async function handleTranslate() {
  const text = document.getElementById('input-text').value.trim();
  if (!text) return;
  
  const checkboxes = document.querySelectorAll('.sp-lang-checkbox input:checked');
  const targetLangs = Array.from(checkboxes).map(cb => cb.value);
  
  if (targetLangs.length === 0) {
    alert('Please select at least one target language');
    return;
  }
  
  // Save preferences
  await saveLanguagePreferences(targetLangs);
  
  // Show loading
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '<div class="sp-loading">Translating...</div>';
  
  // Translate to each language
  const results = {};
  for (const lang of targetLangs) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'translate',
        payload: { text, from: 'auto', to: lang }
      });
      
      if (response.success) {
        results[lang] = { success: true, data: response.data };
      } else {
        results[lang] = { success: false, error: response.error };
      }
    } catch (err) {
      results[lang] = { success: false, error: err.message };
    }
  }
  
  // Display results
  displayResults(results);
}

// Display translation results
function displayResults(results) {
  const languages = getTargetLanguages();
  const langMap = Object.fromEntries(languages.map(l => [l.code, l]));
  
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  
  Object.entries(results).forEach(([lang, result]) => {
    const langInfo = langMap[lang];
    const resultCard = document.createElement('div');
    resultCard.className = 'sp-result-card';
    
    if (result.success) {
      resultCard.innerHTML = `
        <div class="sp-result-header">
          <h4>${langInfo.flag} ${langInfo.name}</h4>
          <button class="sp-btn-copy" data-text="${result.data}">Copy</button>
        </div>
        <div class="sp-result-text">${escapeHtml(result.data)}</div>
      `;
    } else {
      resultCard.innerHTML = `
        <div class="sp-result-header">
          <h4>${langInfo.flag} ${langInfo.name}</h4>
        </div>
        <div class="sp-result-error">❌ ${result.error}</div>
      `;
    }
    
    resultsDiv.appendChild(resultCard);
  });
  
  // Add copy handlers
  document.querySelectorAll('.sp-btn-copy').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const text = e.target.dataset.text;
      await navigator.clipboard.writeText(text);
      e.target.textContent = 'Copied!';
      setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
    });
  });
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Character count
function updateCharCount() {
  const text = document.getElementById('input-text').value;
  document.getElementById('char-count').textContent = `${text.length} characters`;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await initLanguages();
  
  document.getElementById('translate-btn').addEventListener('click', handleTranslate);
  document.getElementById('clear-btn').addEventListener('click', () => {
    document.getElementById('input-text').value = '';
    updateCharCount();
  });
  document.getElementById('input-text').addEventListener('input', updateCharCount);
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
```

#### 3. `src/sidepanel/sidepanel.css`
```css
:root {
  --sp-primary: #3b82f6;
  --sp-bg: #ffffff;
  --sp-border: #e5e7eb;
  --sp-text: #1f2937;
  --sp-text-light: #6b7280;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--sp-bg);
  height: 100vh;
  overflow: hidden;
}

.sidepanel-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.sp-header {
  padding: 16px;
  border-bottom: 1px solid var(--sp-border);
}

.sp-header h1 {
  font-size: 18px;
  color: var(--sp-text);
}

.sp-main {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.sp-input {
  margin-bottom: 16px;
}

#input-text {
  width: 100%;
  min-height: 150px;
  padding: 12px;
  border: 1px solid var(--sp-border);
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
}

.sp-input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
  color: var(--sp-text-light);
}

.sp-languages {
  margin-bottom: 16px;
}

.sp-languages h3 {
  font-size: 14px;
  margin-bottom: 8px;
}

#lang-checkboxes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.sp-lang-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--sp-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.sp-lang-checkbox:hover {
  background: #f9fafb;
}

.sp-lang-checkbox input {
  cursor: pointer;
}

.sp-btn-primary {
  width: 100%;
  padding: 12px;
  background: var(--sp-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 16px;
}

.sp-btn-primary:hover {
  background: #2563eb;
}

.sp-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sp-result-card {
  border: 1px solid var(--sp-border);
  border-radius: 8px;
  padding: 12px;
}

.sp-result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.sp-result-header h4 {
  font-size: 14px;
  color: var(--sp-text);
}

.sp-result-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--sp-text);
}

.sp-result-error {
  color: #ef4444;
  font-size: 13px;
}

.sp-btn-copy {
  padding: 4px 12px;
  background: #f3f4f6;
  border: 1px solid var(--sp-border);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.sp-btn-copy:hover {
  background: #e5e7eb;
}

.sp-loading {
  text-align: center;
  padding: 20px;
  color: var(--sp-text-light);
}

.sp-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--sp-border);
  display: flex;
  justify-content: flex-end;
}

.sp-btn-icon {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
}

.sp-btn-icon:hover {
  background: #f3f4f6;
}
```

---

## 🔧 Manifest Updates

Update `public/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Smart Translator",
  "version": "1.0.0",
  
  "permissions": [
    "storage",
    "activeTab",
    "sidePanel"
  ],
  
  "side_panel": {
    "default_path": "sidepanel/sidepanel.html"
  },
  
  "commands": {
    "toggle_sidepanel": {
      "suggested_key": {
        "default": "Alt+S"
      },
      "description": "Toggle Translation Side Panel"
    }
  }
}
```

---

## 🔄 Background Service Updates

Update `src/background/background.js`:

```javascript
// Enable side panel on extension icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle_sidepanel') {
    chrome.windows.getCurrent((window) => {
      chrome.sidePanel.open({ windowId: window.id });
    });
  }
});
```

---

## ⚙️ Vite Build Configuration

Update `vite.config.js` to include side panel:

```javascript
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/background.js'),
        content: resolve(__dirname, 'src/content/content.js'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
        options: resolve(__dirname, 'src/options/options.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'), // NEW
      }
    }
  }
});
```

---

## ✅ Implementation Checklist

### Phase 1: Setup (30 min)
- [ ] Add `sidePanel` permission to manifest.json
- [ ] Add `side_panel.default_path` to manifest.json
- [ ] Add `toggle_sidepanel` command to manifest.json
- [ ] Create `src/sidepanel/` directory
- [ ] Update vite.config.js
- [ ] Update background.js with side panel handlers
- [ ] Test: Extension icon opens side panel
- [ ] Test: Alt+S toggles side panel

### Phase 2: UI Build (1-2 hours)
- [ ] Create sidepanel.html structure
- [ ] Create sidepanel.css with styling
- [ ] Implement textarea with auto-resize
- [ ] Build language selector (multi-checkbox)
- [ ] Add translate button
- [ ] Add clear button
- [ ] Add character counter
- [ ] Add settings icon in footer
- [ ] Test: UI renders correctly

### Phase 3: Translation Logic (1 hour)
- [ ] Create sidepanel.js
- [ ] Import shared utilities (getTargetLanguages, logger)
- [ ] Implement loadLanguagePreferences()
- [ ] Implement saveLanguagePreferences()
- [ ] Implement handleTranslate()
- [ ] Implement displayResults()
- [ ] Add copy button handlers
- [ ] Add error handling
- [ ] Test: Translations work for single language
- [ ] Test: Translations work for multiple languages

### Phase 4: Polish (1 hour)
- [ ] Add loading states/animations
- [ ] Improve error messages
- [ ] Add empty state for results
- [ ] Responsive design tweaks
- [ ] Add keyboard shortcuts (Enter to translate)
- [ ] Persist last input text (optional)
- [ ] Add clear results button
- [ ] Test: All edge cases (no input, no languages selected, API errors)

### Phase 5: Documentation & Testing
- [ ] Update AGENTS.MD with side panel info
- [ ] Update README.md with Alt+S shortcut
- [ ] Test on multiple websites
- [ ] Test tab switching (panel persists)
- [ ] Test with different providers (OpenAI, Claude)
- [ ] Test cache integration
- [ ] Final QA

---

## 🎨 UI/UX Considerations

1. **Language Selection**: Default to user's preferred languages from settings
2. **Results Display**: Show in order of selection, with clear visual separation
3. **Copy Buttons**: Quick copy for each language result
4. **Loading State**: Show which languages are currently being translated
5. **Error Handling**: Clear error messages per language if translation fails
6. **Responsive**: Should work well in various side panel widths

---

## 🔗 Integration Points

### Reused Components
- `getTargetLanguages()` from defaults.js
- `logger` utilities
- Translation message protocol (same as popup/content)
- Cache service (automatic via background)
- Storage utilities

### No Changes Needed
- ✅ background/translator/* (works as-is)
- ✅ background/cache/* (works as-is)
- ✅ utils/* (fully reusable)
- ✅ config/defaults.js (already has language list)

---

## 📊 Expected Benefits

1. **Better UX**: Dedicated workspace for translations
2. **Multi-language**: Compare translations side-by-side
3. **Persistent**: Stays open across tabs
4. **No Conflicts**: No DOM injection issues
5. **Native Feel**: Uses Chrome's built-in side panel UI

---

## 🚀 Future Enhancements

- [ ] Split view: Source | Target side-by-side
- [ ] Export translations to file (.txt, .json)
- [ ] Translation history within side panel
- [ ] Syntax highlighting for code blocks
- [ ] Diff view to compare translations

---

**Status**: Ready to implement  
**Estimated Time**: 3-4 hours  
**Dependencies**: Chrome 114+, existing translator infrastructure
