/**
 * OpenAI Translator implementation
 */

import { BaseTranslator } from './baseTranslator.js';
import { error as logError } from '../../utils/logger.js';

export class OpenAITranslator extends BaseTranslator {
  /**
   * Translate using OpenAI API with streaming
   */
  async translate(text, from, to, onStream = null) {
    if (!this.hasValidApiKey()) {
      throw new Error('OpenAI API key not configured');
    }

    const host = this.config.host || 'https://api.openai.com';
    const path = this.config.path || '/v1/chat/completions';
    const endpoint = `${host}${path}`;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: this.buildSystemPrompt(to)
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: this.config.temperature || 0.3,
          max_tokens: this.config.maxTokens || 2000,
          stream: !!onStream
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      // Handle streaming response
      if (onStream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

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
      logError('OpenAI translation error:', err);
      throw new Error(`OpenAI API error: ${err.message}`);
    }
  }
}
