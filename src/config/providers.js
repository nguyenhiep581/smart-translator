/**
 * Provider configurations and constants
 */

export const PROVIDER_TYPES = {
  OPENAI: 'openai',
  CLAUDE: 'claude'
};

export const DEFAULT_ENDPOINTS = {
  OPENAI: 'https://api.openai.com/v1/chat/completions',
  CLAUDE: 'https://api.anthropic.com/v1/messages'
};

export const OPENAI_MODELS = [
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', speed: 'fast', quality: 'excellent', default: true },
  { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', speed: 'medium', quality: 'excellent' },
  { id: 'gpt-4', name: 'GPT-4', speed: 'slow', quality: 'excellent' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', speed: 'fast', quality: 'good' }
];

export const CLAUDE_MODELS = [
  { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku', speed: 'fast', quality: 'excellent', default: true },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', speed: 'slow', quality: 'excellent' },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', speed: 'medium', quality: 'very good' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', speed: 'fast', quality: 'good' }
];

export const API_TIMEOUTS = {
  DEFAULT: 30000, // 30 seconds
  DETECTION: 5000  // 5 seconds for language detection
};

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 8000   // 8 seconds
};
