/**
 * Message router for background service worker
 */

import { debug, error, initLogger } from '../utils/logger.js';
import { getStorage, setStorage } from '../utils/storage.js';
import { OpenAITranslator } from './translator/openAITranslator.js';
import { ClaudeTranslator } from './translator/claudeTranslator.js';
import { CacheService } from './cache/cacheService.js';
import { detectLanguage } from './services/detectLanguage.js';

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

      case 'updateDebugMode':
        await handleUpdateDebugMode(message.payload, sendResponse);
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

/**
 * Create translator instance based on config
 */
function createTranslator(config) {
  switch (config.provider) {
    case 'openai':
      return new OpenAITranslator(config.openai);
    case 'claude':
      return new ClaudeTranslator(config.claude);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
