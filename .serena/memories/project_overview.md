# Smart Translator – Project Overview
- Purpose: Manifest V3 Chrome extension delivering DeepL-style inline translations for selected text via AI providers (OpenAI, Claude, optional custom endpoints) with smooth UI and caching.
- Tech stack: JavaScript ES modules (no TS), Vite multi-entry build, Chrome extension APIs, franc-min for language detection, LRU + chrome.storage caches, pnpm package manager, Husky + lint-staged, Prettier/ESLint.
- Key components: background service worker (message router, translators, cache, detectLanguage), content scripts (floating icon, mini popup, expand panel, styles), popup page, options page, shared utils (storage/logger/dom/hashing), config defaults.
- UX notes: DeepL-like mini popup + expand mode, typewriter effect, copy/replace/expand actions, responsive layout; follow DESIGN_SYSTEM.md for styling patterns.
- Security/perf: cache-first flow with 30s timeout; never log API keys; escape HTML for injections; avoid blocking main thread; prefer logger utility over console.
- Status: v1.0.0 complete; core features done (per PROJECT_STATUS.md and AGENTS.md).