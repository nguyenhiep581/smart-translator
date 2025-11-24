import { error as logError, debug } from '../utils/logger.js';
import hljs from 'highlight.js/lib/common';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

let conversations = [];
let currentConversation = null;
let attachments = [];
let config = null;
let streamPort = null;
let streamingConversationId = null;
let providerModels = { openai: [], claude: [], gemini: [] };
let lastPendingMessage = null;
let promptLibrary = [];
let portReady = false;
let webBrowsingEnabled = false;

marked.setOptions({
  gfm: true,
  breaks: true,
  langPrefix: 'language-',
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch (err) {
        logError('Highlight error:', err);
      }
    }
    try {
      return hljs.highlightAuto(code).value;
    } catch (err) {
      logError('Auto-highlight error:', err);
      return code;
    }
  },
});

const providerSelect = () => document.getElementById('provider-select');
const modelSelect = () => document.getElementById('model-select');
const modalEl = () => document.getElementById('settings-modal');
const modalSystemPrompt = () => document.getElementById('modal-system-prompt');
const modalMaxTokens = () => document.getElementById('modal-max-tokens');
const messagesEl = () => document.getElementById('messages');
const convoListEl = () => document.getElementById('conversation-list');
const inputEl = () => document.getElementById('input');
const attachmentContainer = () => document.getElementById('attachment-previews');

async function init() {
  await loadConfig();
  await loadConversations();
  connectStreamPort();
  const activeProvider = populateProviderSelect();
  if (activeProvider) {
    populateModelSelect(activeProvider, getDefaultModel(activeProvider));
  } else {
    disableModelSelect('Add an API key in Options to choose models');
  }
  updateSendAvailability();
  bindEvents();
  renderConversations();
  if (conversations.length === 0) {
    await createNewConversation();
  } else {
    setActiveConversation(conversations[0].id);
  }

  // Listen for config changes from options page
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.config) {
      loadConfig().then(() => {
        // Update provider and model selects
        const provider = populateProviderSelect();
        if (provider) {
          const model = currentConversation?.model || getDefaultModel(provider);
          populateModelSelect(provider, model);
        } else {
          disableModelSelect('Add an API key in Options to choose models');
        }
        updateSendAvailability();
      });
    }
  });
}

function connectStreamPort() {
  try {
    if (streamPort) {
      try {
        streamPort.disconnect();
      } catch (err) {
        // ignore
      }
    }
    streamPort = chrome.runtime.connect({ name: 'chat-stream' });
    streamPort.onMessage.addListener(handleStreamMessage);
    streamPort.onDisconnect.addListener(() => {
      portReady = false;
      streamPort = null;
    });
    portReady = true;
  } catch (err) {
    logError('Stream port connection failed', err);
    portReady = false;
  }
}

function ensurePort() {
  return streamPort && portReady;
}

async function loadConfig() {
  const res = await chrome.storage.local.get(['config', 'chatPrompts']);
  config = res.config || {};
  promptLibrary = res.chatPrompts || [];

  providerModels = {
    openai: config.openai?.availableModels || [],
    claude: config.claude?.availableModels || [],
    gemini: filterGeminiModels(config.gemini?.availableModels || []),
  };

  enforceActiveProvider();

  // Sanitize stored models for Gemini
  if (config.gemini) {
    config.gemini.model = sanitizeGeminiModel(config.gemini.model);
  }

  // Pick defaults if model present in config but not in available list
  ['openai', 'claude', 'gemini'].forEach((p) => {
    const model = config[p]?.model;
    if (model && !providerModels[p].includes(model)) {
      providerModels[p].unshift(model);
    }
  });

  // Ensure saved chat model stays available in the list for the active provider
  if (config.chatModel) {
    const activeProvider = config.provider || 'openai';
    if (!providerModels[activeProvider].includes(config.chatModel)) {
      providerModels[activeProvider].unshift(config.chatModel);
    }
  }
}

function filterGeminiModels(models) {
  return (models || []).filter(
    (m) =>
      m &&
      m.startsWith('gemini') &&
      !m.toLowerCase().includes('embed') &&
      !m.toLowerCase().includes('gecko'),
  );
}

function sanitizeGeminiModel(model) {
  if (!model) {
    return 'gemini-2.5-flash';
  }
  if (
    model.startsWith('gemini') &&
    !model.toLowerCase().includes('embed') &&
    !model.toLowerCase().includes('gecko')
  ) {
    return model.replace(/^models\//, '');
  }
  return 'gemini-2.5-flash';
}

function enforceActiveProvider() {
  const providersWithKeys = ['openai', 'claude', 'gemini'].filter((p) => config?.[p]?.apiKey);
  if (config?.provider && config[config.provider]?.apiKey) {
    return config.provider;
  }
  if (providersWithKeys.length > 0) {
    const chosen = providersWithKeys[0];
    config.provider = chosen;
    // Persist the resolved provider so background uses the same
    chrome.storage.local.set({ config }).catch((err) => {
      logError('Failed to persist resolved provider:', err);
    });
    return chosen;
  }
  config.provider = null;
  return null;
}

async function refreshModels() {
  const btn = document.getElementById('refresh-models');
  const icon = btn.querySelector('svg');

  // Disable button and show loading state
  btn.disabled = true;
  icon.style.animation = 'spin 1s linear infinite';

  try {
    // Request models from background
    const response = await chrome.runtime.sendMessage({
      type: 'getAvailableModels',
      payload: {
        provider: config.provider || 'openai',
      },
    });

    if (response.success && response.models) {
      // Update config with new models
      const provider = config.provider || 'openai';
      providerModels[provider] = response.models;

      // Update config in storage
      if (!config[provider]) {
        config[provider] = {};
      }
      config[provider].availableModels = response.models;
      await chrome.storage.local.set({ config });

      // Refresh the model selector
      const currentModel = modelSelect().value;
      populateModelSelect(provider, currentModel);

      debug('Models refreshed successfully:', response.models);
    }
  } catch (err) {
    logError('Failed to refresh models:', err);
  } finally {
    // Re-enable button and stop animation
    btn.disabled = false;
    icon.style.animation = '';
  }
}

async function loadConversations() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'chatList' });
    if (res.success) {
      conversations = res.data || [];
    }
  } catch (err) {
    logError('Failed to load conversations', err);
  }
}

async function createNewConversation() {
  try {
    const provider = config.provider || 'openai';
    const model =
      config.chatModel && providerModels[provider]?.includes(config.chatModel)
        ? config.chatModel
        : getDefaultModel(provider);
    const res = await chrome.runtime.sendMessage({
      type: 'chatCreate',
      payload: {
        provider,
        model,
        systemPrompt: '',
        maxTokens: 10000,
      },
    });
    if (res.success) {
      conversations.unshift(res.data);
      setActiveConversation(res.data.id);
    }
  } catch (err) {
    logError('Failed to create conversation', err);
  }
}

function bindEvents() {
  document.getElementById('new-chat').addEventListener('click', async () => {
    await createNewConversation();
    renderConversations();
  });
  document.getElementById('search-convo').addEventListener('input', renderConversations);

  providerSelect().addEventListener('change', async (e) => {
    const newProvider = e.target.value;
    config.provider = newProvider;
    await chrome.storage.local.set({ config });
    populateModelSelect(newProvider, getDefaultModel(newProvider));
    updateSendAvailability();
    if (currentConversation) {
      currentConversation.provider = newProvider;
      currentConversation.model = getDefaultModel(newProvider);
      await persistConversation();
    }
  });

  document.getElementById('send-btn').addEventListener('click', sendMessage);
  inputEl().addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  inputEl().addEventListener('paste', handlePaste);

  document.getElementById('attach-btn').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  document.getElementById('web-search-btn').addEventListener('click', () => {
    // Check if web search is configured
    const provider = config.webSearch?.provider || 'ddg';
    const isGoogle = provider === 'google';
    const hasGoogleKeys = config.webSearch?.apiKey && config.webSearch?.cx;

    if (isGoogle && !hasGoogleKeys) {
      alert(
        'Please configure Google Search API settings in Options first, or switch to DuckDuckGo (Free).',
      );
      chrome.runtime.openOptionsPage();
      return;
    }

    webBrowsingEnabled = !webBrowsingEnabled;
    const btn = document.getElementById('web-search-btn');
    if (webBrowsingEnabled) {
      btn.classList.add('active');
      btn.style.color = '#3b82f6'; // distinct active color
    } else {
      btn.classList.remove('active');
      btn.style.color = '';
    }
  });

  document.getElementById('file-input').addEventListener('change', handleFiles);
  document.getElementById('btn-system-prompt').addEventListener('click', () => openModal());
  document.getElementById('btn-max-tokens').addEventListener('click', () => openModal());
  document.getElementById('btn-prompts').addEventListener('click', openPromptsModal);
  document.getElementById('refresh-models').addEventListener('click', refreshModels);
  document.getElementById('close-modal').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveModalSettings);
  document.getElementById('modal-backdrop').addEventListener('click', closeModal);
  modalMaxTokens().addEventListener('keydown', (e) => {
    e.stopPropagation();
  });

  document.getElementById('prompts-backdrop').addEventListener('click', closePromptsModal);
  document.getElementById('close-prompts').addEventListener('click', closePromptsModal);
  document.getElementById('prompts-close-btn').addEventListener('click', closePromptsModal);
  document.getElementById('prompt-save').addEventListener('click', savePrompt);

  modelSelect().addEventListener('change', async () => {
    if (!currentConversation) {
      return;
    }
    const selected = modelSelect().value;
    currentConversation.model = selected;
    await persistConversation();
    // Persist preferred chat model for future sessions/new chats
    const nextConfig = { ...(config || {}) };
    nextConfig.chatModel = selected;
    config = nextConfig;
    await chrome.storage.local.set({ config: nextConfig });
  });
}

function renderConversations() {
  convoListEl().innerHTML = '';
  const term = (document.getElementById('search-convo')?.value || '').toLowerCase();
  const filtered = conversations.filter((c) => {
    if (!term) {
      return true;
    }
    return (
      (c.title || '').toLowerCase().includes(term) ||
      (c.summary || '').toLowerCase().includes(term) ||
      (c.model || '').toLowerCase().includes(term)
    );
  });

  if (!filtered.length) {
    convoListEl().innerHTML = '<div class="empty-state">No conversations yet</div>';
    return;
  }

  filtered.forEach((c) => {
    const el = document.createElement('div');
    el.className = `conversation ${currentConversation?.id === c.id ? 'active' : ''}`;
    el.innerHTML = `
      <button class="delete-btn" title="Delete">&times;</button>
      <div class="conversation-title">${escapeHtml(c.title || 'Conversation')}</div>
      <div class="conversation-meta">${c.model || ''}</div>
    `;
    el.addEventListener('click', () => {
      setActiveConversation(c.id);
    });
    el.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversation(c.id);
    });
    convoListEl().appendChild(el);
  });
}

function updateLastMessage(content) {
  const messages = messagesEl();
  const lastMsgRow = messages.querySelector('.msg:last-child');
  const lastMsg = lastMsgRow?.querySelector('.bubble');
  const roleIcon = lastMsgRow?.querySelector('.role');

  if (lastMsg) {
    // During streaming: show plain text only (no markdown rendering)
    // Use textContent for instant, flicker-free updates
    lastMsg.textContent = content || '';
    lastMsg.style.whiteSpace = 'pre-wrap';

    // Update icon: if content exists, show 🤖, otherwise keep loading spinner
    if (roleIcon && content && content.trim()) {
      roleIcon.innerHTML = '🤖';
    }

    // Auto-scroll to bottom
    messages.scrollTop = messages.scrollHeight;
  }
}

function renderMessages() {
  messagesEl().innerHTML = '';
  if (!currentConversation || !currentConversation.messages?.length) {
    messagesEl().innerHTML = '<div class="empty-state">Start chatting...</div>';
    return;
  }

  currentConversation.messages.forEach((m) => {
    const row = document.createElement('div');
    row.className = `msg ${m.role}`;
    const rendered = renderMarkdown(m.content || '');
    const isEmpty = !m.content || m.content.trim() === '';

    // Always show 🤖 for assistant, 🧑 for user (no loading spinner)
    const badge = m.role === 'assistant' ? '🤖' : '🧑';

    row.innerHTML = `
      <div class="role" title="${m.role}">${badge}</div>
      <div class="bubble markdown-body">${rendered || (isEmpty ? '<div class="loading-dots">Thinking...</div>' : '')}</div>
    `;
    messagesEl().appendChild(row);
  });
  messagesEl().scrollTop = messagesEl().scrollHeight;

  // Attach copy handlers for code blocks
  messagesEl()
    .querySelectorAll('.copy-btn')
    .forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const code = e.target.dataset.code || '';
        try {
          await navigator.clipboard.writeText(code);
          e.target.textContent = 'Copied';
          setTimeout(() => (e.target.textContent = 'Copy'), 1500);
        } catch (err) {
          logError('Copy failed', err);
        }
      });
    });
}

function setActiveConversation(id) {
  currentConversation = conversations.find((c) => c.id === id) || null;
  if (!currentConversation) {
    return;
  }

  populateModelSelect(
    currentConversation.provider || config.provider || 'openai',
    currentConversation.model ||
      config.chatModel ||
      getDefaultModel(currentConversation.provider || config.provider),
  );
  modalSystemPrompt().value = currentConversation.systemPrompt || '';
  modalMaxTokens().value = currentConversation.maxTokens || 10000;
  attachments = [];
  renderAttachmentPreviews();
  renderConversations();
  renderMessages();
  updateSettingsButtons();
}

function renderAttachmentPreviews() {
  attachmentContainer().innerHTML = '';
  attachments.forEach((att, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'attachment';

    if (att.isMarkdown) {
      // Show markdown file icon and name
      wrap.innerHTML = `
        <div class="markdown-file">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          <span>${escapeHtml(att.name)}</span>
        </div>
        <button data-idx="${idx}">×</button>
      `;
    } else {
      // Show image preview
      wrap.innerHTML = `
        <img src="${att.dataUrl}" alt="${escapeHtml(att.name)}" />
        <button data-idx="${idx}">×</button>
      `;
    }

    wrap.querySelector('button').addEventListener('click', () => {
      attachments.splice(idx, 1);
      renderAttachmentPreviews();
    });
    attachmentContainer().appendChild(wrap);
  });
}

async function sendMessage() {
  if (!currentConversation) {
    return;
  }
  const text = inputEl().value.trim();
  if (!text && attachments.length === 0) {
    setComposerEnabled(
      isProviderConfigured(providerSelect()?.value || config?.provider || 'openai'),
    );
    return;
  }

  if (!ensureChatProviderConfigured()) {
    return;
  }

  // Align conversation provider/model with current selection/config to avoid stale data
  const activeProvider = providerSelect()?.value || config.provider || 'openai';
  config.provider = activeProvider;
  chrome.storage.local.set({ config }).catch((err) => logError('Persist provider failed', err));

  if (currentConversation.provider !== activeProvider) {
    currentConversation.provider = activeProvider;
    currentConversation.model = getDefaultModel(activeProvider);
  }

  if (activeProvider === 'gemini') {
    currentConversation.model = sanitizeGeminiModel(currentConversation.model);
  }

  if (!ensurePort()) {
    renderError('Connection lost. Retrying...');
    connectStreamPort();
    if (!ensurePort()) {
      renderError('Unable to reconnect. Please try again.');
      return;
    }
  }

  const messagePayload = {
    content: text,
    attachments: attachments.slice(0, 4),
    webBrowsing: webBrowsingEnabled,
  };

  // Build a clean copy for sending (no optimistic messages)
  const convoForSend = {
    ...currentConversation,
    messages: [...(currentConversation.messages || [])],
  };

  // UI-only optimistic placeholder
  const uiConversation = {
    ...convoForSend,
    messages: [
      ...convoForSend.messages,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ],
  };
  currentConversation = uiConversation;
  renderMessages();
  attachments = [];
  renderAttachmentPreviews();
  inputEl().value = '';
  renderError(null);
  updateSettingsButtons();

  lastPendingMessage = {
    conversation: convoForSend,
    message: messagePayload,
  };

  streamingConversationId = convoForSend.id;
  try {
    streamPort.postMessage({
      type: 'chatSend',
      payload: { conversation: convoForSend, message: messagePayload },
    });
  } catch (err) {
    logError('Stream postMessage failed', err);
    renderError('Connection lost. Please retry.');
    portReady = false;
  }
}

async function persistConversation() {
  if (!currentConversation) {
    return;
  }
  try {
    await chrome.runtime.sendMessage({
      type: 'chatUpdate',
      payload: { conversation: currentConversation },
    });
  } catch (err) {
    logError('Persist conversation failed', err);
  }
}

async function deleteConversation(id) {
  try {
    await chrome.runtime.sendMessage({ type: 'chatDelete', payload: { id } });
    conversations = conversations.filter((c) => c.id !== id);
    if (currentConversation?.id === id) {
      currentConversation = conversations[0] || null;
      if (currentConversation) {
        setActiveConversation(currentConversation.id);
      } else {
        renderConversations();
        renderMessages();
      }
    } else {
      renderConversations();
    }
  } catch (err) {
    logError('Delete conversation failed', err);
  }
}

function handleFiles(event) {
  const files = Array.from(event.target.files || []);
  const available = Math.max(0, 4 - attachments.length);
  const toAdd = files.slice(0, available);
  toAdd.forEach((file) => {
    const isMarkdown = file.name.endsWith('.md') || file.name.endsWith('.markdown');
    const isImage = file.type.startsWith('image/');

    if (!isMarkdown && !isImage) {
      return; // Skip unsupported files
    }

    const reader = new FileReader();
    reader.onload = () => {
      attachments.push({
        name: file.name,
        mime: file.type || (isMarkdown ? 'text/markdown' : 'application/octet-stream'),
        dataUrl: reader.result,
        isMarkdown: isMarkdown,
      });
      renderAttachmentPreviews();
    };

    if (isMarkdown) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
  event.target.value = '';
}

function handlePaste(event) {
  const items = event.clipboardData?.files ? Array.from(event.clipboardData.files) : [];
  if (!items.length) {
    return;
  }
  const images = items.filter((f) => f.type.startsWith('image/'));
  if (!images.length) {
    return;
  }
  const available = Math.max(0, 4 - attachments.length);
  const toAdd = images.slice(0, available);
  toAdd.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      attachments.push({
        name: file.name,
        mime: file.type,
        dataUrl: reader.result,
      });
      renderAttachmentPreviews();
    };
    reader.readAsDataURL(file);
  });
  event.preventDefault();
}

function getDefaultModel(provider) {
  const models = providerModels[provider] || [];
  if (models.length > 0) {
    return models[0];
  }
  switch (provider) {
    case 'claude':
      return 'claude-sonnet-4-5';
    case 'gemini':
      return 'gemini-2.5-flash';
    case 'openai':
    default:
      return 'gpt-4o-mini';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function populateProviderSelect() {
  const select = providerSelect();
  select.innerHTML = '';

  const providerNames = {
    openai: 'OpenAI',
    claude: 'Claude',
    gemini: 'Gemini',
  };

  const configuredProviders = ['openai', 'claude', 'gemini'].filter((p) => config[p]?.apiKey);

  if (configuredProviders.length === 0) {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Add an API key in Options';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);
    return null;
  }

  configuredProviders.forEach((provider) => {
    const opt = document.createElement('option');
    opt.value = provider;
    opt.textContent = providerNames[provider];
    select.appendChild(opt);
  });

  // Set current provider to saved if configured, otherwise first configured
  const currentProvider = config.provider;
  if (currentProvider && configuredProviders.includes(currentProvider)) {
    select.value = currentProvider;
    return currentProvider;
  }

  const chosen = configuredProviders[0];
  select.value = chosen;
  config.provider = chosen;
  chrome.storage.local.set({ config }).catch((err) => logError('Failed to persist provider', err));
  return chosen;
}

function populateModelSelect(provider, selected) {
  // Refresh config.provider to stay in sync with UI
  if (provider && config.provider !== provider) {
    config.provider = provider;
    chrome.storage.local.set({ config }).catch((err) => logError('Persist provider failed', err));
  }

  // Sanitize gemini models and selected value
  if (provider === 'gemini') {
    providerModels.gemini = filterGeminiModels(providerModels.gemini);
    selected = sanitizeGeminiModel(selected);
  }

  const options = {
    openai: providerModels.openai.length ? providerModels.openai : ['gpt-4o-mini', 'gpt-4o'],
    claude: providerModels.claude.length
      ? providerModels.claude
      : ['claude-sonnet-4-5', 'claude-haiku-3-5'],
    gemini: providerModels.gemini.length ? providerModels.gemini : ['gemini-2.5-flash'],
  };

  const models = options[provider] || [];

  const select = modelSelect();
  select.innerHTML = '';
  select.disabled = false;

  models.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    select.appendChild(opt);
  });

  // Only use selected if it's in the provider's model list
  if (selected && models.includes(selected)) {
    select.value = selected;
  } else if (models.length > 0) {
    // Fallback to first model in the list
    select.value = models[0];
    if (provider === 'gemini') {
      config.gemini = { ...(config.gemini || {}), model: select.value };
      chrome.storage.local
        .set({ config })
        .catch((err) => logError('Persist gemini model failed', err));
    }
  }
}

function disableModelSelect(message) {
  const select = modelSelect();
  select.innerHTML = '';
  const opt = document.createElement('option');
  opt.textContent = message;
  opt.disabled = true;
  opt.selected = true;
  select.appendChild(opt);
  select.disabled = true;
}

function isProviderConfigured(provider) {
  return Boolean(config?.[provider]?.apiKey);
}

function ensureChatProviderConfigured(options = {}) {
  const { openOptions = true, showError = true } = options;
  const provider = providerSelect()?.value || config?.provider || 'openai';
  const hasApiKey = isProviderConfigured(provider);
  const sendBtn = document.getElementById('send-btn');
  setComposerEnabled(hasApiKey);
  if (!hasApiKey) {
    if (showError) {
      renderError('Please add an API key in Options before sending messages.');
    }
    if (openOptions) {
      try {
        chrome.runtime.openOptionsPage();
      } catch (err) {
        logError('Failed to open options page from chat:', err);
      }
    }
    return false;
  }
  return true;
}

function updateSendAvailability() {
  ensureChatProviderConfigured({ openOptions: false, showError: false });
}

function setComposerEnabled(enabled) {
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) {
    sendBtn.disabled = !enabled;
  }
  const input = inputEl();
  if (input) {
    input.disabled = !enabled;
  }
  const attachBtn = document.getElementById('attach-btn');
  if (attachBtn) {
    attachBtn.disabled = !enabled;
  }
  const webSearchBtn = document.getElementById('web-search-btn');
  if (webSearchBtn) {
    webSearchBtn.disabled = !enabled;
    webSearchBtn.classList.toggle('disabled', !enabled);
  }
}

function handleStreamMessage(msg) {
  if (!currentConversation) {
    return;
  }
  if (msg.type === 'chatStreamChunk') {
    if (msg.conversationId !== streamingConversationId) {
      return;
    }
    const msgs = currentConversation.messages || [];
    const last = msgs[msgs.length - 1];
    if (last && last.role === 'assistant') {
      last.content = msg.content || '';
      updateLastMessage(msg.content || '');
    }
  } else if (msg.type === 'chatStreamDone') {
    streamingConversationId = null;

    const convo = msg.conversation;
    const idx = conversations.findIndex((c) => c.id === convo.id);
    if (idx >= 0) {
      conversations[idx] = convo;
    } else {
      conversations.unshift(convo);
    }
    currentConversation = convo;

    // Now render final markdown for the last message
    const messages = messagesEl();
    const lastMsg = messages.querySelector('.msg:last-child .bubble');
    if (lastMsg && convo.messages?.length) {
      const lastContent = convo.messages[convo.messages.length - 1].content;
      const rendered = renderMarkdown(lastContent || '');
      lastMsg.innerHTML = rendered;
      lastMsg.style.whiteSpace = '';

      // Re-attach copy handlers
      lastMsg.querySelectorAll('.copy-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const code = e.target.dataset.code || '';
          try {
            await navigator.clipboard.writeText(code);
            e.target.textContent = 'Copied';
            setTimeout(() => (e.target.textContent = 'Copy'), 1500);
          } catch (err) {
            logError('Copy failed', err);
          }
        });
      });
    }

    renderConversations(); // Only update conversation list
    renderError(null);
  } else if (msg.type === 'chatStreamError') {
    streamingConversationId = null;
    renderError(msg.error || 'Streaming failed. Please retry.');
    try {
      streamPort?.disconnect();
    } catch (_) {
      // ignore
    }
    streamPort = null;
    portReady = false;
    connectStreamPort();
    loadConversations().then(() => {
      if (conversations.length && currentConversation) {
        setActiveConversation(currentConversation.id);
      } else if (conversations.length) {
        setActiveConversation(conversations[0].id);
      }
    });
  }
}

function openPromptsModal() {
  renderPromptList();
  document.getElementById('prompts-modal').classList.remove('modal-hidden');
}

function closePromptsModal() {
  document.getElementById('prompts-modal').classList.add('modal-hidden');
}

async function savePrompt() {
  const title = document.getElementById('prompt-title').value.trim();
  const text = document.getElementById('prompt-text').value.trim();
  if (!title || !text) {
    return;
  }
  promptLibrary.unshift({ id: `prompt_${Date.now()}`, title, text });
  await chrome.storage.local.set({ chatPrompts: promptLibrary });
  document.getElementById('prompt-title').value = '';
  document.getElementById('prompt-text').value = '';
  renderPromptList();
}

function renderPromptList() {
  const list = document.getElementById('prompt-list');
  list.innerHTML = '';
  if (!promptLibrary.length) {
    list.innerHTML = '<div class="empty-state">No saved prompts</div>';
    return;
  }
  promptLibrary.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'prompt-item';
    item.innerHTML = `
      <div class="prompt-title">${escapeHtml(p.title)}</div>
      <div class="prompt-text">${renderMarkdown(p.text)}</div>
      <div class="prompt-actions">
        <button class="btn btn-secondary btn-sm apply" data-id="${p.id}">Apply</button>
        <button class="btn btn-ghost btn-sm delete" data-id="${p.id}">Delete</button>
      </div>
    `;
    item.querySelector('.apply').addEventListener('click', () => applyPrompt(p));
    item.querySelector('.delete').addEventListener('click', async () => {
      promptLibrary = promptLibrary.filter((x) => x.id !== p.id);
      await chrome.storage.local.set({ chatPrompts: promptLibrary });
      renderPromptList();
    });
    list.appendChild(item);
  });
}

async function applyPrompt(p) {
  if (!currentConversation) {
    return;
  }
  currentConversation.systemPrompt = p.text;
  await persistConversation();
  updateSettingsButtons();
  closePromptsModal();
}

function renderError(message) {
  const el = document.getElementById('chat-error');
  if (!el) {
    return;
  }
  if (!message) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  el.style.display = 'flex';
  el.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button id="retry-chat">Retry</button>
  `;
  document.getElementById('retry-chat')?.addEventListener('click', () => {
    renderError(null);
    if (lastPendingMessage) {
      if (!ensurePort()) {
        connectStreamPort();
      }
      streamingConversationId = lastPendingMessage.conversation.id;
      try {
        streamPort.postMessage({
          type: 'chatSend',
          payload: lastPendingMessage,
        });
      } catch (err) {
        logError('Retry failed', err);
        renderError('Retry failed. Please try again.');
      }
    }
  });
}

function openModal() {
  if (!currentConversation) {
    return;
  }
  modalSystemPrompt().value = currentConversation.systemPrompt || '';
  modalMaxTokens().value = currentConversation.maxTokens || 10000;
  modalEl().classList.remove('modal-hidden');
}

function closeModal() {
  modalEl().classList.add('modal-hidden');
}

async function saveModalSettings() {
  if (!currentConversation) {
    closeModal();
    return;
  }
  const newPrompt = modalSystemPrompt().value;
  const newMax = parseInt(modalMaxTokens().value, 10) || 10000;
  currentConversation.systemPrompt = newPrompt;
  currentConversation.maxTokens = newMax;
  await persistConversation();
  updateSettingsButtons();
  closeModal();
}

function updateSettingsButtons() {
  const sysBtn = document.getElementById('btn-system-prompt');
  const maxBtn = document.getElementById('btn-max-tokens');
  if (sysBtn) {
    const hasPrompt = currentConversation?.systemPrompt?.trim();
    sysBtn.textContent = hasPrompt ? '🧠 System prompt (set)' : '🧠 System prompt';
  }
  if (maxBtn) {
    const max = currentConversation?.maxTokens || 10000;
    maxBtn.textContent = `🧮 Max tokens (${max})`;
  }
}

init().catch((err) => {
  logError('Chat init failed', err);
});
const MATH_PLACEHOLDER = '__MATH_BLOCK_';

function normalizeCodeFences(text) {
  if (!text || !text.includes('```')) {
    return text;
  }
  const fenceCount = (text.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) {
    return `${text}\n\`\`\`\n`;
  }
  return text;
}

function protectMath(text) {
  const mathBlocks = [];
  let idx = 0;
  const replaced = text.replace(/\$\$([\s\S]+?)\$\$|\$([^\n]+?)\$/g, (match, block, inline) => {
    const content = block || inline;
    const placeholder = `${MATH_PLACEHOLDER}${idx}__`;
    mathBlocks.push({ placeholder, content, display: Boolean(block) });
    idx += 1;
    return placeholder;
  });
  return { replaced, mathBlocks };
}

function renderMath(content, display) {
  try {
    return katex.renderToString(content, {
      displayMode: display,
      throwOnError: false,
    });
  } catch (err) {
    logError('KaTeX render failed', err);
    return content;
  }
}

function renderMarkdown(text) {
  if (!text) {
    return '';
  }
  const normalized = normalizeCodeFences(text);
  const { replaced, mathBlocks } = protectMath(normalized);
  const parsed = marked.parse(replaced);

  let restored = parsed;
  mathBlocks.forEach(({ placeholder, content, display }) => {
    const html = renderMath(content, display);
    restored = restored.replaceAll(placeholder, html);
  });

  const temp = document.createElement('div');
  temp.innerHTML = restored;

  temp.querySelectorAll('pre code').forEach((codeEl) => {
    // Code is already highlighted by marked, just add hljs class for styling
    if (!codeEl.classList.contains('hljs')) {
      codeEl.classList.add('hljs');
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    const pre = codeEl.parentElement;
    if (pre && pre.parentElement) {
      pre.parentElement.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.dataset.code = codeEl.textContent || '';
      wrapper.appendChild(copyBtn);
    }
  });

  temp.querySelectorAll('a').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });

  return temp.innerHTML;
}
