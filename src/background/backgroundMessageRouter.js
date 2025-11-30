/**
 * Message router for background service worker
 */

import { debug, error, initLogger } from '../utils/logger.js';
import { GoogleGenAI } from '@google/genai';
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
import { createChatProvider } from './services/chatProviders.js';
import { runSearchCrawlProtocol } from './services/searchCrawlProtocol.js';
import { saveEmbedding } from './services/memoryService.js';
import { PROVIDER_DEFAULT_MODELS, filterModelsByProvider } from '../config/providers.js';
import {
  DEFAULT_HOSTS,
  DEFAULT_PATHS,
  OPENAI_DEFAULT_MODEL,
  GEMINI_DEFAULT_MODEL,
  CLAUDE_DEFAULT_MODEL,
} from '../config/constants.js';

const cacheService = new CacheService();

function isNonTranslationOutput(text) {
  if (!text || typeof text !== 'string') {
    return true;
  }
  const lowered = text.toLowerCase();
  const badIndicators = [
    'translation:',
    'translated',
    'explanation',
    'explain',
    'summary',
    'summarize',
    'analysis',
    'means',
    'meaning',
    'here is',
    'original text',
    'in english',
    'in vietnamese',
  ];
  return badIndicators.some((k) => lowered.includes(k));
}

async function maybePlanWithLLM(config, conversation, userMessage) {
  try {
    const plannerProvider =
      (config.openai?.apiKey && 'openai') ||
      (config.claude?.apiKey && 'claude') ||
      conversation?.provider ||
      config.provider;

    debug(`maybePlanWithLLM: selected provider=${plannerProvider}`);

    if (!plannerProvider || !config[plannerProvider]?.apiKey) {
      debug('maybePlanWithLLM: No valid provider/key found for planning');
      return null;
    }
    const plannerConfig = { ...config, provider: plannerProvider };
    const plannerModel = config[plannerProvider]?.model || conversation?.model || '';
    debug(
      `LLM plan using provider=${plannerProvider} model=${plannerModel || 'default'} msg="${userMessage.slice(
        0,
        120,
      )}..."`,
    );

    const prompt = `You are a search planner. Analyze the user request and output ONLY JSON with this shape:
{
  "keywords": [up to 6 short keywords],
  "queries": [up to 4 focused search queries],
  "urls": [explicit URLs to crawl if mentioned]
}
Do not add explanations. User request: """${userMessage}"""`;

    const messages = [{ role: 'user', content: prompt }];
    const translator = createChatProvider(plannerConfig, plannerProvider);

    // Mock a minimal conversation object for the provider (needs model/maxTokens)
    const tempConvo = {
      model: plannerModel,
      maxTokens: 512,
      provider: plannerProvider,
    };

    const response = await translator.chat('', messages, tempConvo);

    debug('LLM plan raw response:', response.slice(0, 500));
    const jsonStart = response.indexOf('{');
    const jsonEnd = response.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      return null;
    }
    const sliced = response.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(sliced);
    return {
      urls: Array.isArray(parsed.urls) ? parsed.urls : [],
      queries: Array.isArray(parsed.queries) ? parsed.queries : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    };
  } catch (err) {
    error(`LLM plan failed for provider=${conversation?.provider || config.provider}:`, err);
    return null;
  }
}

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

      case 'captureVisibleTab':
        await handleCaptureVisibleTab(sender, sendResponse);
        break;

      case 'ocrAndTranslate':
        await handleOcrAndTranslate(message.payload, sendResponse);
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
    let finalText = fullText.trim();
    if (isNonTranslationOutput(finalText)) {
      finalText = (await translator.translate(text, from, to))?.trim() || finalText;
    }
    await cacheService.set(cacheKey, finalText);

    port.postMessage({
      type: 'complete',
      data: finalText,
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
    let translation = await translator.translate(text, from, to);
    if (isNonTranslationOutput(translation)) {
      translation = await translator.translate(text, from, to);
    }
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

async function handleCaptureVisibleTab(sender, sendResponse) {
  try {
    const windowId = sender?.tab?.windowId;
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    sendResponse({ success: true, dataUrl });
  } catch (err) {
    error('Capture error:', err);
    sendResponse({ success: false, error: err.message || 'Capture failed' });
  }
}

async function handleOcrAndTranslate(payload, sendResponse) {
  const { imageBase64 } = payload || {};
  if (!imageBase64) {
    sendResponse({ success: false, error: 'No image provided' });
    return;
  }

  try {
    const { config } = await getStorage('config');
    const ocrText = await extractTextWithProvider(imageBase64, config);

    const to = config?.defaultToLang || 'vi';
    const from = config?.defaultFromLang || 'auto';
    const translator = createTranslator(config);

    const cacheKey = await cacheService.generateKey(
      config.provider,
      translator.getModel(),
      from,
      to,
      ocrText,
    );

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      sendResponse({
        success: true,
        originalText: ocrText,
        translatedText: cached,
        fromCache: true,
      });
      return;
    }

    const translatedText = await translator.translate(ocrText, from, to);
    let finalText = translatedText;
    if (isNonTranslationOutput(finalText)) {
      finalText = await translator.translate(ocrText, from, to);
    }
    await cacheService.set(cacheKey, finalText);

    sendResponse({
      success: true,
      originalText: ocrText,
      translatedText: finalText,
      fromCache: false,
    });
  } catch (err) {
    error('OCR/translate error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

async function extractTextWithProvider(imageBase64, config) {
  const provider = resolveProvider(config);
  switch (provider) {
    case 'openai':
      return extractWithOpenAI(imageBase64, config.openai);
    case 'claude':
      return extractWithClaude(imageBase64, config.claude);
    case 'gemini':
      return extractWithGemini(imageBase64, config.gemini);
    default:
      throw new Error(`OCR is not supported for provider "${provider}".`);
  }
}

async function extractWithOpenAI(imageBase64, openaiConfig) {
  if (!openaiConfig?.apiKey) {
    throw new Error('OpenAI API key not configured for OCR');
  }

  const host = openaiConfig.host || DEFAULT_HOSTS.OPENAI;
  const path = openaiConfig.path || DEFAULT_PATHS.OPENAI;
  const endpoint = `${host}${path}`;
  const model = openaiConfig.model || OPENAI_DEFAULT_MODEL;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are an OCR engine. Extract all readable text from the provided image and return only the exact text content. Do not add explanations, labels, prefixes, or formatting beyond the raw text.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Return only the text visible in this image. No extra words or formatting.',
            },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OCR request failed (${response.status})`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  const text = cleanOcrText(rawText);
  if (!text) {
    error('OpenAI OCR response missing text', { data });
    throw new Error('OCR response missing text');
  }
  return text;
}

async function extractWithClaude(imageBase64, claudeConfig) {
  if (!claudeConfig?.apiKey) {
    throw new Error('Claude API key not configured for OCR');
  }
  const model = claudeConfig.model || CLAUDE_DEFAULT_MODEL;

  const host = claudeConfig.host || DEFAULT_HOSTS.CLAUDE;
  const path = claudeConfig.path || DEFAULT_PATHS.CLAUDE;
  const endpoint = `${host}${path}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeConfig.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      temperature: 0,
      system:
        'You are an OCR engine. Extract all readable text from the provided image and return only the exact text content. Do not add explanations, labels, prefixes, or formatting beyond the raw text.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Return only the text visible in this image. No extra words or formatting.',
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OCR request failed (${response.status})`);
  }

  const data = await response.json();
  const rawText = data?.content?.[0]?.text;
  const text = cleanOcrText(rawText);
  if (!text) {
    error('Claude OCR response missing text', { data });
    throw new Error('OCR response missing text');
  }
  return text;
}

async function extractWithGemini(imageBase64, geminiConfig) {
  if (!geminiConfig?.apiKey) {
    throw new Error('Gemini API key not configured for OCR');
  }

  const modelName = normalizeGeminiModel(geminiConfig.model) || GEMINI_DEFAULT_MODEL;

  const ai = new GoogleGenAI({ apiKey: geminiConfig.apiKey });
  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Return only the text visible in this image. No extra words, labels, or formatting.',
          },
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 800,
    },
  });

  const payload = response?.response || response;
  let text = '';

  // Prefer direct text accessor if provided by SDK helper
  if (payload?.text) {
    text = typeof payload.text === 'function' ? payload.text() : payload.text;
  }

  // Fallback to first candidate parts
  if (!text && payload?.candidates?.length) {
    const parts = payload.candidates[0]?.content?.parts || [];
    text = parts
      .map((p) => p?.text)
      .filter(Boolean)
      .join('\n');
  }

  text = cleanOcrText(text);
  if (!text) {
    error('Gemini OCR response missing text', { response });
    throw new Error('OCR response missing text');
  }
  return text.trim();
}

function normalizeGeminiModel(model) {
  if (!model) {
    return '';
  }
  return model.replace(/^models\//, '');
}

function cleanOcrText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text.trim();
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
      timestamp: Date.now(),
      attachments: (message.attachments || []).slice(0, 4),
    };

    const assistantReply = await sendChatMessage(config, convo, userPayload);

    convo.messages.push(userPayload);

    convo.messages.push({ role: 'assistant', content: assistantReply, timestamp: Date.now() });
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
      timestamp: Date.now(),
      attachments: (message.attachments || []).slice(0, 4),
    };

    // Summary if needed
    await ensureSummaryIfNeeded(config, convo, userPayload);

    // Web Search & Crawl protocol if enabled
    let searchResults = null;
    const webConfig = config.webSearch || {};

    if (message.webBrowsing) {
      debug('handleChatStream: webBrowsing enabled');
      const notifyStatus = (status) => {
        try {
          port.postMessage({
            type: 'chatStreamStatus',
            conversationId: convo.id,
            status,
          });
        } catch (_) {
          // ignore status errors
        }
      };

      const llmPlan = await maybePlanWithLLM(config, convo, message.content);

      try {
        searchResults = await runSearchCrawlProtocol(
          message.content,
          webConfig,
          notifyStatus,
          llmPlan,
        );
      } catch (err) {
        error('Web search/crawl error:', err);
        notifyStatus('Search failed, continuing without web context.');
      } finally {
        notifyStatus(null);
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
    convo.messages.push({ role: 'assistant', content: assistantText, timestamp: Date.now() });
    if (!convo.title || convo.title === 'New chat') {
      convo.title = message.content.slice(0, 40) || 'Conversation';
    }
    convo.updatedAt = Date.now();

    // Save embeddings for recall
    await saveEmbedding(convo.id, userPayload);
    await saveEmbedding(convo.id, { role: 'assistant', content: assistantText });

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
        models = PROVIDER_DEFAULT_MODELS[provider] || [];
      }
    }

    if (provider === 'gemini') {
      models = filterModelsByProvider('gemini', models);
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
function resolveProvider(config) {
  const preferred = config?.provider;
  const hasPreferredKey = preferred && config?.[preferred]?.apiKey;
  if (hasPreferredKey) {
    return preferred;
  }

  const fallback = ['openai', 'claude', 'gemini'].find((p) => config?.[p]?.apiKey);
  if (fallback) {
    return fallback;
  }

  throw new Error('No provider configured. Please add an API key in Options.');
}

function createTranslator(config) {
  const provider = resolveProvider(config);
  // Ensure downstream consumers (cache keys, etc.) use the resolved provider
  config.provider = provider;

  if (!config[provider]) {
    throw new Error(
      `Configuration for provider "${provider}" is missing. Please re-save in Options.`,
    );
  }

  switch (provider) {
    case 'openai':
      return new OpenAITranslator(config.openai);
    case 'claude':
      return new ClaudeTranslator(config.claude);
    case 'gemini':
      return new GeminiTranslator(config.gemini);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
