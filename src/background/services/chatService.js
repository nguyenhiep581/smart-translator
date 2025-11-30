import { getStorage, setStorage } from '../../utils/storage.js';
import { error as logError } from '../../utils/logger.js';
import { GoogleGenAI } from '@google/genai';
import { saveEmbedding, searchSimilar, formatSemanticRecall } from './memoryService.js';
import {
  OPENAI_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  DEFAULT_HOSTS,
  DEFAULT_PATHS,
  CLAUDE_DEFAULT_MODEL,
  DEFAULT_CHAT_TEMPERATURE,
  DEFAULT_TRANSLATION_TEMPERATURE,
  DEFAULT_CHAT_MAX_TOKENS,
  DEFAULT_MAX_TOKENS,
} from '../../config/constants.js';
import { createChatProvider, normalizeOpenAIMessage } from './chatProviders.js';

const CHAT_KEY = 'chatConversations';
const SUMMARY_SYSTEM_PROMPT = `You are a conversation summarizer.
Summarize the following messages into a concise description preserving key facts, details, user preferences, decisions, tasks, and important context.
Keep the summary under 200 words.`;

const UPDATE_SUMMARY_PROMPT = `You are a conversation summarizer.
Your task is to update an existing summary with new messages.
Integrate the new information into the existing summary, preserving key facts, context, and user preferences.
Keep the updated summary concise (under 250 words).`;

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

export function createEmptyConversation(
  provider,
  model = '',
  systemPrompt = '',
  maxTokens = DEFAULT_CHAT_MAX_TOKENS,
  temperature = DEFAULT_CHAT_TEMPERATURE,
) {
  const id = `chat_${Date.now()}`;
  return {
    id,
    title: 'New chat',
    provider,
    model,
    systemPrompt,
    maxTokens,
    temperature,
    messages: [],
    updatedAt: Date.now(),
  };
}

export async function sendChatMessage(config, conversation, userMessage) {
  await ensureSummaryIfNeeded(config, conversation, userMessage);
  const translator = createChatProvider(config, conversation.provider);
  const { systemPrompt, messages } = await buildChatPayload(config, conversation, userMessage);
  const response = await translator.chat(systemPrompt, messages, conversation);
  await saveEmbedding(conversation.id, userMessage);
  await saveEmbedding(conversation.id, { role: 'assistant', content: response });
  return response;
}

export async function streamChatMessage(config, conversation, userMessage, onChunk, searchResults) {
  const provider = conversation.provider;
  if (provider === 'gemini') {
    return streamGemini(config, conversation, userMessage, onChunk, searchResults);
  }
  if (provider === 'openai') {
    return streamOpenAIStyle(config, conversation, userMessage, onChunk, searchResults);
  }
  if (provider === 'claude') {
    return streamClaude(config, conversation, userMessage, onChunk, searchResults);
  }
  throw new Error(`Streaming not supported for provider: ${provider}`);
}

function estimateTokens(messages) {
  const text = messages.map((m) => m.content || '').join(' ');
  return Math.ceil(text.length / 4); // rough heuristic
}

export async function buildChatPayload(config, conversation, userMessage, searchResults) {
  const history = conversation.messages || [];
  const contextMessages = history.slice(-20);
  const includeSummary = conversation.useSummary !== false;

  const finalUserMessage = { ...userMessage };

  // Handle markdown attachments by appending to content
  if (finalUserMessage.attachments && finalUserMessage.attachments.length > 0) {
    const markdownFiles = finalUserMessage.attachments.filter((att) => att.isMarkdown);
    if (markdownFiles.length > 0) {
      let mdContent = '';
      markdownFiles.forEach((att) => {
        mdContent += `\n\n--- File: ${att.name} ---\n${att.dataUrl}\n--- End of ${att.name} ---\n`;
      });
      finalUserMessage.content = finalUserMessage.content + mdContent;
    }
  }

  if (searchResults) {
    finalUserMessage.content = `${searchResults}\n\nBased on the above search results, please answer the following.\n\n${finalUserMessage.content}`;
  }

  const semantic = await searchSimilar(conversation.id, finalUserMessage.content || '', 3);
  const semanticContent = formatSemanticRecall(semantic);

  let systemPrompt = conversation.systemPrompt || '';
  if (includeSummary && conversation.summary) {
    systemPrompt += `\n\nConversation summary: ${conversation.summary}`;
  }
  if (semanticContent) {
    systemPrompt += `\n\n${semanticContent}`;
  }

  const messages = [];
  messages.push(...contextMessages);
  messages.push(finalUserMessage);

  const maxContextTokens = 14000;
  let current = messages;
  while (estimateTokens(current) > maxContextTokens && current.length > 2) {
    current = current.slice(1);
  }

  return { systemPrompt, messages: current };
}

async function streamOpenAIStyle(config, conversation, userMessage, onChunk, searchResults) {
  const host = config.openai.host || DEFAULT_HOSTS.OPENAI;
  const path = config.openai.path || DEFAULT_PATHS.OPENAI;
  const endpoint = `${host}${path}`;

  const { systemPrompt, messages } = await buildChatPayload(
    config,
    conversation,
    userMessage,
    searchResults,
  );
  const bodyMessages = messages.map((m) => normalizeOpenAIMessage(m));
  if (systemPrompt) {
    bodyMessages.unshift({ role: 'system', content: systemPrompt });
  }
  let fullText = '';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.openai.model || conversation.model || OPENAI_DEFAULT_MODEL,
      messages: bodyMessages,
      temperature:
        conversation.temperature ?? config.openai.temperature ?? DEFAULT_TRANSLATION_TEMPERATURE,
      max_tokens: conversation.maxTokens || config.openai.maxTokens || DEFAULT_MAX_TOKENS.openai,
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

async function streamGemini(config, conversation, userMessage, onChunk, searchResults) {
  const { systemPrompt, messages } = await buildChatPayload(
    config,
    conversation,
    userMessage,
    searchResults,
  );

  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  const modelName = (config.gemini.model || conversation.model || GEMINI_DEFAULT_MODEL)
    .replace(/^models\//, '')
    .replace(/^embedding-.*$/i, GEMINI_DEFAULT_MODEL)
    .replace(/gecko/i, GEMINI_DEFAULT_MODEL);

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const generationConfig = {
    temperature:
      conversation.temperature ?? config.gemini.temperature ?? DEFAULT_TRANSLATION_TEMPERATURE,
    maxOutputTokens: conversation.maxTokens || config.gemini.maxTokens || DEFAULT_MAX_TOKENS.gemini,
  };

  try {
    // Stream content with system instruction in config
    const result = await ai.models.generateContentStream({
      model: modelName,
      contents,
      config: {
        ...generationConfig,
        systemInstruction: systemPrompt ? [systemPrompt] : undefined,
      },
    });

    let fullText = '';
    for await (const chunk of result) {
      if (chunk.text) {
        fullText += chunk.text;
        onChunk(fullText, false);
      }
    }

    onChunk(fullText, true);
    return fullText.trim();
  } catch (err) {
    logError('Gemini streaming error:', err);
    throw err;
  }
}

async function streamClaude(config, conversation, userMessage, onChunk, searchResults) {
  const host = config.claude.host || DEFAULT_HOSTS.CLAUDE;
  const path = config.claude.path || DEFAULT_PATHS.CLAUDE;
  const endpoint = `${host}${path}`;

  const { systemPrompt, messages } = await buildChatPayload(
    config,
    conversation,
    userMessage,
    searchResults,
  );
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
      model: config.claude.model || conversation.model || CLAUDE_DEFAULT_MODEL,
      max_tokens: conversation.maxTokens || config.claude.maxTokens || DEFAULT_MAX_TOKENS.claude,
      temperature:
        conversation.temperature ?? config.claude.temperature ?? DEFAULT_TRANSLATION_TEMPERATURE,
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

export async function ensureSummaryIfNeeded(config, conversation, userMessage) {
  const history = conversation.messages || [];
  const combined = [...history, userMessage];

  // Only summarize if we have a significant amount of new content
  const lastCount = conversation.lastSummarizedCount || 0;
  const newMessagesCount = combined.length - lastCount;
  const threshold = 20; // Summarize every 20 new messages

  if (newMessagesCount < threshold) {
    return conversation;
  }

  const toSummarize = combined.slice(lastCount);
  const summaryText = await summarizeMessages(config, conversation, toSummarize);
  conversation.summary = summaryText;
  conversation.lastSummarizedCount = combined.length;

  // We do NOT truncate conversation.messages anymore to preserve history.
  // buildChatPayload will handle context window slicing.
  return conversation;
}

async function summarizeMessages(config, conversation, messages) {
  if (!messages?.length) {
    return conversation.summary || '';
  }
  const translator = createChatProvider(config, conversation.provider);
  const summarizerConversation = {
    ...conversation,
    maxTokens: Math.min(conversation.maxTokens || 500, 500),
  };

  let prompt = SUMMARY_SYSTEM_PROMPT;
  let contentToSummarize = messages;

  // If we have an existing summary, ask to update it
  if (conversation.summary) {
    prompt = UPDATE_SUMMARY_PROMPT;
    // We need to inject the previous summary into the context for the model
    // We can't easily inject it as a system prompt if we are using a different system prompt
    // So we prepend it to the messages as a context note
    contentToSummarize = [
      {
        role: 'user',
        content: `Existing Summary:\n${conversation.summary}\n\nNew Messages to integrate:\n${messages
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n')}`,
      },
    ];
  }

  try {
    const response = await translator.chat(prompt, contentToSummarize, summarizerConversation);
    return response;
  } catch (err) {
    logError('Summarization failed', err);
    return conversation.summary || '';
  }
}
