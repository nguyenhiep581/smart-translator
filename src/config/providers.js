/**
 * Provider configurations and constants
 */

export const PROVIDER_TYPES = {
  OPENAI: 'openai',
  CLAUDE: 'claude',
};

export const DEFAULT_ENDPOINTS = {
  OPENAI: 'https://api.openai.com/v1/chat/completions',
  CLAUDE: 'https://api.anthropic.com/v1/messages',
};

export const OPENAI_MODELS = [
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    speed: 'fast',
    quality: 'excellent',
    default: true,
  },
];

export const CLAUDE_MODELS = [
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    speed: 'fast',
    quality: 'excellent',
    default: true,
  },
  {
    id: 'claude-haiku-3-5',
    name: 'Claude Haiku 3.5',
    speed: 'very fast',
    quality: 'good',
    default: false,
  },
];

export const API_TIMEOUTS = {
  DEFAULT: 30000, // 30 seconds
  DETECTION: 5000, // 5 seconds for language detection
};

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 8000, // 8 seconds
};
