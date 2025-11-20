# 🛠️ Code Formatting & Linting Guide

This project uses **Prettier** for code formatting and **ESLint** for code quality checks.

---

## **⚙️ Configuration Files**

- **`.prettierrc`** - Prettier configuration
- **`.prettierignore`** - Files to ignore for Prettier
- **`.eslintrc.json`** - ESLint configuration
- **`.eslintignore`** - Files to ignore for ESLint
- **`.editorconfig`** - Editor configuration (works with most IDEs)
- **`.vscode/settings.json`** - VS Code specific settings

---

## **📦 Quick Start**

### **Install Dependencies**

```bash
pnpm install
```

This installs:
- `prettier@^3.1.0` - Code formatter
- `eslint@^8.55.0` - Code linter
- `husky@^9.0.0` - Git hooks manager
- `lint-staged@^15.2.0` - Run linters on staged files

---

## **🪝 Pre-commit Hooks (Automatic)**

This project uses **Husky** and **lint-staged** to automatically format and lint your code before each commit.

### **What Happens on Commit**

When you run `git commit`, the pre-commit hook automatically:
1. ✅ Formats staged `.js`, `.css`, `.html`, `.json` files with Prettier
2. ✅ Lints and auto-fixes staged `.js` files with ESLint
3. ✅ Only commits if there are no errors (warnings are allowed)

### **Example**

```bash
git add .
git commit -m "Add new feature"

# Output:
# ✔ Backed up original state in git stash
# ✔ Running tasks for staged files...
#   ✔ prettier --write
#   ✔ eslint --fix --max-warnings 100
# ✔ Applying modifications from tasks...
# [main abc1234] Add new feature
```

### **Manual Pre-commit Check**

Test what the pre-commit hook will do without committing:

```bash
make pre-commit
# or
pnpm exec lint-staged
```

### **Bypass Pre-commit Hook (Not Recommended)**

If you absolutely need to skip the hook:

```bash
git commit --no-verify -m "Emergency fix"
```

⚠️ **Warning**: Only use `--no-verify` in emergencies. Your code should always pass formatting and linting checks.

---

## **🚀 Commands**

### **Format Code**

```bash
# Format all files (auto-fix)
make format
# or
pnpm run format

# Check formatting without fixing
make format-check
# or
pnpm run format:check
```

### **Lint Code**

```bash
# Check for linting issues
make lint
# or
pnpm run lint

# Auto-fix linting issues
make lint-fix
# or
pnpm run lint:fix
```

### **Run Both**

```bash
# Check both format and lint
make check
# or
pnpm run check
```

### **Test Pre-commit Hook**

```bash
# Run the same checks that happen on git commit
make pre-commit
# or
pnpm exec lint-staged
```

---

## **🎯 Formatting Rules**

### **Prettier Settings**

```json
{
  "semi": true,                    // Use semicolons
  "singleQuote": true,             // Use single quotes
  "trailingComma": "es5",          // Trailing commas where valid in ES5
  "printWidth": 100,               // Max line length 100 chars
  "tabWidth": 2,                   // 2 spaces for indentation
  "useTabs": false,                // Use spaces, not tabs
  "arrowParens": "always",         // Always parentheses around arrow function params
  "endOfLine": "lf"                // Unix line endings
}
```

### **Examples**

```javascript
// ✅ Good - Formatted
const myFunction = (param1, param2) => {
  return {
    name: 'example',
    value: 123,
  };
};

// ❌ Bad - Not formatted
const myFunction=(param1,param2)=>{
    return {name:"example",value:123}}
```

---

## **🔍 Linting Rules**

### **Key ESLint Rules**

| Rule | Setting | Description |
|------|---------|-------------|
| `no-console` | warn | Warn on console usage (except logger.js) |
| `no-unused-vars` | warn | Warn on unused variables |
| `prefer-const` | error | Use const when variable isn't reassigned |
| `no-var` | error | Don't use var, use let/const |
| `eqeqeq` | error | Use === instead of == |
| `curly` | error | Always use braces with if/for/while |
| `quotes` | error | Use single quotes |
| `semi` | error | Always use semicolons |
| `indent` | error | 2 spaces indentation |
| `max-len` | warn | Max 100 chars per line |

### **Examples**

```javascript
// ✅ Good - Follows ESLint rules
const API_KEY = 'sk-...';
let count = 0;

if (count === 0) {
  console.log('Zero');
}

// ❌ Bad - Violates ESLint rules
var API_KEY = "sk-..."  // no var, use single quotes, missing semicolon
let count = 0

if (count == 0)  // use ===, missing braces
  console.log("Zero")  // use single quotes
```

---

## **🔧 Editor Integration**

### **VS Code**

1. **Install recommended extensions**:
   - Prettier - Code formatter (`esbenp.prettier-vscode`)
   - ESLint (`dbaeumer.vscode-eslint`)
   - EditorConfig for VS Code (`editorconfig.editorconfig`)

2. **Settings** (already in `.vscode/settings.json`):
   - Format on save: ✅ Enabled
   - ESLint auto-fix on save: ✅ Enabled
   - Default formatter: Prettier

3. **Usage**:
   - Save file → Auto-format + Auto-fix
   - Or: `Cmd+Shift+P` → "Format Document"

### **Other Editors**

The `.editorconfig` file works with:
- WebStorm / IntelliJ IDEA
- Sublime Text
- Atom
- Vim / Neovim
- And more...

Install the EditorConfig plugin for your editor.

---

## **📝 Git Workflow**

### **Automatic Pre-commit Checks**

The project is configured with **Husky** to automatically run checks before every commit:

```bash
# Just commit normally - hooks run automatically
git add .
git commit -m "Your commit message"

# The pre-commit hook will:
# 1. Format staged files with Prettier
# 2. Lint and auto-fix staged JS files with ESLint
# 3. Prevent commit if there are errors
```

### **What Gets Checked**

- **JavaScript files** (`.js`): Prettier + ESLint
- **CSS files** (`.css`): Prettier only
- **HTML files** (`.html`): Prettier only
- **JSON files** (`.json`): Prettier only

### **Manual Pre-commit Checks**

Before committing, you can manually run:

```bash
# Run the exact same checks as pre-commit hook
make pre-commit

# Or check everything (all files, not just staged)
make check

# If issues found, auto-fix
make format
make lint-fix

# Verify
make check
```

### **Troubleshooting Commits**

**Issue: Commit blocked by lint errors**

```bash
# Fix the errors
make lint-fix

# Re-stage the fixed files
git add .

# Try commit again
git commit -m "Your message"
```

**Issue: Need to commit urgently despite errors**

```bash
# Use --no-verify flag (NOT RECOMMENDED)
git commit --no-verify -m "Emergency fix"
```

⚠️ **Only use `--no-verify` in emergencies!**

### **Optional: Manual Git Hooks**

The automatic hooks are in `.husky/pre-commit`. If you need custom hooks, edit this file.

---

## **🐛 Common Issues**

### **Issue: "Parsing error: Unexpected token"**

**Solution**: Make sure `parserOptions.ecmaVersion` in `.eslintrc.json` matches your code.

### **Issue: "Cannot find module 'eslint'"**

**Solution**: Run `pnpm install` to install dependencies.

### **Issue: "Conflicting rules between Prettier and ESLint"**

**Solution**: Our config is already set up to avoid conflicts. If you add custom rules, use `eslint-config-prettier` to disable conflicting ESLint rules.

### **Issue: "Files not formatting on save"**

**Solution**: 
1. Check VS Code has Prettier extension installed
2. Verify `.vscode/settings.json` has `"editor.formatOnSave": true`
3. Make sure `prettier.requireConfig: true` and `.prettierrc` exists

---

## **🎨 Customization**

### **Change Formatting Rules**

Edit `.prettierrc`:

```json
{
  "printWidth": 120,  // Change max line length
  "tabWidth": 4,      // Change indentation size
  "semi": false       // Remove semicolons
}
```

### **Change Linting Rules**

Edit `.eslintrc.json`:

```json
{
  "rules": {
    "no-console": "off",        // Allow console.log everywhere
    "max-len": ["warn", 120]    // Change max line length
  }
}
```

---

## **📊 Ignoring Files**

### **Prettier Ignore**

Add to `.prettierignore`:
```
dist/
build/
*.min.js
```

### **ESLint Ignore**

Add to `.eslintignore`:
```
node_modules/
dist/
vite.config.js
```

---

## **✅ Best Practices**

1. **Format before committing**: Always run `make format` before pushing
2. **Fix lint warnings**: Don't ignore warnings, they catch bugs
3. **Use editor integration**: Let your editor auto-format on save
4. **Review changes**: Check what formatting changed before committing
5. **Keep rules consistent**: Don't disable rules without team discussion

---

## **📚 Resources**

- [Prettier Documentation](https://prettier.io/docs/en/)
- [ESLint Rules](https://eslint.org/docs/latest/rules/)
- [EditorConfig](https://editorconfig.org/)

---

**Setup complete! Your code will now be automatically formatted and linted. 🎉**
