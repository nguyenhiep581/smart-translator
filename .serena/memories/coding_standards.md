# Coding Standards
- Formatting: Prettier (semi, singleQuote, trailingComma=es5, printWidth 100, tabWidth 2, LF). Use pnpm scripts or make targets; Husky+lint-staged auto-run on commit.
- ESLint highlights: no-console (use utils/logger), prefer-const, no-var, eqeqeq, curly required, single quotes, semicolons, max-len warn ~100. Functions ideally 20-50 lines (<100), files <300 lines; extract helpers to keep responsibilities focused.
- Naming: PascalCase for classes, camelCase for vars/functions, UPPER_SNAKE_CASE for constants, kebab-case with `st-` prefix for CSS classes; prepend _ for private methods (convention).
- Docs/comments: JSDoc on public functions; inline comments explain why, not what. TODO/FIXME/HACK/NOTE style standard.
- Imports order: external libs → internal modules → utilities → config/constants.
- Security/UX rules (per AGENTS/CODE_STYLE): never log API keys; escape HTML before injection; validate URLs; avoid document.execCommand; remove event listeners when done; don’t block main thread (use async/idle); maintain DeepL-style UI/animations per DESIGN_SYSTEM.
- Logging: always use logger util (`debug/info/warn/error`), respects debug mode; no console.log/error.
