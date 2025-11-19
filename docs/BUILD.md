# 🏗️ **BUILD.md — Build & Deployment Guide**

---

## **Build Instructions**

### **Prerequisites**

- Node.js 18+ (LTS recommended)
- pnpm 8+ (package manager)
- Chrome/Edge browser

### **Installation**

```bash
# Install dependencies
make install

# Or using pnpm directly
pnpm install
```

### **Development Mode**

```bash
# Start development build with watch mode
make dev

# Or using pnpm
pnpm run dev
```

After building, load the extension in Chrome:
1. Open `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist/` folder
5. Configure API keys in extension Settings (Options page)

### **Production Build**

```bash
# Build for production
make build

# Or using pnpm
pnpm run build
```

Output will be in `dist/` folder.

### **Create Distribution Package**

```bash
# Create ZIP file for Chrome Web Store
make zip

# Output: smart-translator.zip
```

---

## **Extension Configuration**

### **1. Select Provider**

Open extension Options page:
- Click extension icon → Settings
- Or right-click icon → Options

Choose your AI provider:
- **OpenAI** or **Claude**

### **2. Configure API Settings**

#### **OpenAI Configuration**
- **API Key**: Get from https://platform.openai.com/api-keys
- **Model**: Select from dropdown (default: `gpt-5-mini`)
- **Endpoint** (Optional): Leave empty for default, or enter custom OpenAI-compatible API
- **Test Connection**: Click button to verify setup
- **Get Available Models**: Fetch list of available models from API

#### **Claude Configuration**
- **API Key**: Get from https://console.anthropic.com/
- **Model**: Select from dropdown (default: `claude-haiku-4-5-20251001`)
- **Endpoint** (Optional): Leave empty for default, or enter custom Claude-compatible API
- **Test Connection**: Click button to verify setup
- **Get Available Models**: View available Claude models

### **3. Custom Endpoints**

Both providers support custom API endpoints:

**Use Cases:**
- Azure OpenAI Service
- LocalAI or self-hosted OpenAI-compatible APIs
- Custom Claude-compatible proxies
- Enterprise API gateways

**Requirements:**
- Custom endpoints must be API-compatible with respective provider
- OpenAI endpoints must accept OpenAI request/response format
- Claude endpoints must accept Claude request/response format
- HTTPS required for production

---

## **Testing the Extension**

### **Basic Translation Test**

1. Navigate to any webpage
2. Select some text (1-5000 characters)
3. Floating icon appears near selection
4. Click icon to see mini popup with translation
5. Use action buttons:
   - **Copy**: Copy translation to clipboard
   - **Replace**: Replace original text with translation
   - **Expand**: Open full-screen editor mode

### **Expand Mode Test**

1. Translate text via mini popup
2. Click "Expand" button
3. Full-screen editor opens with:
   - Source text (left pane, read-only)
   - Translation (right pane, editable)
   - Target language selector
   - Translate/Replace buttons
4. Press **Esc** to close

### **Test Connection Feature**

In Options page:
1. Enter API key for your provider
2. Click "Test Connection" button
3. Extension will translate "Hello" to Vietnamese
4. Success: Shows translated result
5. Failure: Shows detailed error message

### **Get Models Feature**

In Options page:
1. Enter API key
2. Click "Get Available Models" button
3. **OpenAI**: Fetches models from API, updates dropdown
4. **Claude**: Shows predefined model list

---

## **Build Commands Reference**

### **Makefile Commands**

```bash
make install    # Install dependencies via pnpm
make dev        # Development build with watch mode
make build      # Production build
make zip        # Create distributable ZIP
make clean      # Remove dist/ and node_modules/
```

### **Package.json Scripts**

```bash
pnpm install           # Install dependencies
pnpm run dev           # Development mode
pnpm run build         # Production build
pnpm run preview       # Preview build locally
```

---

## **Project Structure**

```
smart-translator/
├── docs/              # Documentation
│   ├── AGENT.md       # AI agent guide
│   ├── API_SPECS.md   # API specifications
│   ├── BUILD.md       # This file
│   ├── DESIGN_SYSTEM.md
│   ├── PLAN.md
│   └── SETUP.md
├── public/            # Static assets
│   └── icon*.svg      # Extension icons
├── src/
│   ├── background/    # Service worker
│   │   ├── translator/
│   │   ├── cache/
│   │   └── services/
│   ├── config/        # Configuration
│   ├── content/       # Content scripts
│   ├── options/       # Options page
│   ├── popup/         # Extension popup
│   └── utils/         # Utilities
├── dist/              # Build output (generated)
├── package.json
├── vite.config.js
├── manifest.json
├── Makefile
└── README.md
```

---

## **Troubleshooting**

### **Extension Not Loading**

**Symptoms**: Extension fails to load in Chrome

**Solutions**:
1. Check manifest.json syntax:
   ```bash
   cat manifest.json | jq .
   ```
2. Verify all files exist:
   ```bash
   make build
   ls -R dist/
   ```
3. Check browser console for errors (F12)
4. Ensure Chrome version supports Manifest V3

### **Translation Not Working**

**Symptoms**: No translation appears, or errors shown

**Solutions**:
1. Verify API key configured correctly in Options
2. Check browser console for API errors
3. Test connection using "Test Connection" button
4. Verify internet connectivity
5. Check API provider status (OpenAI/Claude)
6. Review network tab for failed API calls

### **Floating Icon Not Appearing**

**Symptoms**: Icon doesn't show when selecting text

**Solutions**:
1. Refresh page after loading extension
2. Check content scripts injected:
   - Open DevTools → Sources tab
   - Look for content scripts
3. Verify selection length (1-5000 chars)
4. Check browser console for JavaScript errors
5. Ensure content script permissions granted

### **Cache Issues**

**Symptoms**: Old translations showing, or cache not working

**Solutions**:
1. Clear cache via Options → Cache → Clear All Cache
2. Check cache settings (TTL, max entries)
3. Verify chrome.storage permissions
4. Check browser storage quota

### **Build Errors**

**Symptoms**: Build fails with errors

**Solutions**:
1. Clean and rebuild:
   ```bash
   make clean
   make install
   make build
   ```
2. Check Node.js version (18+ required)
3. Verify pnpm installation
4. Delete `node_modules` and reinstall
5. Check Vite configuration

---

## **Performance Optimization**

### **Cache Configuration**

Optimize cache for your usage:

**Memory Cache:**
- Default: 500 entries (LRU)
- Increase for frequent translations
- Decrease to reduce memory usage

**Persistent Cache:**
- Default: 7 days TTL
- Increase for rarely-changing content
- Decrease for frequently-updated content

### **API Optimization**

**Model Selection:**
- **Fast**: gpt-5-mini, claude-haiku-4-5 (recommended)
- **Quality**: gpt-4, claude-3-opus
- **Balanced**: gpt-4-turbo, claude-3-sonnet

**Custom Endpoints:**
- Use local/regional endpoints for lower latency
- Azure OpenAI for enterprise compliance
- Self-hosted for offline/air-gapped environments

---

## **Security Best Practices**

1. ✅ **Never commit API keys** to version control
2. ✅ **Use HTTPS** for all API endpoints (required)
3. ✅ **Validate** custom endpoint URLs before saving
4. ✅ **Review permissions** in manifest.json
5. ✅ **Test thoroughly** before distributing
6. ✅ **Keep dependencies updated** for security patches
7. ✅ **Use environment-specific configs** (dev/prod)

---

## **Distribution Checklist**

Before distributing your extension:

- [ ] Test all features thoroughly
- [ ] Verify API keys not included in code
- [ ] Run production build (`make build`)
- [ ] Test built extension from `dist/`
- [ ] Check all icons load correctly
- [ ] Verify permissions in manifest
- [ ] Test on clean Chrome profile
- [ ] Create ZIP package (`make zip`)
- [ ] Prepare Chrome Web Store listing
- [ ] Write clear privacy policy
- [ ] Document required permissions
- [ ] Prepare support documentation

---

## **Chrome Web Store Submission**

### **Required Assets**

1. **Extension ZIP**: `smart-translator.zip`
2. **Icons**: All sizes (16, 32, 48, 128)
3. **Screenshots**: 1280x800 or 640x400
4. **Promotional Images**: 440x280 (optional)
5. **Privacy Policy**: Required if collecting data

### **Store Listing**

**Name**: Smart Translator

**Description** (short):
```
AI-powered translation extension with multi-provider support (OpenAI, Claude)
```

**Description** (detailed):
```
Smart Translator uses AI to translate selected text instantly.

Features:
• Multiple AI providers (OpenAI, Claude)
• Floating icon for quick access
• Mini popup with instant translation
• Full-screen editor mode
• Two-layer caching for speed
• Automatic language detection
• Support for EN, JA, VI, ZH

No data collection. API keys stored locally.
```

**Category**: Productivity

**Language**: English

---

## **Maintenance**

### **Updating Dependencies**

```bash
# Check for updates
pnpm outdated

# Update all dependencies
pnpm update

# Update specific package
pnpm update vite
```

### **Version Bumping**

1. Update version in `manifest.json`
2. Update version in `package.json`
3. Rebuild: `make build`
4. Create new ZIP: `make zip`
5. Upload to Chrome Web Store

---

**Last Updated**: November 2025
