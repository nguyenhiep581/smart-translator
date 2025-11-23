# 🔌 **API_SPECS.md — Translation Provider API Specifications**

---

## **Overview**

This document provides detailed API specifications for all supported translation providers. Use this as a reference when implementing translator classes.

---

# #️⃣ **1. OpenAI API**

## **1.1 Endpoint**

```
POST https://api.openai.com/v1/chat/completions
```

## **1.2 Authentication**

```http
Authorization: Bearer {API_KEY}
Content-Type: application/json
```

## **1.3 Request Format**

```json
{
  "model": "gpt-4-turbo-preview",
  "messages": [
    {
      "role": "system",
      "content": "You are a professional Vietnamese native translator..."
    },
    {
      "role": "user",
      "content": "Text to translate"
    }
  ],
  "temperature": 0.3,
  "max_tokens": 2048,
  "top_p": 1,
  "frequency_penalty": 0,
  "presence_penalty": 0
}
```

## **1.4 Response Format**

### Success Response (200 OK)

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4-turbo-preview",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Translated text here"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 30,
    "total_tokens": 80
  }
}
```

### Error Response

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```

## **1.5 Common Error Codes**

| Status | Error Code | Description |
|--------|-----------|-------------|
| 401 | `invalid_api_key` | Invalid or missing API key |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `server_error` | OpenAI server error |
| 503 | `service_unavailable` | Service temporarily unavailable |

## **1.6 Rate Limits**

- **Free tier**: 3 requests/minute
- **Paid tier**: 3,500 requests/minute (varies by model)

## **1.7 Recommended Models**

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| `gpt-4-turbo-preview` | Medium | Excellent | $$ |
| `gpt-4` | Slow | Excellent | $$$ |
| `gpt-3.5-turbo` | Fast | Good | $ |

## **1.8 System Prompt Template**

```javascript
function buildSystemPrompt(targetLang) {
  return `You are a professional ${targetLang} native translator who needs to fluently translate text into ${targetLang}.

## Translation Rules
1. Output only the translated content, without explanations or additional content (such as "Here's the translation:" or "Translation as follows:")
2. The returned translation must maintain exactly the same number of paragraphs and format as the original text
3. If the text contains HTML tags, consider where the tags should be placed in the translation while maintaining fluency
4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.
5. If input contains %%, use %% in your output, if input has no %%, don't use %% in your output`;
}
```

---

# #️⃣ **2. Claude API (Anthropic)**

## **2.1 Endpoint**

```
POST https://api.anthropic.com/v1/messages
```

## **2.2 Authentication**

```http
x-api-key: {API_KEY}
anthropic-version: 2023-06-01
content-type: application/json
```

## **2.3 Request Format**

```json
{
  "model": "claude-3-sonnet-20240229",
  "max_tokens": 2000,
  "system": "You are a professional Vietnamese native translator...",
  "messages": [
    {
      "role": "user",
      "content": "Text to translate"
    }
  ],
  "temperature": 0.3
}
```

## **2.4 Response Format**

### Success Response (200 OK)

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Translated text here"
    }
  ],
  "model": "claude-3-sonnet-20240229",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 50,
    "output_tokens": 30
  }
}
```

### Error Response

```json
{
  "type": "error",
  "error": {
    "type": "authentication_error",
    "message": "Invalid API key"
  }
}
```

## **2.5 Common Error Codes**

| Status | Error Type | Description |
|--------|-----------|-------------|
| 401 | `authentication_error` | Invalid API key |
| 429 | `rate_limit_error` | Too many requests |
| 400 | `invalid_request_error` | Malformed request |
| 500 | `api_error` | Internal server error |

## **2.6 Rate Limits**

- **Tier 1**: 50 requests/minute
- **Tier 2**: 1,000 requests/minute
- **Tier 3**: 2,000 requests/minute

## **2.7 Recommended Models**

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| `claude-3-opus-20240229` | Slow | Excellent | $$$ |
| `claude-3-sonnet-20240229` | Medium | Very Good | $$ |
| `claude-3-haiku-20240307` | Fast | Good | $ |

## **2.8 System Prompt Template**

Same as OpenAI (see section 1.8)

## **2.9 Custom Endpoint Support**

Both OpenAI and Claude translators support custom endpoints:

**Configuration:**
```javascript
{
  openai: {
    apiKey: 'sk-...',
    model: 'gpt-4-turbo-preview',
    endpoint: 'https://custom-openai-compatible-api.com/v1/chat/completions' // Optional
  },
  claude: {
    apiKey: 'sk-ant-...',
    model: 'claude-3-sonnet-20240229',
    endpoint: 'https://custom-claude-compatible-api.com/v1/messages' // Optional
  }
}
```

---

# #️⃣ **3. Gemini API (Google)**

## **3.1 Integration Method**

The extension uses the official Google GenAI SDK (`@google/genai`) for reliability and streaming support.

## **3.2 Authentication**

```javascript
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: CONFIG_API_KEY });
```

## **3.3 Configuration**

- **Model**: `gemini-2.0-flash-exp` (default)
- **Temperature**: 0.3 (default)
- **Max Tokens**: 10000 (default)

## **3.4 Recommended Models**

| Model | Speed | Quality | Context Window |
|-------|-------|---------|----------------|
| `gemini-2.0-flash-exp` | Very Fast | Excellent | 1M+ |
| `gemini-1.5-pro` | Fast | Excellent | 2M |
| `gemini-1.5-flash` | Extremely Fast | Good | 1M |

---

# #️⃣ **4. Web Search APIs**

## **4.1 Google Programmable Search Engine (Custom Search JSON API)**

Used for reliable, high-quality search results with an official API Key.

**Endpoint**:
```
GET https://www.googleapis.com/customsearch/v1
```

**Parameters**:
- `key`: API Key (from Google Cloud Console)
- `cx`: Search Engine ID (from Programmable Search Engine)
- `q`: Search query
- `num`: Number of results (default: 5)

**Response Format**:
```json
{
  "items": [
    {
      "title": "Page Title",
      "link": "https://example.com",
      "snippet": "Description of the page content..."
    }
  ]
}
```

## **4.2 DuckDuckGo HTML Search (Free)**

Used as a fallback or free alternative. Does not require an API key.

**Endpoint**:
```
GET https://html.duckduckgo.com/html/?q={QUERY}
```

**Parsing Logic**:
- Fetches the HTML response.
- Uses Regex to extract result blocks (Title, Link, Snippet).
- Decodes `uddg` redirect links to get the actual URL.

**Limitations**:
- Rate limiting by IP address.
- HTML structure changes may break the parser.
- Less structured than JSON API.

---

# #️⃣ **5. Language Detection API**

## **5.1 Offline Detection (Default)**

Use heuristic library like `franc-min`:

```javascript
import { franc } from 'franc-min';

function detectLanguage(text) {
  const langCode = franc(text);
  return mapToISO639(langCode);
}
```

## **5.2 API-Based Detection (Optional)**

### OpenAI Language Detection

Use same endpoint with specific prompt:

```json
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "system",
      "content": "Detect the language of the following text and respond with only the ISO 639-1 language code (e.g., 'en', 'vi', 'fr')."
    },
    {
      "role": "user",
      "content": "Text to detect"
    }
  ],
  "temperature": 0,
  "max_tokens": 10
}
```

Response will be simple: `"vi"` or `"en"`, etc.

---

# #️⃣ **6. Retry Logic**

## **6.1 Exponential Backoff**

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok) {
        return response;
      }
      
      // Retry on 429 (rate limit) or 5xx errors
      if (response.status === 429 || response.status >= 500) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await sleep(delay);
        continue;
      }
      
      // Don't retry on 4xx errors (except 429)
      throw new Error(`API error: ${response.status}`);
      
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

## **6.2 Retry Strategy**

| Error Type | Retry? | Max Retries | Backoff |
|-----------|--------|-------------|---------|
| 429 Rate Limit | Yes | 3 | Exponential |
| 500 Server Error | Yes | 3 | Exponential |
| 503 Unavailable | Yes | 2 | Exponential |
| 401 Auth Error | No | - | - |
| 400 Bad Request | No | - | - |

---

# #️⃣ **7. Timeout Configuration**

```javascript
const TIMEOUT_MS = 30000; // 30 seconds

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

try {
  const response = await fetch(url, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  return response;
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    throw new Error('Translation request timed out');
  }
  throw error;
}
```

---

# #️⃣ **8. Response Caching**

## **8.1 Cache Key Generation**

```javascript
async function generateCacheKey(provider, model, from, to, text) {
  const normalized = text.trim().toLowerCase();
  const hash = await hashString(normalized);
  return `${provider}-${model}-${from}-${to}-${hash}`;
}
```

## **8.2 Hash Function**

Use Web Crypto API for consistent hashing:

```javascript
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

---

# #️⃣ **9. Testing API Connections**

## **9.1 Health Check**

```javascript
async function testProviderConnection(config) {
  try {
    const translator = createTranslator(config);
    const result = await translator.translate(
      'Hello',
      'en',
      'vi',
      { timeout: 5000 }
    );
    
    return {
      success: true,
      message: 'Connection successful',
      sampleTranslation: result
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}
```

## **9.2 Test Data**

```javascript
const TEST_CASES = [
  { text: 'Hello', from: 'en', to: 'vi' },
  { text: 'Bonjour', from: 'fr', to: 'en' },
  { text: 'こんにちは', from: 'ja', to: 'en' }
];
```

---

# #️⃣ **10. Usage Metrics**

Track API usage for telemetry:

```javascript
{
  provider: 'openai',
  timestamp: Date.now(),
  tokensUsed: 80,
  latency: 1250, // ms
  cacheHit: false,
  success: true
}
```

Store in `chrome.storage.local` for display in Options page.

---

# #️⃣ **11. Best Practices**

1. ✅ **Always validate API responses** before using
2. ✅ **Implement proper error handling** for all error types
3. ✅ **Use retry logic** for transient failures
4. ✅ **Set reasonable timeouts** to prevent hanging requests
5. ✅ **Cache aggressively** to reduce API calls and costs
6. ✅ **Log errors** for debugging (but never log API keys)
7. ✅ **Test with multiple languages** to ensure compatibility
8. ✅ **Monitor rate limits** and implement backoff
9. ✅ **Validate endpoint URLs** before saving (must be HTTPS)
10. ✅ **Provide clear error messages** to users

---

**API documentation last updated: November 2025**