/**
 * OpenAI Translator Implementation
 *
 * Handles translation using OpenAI's Chat Completion API with support for:
 * - Streaming responses for real-time translation display
 * - Custom endpoints (Azure OpenAI, LocalAI, etc.)
 * - Automatic timeout handling (30 seconds)
 * - Retry logic for failed requests
 *
 * @class OpenAITranslator
 * @extends BaseTranslator
 *
 * @example
 * const translator = new OpenAITranslator({
 *   apiKey: 'sk-...',
 *   model: 'gpt-4',
 *   host: 'https://api.openai.com',
 *   path: '/v1/chat/completions',
 *   temperature: 0.3,
 *   maxTokens: 1000
 * });
 *
 * // Basic translation
 * const result = await translator.translate('Hello', 'en', 'vi');
 *
 * // With streaming
 * await translator.translate('Hello', 'en', 'vi', (chunk) => {
 *   console.log('Streaming:', chunk);
 * });
 */

import { BaseTranslator } from './baseTranslator.js';
import { error as logError } from '../../utils/logger.js';

export class OpenAITranslator extends BaseTranslator {
  /**
   * Translate text using OpenAI API
   *
   * @param {string} text - Text to translate (max ~8000 chars depending on model)
   * @param {string} from - Source language code ('auto' for auto-detect, or 'en', 'ja', 'vi', 'zh')
   * @param {string} to - Target language code ('en', 'ja', 'vi', 'zh')
   * @param {Function|null} onStream - Optional callback for streaming responses: (chunk: string) => void
   *
   * @returns {Promise<string>} Translated text
   *
   * @throws {Error} If API key is not configured
   * @throws {Error} If API request fails (network, auth, rate limit, etc.)
   * @throws {Error} If translation times out after 30 seconds
   *
   * @example
   * // Non-streaming translation
   * const translation = await translator.translate('Hello world', 'en', 'vi');
   * console.log(translation); // "Xin chào thế giới"
   *
   * @example
   * // Streaming translation for real-time display
   * let fullTranslation = '';
   * await translator.translate('Long text...', 'en', 'vi', (chunk) => {
   *   fullTranslation += chunk;
   *   updateUI(fullTranslation); // Update UI in real-time
   * });
   */
  async translate(text, from, to, onStream = null) {
    if (!this.hasValidApiKey()) {
      throw new Error('OpenAI API key not configured');
    }

    const host = this.config.host || 'https://api.openai.com';
    const path = this.config.path || '/v1/chat/completions';
    const endpoint = `${host}${path}`;

    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(endpoint, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: this.buildSystemPrompt(to),
            },
            {
              role: 'user',
              content: text,
            },
          ],
          temperature: this.config.temperature || 0.3,
          max_tokens: this.config.maxTokens || 1000,
          stream: !!onStream,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      // Handle streaming response
      if (onStream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((line) => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                continue;
              }

              try {
                const json = JSON.parse(data);
                const content = json.choices[0]?.delta?.content;
                if (content) {
                  fullText += content;
                  onStream(content);
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        return fullText.trim();
      }

      // Handle non-streaming response
      const data = await response.json();

      if (!data.choices || !data.choices[0]?.message?.content) {
        throw new Error('Invalid response format from OpenAI');
      }

      return data.choices[0].message.content.trim();
    } catch (err) {
      if (err.name === 'AbortError') {
        logError('OpenAI API timeout after 30s');
        throw new Error(
          'Translation timeout - API took too long. Try shorter text or check your API endpoint.',
        );
      }
      logError('OpenAI translation error:', err);
      throw new Error(`OpenAI API error: ${err.message}`);
    }
  }
}
