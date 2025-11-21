# Side Panel Testing Guide

## ✅ Implementation Complete

All Phase 1 tasks are done:
- ✅ Manifest configuration with sidePanel permission
- ✅ Side panel files created (HTML, JS, CSS)
- ✅ Background service updated with keyboard shortcut
- ✅ Build configuration updated
- ✅ Production build completed

---

## 🧪 Testing Steps

### 1. Load Extension
```bash
# Extension is built in dist/ folder
cd /Users/hiep/projects/smart-translator
```

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `dist/` folder

### 2. Test Extension Icon Click
1. Click the Smart Translator extension icon in toolbar
2. **Expected**: Side panel opens on the right side of browser
3. **Expected**: Panel shows:
   - "Smart Translator" header (blue)
   - Text input area
   - Target Languages section with checkboxes (auto-populated)
   - Translate button
   - Empty state message

### 3. Test Keyboard Shortcut (Alt+S)
1. Press `Alt+S` (or `Option+S` on Mac)
2. **Expected**: Side panel toggles (opens if closed, closes if open)
3. Press `Alt+S` again
4. **Expected**: Panel closes

### 4. Test Translation Functionality
1. Open side panel
2. Enter some text in the textarea (e.g., "Hello, how are you?")
3. **Expected**: Character counter updates
4. Select 2-3 target languages (checkboxes)
5. Click "Translate" button
6. **Expected**: 
   - Loading state appears
   - Results appear for each selected language
   - Each result card shows:
     - Language flag and name
     - Translation text
     - Copy button
     - Cache badge (if cached)

### 5. Test Copy Button
1. After translation, click "Copy" on any result
2. **Expected**: 
   - Button text changes to "Copied!"
   - After 2 seconds, reverts to "Copy"
3. Paste somewhere to verify text was copied

### 6. Test Clear Button
1. Enter text in textarea
2. Click "Clear" button
3. **Expected**:
   - Text clears
   - Character counter resets to "0 characters"
   - Results section shows empty state again

### 7. Test Settings Button
1. Click the gear icon in footer
2. **Expected**: Options page opens in new tab

### 8. Test Ctrl+Enter Shortcut
1. Enter text in textarea
2. Select target languages
3. Press `Ctrl+Enter` (or `Cmd+Enter` on Mac)
4. **Expected**: Translation starts (same as clicking Translate button)

### 9. Test Language Preferences
1. Select 2-3 languages and translate
2. Close side panel
3. Reopen side panel
4. **Expected**: Previously selected languages are still checked

### 10. Test Persistence
1. Open side panel
2. Navigate to different tabs
3. **Expected**: Side panel stays open across tabs
4. Enter text and translate
5. Navigate to another tab
6. **Expected**: Translation results remain visible

---

## 🐛 Debugging

If something doesn't work:

1. **Check Console**:
   - Right-click in side panel → Inspect
   - Check Console tab for errors

2. **Check Background Service Worker**:
   - Go to `chrome://extensions/`
   - Find Smart Translator
   - Click "service worker" link
   - Check Console for errors

3. **Check API Configuration**:
   - Open Options page (gear icon or right-click extension → Options)
   - Verify API provider is configured
   - Check API key is entered

4. **Enable Debug Mode**:
   - Go to Options → About section
   - Enable "Debug Mode"
   - Check console for detailed logs

5. **Rebuild**:
   ```bash
   cd /Users/hiep/projects/smart-translator
   rm -rf dist node_modules/.vite
   pnpm run build
   BUILD_TARGET=content pnpm run build
   ```
   Then reload extension in Chrome

---

## 📊 Expected Behavior Summary

| Feature | Expected Result |
|---------|----------------|
| Extension Icon Click | Opens side panel |
| Alt+S Shortcut | Toggles side panel |
| Text Input | Character counter updates |
| Language Selection | Checkboxes save preferences |
| Translate Button | Translates to all selected languages |
| Copy Button | Copies translation to clipboard |
| Clear Button | Clears input and results |
| Settings Button | Opens options page |
| Ctrl+Enter | Triggers translation |
| Tab Navigation | Panel persists across tabs |
| Cached Translations | Shows ⚡ Cache badge |

---

## ✨ Features Implemented

1. **Multi-Language Translation**: Translate to multiple languages simultaneously
2. **Persistent UI**: Panel stays open across tabs
3. **Smart Caching**: Fast translations with cache indicators
4. **Keyboard Shortcuts**: Alt+S to toggle, Ctrl+Enter to translate
5. **Language Preferences**: Remembers selected languages
6. **Character Counter**: Real-time character count
7. **Copy to Clipboard**: One-click copy functionality
8. **Responsive Design**: Clean, modern UI matching design system
9. **Error Handling**: User-friendly error messages
10. **Loading States**: Visual feedback during translation

---

## 🎯 Next Steps (Optional Enhancements)

If you want to further improve the side panel:

1. **Add language search/filter** in language selection
2. **Add "Select All" / "Deselect All"** buttons
3. **Add translation history** in side panel
4. **Add export functionality** (export all translations)
5. **Add voice input** for text
6. **Add text-to-speech** for translations
7. **Add swap languages** button
8. **Add recent languages** quick access
9. **Add drag-and-drop** file upload for batch translation
10. **Add diff view** for comparing translations

All core functionality is complete and ready to use! 🚀
