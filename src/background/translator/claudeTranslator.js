/**
 * Claude (Anthropic) Translator Implementation
 *
 * Handles translation using Claude's Messages API with support for:
 * - Streaming responses using Server-Sent Events (SSE)
 * - Custom endpoints for self-hosted Claude
 * - Automatic timeout handling (30 seconds)
 * - Content block delta streaming for real-time updates
 *
 * @class ClaudeTranslator
 * @extends BaseTranslator
 *
 * @example
 * const translator = new ClaudeTranslator({
 *   apiKey: 'sk-ant-...',
 *   model: 'claude-3-sonnet-20240229',
 *   host: 'https://api.anthropic.com',
 *   path: '/v1/messages',
 *   temperature: 0.3,
 *   maxTokens: 1000
 * });
 *
 * // Basic translation
 * const result = await translator.translate('Hello', 'en', 'vi');
 *
 * // With streaming callback
 * await translator.translate('Hello', 'en', 'vi', (chunk) => {
 *   console.log('Received:', chunk);
 * });
 */

import { BaseTranslator } from './baseTranslator.js';
import { error as logError } from '../../utils/logger.js';

export class ClaudeTranslator extends BaseTranslator {
  /**
   * Translate text using Claude API
   *
   * @param {string} text - Text to translate (max ~100k tokens for Claude 3)
   * @param {string} from - Source language code ('auto', 'en', 'ja', 'vi', 'zh')
   * @param {string} to - Target language code ('en', 'ja', 'vi', 'zh')
   * @param {Function|null} onStream - Optional streaming callback: (chunk: string) => void
   *
   * @returns {Promise<string>} Translated text
   *
   * @throws {Error} If API key is not configured
   * @throws {Error} If API request fails (network, auth, rate limit, etc.)
   * @throws {Error} If translation times out after 30 seconds
   *
   * @example
   * const translation = await translator.translate('Hello', 'en', 'ja');
   * console.log(translation); // "こんにちは"
   */
  async translate(text, from, to, onStream = null) {
    if (!this.hasValidApiKey()) {
      throw new Error('Claude API key not configured');
    }

    const host = this.config.host || 'https://api.anthropic.com';
    const path = this.config.path || '/v1/messages';
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
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-3-sonnet-20240229',
          max_tokens: this.config.maxTokens || 1000,
          temperature: this.config.temperature || 0.3,
          system: this.buildSystemPrompt(to),
          messages: [
            {
              role: 'user',
              content: text,
            },
          ],
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

              try {
                const json = JSON.parse(data);

                if (json.type === 'content_block_delta') {
                  const content = json.delta?.text;
                  if (content) {
                    fullText += content;
                    onStream(content);
                  }
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

      if (!data.content || !data.content[0]?.text) {
        throw new Error('Invalid response format from Claude');
      }

      return data.content[0].text.trim();
    } catch (err) {
      if (err.name === 'AbortError') {
        logError('Claude API timeout after 30s');
        throw new Error(
          'Translation timeout - API took too long. Try shorter text or check your API endpoint.',
        );
      }
      logError('Claude translation error:', err);
      throw new Error(`Claude API error: ${err.message}`);
    }
  }
}
