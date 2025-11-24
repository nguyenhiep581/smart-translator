/**
 * Default configuration for Smart Translator
 */
export const DEFAULT_CONFIG = {
  // Provider settings
  provider: 'openai',

  // OpenAI settings
  openai: {
    apiKey: '',
    model: 'gpt-5.1',
    host: 'https://api.openai.com',
    path: '/v1/chat/completions',
    temperature: 0.3,
    maxTokens: 10000,
  },

  // Claude settings
  claude: {
    apiKey: '',
    model: 'claude-sonnet-4-5',
    host: 'https://api.anthropic.com',
    path: '/v1/messages',
    temperature: 0.3,
    maxTokens: 10000,
  },

  // Gemini settings
  gemini: {
    apiKey: '',
    model: 'gemini-2.0-flash-exp',
    temperature: 0.3,
    maxTokens: 10000,
  },

  // Language settings
  defaultFromLang: 'auto',
  defaultToLang: 'vi',
  supportedTargetLanguages: ['en', 'ja', 'vi', 'zh'],

  // Cache settings
  cacheEnabled: true,
  cacheTTL: 86400000, // 24 hours in milliseconds
  maxCacheEntries: 500,

  // Language detection
  autoDetect: true,
  useAPIDetection: false, // Use heuristic by default

  // UI settings
  theme: 'light',
  animationSpeed: 'normal', // fast, normal, slow

  // Advanced settings
  debugMode: false,
  enableCtrlShortcut: false, // Ctrl/Cmd shortcut disabled by default

  // Keyboard shortcuts
  shortcuts: {
    translate: 'Ctrl+Shift+T',
    expandMode: 'Ctrl+Shift+E',
  },

  // Side panel hotkey (in-page listener)
  sidePanelHotkey: 'Alt+S',
};

/**
 * Language codes mapping
 */
export const LANGUAGES = {
  en: { name: 'English', nativeName: 'English' },
  es: { name: 'Spanish', nativeName: 'Español' },
  fr: { name: 'French', nativeName: 'Français' },
  de: { name: 'German', nativeName: 'Deutsch' },
  it: { name: 'Italian', nativeName: 'Italiano' },
  pt: { name: 'Portuguese', nativeName: 'Português' },
  ru: { name: 'Russian', nativeName: 'Русский' },
  ja: { name: 'Japanese', nativeName: '日本語' },
  ko: { name: 'Korean', nativeName: '한국어' },
  zh: { name: 'Chinese', nativeName: '中文' },
  ar: { name: 'Arabic', nativeName: 'العربية' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  th: { name: 'Thai', nativeName: 'ไทย' },
  auto: { name: 'Auto Detect', nativeName: 'Auto Detect' },
};

/**
 * Get target languages (excludes 'auto')
 */
export function getTargetLanguages() {
  return Object.entries(LANGUAGES)
    .filter(([code]) => code !== 'auto')
    .map(([code, lang]) => ({ code, name: lang.name, flag: getLanguageFlag(code) }));
}

/**
 * Get language emoji flag
 * Uses Unicode flag emojis with Windows-compatible fallback
 */
function getLanguageFlag(code) {
  // Windows-compatible approach: Use Segoe UI Emoji font hint
  const flags = {
    en: '\uD83C\uDDEC\uD83C\uDDE7', // 🇬🇧
    es: '\uD83C\uDDEA\uD83C\uDDF8', // 🇪🇸
    fr: '\uD83C\uDDEB\uD83C\uDDF7', // 🇫🇷
    de: '\uD83C\uDDE9\uD83C\uDDEA', // 🇩🇪
    it: '\uD83C\uDDEE\uD83C\uDDF9', // 🇮🇹
    pt: '\uD83C\uDDF5\uD83C\uDDF9', // 🇵🇹
    ru: '\uD83C\uDDF7\uD83C\uDDFA', // 🇷🇺
    ja: '\uD83C\uDDEF\uD83C\uDDF5', // 🇯🇵
    ko: '\uD83C\uDDF0\uD83C\uDDF7', // 🇰🇷
    zh: '\uD83C\uDDE8\uD83C\uDDF3', // 🇨🇳
    ar: '\uD83C\uDDF8\uD83C\uDDE6', // 🇸🇦
    hi: '\uD83C\uDDEE\uD83C\uDDF3', // 🇮🇳
    vi: '\uD83C\uDDFB\uD83C\uDDF3', // 🇻🇳
    th: '\uD83C\uDDF9\uD83C\uDDED', // 🇹🇭
  };
  return flags[code] || '\uD83C\uDF10'; // 🌐
}

/**
 * Generate language options HTML
 */
export function generateLanguageOptions(selectedLang = 'vi', includeAuto = false) {
  const languages = includeAuto
    ? Object.entries(LANGUAGES)
    : Object.entries(LANGUAGES).filter(([code]) => code !== 'auto');

  return languages
    .map(
      ([code, lang]) =>
        `<option value="${code}" ${code === selectedLang ? 'selected' : ''}>${lang.name}</option>`,
    )
    .join('');
}

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  NO_API_KEY: 'API key not configured. Please set it in options.',
  TRANSLATION_FAILED: 'Translation failed. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  RATE_LIMIT: 'Rate limit exceeded. Please try again later.',
  INVALID_LANGUAGE: 'Invalid language selected.',
  CACHE_ERROR: 'Cache error occurred.',
};
