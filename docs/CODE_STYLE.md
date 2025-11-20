# 📖 Code Style Guide

## **General Principles**

1. **Readability First**: Code is read more often than written
2. **Consistency**: Follow established patterns
3. **Simplicity**: Prefer simple solutions over clever ones
4. **Documentation**: Comment the "why", not the "what"
5. **Error Handling**: Always handle errors gracefully

---

## **File Structure**

### **Standard File Template**

```javascript
/**
 * [Brief description of file purpose]
 * 
 * [Detailed explanation if needed]
 * 
 * @module [module-name]
 * @requires [dependencies]
 * 
 * @example
 * import { function } from './file.js';
 * const result = function(params);
 */

// Imports (grouped by type)
import { externalLib } from 'external-lib';
import { localUtil } from '../utils/util.js';

// Constants
const CONSTANT_NAME = 'value';

// Main code
export class ClassName {
  // Implementation
}

// Helper functions (if any)
function helperFunction() {
  // Implementation
}
```

---

## **Naming Conventions**

### **Variables & Functions**
```javascript
// ✅ Good: Descriptive camelCase
const translationCache = new Map();
function translateText(text, targetLang) { }
async function fetchTranslation(params) { }

// ❌ Bad: Unclear, abbreviated, inconsistent
const tc = new Map();
function trans(t, l) { }
async function get_trans(params) { }
```

### **Classes**
```javascript
// ✅ Good: PascalCase, noun-based
class TranslationService { }
class OpenAITranslator extends BaseTranslator { }

// ❌ Bad: camelCase, verb-based
class translationService { }
class translateWithOpenAI { }
```

### **Constants**
```javascript
// ✅ Good: UPPER_SNAKE_CASE
const MAX_CACHE_SIZE = 500;
const DEFAULT_TIMEOUT_MS = 30000;
const API_ENDPOINTS = { openai: '...', claude: '...' };

// ❌ Bad: Mixed case
const maxCacheSize = 500;
const Default_Timeout = 30000;
```

### **CSS Classes**
```javascript
// ✅ Good: kebab-case with prefix
<div class="st-mini-popup">
<button class="st-btn st-btn--primary">

// ❌ Bad: No prefix, camelCase
<div class="miniPopup">
<button class="btnPrimary">
```

### **Private Methods (Convention)**
```javascript
class MyClass {
  // ✅ Good: Prefix with underscore
  _privateMethod() { }
  
  // Public method
  publicMethod() {
    this._privateMethod();
  }
}
```

---

## **Documentation Standards**

### **JSDoc Comments**

```javascript
/**
 * Translate text using AI API
 * 
 * This function handles the complete translation workflow including
 * cache checking, API calls, and error handling.
 * 
 * @param {string} text - Text to translate (max 10,000 chars)
 * @param {string} from - Source language code ('auto', 'en', 'ja', 'vi', 'zh')
 * @param {string} to - Target language code ('en', 'ja', 'vi', 'zh')
 * @param {Object} [options] - Optional configuration
 * @param {Function} [options.onProgress] - Progress callback
 * @param {number} [options.timeout=30000] - Request timeout in ms
 * 
 * @returns {Promise<string>} Translated text
 * 
 * @throws {Error} If text is empty or exceeds max length
 * @throws {Error} If API key is not configured
 * @throws {Error} If API request fails or times out
 * 
 * @example
 * // Basic usage
 * const translation = await translate('Hello', 'en', 'vi');
 * console.log(translation); // "Xin chào"
 * 
 * @example
 * // With options
 * const translation = await translate('Hello', 'en', 'vi', {
 *   onProgress: (percent) => console.log(`${percent}%`),
 *   timeout: 60000
 * });
 */
async function translate(text, from, to, options = {}) {
  // Implementation
}
```

### **Inline Comments**

```javascript
// ✅ Good: Explain WHY, not WHAT
// Use LRU cache to maintain performance with limited memory
const cache = new LRUCache(500);

// Timeout prevents hanging on slow API endpoints
const timeoutId = setTimeout(() => controller.abort(), 30000);

// ❌ Bad: Stating the obvious
// Create a new cache
const cache = new LRUCache(500);

// Set timeout to 30 seconds
const timeoutId = setTimeout(() => controller.abort(), 30000);
```

### **TODO Comments**

```javascript
// TODO(username): Add retry logic for network errors
// TODO: Implement streaming for real-time updates
// FIXME: Race condition when clearing cache during translation
// HACK: Workaround for Chrome bug #12345 - remove when fixed
// NOTE: This must run before cache initialization
```

---

## **Function Design**

### **Function Length**
- **Target**: 20-50 lines
- **Max**: 100 lines
- **If longer**: Extract helper functions or refactor

### **Function Responsibilities**
```javascript
// ✅ Good: Single responsibility
async function fetchFromAPI(endpoint, options) {
  return await fetch(endpoint, options);
}

async function parseResponse(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

async function translateText(text) {
  const response = await fetchFromAPI(API_ENDPOINT, buildOptions(text));
  const data = await parseResponse(response);
  return data.translation;
}

// ❌ Bad: Multiple responsibilities
async function translateText(text) {
  // Fetching
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify({ ... })
  });
  
  // Parsing
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  
  // Caching
  cache.set(key, data.translation);
  
  // Telemetry
  trackEvent('translation', { duration: Date.now() - start });
  
  return data.translation;
}
```

### **Parameter Count**
```javascript
// ✅ Good: Max 3-4 parameters, use options object for more
function translate(text, from, to, options = {}) { }

// ❌ Bad: Too many parameters
function translate(text, from, to, model, temperature, maxTokens, stream, callback) { }
```

---

## **Error Handling**

### **Always Wrap Async Operations**
```javascript
// ✅ Good
async function translateText(text) {
  try {
    const result = await api.translate(text);
    return { success: true, data: result };
  } catch (err) {
    logger.error('Translation failed:', err);
    return { success: false, error: err.message };
  }
}

// ❌ Bad: No error handling
async function translateText(text) {
  const result = await api.translate(text);
  return result;
}
```

### **Specific Error Messages**
```javascript
// ✅ Good
if (!text) {
  throw new Error('Translation text is required');
}

if (text.length > 10000) {
  throw new Error(`Text too long (${text.length} chars). Max 10,000 chars.`);
}

// ❌ Bad
if (!text) {
  throw new Error('Invalid input');
}

if (text.length > 10000) {
  throw new Error('Error');
}
```

### **Error Recovery**
```javascript
// ✅ Good: Provide fallbacks
async function getTranslation(text) {
  try {
    return await api.translate(text);
  } catch (err) {
    // Try cache as fallback
    const cached = cache.get(text);
    if (cached) {
      logger.warn('API failed, using cached translation');
      return cached;
    }
    
    // Re-throw if no fallback
    throw err;
  }
}
```

---

## **Async/Await Best Practices**

### **Use Async/Await, Not Callbacks**
```javascript
// ✅ Good
async function getData() {
  const user = await fetchUser();
  const posts = await fetchPosts(user.id);
  return { user, posts };
}

// ❌ Bad
function getData(callback) {
  fetchUser((user) => {
    fetchPosts(user.id, (posts) => {
      callback({ user, posts });
    });
  });
}
```

### **Parallel Execution When Possible**
```javascript
// ✅ Good: Parallel (faster)
const [user, settings, cache] = await Promise.all([
  fetchUser(),
  loadSettings(),
  getCache()
]);

// ❌ Bad: Sequential (slower)
const user = await fetchUser();
const settings = await loadSettings();
const cache = await getCache();
```

### **Error Handling in Promises**
```javascript
// ✅ Good
try {
  const results = await Promise.all([
    api1.call(),
    api2.call()
  ]);
} catch (err) {
  // Handle any rejection
  logger.error('One or more API calls failed:', err);
}

// Or use allSettled for partial success
const results = await Promise.allSettled([
  api1.call(),
  api2.call()
]);

results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`API ${index} succeeded:`, result.value);
  } else {
    logger.error(`API ${index} failed:`, result.reason);
  }
});
```

---

## **Code Organization**

### **Import Order**
```javascript
// 1. External libraries
import { franc } from 'franc-min';

// 2. Internal modules (by type)
import { BaseTranslator } from './translator/baseTranslator.js';
import { CacheService } from './cache/cacheService.js';

// 3. Utilities
import { debug, error } from '../utils/logger.js';
import { getStorage, setStorage } from '../utils/storage.js';

// 4. Config/Constants
import { DEFAULT_CONFIG } from '../config/defaults.js';
```

### **Class Organization**
```javascript
export class MyClass {
  // 1. Static properties
  static DEFAULT_SIZE = 100;
  
  // 2. Constructor
  constructor(config) {
    this.config = config;
  }
  
  // 3. Public methods (alphabetical or logical order)
  async translate(text) { }
  
  async getModel() { }
  
  // 4. Private methods (prefixed with _)
  _buildRequest(text) { }
  
  _handleError(err) { }
}
```

---

## **Testing Patterns**

### **Testable Functions**
```javascript
// ✅ Good: Pure, testable
export function calculateCacheKey(provider, model, text) {
  return `${provider}-${model}-${hash(text)}`;
}

// ❌ Bad: Side effects, hard to test
export function updateCache(text) {
  const key = `${globalProvider}-${globalModel}-${hash(text)}`;
  globalCache.set(key, text);
  updateUI();
}
```

### **Dependency Injection**
```javascript
// ✅ Good: Inject dependencies
class TranslationService {
  constructor(cache, api) {
    this.cache = cache;
    this.api = api;
  }
}

// Easy to test with mocks
const mockCache = { get: jest.fn(), set: jest.fn() };
const mockApi = { translate: jest.fn() };
const service = new TranslationService(mockCache, mockApi);

// ❌ Bad: Hard-coded dependencies
class TranslationService {
  constructor() {
    this.cache = new RealCache();
    this.api = new RealAPI();
  }
}
```

---

## **Security Best Practices**

### **Never Log Sensitive Data**
```javascript
// ✅ Good
logger.debug('API request', { endpoint, model });

// ❌ Bad
logger.debug('API request', { endpoint, apiKey, model });
```

### **Escape User Input**
```javascript
// ✅ Good
import { escapeHtml } from './utils/dom.js';
element.innerHTML = escapeHtml(userInput);

// ❌ Bad
element.innerHTML = userInput; // XSS vulnerability!
```

### **Validate URLs**
```javascript
// ✅ Good
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

if (!isValidUrl(customEndpoint)) {
  throw new Error('Invalid URL');
}
```

---

## **Performance Guidelines**

### **Debounce Expensive Operations**
```javascript
let debounceTimer;

function onTextSelection(event) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    processSelection(event);
  }, 300); // Wait 300ms after last input
}
```

### **Use const/let, Not var**
```javascript
// ✅ Good: Block-scoped
const API_KEY = config.apiKey;
let translationCache = null;

// ❌ Bad: Function-scoped, hoisting issues
var API_KEY = config.apiKey;
var translationCache = null;
```

### **Avoid Memory Leaks**
```javascript
// ✅ Good: Clean up listeners
function attachListeners() {
  const handler = () => { /* ... */ };
  element.addEventListener('click', handler);
  
  return () => {
    element.removeEventListener('click', handler);
  };
}

const cleanup = attachListeners();
// Later:
cleanup();

// ❌ Bad: No cleanup
function attachListeners() {
  element.addEventListener('click', () => { /* ... */ });
}
```

---

## **Git Commit Messages**

### **Format**
```
<type>(<scope>): <subject>

<body>

<footer>
```

### **Types**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance

### **Examples**
```
feat(translator): add Claude API support

- Implement ClaudeTranslator class
- Add streaming support for Claude
- Update config to include Claude settings

Closes #123

---

fix(cache): prevent race condition on clear

Cache was being accessed during clear operation causing
inconsistent state.

- Add mutex lock for cache operations
- Add tests for concurrent access

---

perf(translator): reduce system prompt size

Reduced prompt from 100 to 75 chars for faster API processing.
Maintains translation quality while improving response time by ~15%.
```

---

## **Tools & Automation**

### **Recommended VS Code Extensions**
- ESLint
- Prettier
- Error Lens
- Todo Tree
- GitLens

### **Prettier Config** (`.prettierrc`)
```json
{
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 100
}
```

### **ESLint Config** (`.eslintrc.js`)
```javascript
module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true
  },
  extends: 'eslint:recommended',
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'warn',
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
```

---

## **Code Review Checklist**

Before submitting code for review:

- [ ] Code follows naming conventions
- [ ] All functions have JSDoc comments
- [ ] Error handling is comprehensive
- [ ] No console.log (use logger service)
- [ ] No hardcoded values (use constants)
- [ ] No API keys or secrets in code
- [ ] User input is escaped/validated
- [ ] Performance is acceptable
- [ ] No memory leaks (listeners cleaned up)
- [ ] Works on all supported browsers
- [ ] Tested edge cases
- [ ] Commit messages are descriptive

---

**Remember**: Good code is code that others can understand and maintain. When in doubt, prioritize readability over cleverness.
