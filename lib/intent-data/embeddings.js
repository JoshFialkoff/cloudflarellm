/**
 * Embedding utilities for intent scoring enrichment.
 * Falls back to a deterministic projection when no OpenAI key is set.
 */

const OPENAI_KEY = process.env.INTENT_OPENAI_API_KEY;
const OPENAI_URL = process.env.INTENT_OPENAI_BASE_URL || "https://api.openai.com/v1";

function seededRandom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  h = h >>> 0;
  return () => {
    h = (h * 16807 + 0) % 2147483647;
    return (h - 1) / 2147483646;
  };
}

function deterministicEmbedding(text, dims = 16) {
  const rng = seededRandom(text);
  const vec = [];
  for (let i = 0; i < dims; i++) {
    vec.push(rng() * 2 - 1);
  }
  return vec;
}

export async function getEmbedding(text) {
  if (!OPENAI_KEY) {
    return deterministicEmbedding(text);
  }

  const res = await fetch(`${OPENAI_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embedding error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data?.[0]?.embedding || deterministicEmbedding(text);
}

export { deterministicEmbedding };
