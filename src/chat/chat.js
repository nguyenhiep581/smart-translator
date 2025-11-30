import { error as logError, debug } from '../utils/logger.js';
import {
  getDefaultModel,
  filterModelsByProvider,
  sanitizeModel,
  PROVIDER_DEFAULT_MODELS,
  DEFAULT_CHAT_TEMPERATURE,
  DEFAULT_CHAT_MAX_TOKENS,
} from '../config/providers.js';
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
let promptFilter = '';
let promptSelectionIndex = 0;
let slashPromptVisible = false;
let slashPromptFilter = '';
let slashPromptIndex = 0;

const DEFAULT_CHAT_PROMPTS = [
  {
    id: 'prompt_translate_en',
    title: 'Translate to English',
    text: 'Translate the following text into natural, concise English. Preserve formatting and inline code. Do not add commentary.',
  },
  {
    id: 'prompt_translate_ja',
    title: 'Translate to Japanese',
    text: 'Translate the following text into clear, natural Japanese. Keep technical terms in English if commonly used. No explanations.',
  },
  {
    id: 'prompt_java_dev',
    title: 'Java developer',
    text: 'You are a senior Java developer. Propose idiomatic Java solutions (Java 17+), prefer readability, and explain only when necessary.',
  },
  {
    id: 'prompt_react_dev',
    title: 'React developer',
    text: 'You are a pragmatic React developer. Suggest React/TypeScript solutions, functional components, hooks, and minimal dependencies.',
  },
  {
    id: 'prompt_devops',
    title: 'DevOps',
    text: 'You are a DevOps engineer. Provide practical commands/config for CI/CD, containers, Kubernetes, networking, and observability.',
  },
  {
    id: 'prompt_architecture',
    title: 'Architecture',
    text: 'You are a software architect. Propose simple, scalable designs. Call out trade-offs, data flow, and failure handling briefly.',
  },
  {
    id: 'prompt_estimation',
    title: 'Estimation',
    text: 'Estimate implementation effort. List assumptions, risks, and give a rough time/complexity breakdown with confidence level.',
  },
];

const PROVIDER_SYSTEM_DEFAULTS = {
  claude:
    'You are a helpful AI assistant. Respond concisely and directly. Prefer clear bullet points when listing items. Include code or examples only when they add clarity.',
  gemini:
    'You are a helpful AI assistant. Answer succinctly and stay on topic. Provide practical steps or short examples when useful, but keep responses tight.',
};

const getProviderSystemPrompt = (provider) => PROVIDER_SYSTEM_DEFAULTS[provider] || '';

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
const modalTemperature = () => document.getElementById('modal-temperature');
const messagesEl = () => document.getElementById('messages');
const convoListEl = () => document.getElementById('conversation-list');
const inputEl = () => document.getElementById('input');
const attachmentContainer = () => document.getElementById('attachment-previews');

function formatTimestamp(ts) {
  if (!ts) {
    return '';
  }
  try {
    return new Date(ts).toLocaleString();
  } catch (_) {
    return '';
  }
}

function updateWebBrowsingUI() {
  const btn = document.getElementById('web-search-btn');
  if (!btn) {
    return;
  }
  if (webBrowsingEnabled) {
    btn.classList.add('active');
    btn.style.color = '#3b82f6';
  } else {
    btn.classList.remove('active');
    btn.style.color = '';
  }
}

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

  // Load saved web browsing state
  try {
    const state = await chrome.storage.local.get('webBrowsingEnabled');
    if (state && state.webBrowsingEnabled === true) {
      webBrowsingEnabled = true;
    } else {
      webBrowsingEnabled = false;
    }
    updateWebBrowsingUI();
    debug('Chat init: loaded webBrowsingEnabled =', webBrowsingEnabled);
  } catch (err) {
    logError('Failed to load web browsing state', err);
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
  const storedPrompts = Array.isArray(res.chatPrompts) ? res.chatPrompts : [];
  const missingDefaults = DEFAULT_CHAT_PROMPTS.filter(
    (p) => !storedPrompts.some((sp) => sp.id === p.id),
  );
  promptLibrary =
    storedPrompts.length === 0 ? DEFAULT_CHAT_PROMPTS : [...storedPrompts, ...missingDefaults];
  if (missingDefaults.length || storedPrompts.length === 0) {
    chrome.storage.local.set({ chatPrompts: promptLibrary }).catch((err) => {
      logError('Failed to seed default prompts', err);
    });
  }

  providerModels = {
    openai: config.openai?.availableModels || [],
    claude: config.claude?.availableModels || [],
    gemini: filterModelsByProvider('gemini', config.gemini?.availableModels || []),
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
      conversations =
        res.data?.map((c) => {
          const maxNum = Number(c.maxTokens);
          const safeMax = Number.isFinite(maxNum) ? maxNum : DEFAULT_CHAT_MAX_TOKENS;
          return { ...c, maxTokens: safeMax };
        }) || [];
    }
  } catch (err) {
    logError('Failed to load conversations', err);
  }
}

async function createNewConversation() {
  try {
    const lastConvo = currentConversation || conversations[0];
    const provider = lastConvo?.provider || config.provider || 'openai';

    const availableModels = providerModels[provider] || [];
    let model = lastConvo?.model;

    if (!model || (provider === 'gemini' && !availableModels.includes(model))) {
      if (config.chatModel && availableModels.includes(config.chatModel)) {
        model = config.chatModel;
      } else {
        model = getDefaultModel(provider);
      }
    }

    if (provider === 'gemini') {
      model = sanitizeModel('gemini', model);
    }

    const systemPrompt = config.systemPrompt || getProviderSystemPrompt(provider);
    const defaultTemp = config.chat?.temperature ?? DEFAULT_CHAT_TEMPERATURE;
    const res = await chrome.runtime.sendMessage({
      type: 'chatCreate',
      payload: {
        provider,
        model,
        systemPrompt,
        maxTokens: DEFAULT_CHAT_MAX_TOKENS,
        temperature: defaultTemp,
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
    if (slashPromptVisible) {
      const matches = getSlashPromptMatches();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        slashPromptIndex = Math.min(matches.length - 1, slashPromptIndex + 1);
        renderSlashPromptSuggestions();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        slashPromptIndex = Math.max(0, slashPromptIndex - 1);
        renderSlashPromptSuggestions();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        applySlashPromptByIndex(slashPromptIndex);
        return;
      }
      if (e.key === 'Escape') {
        hideSlashPromptSuggestions();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  inputEl().addEventListener('input', handleSlashPromptInput);
  inputEl().addEventListener('paste', handlePaste);
  inputEl().addEventListener('blur', hideSlashPromptSuggestions);

  document.getElementById('attach-btn').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  document.getElementById('web-search-btn').addEventListener('click', () => {
    webBrowsingEnabled = !webBrowsingEnabled;
    updateWebBrowsingUI();
    chrome.storage.local.set({ webBrowsingEnabled }).catch((err) => {
      logError('Failed to save web browsing state', err);
    });
  });

  document.getElementById('file-input').addEventListener('change', handleFiles);
  document.getElementById('btn-system-prompt').addEventListener('click', () => openModal());
  document.getElementById('btn-max-tokens').addEventListener('click', () => openModal());
  document.getElementById('btn-temperature').addEventListener('click', () => openModal());
  document.getElementById('btn-prompts').addEventListener('click', openPromptsModal);
  document.getElementById('refresh-models').addEventListener('click', refreshModels);
  document.getElementById('close-modal').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveModalSettings);
  document.getElementById('modal-backdrop').addEventListener('click', closeModal);
  modalMaxTokens().addEventListener('keydown', (e) => {
    e.stopPropagation();
  });
  modalTemperature().addEventListener('keydown', (e) => {
    e.stopPropagation();
  });

  document.getElementById('prompts-backdrop').addEventListener('click', closePromptsModal);
  document.getElementById('close-prompts').addEventListener('click', closePromptsModal);
  document.getElementById('prompt-save').addEventListener('click', savePrompt);
  const promptSearch = document.getElementById('prompt-search');
  if (promptSearch) {
    promptSearch.addEventListener('input', (e) => {
      promptFilter = e.target.value || '';
      promptSelectionIndex = 0;
      renderPromptList();
    });
    promptSearch.addEventListener('keydown', (e) => {
      const filtered = getFilteredPrompts();
      if (!filtered.length) {
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        promptSelectionIndex = Math.min(filtered.length - 1, promptSelectionIndex + 1);
        renderPromptList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        promptSelectionIndex = Math.max(0, promptSelectionIndex - 1);
        renderPromptList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        insertPromptIntoComposer(filtered[promptSelectionIndex]);
      }
    });
  }

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
    const subtitle = c.summary || previewFromMessages(c);
    el.innerHTML = `
      <button class="delete-btn" title="Delete">&times;</button>
      <div class="conversation-title">${escapeHtml(c.title || 'Conversation')}</div>
      <div class="conversation-meta">${escapeHtml(subtitle || '')}</div>
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
  const lastMsg = lastMsgRow?.querySelector('.message-body');
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

function createMessageActions(messageText) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';
  actions.innerHTML = `
    <button class="action-btn copy" aria-label="Copy message" title="Copy">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"></path>
      </svg>
    </button>
    <button class="action-btn quote" aria-label="Quote message" title="Quote">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M7 7h6v2H9v6H7V7zm8 0h6v2h-4v6h-2V7z" fill="currentColor"></path>
      </svg>
    </button>
  `;
  const copyBtn = actions.querySelector('.copy');
  const quoteBtn = actions.querySelector('.quote');
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(messageText);
    } catch (err) {
      logError('Copy message failed', err);
    }
  });
  quoteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const input = inputEl();
    if (!input) {
      return;
    }
    input.value = messageText;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    updateSendAvailability();
  });
  return actions;
}

function attachMessageActions(bubbleEl, messageText) {
  if (!bubbleEl) {
    return;
  }
  bubbleEl.querySelector('.message-actions')?.remove();
  if (!messageText || !messageText.trim()) {
    return;
  }
  bubbleEl.appendChild(createMessageActions(messageText));
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
    const messageText = m.content || '';
    const meta = formatTimestamp(m.timestamp);

    // Always show 🤖 for assistant, 🧑 for user (no loading spinner)
    const badge = m.role === 'assistant' ? '🤖' : '🧑';

    row.innerHTML = `
      <div class="role" title="${m.role}">${badge}</div>
      <div class="bubble markdown-body">
        <div class="message-body">${rendered || (isEmpty ? '<div class="loading-dots">Thinking...</div>' : '')}</div>
        <div class="message-meta">${meta}</div>
      </div>
    `;

    const bubbleEl = row.querySelector('.bubble');
    attachMessageActions(bubbleEl, messageText);
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
  modalMaxTokens().value = currentConversation.maxTokens || DEFAULT_CHAT_MAX_TOKENS;
  modalTemperature().value = currentConversation.temperature ?? DEFAULT_CHAT_TEMPERATURE;
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

function previewFromMessages(conversation) {
  const msgs = conversation?.messages || [];
  const firstUser = msgs.find((m) => m.role === 'user');
  if (!firstUser || !firstUser.content) {
    return '';
  }
  const text = firstUser.content.replace(/\s+/g, ' ').trim();
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
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
  }

  if (activeProvider === 'gemini') {
    currentConversation.model = sanitizeGeminiModel(currentConversation.model);
  }

  if (!currentConversation.systemPrompt) {
    const fallbackPrompt = getProviderSystemPrompt(activeProvider);
    currentConversation.systemPrompt = fallbackPrompt;
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
    timestamp: Date.now(),
  };
  debug('sendMessage payload:', {
    webBrowsing: webBrowsingEnabled,
    attachmentsCount: attachments.length,
  });

  // Build a clean copy for sending (no optimistic messages)
  const convoForSend = {
    ...currentConversation,
    messages: [...(currentConversation.messages || [])],
  };
  if (!convoForSend.systemPrompt) {
    convoForSend.systemPrompt = getProviderSystemPrompt(activeProvider);
  }

  // UI-only optimistic placeholder
  const uiConversation = {
    ...convoForSend,
    messages: [
      ...convoForSend.messages,
      { role: 'user', content: text, timestamp: messagePayload.timestamp },
      { role: 'assistant', content: '', timestamp: Date.now() },
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

  const models = getModelsForProvider(provider);
  if (provider === 'gemini') {
    selected = sanitizeModel('gemini', selected);
  }

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

function getModelsForProvider(provider) {
  const fromConfig = filterModelsByProvider(provider, providerModels[provider] || []);
  const defaults = PROVIDER_DEFAULT_MODELS[provider] || [];
  if (fromConfig.length) {
    return fromConfig;
  }
  if (defaults.length) {
    return defaults;
  }
  return [getDefaultModel(provider)];
}

function sanitizeGeminiModel(model) {
  return sanitizeModel('gemini', model);
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
    renderStatus(null);
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
      const body = lastMsg.querySelector('.message-body');
      if (body) {
        body.innerHTML = rendered;
        body.style.whiteSpace = '';
      }
      attachMessageActions(lastMsg, lastContent || '');

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
    renderStatus(null);
  } else if (msg.type === 'chatStreamError') {
    renderStatus(null);
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
  } else if (msg.type === 'chatStreamStatus') {
    if (msg.conversationId && msg.conversationId !== streamingConversationId) {
      return;
    }
    renderStatus(msg.status);
  }
}

function openPromptsModal() {
  promptFilter = '';
  promptSelectionIndex = 0;
  renderPromptList();
  document.getElementById('prompts-modal').classList.remove('modal-hidden');
  const searchInput = document.getElementById('prompt-search');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
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

function getFilteredPrompts() {
  const term = promptFilter.trim().toLowerCase();
  if (!term) {
    return promptLibrary;
  }
  return promptLibrary.filter((p) => p.title.toLowerCase().includes(term));
}

function clampSelection(max) {
  if (max === 0) {
    promptSelectionIndex = 0;
    return;
  }
  if (promptSelectionIndex >= max) {
    promptSelectionIndex = max - 1;
  }
  if (promptSelectionIndex < 0) {
    promptSelectionIndex = 0;
  }
}

function renderPromptList() {
  const list = document.getElementById('prompt-list');
  list.innerHTML = '';
  const filtered = getFilteredPrompts();
  clampSelection(filtered.length);

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">No matching prompts</div>';
    return;
  }
  filtered.forEach((p, index) => {
    const item = document.createElement('div');
    item.className = `prompt-item${index === promptSelectionIndex ? ' selected' : ''}`;
    item.innerHTML = `
      <div class="prompt-title">${escapeHtml(p.title)}</div>
      <div class="prompt-text">${renderMarkdown(p.text)}</div>
      <div class="prompt-actions">
        <button class="btn btn-secondary btn-sm apply" data-id="${p.id}">Apply</button>
        <button class="btn btn-ghost btn-sm delete" data-id="${p.id}">Delete</button>
      </div>
    `;
    item.addEventListener('click', () => applyPrompt(p));
    item.querySelector('.apply').addEventListener('click', (e) => {
      e.stopPropagation();
      applyPrompt(p);
    });
    item.querySelector('.delete').addEventListener('click', async () => {
      promptLibrary = promptLibrary.filter((x) => x.id !== p.id);
      await chrome.storage.local.set({ chatPrompts: promptLibrary });
      renderPromptList();
    });
    list.appendChild(item);
  });
}

function applyPrompt(p, options = {}) {
  const { setComposer = true } = options;
  if (setComposer) {
    insertPromptIntoComposer(p);
  }
  closePromptsModal();
  hideSlashPromptSuggestions();
  updateSettingsButtons();
}

function applyPromptByIndex(index) {
  const filtered = getFilteredPrompts();
  if (!filtered.length || index < 0 || index >= filtered.length) {
    return;
  }
  applyPrompt(filtered[index]);
}

function insertPromptIntoComposer(prompt) {
  const input = inputEl();
  if (!input || !prompt?.text) {
    return;
  }
  input.value = prompt.text;
  const caret = prompt.text.length;
  input.setSelectionRange(caret, caret);
  input.focus();
  closePromptsModal();
}

function getSlashQuery() {
  const value = inputEl().value;
  const cursor = inputEl().selectionStart ?? value.length;
  const sliced = value.slice(0, cursor);
  // Only trigger when slash is the first non-space character
  const match = sliced.match(/^\s*\/(\w*)$/);
  if (!match) {
    return null;
  }
  return match[1] || '';
}

function getSlashPromptMatches() {
  const term = (slashPromptFilter || '').toLowerCase();
  if (!term) {
    return promptLibrary.slice(0, 20);
  }
  return promptLibrary.filter((p) => p.title.toLowerCase().includes(term)).slice(0, 20);
}

function hideSlashPromptSuggestions() {
  slashPromptVisible = false;
  const container = document.getElementById('prompt-suggestions');
  if (container) {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

function handleSlashPromptInput() {
  const query = getSlashQuery();
  if (query === null) {
    hideSlashPromptSuggestions();
    return;
  }
  slashPromptVisible = true;
  slashPromptFilter = query;
  slashPromptIndex = 0;
  renderSlashPromptSuggestions();
}

function renderSlashPromptSuggestions() {
  const container = document.getElementById('prompt-suggestions');
  if (!container) {
    return;
  }
  const matches = getSlashPromptMatches();
  if (!matches.length) {
    hideSlashPromptSuggestions();
    return;
  }
  slashPromptIndex = Math.min(slashPromptIndex, matches.length - 1);
  container.style.display = 'block';
  container.innerHTML = matches
    .map(
      (p, idx) => `
        <div class="prompt-suggestion-item ${idx === slashPromptIndex ? 'active' : ''}" data-id="${
  p.id
}">
          <div class="title">${escapeHtml(p.title)}</div>
          <div class="excerpt">${escapeHtml(p.text.slice(0, 140))}${p.text.length > 140 ? '…' : ''}</div>
        </div>
      `,
    )
    .join('');

  Array.from(container.querySelectorAll('.prompt-suggestion-item')).forEach((el, idx) => {
    el.addEventListener('click', () => {
      applySlashPromptByIndex(idx);
    });
  });
}

function applySlashPromptByIndex(index) {
  const matches = getSlashPromptMatches();
  if (!matches.length || index < 0 || index >= matches.length) {
    return;
  }
  // Remove the slash trigger from the input before applying
  const input = inputEl();
  const cursor = input.selectionStart ?? input.value.length;
  const before = input.value.slice(0, cursor);
  const after = input.value.slice(cursor);
  const cleanedBefore = before.replace(/^\s*\/\w*$/, (match) => (match.startsWith(' ') ? ' ' : ''));
  const promptText = matches[index].text || '';
  const updated = `${cleanedBefore}${promptText}${after}`;
  input.value = updated;
  const caret = (cleanedBefore || '').length + promptText.length;
  input.setSelectionRange(caret, caret);
  input.focus();
  applyPrompt(matches[index], { setComposer: false });
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
  const lastUserMsg = lastPendingMessage?.message?.content || '';
  const preview = lastUserMsg ? escapeHtml(lastUserMsg.slice(0, 200)) : '';
  el.style.display = 'flex';
  el.innerHTML = `
    <span>${escapeHtml(message)}</span>
    ${
  preview
    ? `<div class="retry-preview" title="Original message">${preview}${lastUserMsg.length > 200 ? '…' : ''}</div>`
    : ''
}
    <button id="retry-chat">Retry</button>
  `;
  document.getElementById('retry-chat')?.addEventListener('click', () => {
    renderError(null);
    if (preview) {
      const input = inputEl();
      if (input) {
        input.value = lastUserMsg;
        input.focus();
      }
    }
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

function renderStatus(message) {
  const el = document.getElementById('chat-status');
  if (!el) {
    return;
  }
  if (!message) {
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  el.style.display = 'flex';
  el.textContent = message;
}

function openModal() {
  if (!currentConversation) {
    return;
  }
  modalSystemPrompt().value = currentConversation.systemPrompt || '';
  modalMaxTokens().value = currentConversation.maxTokens || DEFAULT_CHAT_MAX_TOKENS;
  modalTemperature().value = currentConversation.temperature ?? DEFAULT_CHAT_TEMPERATURE;
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
  const newMax = parseInt(modalMaxTokens().value, 10) || DEFAULT_CHAT_MAX_TOKENS;
  const newTemp = parseFloat(modalTemperature().value);
  currentConversation.systemPrompt = newPrompt;
  currentConversation.maxTokens = newMax;
  currentConversation.temperature = isNaN(newTemp) ? DEFAULT_CHAT_TEMPERATURE : newTemp;
  await persistConversation();
  updateSettingsButtons();
  closeModal();
}

function updateSettingsButtons() {
  const sysBtn = document.getElementById('btn-system-prompt');
  const maxBtn = document.getElementById('btn-max-tokens');
  const tempBtn = document.getElementById('btn-temperature');
  if (sysBtn) {
    const hasPrompt = currentConversation?.systemPrompt?.trim();
    sysBtn.textContent = hasPrompt ? '🧠 System prompt (set)' : '🧠 System prompt';
  }
  if (maxBtn) {
    const maxValue = Number(currentConversation?.maxTokens);
    const max = Number.isFinite(maxValue) ? maxValue : DEFAULT_CHAT_MAX_TOKENS;
    maxBtn.textContent = `🧮 Max tokens (${max})`;
  }
  if (tempBtn) {
    const tempValue = currentConversation?.temperature ?? DEFAULT_CHAT_TEMPERATURE;
    tempBtn.textContent = `🌡️ Temp (${tempValue})`;
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
