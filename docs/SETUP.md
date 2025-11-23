# 🚀 **SETUP.md — Project Setup & Development Guide**

---

## **Prerequisites**

- **Node.js**: v18+ (LTS recommended)
- **pnpm**: v8+
- **Chrome**: Latest version for testing
- **Git**: For version control

---

## **Initial Setup**

### 1. Install Dependencies

```bash
# Install pnpm globally (if not already installed)
npm install -g pnpm

# Install project dependencies
pnpm install
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys (for development/testing only)
# DO NOT commit .env file
```

### 3. Development Workflow

```bash
# Start development server with hot reload
make dev

# Or directly with pnpm
pnpm run dev
```

### 4. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `dist/` folder from your project

### 5. Build for Production

```bash
# Create production build
make build

# Create distributable ZIP file
make zip
```

---

## **Project Structure Quick Reference**

```
smart-translator/
├── docs/              # Documentation
├── src/
│   ├── background/    # Service worker, translators, cache
│   ├── content/       # Content scripts, UI components
│   ├── popup/         # Extension popup
│   ├── options/       # Options/settings page
│   ├── utils/         # Shared utilities
│   └── assets/        # Icons and images
├── dist/              # Build output (auto-generated)
├── manifest.json      # Chrome extension manifest
├── vite.config.js     # Build configuration
├── Makefile           # Build commands
└── package.json       # Dependencies
```

---

## **Development Commands**

| Command | Description |
|---------|-------------|
| `make dev` | Start development server with hot reload |
| `make build` | Build production version |
| `make zip` | Create distributable ZIP file |
| `make clean` | Remove dist and node_modules |
| `pnpm install` | Install dependencies |
| `pnpm run dev` | Same as `make dev` |
| `pnpm run build` | Same as `make build` |

---

## **Testing the Extension**

### Manual Testing Checklist

1. **Text Selection**
   - [ ] Select text on any webpage
   - [ ] Floating icon appears near selection
   - [ ] Icon positioned correctly (not overlapping text)

2. **Translation**
   - [ ] Hover icon → mini popup appears
   - [ ] Translation displays correctly
   - [ ] Fade animation is smooth

3. **Buttons**
   - [ ] Copy button works
   - [ ] Replace button works (replaces selected text)
   - [ ] Expand button opens full panel

4. **Settings**
   - [ ] Can configure API provider
   - [ ] Can set default languages
   - [ ] API key is masked in UI

5. **Cache**
   - [ ] Same text translates instantly (from cache)
   - [ ] Cache persists after browser restart

### Test Websites

Try the extension on:
- Gmail
- Twitter/X
- Medium articles
- GitHub README files
- News websites

---

## **Configuration Files**

### `.env.example`

```bash
# OpenAI Configuration (for development/testing)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# Claude Configuration (optional)
CLAUDE_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-sonnet-20240229

# Custom Provider (optional)
CUSTOM_API_URL=https://api.example.com/v1/chat
CUSTOM_API_KEY=your-key-here
```

**⚠️ Important**: Never commit `.env` file with real API keys!

---

## **Troubleshooting**

### Extension doesn't load
- Check Chrome DevTools console for errors
- Ensure `dist/` folder exists (run `make build`)
- Verify manifest.json is valid JSON

### Translations not working
- Check background service worker console (`chrome://extensions/` → Details → Inspect views: service worker)
- Verify API key is configured in Options page
- Check network tab for failed API requests

### UI not updating
- Hard refresh the page (Cmd+Shift+R / Ctrl+Shift+R)
- Reload extension from `chrome://extensions/`
- Clear cache: `make clean && make build`

### Hot reload not working
- Stop dev server and restart
- Check if Vite server is running on expected port
- Try reloading extension manually

---

## **Code Style & Best Practices**

### JavaScript
- Use ES6+ features (modules, arrow functions, async/await)
- Prefer `const` over `let`, avoid `var`
- Use descriptive variable names
- Add JSDoc comments for public functions

### CSS
- Use BEM naming convention with `st-` prefix
- Example: `st-mini-popup__header--active`
- Keep specificity low
- Use CSS custom properties for theming

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add my feature"

# Push to remote
git push origin feature/my-feature
```

---

## **API Provider Configuration**

### OpenAI Setup

1. Get API key from https://platform.openai.com/api-keys
2. Open extension Options page
3. Select "OpenAI" as provider
4. Enter API key and model (e.g., `gpt-4-turbo-preview`)

### Claude Setup

1. Get API key from https://console.anthropic.com/
2. Open extension Options page
3. Select "Claude" as provider
4. Enter API key and model (e.g., `claude-3-sonnet-20240229`)

### Gemini Setup

1. Get API key from https://aistudio.google.com/app/apikey
2. Open extension Options page
3. Select "Gemini" as provider
4. Enter API key (e.g. `AIza...`)
5. Model defaults to `gemini-2.0-flash-exp`

### Custom Provider Setup

1. Ensure your API follows OpenAI-compatible format
2. Open extension Options page
3. Select "Custom" as provider
4. Enter:
   - API URL
   - API Key
   - Model name
   - Custom headers (if needed)

---

## **Performance Optimization**

### Cache Configuration

Default settings in `src/config/defaults.js`:
```javascript
{
  cacheEnabled: true,
  cacheTTL: 86400000,  // 24 hours in milliseconds
  maxCacheEntries: 500
}
```

Adjust in Options page based on your needs.

### Language Detection

For faster detection, use heuristic offline mode (default).  
API-based detection can be enabled in settings (slower but more accurate).

---

## **Security Notes**

- API keys are stored in `chrome.storage.local` (encrypted by Chrome)
- Never log API keys to console in production
- Content scripts don't have direct access to API keys
- All API calls go through background service worker
- HTML is escaped before injection to prevent XSS

---

## **Next Steps**

1. ✅ Complete initial setup
2. ✅ Load extension in Chrome
3. ✅ Configure API provider in Options
4. ✅ Test basic translation
5. 📖 Read [AGENT.md](./agent.md) for implementation details
6. 🎨 Review [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for UI guidelines
7. 🔌 Check [API_SPECS.md](./API_SPECS.md) for provider details

---

## **Support & Resources**

- **Chrome Extension Docs**: https://developer.chrome.com/docs/extensions/
- **Vite Documentation**: https://vitejs.dev/
- **pnpm Documentation**: https://pnpm.io/

---

**Happy coding! 🎉**
