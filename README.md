# 🚀 Smart Translator

A high-performance Chrome Extension for AI-powered translation with DeepL-style user experience.

**Author:** nguyenhiep

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-blue)](https://chrome.google.com/webstore)

## ✨ Features

- 🎯 **DeepL-style UI** - Floating icon and mini popup for instant translations
- 🤖 **Multi-Provider Support** - OpenAI, Claude, with custom endpoint capability
- ⚡ **Two-Layer Cache** - Memory (LRU) + Persistent storage for blazing-fast repeated translations
- 🌍 **Language Support** - Translate to/from English, Japanese, Vietnamese, Chinese
- 🎨 **Clean Design** - Minimal, enterprise-grade interface
- 🔒 **Secure** - API keys safely stored in chrome.storage.local
- ⏱️ **Smart Timeout** - 30-second timeout prevents hanging on slow APIs
- 📊 **Analytics** - Track usage statistics (local only, no telemetry)
- 🐛 **Debug Mode** - Toggle detailed console logging
- 💬 **Chat Mode** - ChatGPT-style chat with history, model selection, up to 3 image attachments, streaming replies, and **Web Browsing** capabilities
- 🗂️ **Backup & Restore** - Export/import settings and prompts as versioned JSON; API keys included only when explicitly selected

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm 10+ (`npm install -g pnpm`)
- Chrome/Chromium browser
- API key from OpenAI or Anthropic (Claude)

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/smart-translator.git
cd smart-translator

# Install dependencies
pnpm install

# Build extension
make build

# Load in Chrome
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist/` folder
# 5. (Optional) Set a shortcut in chrome://extensions/shortcuts for side panel
```

### Configure API Keys

1. Click extension icon → Options
2. Select provider (OpenAI or Claude)
3. Enter your API key
4. Choose model
5. Save settings
6. Start translating!

## 🛠️ Development

### Available Commands

```bash
make dev       # Build once for development
make watch     # Auto-rebuild on file changes
make build     # Production build
make zip       # Create distributable package
make clean     # Remove build artifacts
```

### Development Workflow

1. **Make changes** in `src/` directory
2. **Run** `make watch` for auto-rebuild
3. **Reload extension** in chrome://extensions/
4. **Test** your changes
5. **Check console** for errors (enable Debug Mode in Options → About)

### Debug Mode

Enable detailed logging:
1. Options → About → Enable Debug Mode
2. Save settings
3. Reload extension
4. Open console (F12) to see detailed logs

```
smart-translator/
├── src/
│   ├── background/         # Service Worker (translation logic, cache)
│   │   ├── translator/    # AI provider implementations
│   │   ├── cache/         # Two-layer caching system
│   │   └── services/      # Business logic
│   ├── content/           # Content Scripts (injected UI)
│   │   ├── floatingIcon.js
│   │   ├── miniPopup.js
│   │   └── popupExpand.js
│   ├── options/           # Settings page
│   ├── popup/             # Toolbar popup
│   ├── utils/             # Shared utilities
│   └── config/            # Configuration
├── docs/                  # Documentation
│   ├── ARCHITECTURE.md    # System architecture
│   ├── CODE_STYLE.md      # Coding standards
│   ├── PLAN.md           # Project plan
│   └── AGENTS.md         # AI development guide
├── public/                # Static assets
├── dist/                  # Build output (git-ignored)
└── vite.config.js        # Build configuration
```

## 📖 Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Complete system architecture
- **[CODE_STYLE.md](./docs/CODE_STYLE.md)** - Coding standards and best practices
- **[PLAN.md](./docs/PLAN.md)** - Project planning and specifications
- **[AGENTS.md](./docs/AGENTS.md)** - AI agent implementation guidelines
- **[API_SPECS.md](./docs/API_SPECS.md)** - API integration details

## 🎯 Usage

1. **Select text** on any webpage
2. **Hover** over floating icon that appears
3. **View translation** in popup
4. **Click buttons**:
   - 📋 Copy - Copy translation to clipboard
   - 🔄 Replace - Replace original text with translation (coming soon)
   - 📖 Expand - Open full editor mode

### Expand Mode

- Side-by-side source/target view
- Editable text areas
- Change languages on the fly
- Auto-translate when switching languages

### Chat Mode

- Popup → **Open Chat** (opens chat in a new tab)
- Choose provider/model, system prompt, max tokens
- Saved recent conversations (uses last 6 messages for context)
- Streaming responses (OpenAI/Copilot/Claude) and up to 3 image attachments per message

## ⚙️ Configuration

### Get API Keys

- **OpenAI**: https://platform.openai.com/api-keys
- **Claude**: https://console.anthropic.com/

### Extension Settings

1. Click extension icon → **Options**
2. **Provider Settings**:
   - Select provider (OpenAI or Claude)
   - Enter API key
   - Choose model (or fetch available models)
   - Optional: Custom endpoint (Azure, LocalAI, etc.)
3. **Language**:
   - Set default target language
4. **Web Search** (Optional):
   - Choose **DuckDuckGo (Free)** for no-setup web browsing.
   - Or configure **Google Programmable Search** (API Key + CX) for higher reliability.
   - Enables real-time web browsing in Chat Mode (click Globe icon).
5. **Cache**:
   - Max memory entries (default: 500)
   - TTL - Time to live (default: 7 days)
5. **About**:
   - Enable Debug Mode for detailed logs
6. **Backup & Restore**:
   - Export/import full configuration and prompt templates as JSON
   - Optionally include API keys; you must opt in for secrets on export/import

### Custom Endpoints

**Azure OpenAI**:
```javascript
Host: https://your-resource.openai.azure.com
Path: /openai/deployments/your-deployment/chat/completions?api-version=2023-05-15
```

**LocalAI**:
```javascript
Host: http://localhost:8080
Path: /v1/chat/completions
```

## 🏗️ Architecture

### System Flow

```
Web Page → Content Script → Background Worker → AI API
                ↓                    ↓
          Display UI        Cache (Memory + Persistent)
```

### Key Components

- **Background Worker**: Translation logic, caching, API calls
- **Content Scripts**: UI injection, text selection detection
- **Cache System**: Two-layer (LRU memory + persistent storage)
- **Translators**: OpenAI, Claude implementations with timeout handling

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for details.

## 🧪 Testing

1. Enable **Debug Mode** (Options → About)
2. Open browser **console** (F12)
3. Select text and translate
4. Check logs for performance metrics
5. Test on different websites

**Test Sites**:
- Gmail, Google Docs
- Twitter/X, Medium
- GitHub, StackOverflow
- Wikipedia

## 🐛 Troubleshooting

### Translation not working

1. Check API key in Options
2. Enable Debug Mode
3. Check console for errors
4. Common issues:
   - Invalid API key
   - Rate limiting (429 error)
   - Network/firewall blocking
   - Timeout (text too long)

### Extension not loading

1. Check chrome://extensions/ for errors
2. Verify manifest.json is valid
3. Rebuild: `make clean && make build`
4. Reload extension

### Cache issues

Clear cache: Options → Cache → Clear All Cache

### Debug Commands

```javascript
// Check storage
chrome.storage.local.get(null, console.log);

// Clear cache
chrome.runtime.sendMessage({ type: 'clearCache' });

// Get cache stats
chrome.runtime.sendMessage({ type: 'getCacheStats' }, console.log);
```

## 🛠️ Tech Stack

- **Build**: Vite 5.4.21
- **Package Manager**: pnpm 10+
- **Manifest**: Chrome Extension Manifest V3
- **Language**: JavaScript ES2021+
- **APIs**: OpenAI Chat Completions, Claude Messages
- **Storage**: chrome.storage.local
- **Caching**: LRU Memory Cache + Persistent Storage

## 🤝 Contributing

We welcome contributions! Please read our guidelines:

1. **Read documentation**:
   - [CODE_STYLE.md](./docs/CODE_STYLE.md) - Coding standards
   - [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System design
   - [AGENTS.md](./docs/AGENTS.md) - AI assistance guide

2. **Development process**:
   ```bash
   # Fork and clone
   git clone https://github.com/your-username/smart-translator.git
   
   # Create feature branch
   git checkout -b feature/my-feature
   
   # Make changes, test thoroughly
   make watch  # Auto-rebuild
   
   # Commit with conventional format
   git commit -m "feat(translator): add new provider support"
   
   # Push and create PR
   git push origin feature/my-feature
   ```

3. **Commit message format**:
   ```
   <type>(<scope>): <subject>
   
   Types: feat, fix, docs, style, refactor, perf, test, chore
   Scope: translator, cache, ui, options, etc.
   
   Example:
   feat(cache): add cache expiration policy
   fix(ui): correct popup positioning on multiline
   docs(readme): update installation steps
   ```

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [DeepL](https://www.deepl.com/) UX
- Built with [Vite](https://vitejs.dev/)
- Icons from [Lucide](https://lucide.dev/)

---

**Made with ❤️ by hiepnguyen**

## License

MIT

## Support

For issues and questions, please check the documentation in `/docs` folder.
