import {
  DEFAULT_PROVIDER,
  OPENAI_DEFAULT_MODEL,
  CLAUDE_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  OPENAI_FALLBACK_MODEL,
  CLAUDE_FALLBACK_MODEL,
  GEMINI_FALLBACK_MODEL,
} from './constants.js';

export const SUPPORTED_PROVIDERS = ['openai', 'claude', 'gemini'];

export const PROVIDER_DEFAULT_MODELS = {
  openai: [OPENAI_DEFAULT_MODEL, OPENAI_FALLBACK_MODEL, 'gpt-4-turbo', 'gpt-3.5-turbo'],
  claude: [CLAUDE_DEFAULT_MODEL, CLAUDE_FALLBACK_MODEL],
  gemini: [GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODEL],
};

function isGeminiAllowed(model) {
  if (!model) {
    return false;
  }
  const normalized = model.replace(/^models\//, '').toLowerCase();
  return (
    normalized.startsWith('gemini') &&
    !normalized.includes('embed') &&
    !normalized.includes('gecko')
  );
}

export function filterModelsByProvider(provider, models = []) {
  const filtered = (models || []).filter(Boolean);
  if (provider === 'gemini') {
    return filtered.map((m) => m.replace(/^models\//, '')).filter((m) => isGeminiAllowed(m));
  }
  return filtered;
}

export function sanitizeModel(provider, model) {
  const normalized = (model || '').replace(/^models\//, '');
  if (provider === 'gemini') {
    if (isGeminiAllowed(normalized)) {
      return normalized;
    }
    return GEMINI_DEFAULT_MODEL;
  }
  if (normalized) {
    return normalized;
  }
  return getDefaultModel(provider);
}

export function getDefaultModel(provider = DEFAULT_PROVIDER) {
  const list = PROVIDER_DEFAULT_MODELS[provider];
  if (list && list.length > 0) {
    return list[0];
  }
  return OPENAI_DEFAULT_MODEL;
}
