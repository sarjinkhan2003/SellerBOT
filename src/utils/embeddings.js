/**
 * EMBEDDING PROVIDER: Cohere embed-multilingual-v3
 *
 * TO SWITCH TO OLLAMA EMBEDDINGS LATER:
 * 1. Deploy Ollama with nomic-embed-text model
 *    (ollama pull nomic-embed-text)
 * 2. Add VITE_OLLAMA_URL to .env
 * 3. Replace cohereEmbed() with ollamaEmbed():
 *
 * async function ollamaEmbed(text) {
 *   const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
 *     method: 'POST',
 *     body: JSON.stringify({
 *       model: 'nomic-embed-text',
 *       prompt: text
 *     })
 *   })
 *   const data = await res.json()
 *   return data.embedding
 * }
 *
 * Note: nomic-embed-text uses 768 dimensions.
 * Update Supabase vector(1024) to vector(768)
 * and re-sync all embeddings if switching.
 */

const COHERE_API_KEY = import.meta.env.VITE_COHERE_API_KEY
const COHERE_MODEL = "embed-multilingual-v3.0"
export const EMBEDDING_DIM = 1024

async function cohereEmbed(texts, inputType = "search_document") {
  if (!COHERE_API_KEY) {
    return null
  }

  try {
    const response = await fetch("https://api.cohere.com/v1/embed", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${COHERE_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        texts,
        model: COHERE_MODEL,
        input_type: inputType,
        embedding_types: ["float"],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Cohere API error:", response.status, errorText)
      return null
    }

    const data = await response.json()
    return data?.embeddings?.float || null
  } catch (error) {
    console.error("Cohere embed request failed:", error.message, error)
    return null
  }
}

export async function generateEmbedding(text) {
  if (!text?.trim()) return null
  const results = await cohereEmbed([text.slice(0, 2000)], "search_document")
  return results?.[0] || null
}

export async function generateQueryEmbedding(text) {
  if (!text?.trim()) return null
  const results = await cohereEmbed([text.slice(0, 500)], "search_query")
  return results?.[0] || null
}

export async function generateBatchEmbeddings(texts) {
  if (!texts?.length) return []

  const chunks = []
  for (let index = 0; index < texts.length; index += 96) {
    chunks.push(texts.slice(index, index + 96))
  }

  const allEmbeddings = []
  for (const chunk of chunks) {
    const results = await cohereEmbed(chunk, "search_document")
    if (results) allEmbeddings.push(...results)
  }

  return allEmbeddings
}

export function prepareProductText(product) {
  return [
    product.name || "",
    product.banglaName || "",
    (product.tags || []).join(" "),
    (product.variants || []).join(" "),
  ].filter(Boolean).join(" | ")
}

export function prepareZoneText(zone) {
  return [
    zone.area || "",
    zone.banglaArea || "",
    (zone.keywords || []).join(" "),
    zone.division || "",
  ].filter(Boolean).join(" | ")
}

export function prepareChatQueryText(chatText) {
  return String(chatText || "")
    .replace(/(?:\+?88)?01[3-9]\d{8}/g, "")
    .replace(/[\u09e6-\u09ef]{11}/g, "")
    .trim()
    .slice(0, 500)
}

export function isEmbeddingAvailable() {
  return Boolean(import.meta.env.VITE_COHERE_API_KEY)
}

