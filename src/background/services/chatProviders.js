import { GoogleGenAI } from '@google/genai';
import { OpenAITranslator } from '../translator/openAITranslator.js';
import { ClaudeTranslator } from '../translator/claudeTranslator.js';
import { GeminiTranslator } from '../translator/geminiTranslator.js';
import { error as logError } from '../../utils/logger.js';
import {
  OPENAI_DEFAULT_MODEL,
  CLAUDE_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  DEFAULT_HOSTS,
  DEFAULT_PATHS,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
} from '../../config/constants.js';
import { sanitizeModel } from '../../config/providers.js';

export function createChatProvider(config, provider) {
  switch (provider) {
    case 'openai':
      return new ChatOpenAI(config.openai);
    case 'claude':
      return new ChatClaude(config.claude);
    case 'gemini':
      return new ChatGemini(config.gemini);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export class ChatOpenAI extends OpenAITranslator {
  async chat(systemPrompt, messages, conversation) {
    const host = this.config.host || DEFAULT_HOSTS.OPENAI;
    const path = this.config.path || DEFAULT_PATHS.OPENAI;
    const endpoint = `${host}${path}`;
    const bodyMessages = messages.map((m) => normalizeOpenAIMessage(m));
    if (systemPrompt) {
      bodyMessages.unshift({ role: 'system', content: systemPrompt });
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || conversation.model || OPENAI_DEFAULT_MODEL,
          messages: bodyMessages,
          temperature:
            conversation.temperature ??
            (this.config.temperature !== undefined
              ? this.config.temperature
              : DEFAULT_TEMPERATURE.openai),
          max_tokens: conversation.maxTokens || this.config.maxTokens || DEFAULT_MAX_TOKENS.openai,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Invalid response from OpenAI');
      }
      return content.trim();
    } catch (err) {
      logError('OpenAI chat error:', err);
      throw err;
    }
  }
}

export class ChatClaude extends ClaudeTranslator {
  async chat(systemPrompt, messages, conversation) {
    const host = this.config.host || DEFAULT_HOSTS.CLAUDE;
    const path = this.config.path || DEFAULT_PATHS.CLAUDE;
    const endpoint = `${host}${path}`;
    const claudeMessages = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model || conversation.model || CLAUDE_DEFAULT_MODEL,
          max_tokens: conversation.maxTokens || this.config.maxTokens || DEFAULT_MAX_TOKENS.claude,
          temperature:
            conversation.temperature ??
            (this.config.temperature !== undefined
              ? this.config.temperature
              : DEFAULT_TEMPERATURE.claude),
          system: systemPrompt || '',
          messages: claudeMessages,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const content = data.content?.[0]?.text;
      if (!content) {
        throw new Error('Invalid response from Claude');
      }
      return content.trim();
    } catch (err) {
      logError('Claude chat error:', err);
      throw err;
    }
  }
}

export class ChatGemini extends GeminiTranslator {
  async chat(systemPrompt, messages, conversation) {
    const ai = new GoogleGenAI({ apiKey: this.config.apiKey });
    const modelName = sanitizeModel(
      'gemini',
      this.config.model || conversation.model || GEMINI_DEFAULT_MODEL,
    );

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const generationConfig = {
      temperature:
        conversation.temperature ??
        (this.config.temperature !== undefined
          ? this.config.temperature
          : DEFAULT_TEMPERATURE.gemini),
      maxOutputTokens: conversation.maxTokens || this.config.maxTokens || DEFAULT_MAX_TOKENS.gemini,
    };

    try {
      // Generate content with system instruction in config
      // Use debug instead of error for request logging
      // debug('Gemini request', {
      //   model: modelName,
      //   systemPrompt,
      //   messageCount: messages.length,
      //   maxOutputTokens: generationConfig.maxOutputTokens,
      // });
      const result = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          ...generationConfig,
          systemInstruction: systemPrompt ? [systemPrompt] : undefined,
        },
      });

      const candidate = result?.response?.candidates?.[0];
      let partsText =
        candidate?.content?.parts
          ?.map((p) => (typeof p.text === 'function' ? p.text() : p.text) || '')
          .join('') ||
        result?.text ||
        '';

      // Handle if result.text is a function (SDK helper)
      if (!partsText && typeof result?.text === 'function') {
        try {
          partsText = result.text();
        } catch (e) {
          // ignore
        }
      }

      if (!partsText) {
        const promptFeedback = result?.response?.promptFeedback;
        const blockReason =
          promptFeedback?.blockReason ||
          promptFeedback?.blockReasonMessage ||
          candidate?.finishReason;
        logError('Gemini chat empty content', {
          model: modelName,
          finishReason: candidate?.finishReason,
          safetyRatings: candidate?.safetyRatings,
          candidatesCount: result?.response?.candidates?.length,
          promptFeedback,
          fullResult: result,
        });
        const userMsg = blockReason
          ? `Gemini blocked the response (${blockReason}).`
          : 'Gemini returned empty content.';
        throw new Error(userMsg);
      }
      return partsText.trim();
    } catch (err) {
      logError('Gemini chat error:', err);
      throw err;
    }
  }
}

export function normalizeOpenAIMessage(message) {
  if (!message.attachments || message.attachments.length === 0) {
    return message;
  }

  const parts = [{ type: 'text', text: message.content }];
  message.attachments.slice(0, 4).forEach((att) => {
    if (att.isMarkdown) {
      // For markdown files, extract text content and append to message
      const mdContent = att.dataUrl; // Text content for markdown
      parts.push({
        type: 'text',
        text: `\n\n--- File: ${att.name} ---\n${mdContent}\n--- End of ${att.name} ---\n`,
      });
    } else {
      // For images, use image_url
      parts.push({
        type: 'image_url',
        image_url: {
          url: att.dataUrl,
        },
      });
    }
  });

  return {
    ...message,
    attachments: undefined,
    content: parts,
  };
}
