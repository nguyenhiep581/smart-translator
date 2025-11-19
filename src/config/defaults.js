/**
 * Default configuration for Smart Translator
 */
export const DEFAULT_CONFIG = {
  // Provider settings
  provider: 'openai',
  
  // OpenAI settings
  openai: {
    apiKey: '',
    model: 'gpt-5-mini',
    host: 'https://api.openai.com',
    path: '/v1/chat/completions',
    temperature: 0.3,
    maxTokens: 2000
  },
  
  // Claude settings
  claude: {
    apiKey: '',
    model: 'claude-haiku-4-5-20251001',
    host: 'https://api.anthropic.com',
    path: '/v1/messages',
    temperature: 0.3,
    maxTokens: 2000
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
  telemetryEnabled: true,
  
  // Keyboard shortcuts
  shortcuts: {
    translate: 'Ctrl+Shift+T',
    expandMode: 'Ctrl+Shift+E'
  }
};

/**
 * Language codes mapping
 */
export const LANGUAGES = {
  en: { name: 'English', nativeName: 'English' },
  ja: { name: 'Japanese', nativeName: '日本語' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  zh: { name: 'Chinese', nativeName: '中文' },
  auto: { name: 'Auto Detect', nativeName: 'Auto Detect' }
};

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  NO_API_KEY: 'API key not configured. Please set it in options.',
  TRANSLATION_FAILED: 'Translation failed. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  RATE_LIMIT: 'Rate limit exceeded. Please try again later.',
  INVALID_LANGUAGE: 'Invalid language selected.',
  CACHE_ERROR: 'Cache error occurred.'
};
