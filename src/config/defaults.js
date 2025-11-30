import {
  DEFAULT_PROVIDER,
  OPENAI_DEFAULT_MODEL,
  CLAUDE_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  DEFAULT_HOSTS,
  DEFAULT_PATHS,
  DEFAULT_CHAT_TEMPERATURE,
  DEFAULT_TRANSLATION_TEMPERATURE,
  DEFAULT_CHAT_MAX_TOKENS,
} from './constants.js';

/**
 * Default configuration for Smart Translator
 */
export const DEFAULT_CONFIG = {
  // Provider settings
  provider: DEFAULT_PROVIDER,
  systemPrompt: '',

  // OpenAI settings
  openai: {
    apiKey: '',
    model: OPENAI_DEFAULT_MODEL,
    host: DEFAULT_HOSTS.OPENAI,
    path: DEFAULT_PATHS.OPENAI,
    temperature: DEFAULT_TRANSLATION_TEMPERATURE,
    maxTokens: DEFAULT_CHAT_MAX_TOKENS,
  },

  // Claude settings
  claude: {
    apiKey: '',
    model: CLAUDE_DEFAULT_MODEL,
    host: DEFAULT_HOSTS.CLAUDE,
    path: DEFAULT_PATHS.CLAUDE,
    temperature: DEFAULT_TRANSLATION_TEMPERATURE,
    maxTokens: DEFAULT_CHAT_MAX_TOKENS,
  },

  // Gemini settings
  gemini: {
    apiKey: '',
    model: GEMINI_DEFAULT_MODEL,
    temperature: DEFAULT_TRANSLATION_TEMPERATURE,
    maxTokens: DEFAULT_CHAT_MAX_TOKENS,
  },

  // Chat-specific settings (overrides provider defaults)
  chat: {
    temperature: DEFAULT_CHAT_TEMPERATURE,
  },

  // Web search settings
  webSearch: {
    provider: 'ddg',
  },

  // Language settings
  defaultFromLang: 'auto',
  defaultToLang: 'vi',
  supportedTargetLanguages: ['en', 'ja', 'vi', 'zh'],

  // Cache settings
  cacheEnabled: true,
  cacheTTL: 86400000, // 24 hours in milliseconds
  maxCacheEntries: 500,
  cache: {
    maxEntries: 500,
    ttl: 86400000,
  },

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
  // Use real emoji codepoints to avoid escaping issues across platforms
  const flags = {
    en: String.fromCodePoint(0x1f1ec, 0x1f1e7), // 🇬🇧
    es: String.fromCodePoint(0x1f1ea, 0x1f1f8), // 🇪🇸
    fr: String.fromCodePoint(0x1f1eb, 0x1f1f7), // 🇫🇷
    de: String.fromCodePoint(0x1f1e9, 0x1f1ea), // 🇩🇪
    it: String.fromCodePoint(0x1f1ee, 0x1f1f9), // 🇮🇹
    pt: String.fromCodePoint(0x1f1f5, 0x1f1f9), // 🇵🇹
    ru: String.fromCodePoint(0x1f1f7, 0x1f1fa), // 🇷🇺
    ja: String.fromCodePoint(0x1f1ef, 0x1f1f5), // 🇯🇵
    ko: String.fromCodePoint(0x1f1f0, 0x1f1f7), // 🇰🇷
    zh: String.fromCodePoint(0x1f1e8, 0x1f1f3), // 🇨🇳
    ar: String.fromCodePoint(0x1f1f8, 0x1f1e6), // 🇸🇦
    hi: String.fromCodePoint(0x1f1ee, 0x1f1f3), // 🇮🇳
    vi: String.fromCodePoint(0x1f1fb, 0x1f1f3), // 🇻🇳
    th: String.fromCodePoint(0x1f1f9, 0x1f1ed), // 🇹🇭
  };
  return flags[code] || String.fromCodePoint(0x1f310); // 🌐
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
