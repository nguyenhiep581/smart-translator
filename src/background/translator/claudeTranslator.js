/**
 * Claude (Anthropic) Translator implementation
 */

import { BaseTranslator } from './baseTranslator.js';
import { error as logError } from '../../utils/logger.js';

export class ClaudeTranslator extends BaseTranslator {
  /**
   * Translate using Claude API with streaming
   */
  async translate(text, from, to, onStream = null) {
    if (!this.hasValidApiKey()) {
      throw new Error('Claude API key not configured');
    }

    const host = this.config.host || 'https://api.anthropic.com';
    const path = this.config.path || '/v1/messages';
    const endpoint = `${host}${path}`;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-3-sonnet-20240229',
          max_tokens: this.config.maxTokens || 2000,
          temperature: this.config.temperature || 0.3,
          system: this.buildSystemPrompt(to),
          messages: [
            {
              role: 'user',
              content: text
            }
          ],
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
      logError('Claude translation error:', err);
      throw new Error(`Claude API error: ${err.message}`);
    }
  }
}
