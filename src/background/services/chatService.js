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
