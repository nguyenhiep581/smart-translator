import { getStorage, setStorage } from '../../utils/storage.js';

const EMBED_DIM = 64;
const MAX_EMBED_ENTRIES = 200;

function hashString(str) {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h1 ^= str.charCodeAt(i);
    h1 = (h1 * 0x01000193) >>> 0;
  }
  return h1 >>> 0;
}

function embedText(text) {
  const vec = new Float32Array(EMBED_DIM);
  const tokens = (text || '').toLowerCase().split(/\s+/).filter(Boolean);
  tokens.forEach((t) => {
    const h = hashString(t);
    const idx = h % EMBED_DIM;
    vec[idx] += 1;
  });
  // l2 normalize
  let norm = 0;
  for (let i = 0; i < EMBED_DIM; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < EMBED_DIM; i++) {
    vec[i] /= norm;
  }
  return Array.from(vec);
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < EMBED_DIM; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}

async function getStore(conversationId) {
  const { memoryEmbeddings = {} } = await getStorage('memoryEmbeddings');
  return memoryEmbeddings[conversationId] || [];
}

async function saveStore(conversationId, entries) {
  const all = (await getStorage('memoryEmbeddings')).memoryEmbeddings || {};
  all[conversationId] = entries.slice(-MAX_EMBED_ENTRIES);
  await setStorage({ memoryEmbeddings: all });
}

export async function saveEmbedding(conversationId, message) {
  if (!conversationId || !message?.content) {
    return;
  }
  const entry = {
    id: `${message.role}_${Date.now()}`,
    text: message.content,
    embedding: embedText(message.content),
    timestamp: Date.now(),
  };
  const store = await getStore(conversationId);
  store.push(entry);
  await saveStore(conversationId, store);
}

export async function searchSimilar(conversationId, text, topK = 3) {
  if (!text) {
    return [];
  }
  const queryVec = embedText(text);
  const store = await getStore(conversationId);
  const scored = store
    .map((e) => ({
      ...e,
      score: cosine(queryVec, e.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((e) => e.score > 0);
  return scored;
}

export function formatSemanticRecall(entries) {
  if (!entries?.length) {
    return '';
  }
  const lines = entries
    .map((e) => `- (${new Date(e.timestamp).toLocaleString()}) ${e.text}`)
    .join('\n');
  return `Relevant past details:\n${lines}`;
}
