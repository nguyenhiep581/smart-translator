# Task Completion Checklist
- Run relevant quality gates: typically `make check` (format-check + lint); for release-sensitive changes also `make build` to ensure Vite multi-entry succeeds.
- If UI/behavior changes, reload extension with fresh `make build`/`make watch` and validate in Chrome (floating icon, mini popup, expand panel, options/popup pages) plus Debug Mode console for errors.
- Ensure no console usage—use logger; confirm no API keys or sensitive data logged; escape HTML in injected UI.
- Keep functions/files within size guidelines; maintain DeepL-style UI and DESIGN_SYSTEM conventions.
- Update documentation/config only if materially changed; respect Husky/lint-staged pre-commit expectations.
- Summarize changes and note any tests/checks run (or skipped with reasons) in final response; avoid reverting user changes.