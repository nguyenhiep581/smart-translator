# Repository Guidelines

## Project Structure & Module Organization
- Source lives in `src/` with key areas: `background/` (service worker, translators, cache), `content/` (floating icon, mini popup), `popup/`, `options/`, `chat/`, and `sidepanel/`. Shared helpers in `utils/` and defaults in `config/`.
- Build outputs to `dist/`. Static assets under `public/`. Docs in `docs/`.
- Chrome storage helpers and logger are the canonical way to persist config and log (avoid `console.*`).

## Build, Test, and Development Commands
- `make build` — production bundle (runs `pnpm run build` via Vite multi-entry).
- `make watch` — watch mode for dev builds.
- `make dev` — one-off dev build.
- `make lint`, `make lint-fix`, `make format` — run ESLint/Prettier checks or fixes.
- `make zip` — package distribution zip.
(No automated tests yet; manual QA expected.)

## Coding Style & Naming Conventions
- JavaScript/HTML/CSS with Prettier (`printWidth 100`, single quotes, semicolons) and ESLint (no-var, prefer-const, eqeqeq, no-console → use `logger`).
- Indent 2 spaces; keep files under ~300 lines when possible; one class/module per file.
- Naming: PascalCase for classes, camelCase for functions/variables, UPPER_SNAKE_CASE for constants, kebab-case for CSS with `st-`/contextual prefixes.
- Escape user content before injecting into DOM; never log API keys.

## Testing Guidelines
- Manual checks only: verify translation flows, chat, options, and prompt features in Chrome. Clear cache via Options when debugging.
- Use `make build` then load `dist/` as unpacked extension for validation.

## Commit & Pull Request Guidelines
- Commit messages: conventional-ish (`feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`).
- Before pushing: run lint/format/build. Include screenshots for UI changes (popup/options/chat) in PRs. Link related issues and summarize behavior changes plus manual test notes.

## Security & Configuration Tips
- Store secrets only in `chrome.storage.local`; never hardcode keys.
- Use Options → Backup to export/import config; include API keys only when explicitly intended.
- Respect provider defaults in `config/defaults.js`; validate custom hosts/paths.
