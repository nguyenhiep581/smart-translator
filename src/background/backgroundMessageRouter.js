/**
 * Message router for background service worker
 */

import { debug, error, initLogger } from '../utils/logger.js';
import { getStorage, setStorage } from '../utils/storage.js';
import { OpenAITranslator } from './translator/openAITranslator.js';
import { ClaudeTranslator } from './translator/claudeTranslator.js';
import { GeminiTranslator } from './translator/geminiTranslator.js';
import { CacheService } from './cache/cacheService.js';
import { detectLanguage } from './services/detectLanguage.js';
import {
  getConversations,
  upsertConversation,
  deleteConversation,
  createEmptyConversation,
  sendChatMessage,
  streamChatMessage,
  ensureSummaryIfNeeded,
} from './services/chatService.js';
import { webSearchService } from './services/webSearchService.js';

const cacheService = new CacheService();

/**
 * Handle incoming messages
 * @param {object} message - Message object
 * @param {object} sender - Sender information
 * @param {function} sendResponse - Response callback
 */
export async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'translate':
        await handleTranslate(message.payload, sendResponse);
        break;

      case 'detectLanguage':
        await handleDetectLanguage(message.payload, sendResponse);
        break;

      case 'getSettings':
        await handleGetSettings(sendResponse);
        break;

      case 'setSettings':
        await handleSetSettings(message.payload, sendResponse);
        break;

      case 'clearCache':
        await handleClearCache(sendResponse);
        break;

      case 'getCacheStats':
        await handleGetCacheStats(sendResponse);
        break;

      case 'updateDebugMode':
        await handleUpdateDebugMode(message.payload, sendResponse);
        break;

      case 'chatList':
        await handleChatList(sendResponse);
        break;

      case 'chatCreate':
        await handleChatCreate(message.payload, sendResponse);
        break;

      case 'chatUpdate':
        await handleChatUpdate(message.payload, sendResponse);
        break;

      case 'chatDelete':
        await handleChatDelete(message.payload, sendResponse);
        break;

      case 'chatSend':
        await handleChatSend(message.payload, sendResponse);
        break;

      case 'getAvailableModels':
        await handleGetAvailableModels(message.payload, sendResponse);
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (err) {
    error('Error handling message:', err);
    sendResponse({ success: false, error: err.message });
  }
}

/**
 * Handle streaming translation via port connection
 * @param {object} message - Message from port
 * @param {Port} port - Chrome runtime port
 */
export async function handleStreamingTranslation(message, port) {
  const { text, from, to } = message;

  if (!text) {
    port.postMessage({ type: 'error', error: 'No text provided' });
    return;
  }

  try {
    // Get configuration
    const { config } = await getStorage('config');
    const translator = createTranslator(config);

    // Check cache first
    const cacheKey = await cacheService.generateKey(
      config.provider,
      translator.getModel(),
      from,
      to,
      text,
    );

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      debug('Cache hit - instant response');
      port.postMessage({ type: 'complete', data: cached, fromCache: true });
      return;
    }

    // Stream translation
    const startTime = Date.now();
    let fullText = '';

    const onStream = (chunk) => {
      fullText += chunk;
      port.postMessage({ type: 'chunk', chunk });
    };

    await translator.translate(text, from, to, onStream);
    const duration = Date.now() - startTime;

    debug(`Streaming translation to ${config.provider} took ${duration}ms`);

    // Cache the result
    await cacheService.set(cacheKey, fullText.trim());

    port.postMessage({
      type: 'complete',
      data: fullText.trim(),
      fromCache: false,
      duration,
    });
  } catch (err) {
    error('Streaming translation error:', err);
    port.postMessage({ type: 'error', error: err.message });
  }
}

/**
 * Handle translation request
 */
async function handleTranslate(payload, sendResponse) {
  const { text, from, to } = payload;

  if (!text) {
    sendResponse({ success: false, error: 'No text provided' });
    return;
  }

  try {
    // Get configuration
    const { config } = await getStorage('config');
    const translator = createTranslator(config);

    // Check cache first
    const cacheKey = await cacheService.generateKey(
      config.provider,
      translator.getModel(),
      from,
      to,
      text,
    );

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      debug('Cache hit - instant response');
      sendResponse({ success: true, data: cached, fromCache: true });
      return;
    }

    // Translate
    const startTime = Date.now();
    const translation = await translator.translate(text, from, to);
    const duration = Date.now() - startTime;

    debug(`API call to ${config.provider} took ${duration}ms`);

    // Cache the result
    await cacheService.set(cacheKey, translation);

    sendResponse({
      success: true,
      data: translation,
      fromCache: false,
      duration,
    });
  } catch (err) {
    error('Translation error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

/**
 * Handle language detection request
 */
async function handleDetectLanguage(payload, sendResponse) {
  const { text } = payload;

  try {
    const { config } = await getStorage('config');
    const lang = await detectLanguage(text, config);
    sendResponse({ success: true, data: lang });
  } catch (err) {
    error('Language detection error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

/**
 * Handle get settings request
 */
async function handleGetSettings(sendResponse) {
  try {
    const { config } = await getStorage('config');
    sendResponse({ success: true, data: config });
  } catch (err) {
    error('Get settings error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

/**
 * Handle set settings request
 */
async function handleSetSettings(payload, sendResponse) {
  try {
    const { config: newConfig } = payload;
    await setStorage({ config: newConfig });
    sendResponse({ success: true });
  } catch (err) {
    error('Set settings error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

/**
 * Handle clear cache request
 */
async function handleClearCache(sendResponse) {
  try {
    await cacheService.clear();
    sendResponse({ success: true });
  } catch (err) {
    error('Clear cache error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

/**
 * Handle get cache stats request
 */
async function handleGetCacheStats(sendResponse) {
  try {
    const stats = await cacheService.getStats();
    sendResponse({ success: true, data: stats });
  } catch (err) {
    error('Get cache stats error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

/**
 * Handle update debug mode request
 */
async function handleUpdateDebugMode(payload, sendResponse) {
  try {
    const { debugMode } = payload;
    initLogger(debugMode);
    debug('Debug mode updated to:', debugMode);
    sendResponse({ success: true });
  } catch (err) {
    error('Update debug mode error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleChatList(sendResponse) {
  try {
    const conversations = await getConversations();
    sendResponse({ success: true, data: conversations });
  } catch (err) {
    error('Chat list error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleChatCreate(payload, sendResponse) {
  try {
    const { provider, model, systemPrompt, maxTokens } = payload;
    const convo = createEmptyConversation(provider, model, systemPrompt || '', maxTokens || 10000);
    await upsertConversation(convo);
    sendResponse({ success: true, data: convo });
  } catch (err) {
    error('Chat create error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleChatUpdate(payload, sendResponse) {
  try {
    const { conversation } = payload;
    if (!conversation || !conversation.id) {
      sendResponse({ success: false, error: 'Invalid conversation' });
      return;
    }
    conversation.updatedAt = Date.now();
    await upsertConversation(conversation);
    sendResponse({ success: true, data: conversation });
  } catch (err) {
    error('Chat update error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleChatDelete(payload, sendResponse) {
  try {
    const { id } = payload;
    await deleteConversation(id);
    sendResponse({ success: true });
  } catch (err) {
    error('Chat delete error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleChatSend(payload, sendResponse) {
  try {
    const { conversation, message } = payload;
    if (!conversation || !conversation.id) {
      sendResponse({ success: false, error: 'Conversation missing' });
      return;
    }
    if (!message || !message.content) {
      sendResponse({ success: false, error: 'Message missing' });
      return;
    }

    // Fetch latest config for provider settings
    const { config } = await getStorage('config');
    if (!config) {
      sendResponse({ success: false, error: 'Config not found' });
      return;
    }

    const convo = { ...conversation, messages: conversation.messages || [] };

    const userPayload = {
      role: 'user',
      content: message.content,
      attachments: (message.attachments || []).slice(0, 3),
    };

    const assistantReply = await sendChatMessage(config, convo, userPayload);

    convo.messages.push(userPayload);

    convo.messages.push({ role: 'assistant', content: assistantReply });
    if (!convo.title || convo.title === 'New chat') {
      convo.title = message.content.slice(0, 40) || 'Conversation';
    }
    convo.updatedAt = Date.now();

    await upsertConversation(convo);
    sendResponse({ success: true, data: convo });
  } catch (err) {
    error('Chat send error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'chat-stream') {
    return;
  }

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'chatSend') {
      await handleChatStream(port, msg.payload);
    }
  });
});

async function handleChatStream(port, payload) {
  try {
    const { conversation, message } = payload;
    if (!conversation || !conversation.id) {
      port.postMessage({ type: 'chatStreamError', error: 'Conversation missing' });
      return;
    }
    if (!message || !message.content) {
      port.postMessage({ type: 'chatStreamError', error: 'Message missing' });
      return;
    }

    const { config } = await getStorage('config');
    if (!config) {
      port.postMessage({ type: 'chatStreamError', error: 'Config not found' });
      return;
    }

    const convo = { ...conversation, messages: conversation.messages || [] };
    const userPayload = {
      role: 'user',
      content: message.content,
      attachments: (message.attachments || []).slice(0, 3),
    };

    // Summary if needed
    await ensureSummaryIfNeeded(config, convo, userPayload);

    // Web Search if enabled
    let searchResults = null;
    const webConfig = config.webSearch || {};

    // Allow if using DDG (no keys needed) OR Google (with keys)
    const isDDG = webConfig.provider === 'ddg';
    const isGoogleReady =
      (webConfig.provider === 'google' || !webConfig.provider) && webConfig.apiKey && webConfig.cx;

    if (message.webBrowsing && (isDDG || isGoogleReady)) {
      try {
        searchResults = await webSearchService.search(message.content, webConfig);
      } catch (err) {
        error('Web search error:', err);
        // Continue without search results
      }
    }

    let assistantText = '';
    const onChunk = (text, done) => {
      assistantText = text;
      port.postMessage({
        type: 'chatStreamChunk',
        conversationId: convo.id,
        content: text,
        done,
      });
    };

    await streamChatMessage(config, convo, userPayload, onChunk, searchResults);

    convo.messages.push(userPayload);
    convo.messages.push({ role: 'assistant', content: assistantText });
    if (!convo.title || convo.title === 'New chat') {
      convo.title = message.content.slice(0, 40) || 'Conversation';
    }
    convo.updatedAt = Date.now();

    await upsertConversation(convo);
    port.postMessage({ type: 'chatStreamDone', conversation: convo });
  } catch (err) {
    port.postMessage({ type: 'chatStreamError', error: err.message });
  }
}

/**
 * Get available models from provider
 */
async function handleGetAvailableModels(payload, sendResponse) {
  try {
    // Handle both payload.provider and direct provider property
    const provider = payload?.provider || payload;

    if (!provider || typeof provider !== 'string') {
      sendResponse({ success: false, error: 'Provider not specified' });
      return;
    }

    const { config } = await chrome.storage.local.get('config');

    if (!config || !config[provider]) {
      sendResponse({ success: false, error: `Provider ${provider} not configured` });
      return;
    }

    const translator = createTranslator({ ...config, provider });

    // Try to get models from the provider
    let models = [];

    if (typeof translator.getAvailableModels === 'function') {
      models = await translator.getAvailableModels();
    } else {
      // Fallback to configured models or defaults
      models = config[provider].availableModels || [];

      if (!models.length) {
        // Use default models
        const defaults = {
          openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
          claude: ['claude-sonnet-4-5', 'claude-haiku-3-5'],
          gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'],
        };
        models = defaults[provider] || [];
      }
    }

    sendResponse({ success: true, models });
  } catch (err) {
    error('Error getting available models:', err);
    sendResponse({ success: false, error: err.message });
  }
}

/**
 * Create translator instance based on config
 */
function createTranslator(config) {
  switch (config.provider) {
    case 'openai':
      return new OpenAITranslator(config.openai);
    case 'claude':
      return new ClaudeTranslator(config.claude);
    case 'gemini':
      return new GeminiTranslator(config.gemini);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
