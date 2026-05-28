import { pipeline } from "@xenova/transformers"

let embedder = null
let loadingPromise = null

async function getEmbedder() {
  if (embedder) return embedder
  if (loadingPromise) return loadingPromise

  loadingPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { quantized: true })
    .then((model) => {
      embedder = model
      loadingPromise = null
      return embedder
    })
    .catch((error) => {
      loadingPromise = null
      console.error("Embedder load failed:", error)
      throw error
    })

  return loadingPromise
}

export async function generateEmbedding(text) {
  try {
    console.log("Loading embedder model...")
    const model = await getEmbedder()
    console.log("Model loaded, generating embedding for:", String(text || "").slice(0, 50))

    const output = await model(String(text || ""), {
      pooling: "mean",
      normalize: true,
    })

    console.log("Embedding generated, length:", output.data.length)
    return Array.from(output.data)
  } catch (error) {
    console.error("generateEmbedding FAILED:", error.message, error)
    return null
  }
}
export function prepareProductText(product) {
  return [
    product.name || "",
    product.banglaName || "",
    (product.tags || []).join(" "),
    product.variants ? product.variants.join(" ") : "",
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
    .replace(/[0-9০-৯]{11}/g, "")
    .replace(/\d+/g, "")
    .trim()
    .slice(0, 200)
}
