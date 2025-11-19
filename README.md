# Smart Translator

A powerful Chrome Extension for translating selected text using AI providers (OpenAI, Claude, or Custom).

## Features

- 🎯 **DeepL-style UI** - Floating icon and mini popup for quick translations
- 🤖 **Multi-Provider** - OpenAI, Claude with custom endpoint support
- ⚡ **Smart Caching** - Two-layer cache (memory + persistent) for instant translations
- 🌍 **Language Support** - Translate to English, Japanese, Vietnamese, or Chinese
- 🎨 **Clean Design** - Minimal enterprise-style interface
- 🔒 **Secure** - API keys stored safely in chrome.storage

## Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm 8+
- Chrome browser

### Installation

```bash
# Install dependencies
make install

# Or with pnpm directly
pnpm install
```

### Development

```bash
# Start development server with hot reload
make dev

# Load extension in Chrome
1. Open chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder
5. Configure API keys in extension Settings (Options page)
```

### Build

```bash
# Build for production
make build

# Create distributable ZIP
make zip
```

## Project Structure

```
smart-translator/
├── docs/               # Documentation
├── src/
│   ├── background/     # Service worker, translators, cache
│   ├── content/        # Content scripts, UI components
│   ├── popup/          # Extension popup
│   ├── options/        # Options/settings page
│   ├── utils/          # Shared utilities
│   └── config/         # Configuration files
├── public/             # Static assets
├── dist/               # Build output
└── manifest.json       # Chrome extension manifest
```

## Documentation

- [PLAN.md](./docs/PLAN_EN.md) - Complete project specification
- [SETUP.md](./docs/SETUP.md) - Detailed setup guide
- [AGENT.md](./docs/agent.md) - Implementation guide
- [API_SPECS.md](./docs/API_SPECS.md) - API specifications
- [DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) - UI design system

## Configuration

1. Get API keys:
   - OpenAI: https://platform.openai.com/api-keys
   - Claude: https://console.anthropic.com/

2. Open extension options page
3. Select provider and enter API key
4. Configure default languages

## Usage

1. Select text on any webpage
2. Floating icon appears
3. Hover icon to see translation
4. Click buttons to:
   - Copy translation
   - Replace selected text
   - Open expand mode

## Commands

```bash
make install   # Install dependencies
make dev       # Development with watch mode
make build     # Production build
make zip       # Create distributable
make clean     # Remove build files
make help      # Show all commands
```

## Tech Stack

- **Build**: Vite
- **Package Manager**: pnpm
- **Manifest**: V3
- **Language**: JavaScript (ES6+)
- **APIs**: OpenAI, Claude, Custom

## License

MIT

## Support

For issues and questions, please check the documentation in `/docs` folder.
