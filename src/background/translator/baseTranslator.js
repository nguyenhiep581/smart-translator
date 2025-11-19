/**
 * Base Translator class - Abstract interface for all translators
 */

export class BaseTranslator {
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
      zh: 'Chinese'
    };
    
    const targetLang = langMap[to] || to;
    
    return `Translate to ${targetLang}. Rules:
1. Output only translation, no explanations
2. Keep format and paragraphs
3. Preserve HTML tags, code, proper nouns
4. Match %% usage from input`;
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
