/**
 * Base Translator Class
 *
 * Abstract base class that defines the interface for all translator implementations.
 * All translators (OpenAI, Claude, etc.) must extend this class and implement
 * the translate() method.
 *
 * @abstract
 * @class BaseTranslator
 *
 * @property {Object} config - Translator configuration
 * @property {string} config.apiKey - API key for the translation service
 * @property {string} config.model - Model identifier (e.g., 'gpt-4', 'claude-3-sonnet')
 * @property {string} [config.host] - API host URL (for custom endpoints)
 * @property {string} [config.path] - API path (for custom endpoints)
 * @property {number} [config.temperature=0.3] - Sampling temperature (0-1)
 * @property {number} [config.maxTokens=1000] - Maximum tokens to generate
 *
 * @example
 * class MyTranslator extends BaseTranslator {
 *   async translate(text, from, to) {
 *     // Implementation here
 *     return translatedText;
 *   }
 * }
 */

export class BaseTranslator {
  /**
   * Create a translator instance
   *
   * @param {Object} config - Configuration object
   * @param {string} config.apiKey - API key for authentication
   * @param {string} config.model - Model to use for translation
   * @param {string} [config.host] - Custom API host
   * @param {string} [config.path] - Custom API path
   * @param {number} [config.temperature] - Sampling temperature
   * @param {number} [config.maxTokens] - Max tokens to generate
   */
  constructor(config) {
    this.config = config;
  }

  /**
   * Translate text from one language to another
   * @param {string} text - Text to translate
   * @param {string} from - Source language code
   * @param {string} to - Target language code
   * @returns {Promise<string>} Translated text
   */
  async translate(text, from, to) {
    throw new Error('translate() must be implemented by subclass');
  }

  /**
   * Build system prompt for translation
   * @param {string} to - Target language
   * @returns {string} System prompt
   */
  buildSystemPrompt(to) {
    const langMap = {
      en: 'English',
      ja: 'Japanese',
      vi: 'Vietnamese',
      zh: 'Chinese',
    };

    const targetLang = langMap[to] || to;

    return `Translate to ${targetLang}. Output only translation. Keep format/paragraphs. Preserve HTML/code/names.`;
  }

  /**
   * Get current model being used
   * @returns {string} Model name
   */
  getModel() {
    return this.config.model || 'unknown';
  }

  /**
   * Validate API key
   * @returns {boolean}
   */
  hasValidApiKey() {
    return Boolean(this.config.apiKey && this.config.apiKey.length > 0);
  }
}
