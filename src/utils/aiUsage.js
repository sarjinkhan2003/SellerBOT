import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "../firebase/config.js"

const USAGE_KEY = "sellerbot-ai-usage"
const WINDOW_MS = 60 * 1000

export const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"

export const GROQ_MODEL_OPTIONS = [
  {
    value: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    description: "Fast and reliable for SellerBot parsing",
    tokenLimit: 6000,
    requestLimit: 30,
  },
  {
    value: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B Versatile",
    description: "Stronger reasoning, a little slower",
    tokenLimit: 6000,
    requestLimit: 30,
  },
  {
    value: "openai/gpt-oss-20b",
    label: "GPT OSS 20B",
    description: "Good fallback model",
    tokenLimit: 8000,
    requestLimit: 30,
  },
  {
    value: "openai/gpt-oss-120b",
    label: "GPT OSS 120B",
    description: "Larger model for harder chats",
    tokenLimit: 8000,
    requestLimit: 30,
  },
  {
    value: "gemma2-9b-it",
    label: "Gemma 2 9B",
    description: "Lightweight backup option",
    tokenLimit: 15000,
    requestLimit: 30,
  },
]

const DEFAULT_USAGE = {
  tokenLimit: 0,
  remainingTokens: 0,
  usedTokens: 0,
  requestLimit: 0,
  remainingRequests: 0,
  usedRequests: 0,
  resetTokens: "",
  resetRequests: "",
  model: "",
  updatedAt: "",
  source: "estimated",
  windowStartedAt: "",
}

export function getGroqModelOption(model = "") {
  return GROQ_MODEL_OPTIONS.find((item) => item.value === model) || GROQ_MODEL_OPTIONS[0]
}

export function getDefaultGroqModel() {
  return import.meta.env.VITE_GROQ_MODEL || DEFAULT_GROQ_MODEL
}

export function getStoredAIUsage() {
  try {
    return { ...DEFAULT_USAGE, ...JSON.parse(localStorage.getItem(USAGE_KEY) || "{}") }
  } catch {
    return DEFAULT_USAGE
  }
}

export function getDisplayAIUsage(usage, model = "") {
  const selectedModel = model || usage?.model || getDefaultGroqModel()
  const option = getGroqModelOption(selectedModel)
  const sameModel = usage?.model === selectedModel
  const hasUsage = sameModel && (usage?.tokenLimit || usage?.requestLimit)

  if (hasUsage) {
    return {
      ...DEFAULT_USAGE,
      ...usage,
      tokenLimit: usage.tokenLimit || option.tokenLimit,
      requestLimit: usage.requestLimit || option.requestLimit,
      remainingTokens: Number.isFinite(Number(usage.remainingTokens)) ? Number(usage.remainingTokens) : option.tokenLimit,
      remainingRequests: Number.isFinite(Number(usage.remainingRequests)) ? Number(usage.remainingRequests) : option.requestLimit,
    }
  }

  return {
    ...DEFAULT_USAGE,
    tokenLimit: option.tokenLimit,
    remainingTokens: option.tokenLimit,
    usedTokens: 0,
    requestLimit: option.requestLimit,
    remainingRequests: option.requestLimit,
    usedRequests: 0,
    resetTokens: "per minute",
    resetRequests: "per minute",
    model: selectedModel,
    source: "model default",
  }
}

export function saveAIUsage(usage) {
  const next = { ...getStoredAIUsage(), ...usage, updatedAt: new Date().toISOString() }
  localStorage.setItem(USAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent("sellerbot-ai-usage-updated", { detail: next }))
  return next
}

export function updateGroqUsageFromHeaders(headers, model = "", responseUsage = null) {
  const selectedModel = model || getDefaultGroqModel()
  const headerUsage = readHeaderUsage(headers, selectedModel)

  if (headerUsage) {
    return saveAIUsage(headerUsage)
  }

  return saveEstimatedUsage(selectedModel, responseUsage)
}

export async function getAISettings(uid) {
  if (!uid) return {}
  try {
    const snap = await getDoc(doc(db, "users", uid, "settings", "ai"))
    return snap.exists() ? snap.data() : {}
  } catch (error) {
    console.error("Could not load AI settings:", error)
    return {}
  }
}

export async function saveAISettings(uid, settings) {
  if (!uid) throw new Error("Missing user")
  await setDoc(doc(db, "users", uid, "settings", "ai"), {
    groqApiKey: settings.groqApiKey || "",
    groqModel: settings.groqModel || getDefaultGroqModel(),
    maxTokens: Number(settings.maxTokens || 800),
    updatedAt: new Date(),
  }, { merge: true })
}

function readHeaderUsage(headers, model) {
  if (!headers) return null
  const tokenLimit = numberHeader(headers, "x-ratelimit-limit-tokens")
  const remainingTokens = numberHeader(headers, "x-ratelimit-remaining-tokens")
  const requestLimit = numberHeader(headers, "x-ratelimit-limit-requests")
  const remainingRequests = numberHeader(headers, "x-ratelimit-remaining-requests")
  const resetTokens = headers.get("x-ratelimit-reset-tokens") || ""
  const resetRequests = headers.get("x-ratelimit-reset-requests") || ""

  if (!tokenLimit && !remainingTokens && !requestLimit && !remainingRequests && !resetTokens && !resetRequests) {
    return null
  }

  return {
    tokenLimit,
    remainingTokens,
    usedTokens: Math.max(0, tokenLimit - remainingTokens),
    requestLimit,
    remainingRequests,
    usedRequests: Math.max(0, requestLimit - remainingRequests),
    resetTokens,
    resetRequests,
    model,
    source: "Groq headers",
    windowStartedAt: new Date().toISOString(),
  }
}

function saveEstimatedUsage(model, responseUsage) {
  const option = getGroqModelOption(model)
  const stored = getStoredAIUsage()
  const now = Date.now()
  const storedWindow = stored.windowStartedAt ? new Date(stored.windowStartedAt).getTime() : 0
  const sameWindow = stored.model === model && storedWindow && now - storedWindow < WINDOW_MS
  const windowStartedAt = sameWindow ? stored.windowStartedAt : new Date(now).toISOString()
  const elapsed = sameWindow ? now - storedWindow : 0
  const secondsToReset = Math.max(1, Math.ceil((WINDOW_MS - elapsed) / 1000))
  const callTokens = getResponseTokenCount(responseUsage)
  const usedTokens = (sameWindow ? Number(stored.usedTokens || 0) : 0) + callTokens
  const usedRequests = (sameWindow ? Number(stored.usedRequests || 0) : 0) + 1

  return saveAIUsage({
    tokenLimit: option.tokenLimit,
    remainingTokens: Math.max(0, option.tokenLimit - usedTokens),
    usedTokens,
    requestLimit: option.requestLimit,
    remainingRequests: Math.max(0, option.requestLimit - usedRequests),
    usedRequests,
    resetTokens: String(secondsToReset) + "s",
    resetRequests: String(secondsToReset) + "s",
    model,
    source: callTokens ? "estimated from response usage" : "estimated request count",
    windowStartedAt,
  })
}

function getResponseTokenCount(usage) {
  if (!usage) return 0
  const direct = Number(usage.total_tokens || usage.totalTokens || usage.tokens || 0)
  if (Number.isFinite(direct) && direct > 0) return direct
  const prompt = Number(usage.prompt_tokens || usage.promptTokens || 0)
  const completion = Number(usage.completion_tokens || usage.completionTokens || 0)
  const total = prompt + completion
  return Number.isFinite(total) && total > 0 ? total : 0
}

function numberHeader(headers, name) {
  const value = headers.get(name)
  if (!value) return 0
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}
