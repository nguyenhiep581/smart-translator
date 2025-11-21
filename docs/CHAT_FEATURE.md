# Chat Feature Overview

This document describes the ChatGPT-style chat implementation: architecture, data flow, APIs, and UI behaviors.

## Capabilities
- Providers: OpenAI, Claude, Gemini, Copilot (uses existing provider configs).
- Streaming replies: OpenAI/Copilot/Claude stream; Gemini returns final text only.
- Context: Last 6 messages sent with each request; automatic summarization when history grows.
- Attachments: Up to 3 images per user message (OpenAI/Copilot handle image_url; others ignore).
- System prompt & max tokens per conversation (defaults to 10,000).
- Conversation history persisted in `chrome.storage.local` (rolling history; summary used to shrink).
- UI: Chat page with sidebar history, model selector, system prompt/max tokens modal, streaming status, paste/attach images, copy buttons for code blocks, Markdown rendering with highlight.js, search and delete conversations, role icons.

## Storage & Data Model
- Stored key: `chatConversations` in `chrome.storage.local`.
- Conversation shape:
  ```js
  {
    id,
    title,
    provider,
    model,
    systemPrompt,
    maxTokens,
    summary,          // optional summarized history
    messages: [ { role: 'user'|'assistant', content, attachments? } ],
    updatedAt
  }
  ```
- Recent conversations kept; summary collapses old messages when token estimate is high.

## Background Flow
- `src/background/services/chatService.js`
  - `sendChatMessage` (non-stream): Builds payload (system prompt + summary + last 6 messages + new user message), summaries if needed, calls provider chat, returns text.
  - `streamChatMessage`: Streams for OpenAI/Copilot (OpenAI SSE) and Claude (Anthropic SSE); Gemini falls back to final-only. Keeps last pending message for retry UI.
  - `ensureSummaryIfNeeded`: Estimates tokens (rough heuristic) and, if over threshold, summarizes older messages with a summary prompt (<=200 words) and keeps recent messages.
  - Summary prompt:
    ```
    You are a conversation summarizer.
    Summarize the following messages into a concise description preserving key facts, details, user preferences, decisions, tasks, and important context.
    Keep the summary under 200 words.
    ```
  - Provider chat classes: OpenAI/Copilot (OpenAI style), Claude (messages array), Gemini (generateContent).
  - Messages include up to 3 attachments (image_url).
- `src/background/backgroundMessageRouter.js`
  - Message types: `chatList`, `chatCreate`, `chatUpdate`, `chatDelete`, `chatSend`.
  - Streaming port: `chat-stream` (`onConnect`), handles chunked responses and final conversation persistence.

## Frontend Flow (Chat Page)
- Files: `src/chat/chat.html|css|js`.
- Opens via popup button “Open Chat” → new tab.
- Connects to background port `chat-stream`.
- UI:
  - Sidebar: “New chat”, model dropdown, recent conversations list.
  - Main: settings buttons opening modal for system prompt and max tokens (up to 10k), messages thread, composer with larger textarea (3 rows), attach button, paste-to-attach images (max 3), send on Enter (Shift+Enter newline).
  - Markdown rendering with highlight.js; code blocks include copy buttons.
  - Error bar with Retry: on streaming error, reconnects port and replays last pending message.
  - Search and delete conversations in sidebar; role icons instead of text labels.
- Model lists: uses provider `availableModels` from config when present; falls back to presets.

## Options UI
- Provider select dropdown (OpenAI/Claude/Gemini/Copilot).
- “Get Models” for all providers; fetched lists saved to config `availableModels` and used by chat defaults.
- Max tokens defaults set to 10,000 per provider in `config/defaults.js`.

## Attachments
- Up to 3 images per user message.
- Paste-to-attach and file input; previews shown; remove button per attachment.
- Non-image clipboard items ignored.

## Streaming & Error Handling
- Streaming updates assistant message live; on error, shows inline error bar with Retry (re-sends last pending message).
- On stream error, reconnects to `chat-stream`.

## Build Notes
- Chat page is an entry in `vite.config.js`.
- highlight.js is a dependency (installed via pnpm).
- No DOMPurify: input is escaped before Markdown replacements; code blocks use highlight.js output.
