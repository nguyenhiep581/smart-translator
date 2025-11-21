/**
 * Gemini Translator Implementation
 *
 * Uses Google's Generative Language API (Gemini) via generateContent.
 */

import { BaseTranslator } from './baseTranslator.js';
import { error as logError } from '../../utils/logger.js';

export class GeminiTranslator extends BaseTranslator {
  /**
   * Translate text using Gemini
   * @param {string} text
   * @param {string} from
   * @param {string} to
   * @param {Function|null} onStream - not supported for Gemini; ignored
   * @returns {Promise<string>}
   */
  async translate(text, from, to, onStream = null) {
    if (!this.hasValidApiKey()) {
      throw new Error('Gemini API key not configured');
    }

    const host = this.config.host || 'https://generativelanguage.googleapis.com';
    const path =
      this.config.path || '/v1beta/models/gemini-pro:generateContent?key=' + this.config.apiKey;
    const endpoint = path.startsWith('http') ? path : `${host}${path}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(endpoint, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text }],
            },
          ],
          systemInstruction: {
            role: 'system',
            parts: [{ text: this.buildSystemPrompt(to) }],
          },
          generationConfig: {
            temperature: this.config.temperature ?? 0.3,
            maxOutputTokens: this.config.maxTokens ?? 2048,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textPart) {
        throw new Error('Invalid response format from Gemini');
      }

      return String(textPart).trim();
    } catch (err) {
      if (err.name === 'AbortError') {
        logError('Gemini API timeout after 30s');
        throw new Error('Translation timeout - Gemini API took too long.');
      }
      logError('Gemini translation error:', err);
      throw new Error(`Gemini API error: ${err.message}`);
    }
  }
}
