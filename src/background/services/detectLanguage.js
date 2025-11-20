/**
 * Language detection service
 * Uses offline heuristic detection or API-based detection
 */

import { franc } from 'franc-min';

/**
 * Map franc language codes to ISO 639-1
 */
const FRANC_TO_ISO = {
  eng: 'en',
  jpn: 'ja',
  vie: 'vi',
  cmn: 'zh', // Mandarin Chinese
  fra: 'fr',
  deu: 'de',
  spa: 'es',
  ita: 'it',
  por: 'pt',
  rus: 'ru',
  kor: 'ko',
  ara: 'ar',
  tha: 'th',
};

/**
 * Detect language of text
 * @param {string} text - Text to detect
 * @param {object} config - Configuration
 * @returns {Promise<string>} Language code
 */
export async function detectLanguage(text, config = {}) {
  if (!text || text.trim().length < 3) {
    return 'auto';
  }

  // Use API detection if enabled
  if (config.useAPIDetection) {
    return await detectWithAPI(text, config);
  }

  // Use offline heuristic detection (default)
  return detectOffline(text);
}

/**
 * Offline language detection using franc
 * @param {string} text
 * @returns {string} Language code
 */
function detectOffline(text) {
  try {
    const detected = franc(text, { minLength: 3 });

    if (detected === 'und') {
      return 'auto'; // Undefined/unknown
    }

    // Map to ISO 639-1
    return FRANC_TO_ISO[detected] || 'auto';
  } catch (err) {
    console.error('Offline detection error:', err);
    return 'auto';
  }
}

/**
 * API-based language detection
 * @param {string} text
 * @param {object} config
 * @returns {Promise<string>}
 */
async function detectWithAPI(text, config) {
  // Use a quick API call to detect language
  // This can use the configured provider (OpenAI/Claude)

  try {
    if (config.provider === 'openai' && config.openai?.apiKey) {
      return await detectWithOpenAI(text, config.openai);
    }

    // Fallback to offline
    return detectOffline(text);
  } catch (err) {
    console.error('API detection error:', err);
    return detectOffline(text);
  }
}

/**
 * Detect language using OpenAI
 * @param {string} text
 * @param {object} config
 * @returns {Promise<string>}
 */
async function detectWithOpenAI(text, config) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'Detect the language of the following text and respond with only the ISO 639-1 language code (e.g., "en", "vi", "ja", "zh").',
        },
        {
          role: 'user',
          content: text.slice(0, 200), // First 200 chars
        },
      ],
      temperature: 0,
      max_tokens: 10,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  const langCode = data.choices[0]?.message?.content?.trim().toLowerCase();

  // Validate it's a 2-letter code
  if (langCode && langCode.length === 2) {
    return langCode;
  }

  throw new Error('Invalid language code from API');
}
