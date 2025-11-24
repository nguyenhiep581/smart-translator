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
    model: 'claude-sonnet-4-5-20250514',
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
 */
function getLanguageFlag(code) {
  const flags = {
    en: '🇬🇧',
    es: '🇪🇸',
    fr: '🇫🇷',
    de: '🇩🇪',
    it: '🇮🇹',
    pt: '🇵🇹',
    ru: '🇷🇺',
    ja: '🇯🇵',
    ko: '🇰🇷',
    zh: '🇨🇳',
    ar: '🇸🇦',
    hi: '🇮🇳',
    vi: '🇻🇳',
    th: '🇹🇭',
  };
  return flags[code] || '🌐';
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
