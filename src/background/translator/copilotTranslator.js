/**
 * Copilot Translator Implementation
 *
 * Uses Copilot's OpenAI-compatible chat completion endpoint.
 */

import { BaseTranslator } from './baseTranslator.js';
import { error as logError } from '../../utils/logger.js';

export class CopilotTranslator extends BaseTranslator {
  /**
   * Translate text using Copilot API
   */
  async translate(text, from, to, onStream = null) {
    if (!this.hasValidApiKey()) {
      throw new Error('Copilot API key not configured');
    }

    const host = this.config.host || 'https://api.githubcopilot.com';
    const path = this.config.path || '/chat/completions';
    const endpoint = `${host}${path}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(endpoint, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: this.buildSystemPrompt(to) },
            { role: 'user', content: text },
          ],
          temperature: this.config.temperature ?? 0.3,
          max_tokens: this.config.maxTokens ?? 2048,
          stream: !!onStream,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      // Streaming handling (OpenAI style)
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
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  fullText += content;
                  onStream(content);
                }
              } catch (e) {
                // ignore malformed chunks
              }
            }
          }
        }

        return fullText.trim();
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Invalid response format from Copilot');
      }

      return content.trim();
    } catch (err) {
      if (err.name === 'AbortError') {
        logError('Copilot API timeout after 30s');
        throw new Error('Translation timeout - Copilot API took too long.');
      }
      logError('Copilot translation error:', err);
      throw new Error(`Copilot API error: ${err.message}`);
    }
  }
}
