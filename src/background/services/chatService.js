import { getStorage, setStorage } from '../../utils/storage.js';
import { OpenAITranslator } from '../translator/openAITranslator.js';
import { ClaudeTranslator } from '../translator/claudeTranslator.js';
import { GeminiTranslator } from '../translator/geminiTranslator.js';
import { CopilotTranslator } from '../translator/copilotTranslator.js';
import { error as logError } from '../../utils/logger.js';

const CHAT_KEY = 'chatConversations';
const SUMMARY_SYSTEM_PROMPT = `You are a conversation summarizer.
Summarize the following messages into a concise description preserving key facts, details, user preferences, decisions, tasks, and important context.
Keep the summary under 200 words.`;

export async function getConversations() {
  const { [CHAT_KEY]: conversations = [] } = await getStorage(CHAT_KEY);
  return conversations;
}

export async function saveConversations(conversations) {
  await setStorage({ [CHAT_KEY]: conversations });
}

export async function upsertConversation(conversation) {
  const conversations = await getConversations();
  const idx = conversations.findIndex((c) => c.id === conversation.id);
  if (idx >= 0) {
    conversations[idx] = conversation;
  } else {
    conversations.unshift(conversation);
  }
  await saveConversations(conversations);
}

export async function deleteConversation(id) {
  const conversations = await getConversations();
  const filtered = conversations.filter((c) => c.id !== id);
  await saveConversations(filtered);
}

export function createEmptyConversation(provider, model, systemPrompt = '', maxTokens = 2048) {
  const id = `chat_${Date.now()}`;
  return {
    id,
    title: 'New chat',
    provider,
    model,
    systemPrompt,
    maxTokens,
    messages: [],
    updatedAt: Date.now(),
  };
}

export async function sendChatMessage(config, conversation, userMessage) {
  await ensureSummaryIfNeeded(config, conversation, userMessage);
  const translator = createTranslator(config, conversation.provider);
  const { systemPrompt, messages } = buildChatPayload(conversation, userMessage);
  const response = await translator.chat(systemPrompt, messages, conversation);
  return response;
}

function createTranslator(config, provider) {
  switch (provider) {
    case 'openai':
      return new ChatOpenAI(config.openai);
    case 'claude':
      return new ChatClaude(config.claude);
    case 'gemini':
      return new ChatGemini(config.gemini);
    case 'copilot':
      return new ChatCopilot(config.copilot);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

class ChatOpenAI extends OpenAITranslator {
  async chat(systemPrompt, messages, conversation) {
    const host = this.config.host || 'https://api.openai.com';
    const path = this.config.path || '/v1/chat/completions';
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
          model: conversation.model || this.config.model || 'gpt-4o-mini',
          messages: bodyMessages,
          temperature: this.config.temperature ?? 0.3,
          max_tokens: conversation.maxTokens || this.config.maxTokens || 2048,
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

class ChatCopilot extends CopilotTranslator {
  async chat(systemPrompt, messages, conversation) {
    const host = this.config.host || 'https://api.githubcopilot.com';
    const path = this.config.path || '/chat/completions';
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
          model: conversation.model || this.config.model || 'gpt-4o-mini',
          messages: bodyMessages,
          temperature: this.config.temperature ?? 0.3,
          max_tokens: conversation.maxTokens || this.config.maxTokens || 2048,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Invalid response from Copilot');
      }
      return content.trim();
    } catch (err) {
      logError('Copilot chat error:', err);
      throw err;
    }
  }
}

class ChatClaude extends ClaudeTranslator {
  async chat(systemPrompt, messages, conversation) {
    const host = this.config.host || 'https://api.anthropic.com';
    const path = this.config.path || '/v1/messages';
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
          model: conversation.model || this.config.model || 'claude-haiku-4-5-20251001',
          max_tokens: conversation.maxTokens || this.config.maxTokens || 2048,
          temperature: this.config.temperature ?? 0.3,
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

class ChatGemini extends GeminiTranslator {
  async chat(systemPrompt, messages, conversation) {
    const host = this.config.host || 'https://generativelanguage.googleapis.com';
    const path =
      this.config.path || '/v1beta/models/gemini-pro:generateContent?key=' + this.config.apiKey;
    const endpoint = path.startsWith('http') ? path : `${host}${path}`;

    const userParts = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: userParts,
          systemInstruction: systemPrompt
            ? { role: 'system', parts: [{ text: systemPrompt }] }
            : undefined,
          generationConfig: {
            temperature: this.config.temperature ?? 0.3,
            maxOutputTokens: conversation.maxTokens || this.config.maxTokens || 2048,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textPart) {
        throw new Error('Invalid response from Gemini');
      }
      return String(textPart).trim();
    } catch (err) {
      logError('Gemini chat error:', err);
      throw err;
    }
  }
}

export async function streamChatMessage(config, conversation, userMessage, onChunk) {
  const provider = conversation.provider;
  if (provider === 'gemini') {
    const text = await sendChatMessage(config, conversation, userMessage);
    onChunk(text, true);
    return text;
  }
  if (provider === 'openai' || provider === 'copilot') {
    return streamOpenAIStyle(config, conversation, userMessage, onChunk);
  }
  if (provider === 'claude') {
    return streamClaude(config, conversation, userMessage, onChunk);
  }
  throw new Error(`Streaming not supported for provider: ${provider}`);
}

function buildChatPayload(conversation, userMessage) {
  const history = conversation.messages || [];
  const contextMessages = history.slice(-6);
  const combined = [...contextMessages, userMessage];
  const systemPrompt = conversation.systemPrompt || '';

  const messages = [];
  if (conversation.summary) {
    messages.push({ role: 'assistant', content: `Conversation summary: ${conversation.summary}` });
  }
  messages.push(...combined);

  return { systemPrompt, messages };
}

async function streamOpenAIStyle(config, conversation, userMessage, onChunk) {
  const useCopilot = conversation.provider === 'copilot';
  const host = useCopilot
    ? config.copilot.host || 'https://api.githubcopilot.com'
    : config.openai.host || 'https://api.openai.com';
  const path = useCopilot
    ? config.copilot.path || '/chat/completions'
    : config.openai.path || '/v1/chat/completions';
  const endpoint = `${host}${path}`;

  const { systemPrompt, messages } = buildChatPayload(conversation, userMessage);
  const bodyMessages = messages.map((m) => normalizeOpenAIMessage(m));
  if (systemPrompt) {
    bodyMessages.unshift({ role: 'system', content: systemPrompt });
  }
  let fullText = '';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${useCopilot ? config.copilot.apiKey : config.openai.apiKey}`,
    },
    body: JSON.stringify({
      model:
        conversation.model ||
        (useCopilot ? config.copilot.model || 'gpt-4o-mini' : config.openai.model || 'gpt-4o-mini'),
      messages: bodyMessages,
      temperature: useCopilot
        ? (config.copilot.temperature ?? 0.3)
        : (config.openai.temperature ?? 0.3),
      max_tokens:
        conversation.maxTokens ||
        (useCopilot ? config.copilot.maxTokens || 2048 : config.openai.maxTokens || 2048),
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body for streaming');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter((line) => line.trim() !== '');
    for (const line of lines) {
      if (!line.startsWith('data: ')) {
        continue;
      }
      const data = line.slice(6);
      if (data === '[DONE]') {
        onChunk(fullText, true);
        return fullText.trim();
      }
      try {
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          onChunk(fullText, false);
        }
      } catch (e) {
        // ignore parse issues
      }
    }
  }

  onChunk(fullText, true);
  return fullText.trim();
}

async function streamClaude(config, conversation, userMessage, onChunk) {
  const host = config.claude.host || 'https://api.anthropic.com';
  const path = config.claude.path || '/v1/messages';
  const endpoint = `${host}${path}`;

  const { systemPrompt, messages } = buildChatPayload(conversation, userMessage);
  const claudeMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.claude.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: conversation.model || config.claude.model || 'claude-haiku-4-5-20251001',
      max_tokens: conversation.maxTokens || config.claude.maxTokens || 2048,
      temperature: config.claude.temperature ?? 0.3,
      system: systemPrompt || '',
      messages: claudeMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body for streaming');
  }

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
      if (!line.startsWith('data: ')) {
        continue;
      }
      const data = line.slice(6);
      if (data === '[DONE]') {
        onChunk(fullText, true);
        return fullText.trim();
      }
      try {
        const json = JSON.parse(data);
        const delta =
          json.delta?.text || json.content_block?.text || json.content_block_delta?.text;
        if (delta) {
          fullText += delta;
          onChunk(fullText, false);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  onChunk(fullText, true);
  return fullText.trim();
}

function normalizeOpenAIMessage(message) {
  if (!message.attachments || message.attachments.length === 0) {
    return message;
  }

  const parts = [{ type: 'text', text: message.content }];
  message.attachments.slice(0, 3).forEach((att) => {
    parts.push({
      type: 'image_url',
      image_url: { url: att.dataUrl },
    });
  });
  return { role: message.role, content: parts };
}

function estimateTokens(messages) {
  const text = messages.map((m) => m.content || '').join(' ');
  return Math.ceil(text.length / 4); // rough heuristic
}

export async function ensureSummaryIfNeeded(config, conversation, userMessage) {
  const history = conversation.messages || [];
  const combined = [...history, userMessage];

  const tokenEstimate = estimateTokens(combined);
  const contextLimit = 12000; // conservative context window
  if (tokenEstimate <= contextLimit) {
    return conversation;
  }

  const keepLast = 4;
  const toSummarize = combined.slice(0, Math.max(0, combined.length - keepLast));
  const recent = combined.slice(-keepLast);

  const summaryText = await summarizeMessages(config, conversation, toSummarize);
  conversation.summary = summaryText;
  conversation.messages = recent;
  return conversation;
}

async function summarizeMessages(config, conversation, messages) {
  const translator = createTranslator(config, conversation.provider);
  const summarizerConversation = {
    ...conversation,
    model: conversation.model,
    maxTokens: Math.min(conversation.maxTokens || 500, 500),
  };
  const response = await translator.chat(SUMMARY_SYSTEM_PROMPT, messages, summarizerConversation);
  return response;
}
