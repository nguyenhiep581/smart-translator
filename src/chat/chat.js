import { error as logError, debug } from '../utils/logger.js';
import hljs from 'highlight.js/lib/common';
import { marked } from 'marked';

let conversations = [];
let currentConversation = null;
let attachments = [];
let config = null;
let streamPort = null;
let streamingConversationId = null;
let providerModels = { openai: [], claude: [], gemini: [], copilot: [] };
let lastPendingMessage = null;
let promptLibrary = [];
let portReady = false;

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
  populateModelSelect(config.provider || 'openai', getDefaultModel(config.provider || 'openai'));
  bindEvents();
  renderConversations();
  if (conversations.length === 0) {
    await createNewConversation();
  } else {
    setActiveConversation(conversations[0].id);
  }
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
    gemini: config.gemini?.availableModels || [],
    copilot: config.copilot?.availableModels || [],
  };
  // Pick defaults if model present in config but not in available list
  ['openai', 'claude', 'gemini', 'copilot'].forEach((p) => {
    const model = config[p]?.model;
    if (model && !providerModels[p].includes(model)) {
      providerModels[p].unshift(model);
    }
  });
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
    const model = getDefaultModel(provider);
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

  document.getElementById('file-input').addEventListener('change', handleFiles);
  document.getElementById('btn-system-prompt').addEventListener('click', () => openModal());
  document.getElementById('btn-max-tokens').addEventListener('click', () => openModal());
  document.getElementById('btn-prompts').addEventListener('click', openPromptsModal);
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
    currentConversation.model = modelSelect().value;
    await persistConversation();
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
    const badge = m.role === 'assistant' ? '🤖' : '🧑';
    row.innerHTML = `
      <div class="role" title="${m.role}">${badge}</div>
      <div class="bubble markdown-body">${rendered}<div class="msg-actions"><button class="icon-btn quote-btn" title="Quote">❝</button><button class="icon-btn copy-msg-btn" title="Copy message">📋</button></div></div>
    `;
    messagesEl().appendChild(row);

    row.querySelector('.quote-btn').addEventListener('click', () => {
      const quoted = `> ${m.content.replace(/\n/g, '\n> ')}\n\n`;
      inputEl().value = inputEl().value + quoted;
      inputEl().focus();
    });
    row.querySelector('.copy-msg-btn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(m.content || '');
      } catch (err) {
        logError('Copy message failed', err);
      }
    });
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
    currentConversation.model || getDefaultModel(currentConversation.provider || config.provider),
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
    wrap.innerHTML = `
      <img src="${att.dataUrl}" alt="${escapeHtml(att.name)}" />
      <button data-idx="${idx}">×</button>
    `;
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
    return;
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
    attachments: attachments.slice(0, 3),
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
  const available = Math.max(0, 3 - attachments.length);
  const toAdd = files.slice(0, available);
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
  const available = Math.max(0, 3 - attachments.length);
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
      return 'claude-haiku-4-5-20251001';
    case 'gemini':
      return 'gemini-pro';
    case 'copilot':
      return 'gpt-4o-mini';
    case 'openai':
    default:
      return 'gpt-4o-mini';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function escapeHtmlAttr(text) {
  return (text || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function populateModelSelect(provider, selected) {
  const options = {
    openai: providerModels.openai.length ? providerModels.openai : ['gpt-4o-mini', 'gpt-4o'],
    claude: providerModels.claude.length
      ? providerModels.claude
      : ['claude-haiku-4-5-20251001', 'claude-3-sonnet-20240229'],
    gemini: providerModels.gemini.length ? providerModels.gemini : ['gemini-pro'],
    copilot: providerModels.copilot.length ? providerModels.copilot : ['gpt-4o-mini', 'gpt-4o'],
  };
  const select = modelSelect();
  select.innerHTML = '';
  (options[provider] || [selected || '']).forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    select.appendChild(opt);
  });
  if (selected) {
    select.value = selected;
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
      renderMessages();
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
    renderConversations();
    renderMessages();
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
function renderMarkdown(text) {
  if (!text) {
    return '';
  }
  marked.setOptions({
    gfm: true,
    breaks: true,
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  });

  const html = marked.parse(text);
  // add copy buttons to code blocks
  const temp = document.createElement('div');
  temp.innerHTML = html;
  temp.querySelectorAll('pre code').forEach((codeEl) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    const pre = codeEl.parentElement;
    pre.parentElement.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.dataset.code = codeEl.textContent || '';
    wrapper.appendChild(copyBtn);
  });
  temp.querySelectorAll('a').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
  return temp.innerHTML;
}
