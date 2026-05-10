import { GoogleGenerativeAI } from "@google/generative-ai"

function getModel() {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    console.warn("Gemini API key not set. AI fallback disabled.")
    return null
  }
  return new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY).getGenerativeModel({ model: "gemini-1.5-flash" })
}

export async function convertToStructured(chatText, productCatalog = [], zones = []) {
  const model = getModel()
  if (!model) return convertBanglishFallback(chatText, productCatalog, zones)

  const productList = productCatalog.map((p) => `${p.name}${p.banglaName ? "/" + p.banglaName : ""}`).join(", ")
  const zoneList = zones.map((z) => z.area).join(", ")
  const prompt = `
You are an AI assistant for a Bangladeshi F-commerce (Facebook/WhatsApp) seller.

A customer sent an unstructured chat message.
Extract order information accurately.

Language: May be Bangla, English, or Banglish.

KEY BANGLISH PATTERNS:
Name patterns:
- "ami X" = I am X → name is X
- "ami X," = I am X → name is X (ignore comma)
- "amar nam X" = my name is X
- "ami X boltesi" = I am saying, I am X
- Never include vai/bhai/apu/apa/ভাই in name

Location patterns:
- "X e thaki" = I live in X → address is X
- "X te thaki" = I live in X → address is X
- "X theke" = from X → address is X
- "X e achi" = I am in X → address is X
- "X তে থাকি" = I live in X
- Extract X as the address

Quantity patterns:
- "Xta" = X pieces (2ta=2, 3ta=3)
- "X piece/pcs/nos" = X pieces
- "ekta/একটা" = 1
- "duita/দুইটা" = 2
- "tinta/তিনটা" = 3
- "ar/and/+" separates multiple products
  "2ta shirt ar 1ta pant" = shirt:2, pant:1

Payment patterns:
- "bkash/bikash/বিকাশ korbo/dibo" = bKash
- "nagad/নগদ e dibo" = Nagad
- "rocket" = Rocket
- "cash/cod" = COD

SELLER PRODUCTS: ${productList}
DELIVERY ZONES: ${zoneList}

CUSTOMER CHAT:
"""
${chatText}
"""

RULES:
1. Extract customer name WITHOUT vai/bhai/apu/apa
2. Extract full address EXACTLY as mentioned
3. Match each product to closest in catalog
4. Quantity must be per product separately
5. If something not found → use null

Return ONLY valid JSON, no explanation:
{
  "customerName": "string or null",
  "phone": "11 digit string or null",
  "address": "full address string or null",
  "zone": "zone name from list or null",
  "products": [
    {
      "productName": "matched catalog name",
      "quantity": number
    }
  ],
  "paymentMethod": "COD|bKash|Nagad|Rocket|Bank|Other",
  "deliveryPaymentMethod": "COD|bKash|Nagad|Rocket|Bank|Other|null",
  "transactionId": "string or null",
  "notes": "string or null"
}
`
  const fallback = convertBanglishFallback(chatText, productCatalog, zones)

  try {
    const result = await model.generateContent(prompt)
    const parsed = parseJsonResponse(result.response.text())
    return hasUsefulExtraction(parsed) ? mergeWithFallback(parsed, fallback) : fallback
  } catch (err) {
    console.error("Gemini pre-processor failed:", err)
    return fallback
  }
}

export async function extractWithGemini(chatText, missingFields, productCatalog) {
  const model = getModel()
  if (!model) return {}
  const productNames = productCatalog.slice(0, 20).map((p) => p.name + (p.banglaName ? "/" + p.banglaName : "")).join(", ")
  const prompt = `Extract ONLY these missing fields: ${missingFields.join(", ")}\nProducts: ${productNames}\nChat:\n${chatText}\nReturn ONLY valid JSON.`
  try {
    const result = await model.generateContent(prompt)
    return parseJsonResponse(result.response.text()) || {}
  } catch (error) {
    console.error("Gemini extraction failed:", error)
    return {}
  }
}

function mergeWithFallback(parsed, fallback) {
  if (!fallback) return sanitizeStructuredResult(parsed)

  const merged = {
    ...parsed,
    customerName: isBadName(parsed.customerName) && fallback.customerName ? fallback.customerName : parsed.customerName || fallback.customerName || null,
    phone: parsed.phone || fallback.phone || null,
    address: parsed.address || fallback.address || null,
    zone: parsed.zone || fallback.zone || null,
    products: fallback.products?.length ? fallback.products : parsed.products || [],
    paymentMethod: fallback.paymentMethod || parsed.paymentMethod || "COD",
    deliveryPaymentMethod: parsed.deliveryPaymentMethod || fallback.deliveryPaymentMethod || null,
    transactionId: parsed.transactionId || fallback.transactionId || null,
    notes: parsed.notes || fallback.notes || null,
  }

  return sanitizeStructuredResult(merged)
}

function sanitizeStructuredResult(result) {
  if (!result) return null
  const phone = normalizePhone(result.phone)
  const transactionId = normalizeTransactionId(result.transactionId, phone)
  return {
    ...result,
    phone,
    transactionId,
    products: Array.isArray(result.products) ? result.products.filter((item) => item?.productName) : [],
  }
}

function normalizePhone(phone) {
  if (!phone) return null
  const digits = convertBanglaDigits(String(phone)).replace(/\D/g, "")
  if (!digits) return null
  return digits.startsWith("88") && digits.length === 13 ? digits.slice(2) : digits.slice(-11)
}

function normalizeTransactionId(transactionId, phone) {
  if (!transactionId) return null
  const cleaned = String(transactionId).trim()
  const digits = cleaned.replace(/\D/g, "")
  if (phone && digits && phone.includes(digits)) return null
  if (/^01[3-9]\d{8}$/.test(digits)) return null
  return cleaned
}

function isBadName(name) {
  if (!name) return true
  const cleaned = String(name).trim()
  return cleaned.length < 3 || /^(ss|vai|bhai|apu|apa)$/i.test(cleaned)
}
function parseJsonResponse(text = "") {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start === -1 || end === -1 || end <= start) return null
    try {
      return JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

function hasUsefulExtraction(result) {
  return Boolean(result && (result.customerName || result.phone || result.address || result.products?.length))
}

function convertBanglishFallback(chatText, productCatalog = [], zones = []) {
  const text = convertBanglaDigits(chatText || "")
  const lower = text.toLowerCase()
  const customerName = extractBanglishName(text)
  const address = extractBanglishAddress(text, zones)
  const phone = text.match(/(?:\+?88)?01[3-9]\d{8}/)?.[0]?.replace(/^(\+?88)/, "") || null
  const products = extractBanglishProducts(text, productCatalog)
  const paymentMethod = extractPaymentMethod(lower)

  if (!customerName && !address && !phone && products.length === 0) return null

  return {
    customerName,
    phone,
    address,
    zone: matchZoneName(address, zones),
    products,
    paymentMethod,
    deliveryPaymentMethod: null,
    transactionId: null,
    notes: null,
  }
}

function convertBanglaDigits(value) {
  const banglaDigits = "০১২৩৪৫৬৭৮৯"
  const englishDigits = "0123456789"
  return String(value).replace(/[\u09e6-\u09ef]/g, (digit) => englishDigits[banglaDigits.indexOf(digit)])
}

function extractBanglishName(text) {
  const patterns = [
    /\bami\s+([^,\n]+?)(?:\s+boltesi|,|\n|$)/i,
    /\bamar\s+nam\s+([^,\n]+?)(?:,|\n|$)/i,
    /\bname\s*[:-]\s*([^,\n]+)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    const name = cleanName(match[1])
    if (name) return name
  }

  return null
}

function cleanName(name) {
  return name
    .replace(/\b(vai|bhai|apu|apa)\b/gi, "")
    .replace(/ভাই|আপু|আপা/g, "")
    .replace(/\s+/g, " ")
    .trim() || null
}

function extractBanglishAddress(text, zones) {
  const locationPatterns = [
    /(?:ami\s+[^,\n]+,\s*)?([a-zA-Z\u0980-\u09FF\s.'-]+?)\s+(?:e|te)\s+thaki/i,
    /([a-zA-Z\u0980-\u09FF\s.'-]+?)\s+theke/i,
    /([a-zA-Z\u0980-\u09FF\s.'-]+?)\s+(?:e|te)\s+achi/i,
    /([a-zA-Z\u0980-\u09FF\s.'-]+?)\s+তে\s+থাকি/i,
  ]

  for (const pattern of locationPatterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim().replace(/\s+/g, " ")
  }

  const lower = text.toLowerCase()
  const zone = zones.find((item) => [item.area, item.banglaArea, ...(item.keywords || [])].filter(Boolean).some((keyword) => lower.includes(String(keyword).toLowerCase())))
  return zone?.area || null
}

function extractBanglishProducts(text, productCatalog) {
  const products = []
  const lower = text.toLowerCase()
  const quantityWords = { ekta: 1, duita: 2, tinta: 3, charta: 4, pachta: 5, একটা: 1, দুইটা: 2, তিনটা: 3 }
  const pattern = /(\d+|ekta|duita|tinta|charta|pachta|একটা|দুইটা|তিনটা)\s*(?:ta|টা|pcs|piece|pieces|nos)?\s+([a-zA-Z\u0980-\u09FF][a-zA-Z\u0980-\u09FF'-]*)/gi
  let match

  while ((match = pattern.exec(lower))) {
    const quantity = Number(match[1]) || quantityWords[match[1]] || 1
    const productWord = match[2]
    const catalogMatch = productCatalog.find((product) => productMatches(product, productWord))
    products.push({
      productName: catalogMatch?.name || productWord,
      quantity,
    })
  }

  return products
}

function productMatches(product, word) {
  const values = [product.name, product.banglaName, ...(product.tags || [])].filter(Boolean).map((value) => String(value).toLowerCase())
  return values.some((value) => value.includes(word) || word.includes(value))
}

function extractPaymentMethod(lower) {
  if (lower.includes("bkash") || lower.includes("bikash") || lower.includes("বিকাশ")) return "bKash"
  if (lower.includes("nagad") || lower.includes("নগদ")) return "Nagad"
  if (lower.includes("rocket") || lower.includes("রকেট")) return "Rocket"
  if (lower.includes("bank") || lower.includes("ব্যাংক")) return "Bank"
  return "COD"
}

function matchZoneName(address, zones) {
  if (!address) return null
  const lower = address.toLowerCase()
  return zones.find((zone) => [zone.area, zone.banglaArea, ...(zone.keywords || [])].filter(Boolean).some((keyword) => lower.includes(String(keyword).toLowerCase())))?.area || null
}





