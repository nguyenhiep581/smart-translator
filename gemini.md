# Gemini Agent Context & Guidelines

This file serves as a reference for the Gemini agent working on the Smart Translator project, derived from `AGENTS.md`.

## Project Overview
- **Type:** Chrome Extension
- **Source Root:** `src/`
- **Output:** `dist/`
- **Key Modules:**
  - `background/`: Service worker, translators, cache.
  - `content/`: Floating icon, mini popup, UI injections.
  - `popup/`: Main extension popup.
  - `options/`: Settings page.
  - `chat/`: Chat interface.
  - `sidepanel/`: Side panel features.
  - `utils/`: Shared helpers (logger, storage, DOM).
  - `config/`: Configuration defaults and constants.

## Development Workflow

### Build Commands
- `make build`: Create production bundle (runs `pnpm run build`).
- `make watch`: Watch mode for development.
- `make dev`: One-off development build.
- `make zip`: Package for distribution.

### Quality Assurance
- **Linting:** `make lint` / `make lint-fix` (ESLint).
- **Formatting:** `make format` (Prettier).
- **Testing:** Manual verification required. Load `dist/` as an unpacked extension in Chrome.
  - Verify: Translation flows, chat functionality, options saving, and UI responsiveness.

## Coding Standards

### Style
- **Format:** Prettier (100 print width, single quotes, semicolons).
- **Lint Rules:** `no-var`, `prefer-const`, `eqeqeq`.
- **Logging:** Use `src/utils/logger.js`. **DO NOT** use `console.log` directly.
- **File Size:** Aim for <300 lines. One class/module per file.

### Naming Conventions
- **Classes:** `PascalCase`
- **Functions/Variables:** `camelCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **CSS:** `kebab-case` (use `st-` prefix or contextual prefixes).

### Security
- **Secrets:** Never hardcode API keys. Store in `chrome.storage.local`.
- **DOM:** Always escape user content before injection.
- **Data:** Never log API keys or sensitive user data.

## Version Control
- **Commit Messages:** Follow conventional commits.
  - `feat(scope): description`
  - `fix(scope): description`
  - `docs(scope): description`
- **PRs:** Include screenshots for UI changes. Summarize behavior changes.
