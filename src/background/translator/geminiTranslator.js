/**
 * Gemini Translator Implementation
 *
 * Uses Google's Generative Language API (Gemini) via official @google/genai SDK.
 */

import { GoogleGenAI } from '@google/genai';
import { BaseTranslator } from './baseTranslator.js';
import { error as logError, debug } from '../../utils/logger.js';
import {
  GEMINI_DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
} from '../../config/constants.js';

export class GeminiTranslator extends BaseTranslator {
  /**
   * Translate text using Gemini
   * @param {string} text
   * @param {string} from
   * @param {string} to
   * @param {Function|null} onStream - Optional callback for streaming responses
   * @returns {Promise<string>}
   */
  async translate(text, from, to, onStream = null) {
    if (!this.hasValidApiKey()) {
      throw new Error('Gemini API key not configured');
    }

    try {
      // Initialize GoogleGenAI client
      const ai = new GoogleGenAI({ apiKey: this.config.apiKey });

      // Get model name (remove 'models/' prefix if present)
      const modelName = this.config.model?.replace(/^models\//, '') || GEMINI_DEFAULT_MODEL;

      // Prepare generation config with strict settings to prevent explanations
      const generationConfig = {
        temperature:
          this.config.temperature !== undefined
            ? this.config.temperature
            : DEFAULT_TEMPERATURE.gemini,
        maxOutputTokens: this.config.maxTokens ?? DEFAULT_MAX_TOKENS.gemini,
        topP: 0.8, // Reduce randomness
        topK: 20, // More focused sampling
      };

      const systemInstruction = this.buildSystemPrompt(to);

      // Debug logging
      debug('[Gemini] Translation request:', {
        model: modelName,
        from,
        to,
        textLength: text.length,
        textPreview: text.substring(0, 100),
        config: generationConfig,
        systemPrompt: systemInstruction,
      });

      // Set timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        // Use streaming if callback provided
        if (onStream && typeof onStream === 'function') {
          const result = await ai.models.generateContentStream({
            model: modelName,
            contents: text,
            config: {
              ...generationConfig,
              systemInstruction: [systemInstruction],
            },
          });

          let fullText = '';
          let chunkCount = 0;
          for await (const chunk of result) {
            chunkCount++;
            // Get chunk text - check both .text property and .text() method
            const chunkText = typeof chunk.text === 'function' ? chunk.text() : chunk.text;

            debug(`[Gemini] Chunk ${chunkCount}:`, {
              chunkText: chunkText?.substring(0, 100),
            });

            if (chunkText) {
              fullText += chunkText;
              onStream(chunkText);
            }
          }

          debug('[Gemini] Streaming complete:', {
            totalChunks: chunkCount,
            finalLength: fullText.length,
            preview: fullText.substring(0, 200),
          });

          clearTimeout(timeoutId);
          return fullText.trim();
        } else {
          // Non-streaming fallback
          const result = await ai.models.generateContent({
            model: modelName,
            contents: text,
            config: {
              ...generationConfig,
              systemInstruction: [systemInstruction],
            },
          });

          clearTimeout(timeoutId);

          debug('[Gemini] Non-streaming response:', {
            hasText: !!result.text,
            hasCandidates: !!result.candidates,
          });

          // Get text from result
          const translatedText = result.text;

          if (!translatedText) {
            logError('Unexpected Gemini response structure:', result);
            throw new Error('Invalid response format from Gemini');
          }

          debug('[Gemini] Translation result:', translatedText.substring(0, 200));

          return translatedText.trim();
        }
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        logError('Gemini API timeout after 30s');
        throw new Error('Translation timeout - Gemini API took too long.');
      }

      // Parse API errors for better user messages
      const errorMsg = err.message || '';

      if (errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429')) {
        logError('Gemini quota exceeded:', err);
        throw new Error(
          'Gemini API quota exceeded. Please check your billing at https://ai.google.dev/pricing or wait for quota reset.',
        );
      }

      if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('403')) {
        logError('Gemini API key invalid:', err);
        throw new Error(
          "Gemini API key is invalid or doesn't have permission. Check your key at https://aistudio.google.com/app/apikey",
        );
      }

      if (errorMsg.includes('INVALID_ARGUMENT') || errorMsg.includes('400')) {
        logError('Gemini invalid request:', err);
        throw new Error(
          'Invalid request to Gemini API. Please check your model name and settings.',
        );
      }

      logError('Gemini translation error:', err);
      throw new Error(`Gemini API error: ${err.message}`);
    }
  }
}
