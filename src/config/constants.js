export const DEFAULT_PROVIDER = 'openai';

export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
export const CLAUDE_DEFAULT_MODEL = 'claude-sonnet-4-5';
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';

// Fallback/Secondary models
export const OPENAI_FALLBACK_MODEL = 'gpt-4o';
export const CLAUDE_FALLBACK_MODEL = 'claude-haiku-3-5';
export const GEMINI_FALLBACK_MODEL = 'gemini-1.5-pro';

export const DEFAULT_HOSTS = {
  OPENAI: 'https://api.openai.com',
  CLAUDE: 'https://api.anthropic.com',
};

export const DEFAULT_PATHS = {
  OPENAI: '/v1/chat/completions',
  CLAUDE: '/v1/messages',
};

// Default generation settings
export const DEFAULT_TEMPERATURE = {
  openai: 0.3,
  claude: 0.3,
  gemini: 0.3,
};

export const DEFAULT_MAX_TOKENS = {
  openai: 2048,
  claude: 2048,
  gemini: 2048,
};
