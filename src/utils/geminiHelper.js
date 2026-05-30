import { DEFAULT_GROQ_MODEL, updateGroqUsageFromHeaders } from "./aiUsage.js"
﻿export async function convertToStructured(chatText, productCatalog = [], zones = [], ragProducts = [], ragZones = [], aiConfig = {}) {
  const productList = ragProducts.length > 0
    ? ragProducts.map((p) => `${p.product_name}${p.bangla_name ? "/" + p.bangla_name : ""} (৳${p.price}) [${Math.round((p.similarity || 0) * 100)}% match]`).join(", ")
    : productCatalog.slice(0, 15).map((p) => `${p.name}${p.banglaName ? "/" + p.banglaName : ""} (৳${p.price})`).join(", ")
  const zoneList = ragZones.length > 0
    ? ragZones.map((z) => `${z.area} (৳${z.charge}) [${Math.round((z.similarity || 0) * 100)}% match]`).join(", ")
    : zones.map((z) => z.area).join(", ")
  const prompt = `
You are SellerBot's order pre-processor for Bangladeshi F-commerce sellers.

TASK:
Convert the customer's UNSTRUCTURED chat into one clean STRUCTURED ORDER object.
The chat may be Bangla, English, or Banglish. Understand the meaning first, then output JSON only.

RAG pre-filtered products (most relevant):
${productList || "No products listed"}

RAG pre-filtered zones (most likely):
${zoneList || "No zones listed"}

Prefer products and zones with higher match scores when RAG candidates are listed.

USE THESE STRUCTURED FORMATS AS THE TARGET MEANING:

BANGLA TEMPLATE:
à¦¨à¦¾à¦®à¦ƒ customer name
à¦®à§‹à¦¬à¦¾à¦‡à¦²à¦ƒ 01XXXXXXXXX
à¦ à¦¿à¦•à¦¾à¦¨à¦¾à¦ƒ full delivery address
à¦ªà¦£à§à¦¯à¦ƒ first product name
à¦ªà¦°à¦¿à¦®à¦¾à¦£à¦ƒ quantity
à¦ªà¦£à§à¦¯à¦ƒ second product name
à¦ªà¦°à¦¿à¦®à¦¾à¦£à¦ƒ quantity
à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿà¦ƒ COD/bKash/Nagad/Rocket/Bank/Other
à¦¨à§‹à¦Ÿà¦ƒ optional instruction

ENGLISH TEMPLATE:
Name: customer name
Mobile: 01XXXXXXXXX
Address: full delivery address
Product: first product name
Quantity: quantity
Product: second product name
Quantity: quantity
Payment: COD/bKash/Nagad/Rocket/Bank/Other
Note: optional instruction

BANGLISH TEMPLATE:
nam: customer name
mobile: 01XXXXXXXXX
thikana: full delivery address
ponno/product: product name
poriman/qty: quantity
payment: COD/bKash/Nagad/Rocket/Bank/Other
note: optional instruction

BANGLISH MEANING RULES:
- "ami X" / "ami X," / "ami X boltesi" means customerName is X.
- "amar nam X" means customerName is X.
- Never include vai, bhai, apu, apa, à¦­à¦¾à¦‡, à¦†à¦ªà§, à¦†à¦ªà¦¾ in customerName.
- "X e thaki", "X te thaki", "X theke", "X e achi", "X à¦¤à§‡ à¦¥à¦¾à¦•à¦¿" means address/location is X.
- Keep the address exactly as the customer wrote it when possible.
- "lagbe", "chai", "nibo", "à¦¨à§‡à¦¬", "à¦šà¦¾à¦‡" means the customer wants to order.
- "ar", "and", "+", "à¦†à¦°" separates multiple products.
- "2ta shirt ar 1ta pant" means shirt quantity 2 and pant quantity 1.
- ekta/à¦à¦•à¦Ÿà¦¾=1, duita/à¦¦à§à¦‡à¦Ÿà¦¾=2, tinta/à¦¤à¦¿à¦¨à¦Ÿà¦¾=3, charta=4, pachta=5.
- 2ta/à§¨à¦Ÿà¦¾, 2 pcs, 2 piece, 2 nos all mean quantity 2.
- bkash/bikash/à¦¬à¦¿à¦•à¦¾à¦¶ korbo/dibo means bKash.
- nagad/à¦¨à¦—à¦¦ e dibo means Nagad.
- rocket/à¦°à¦•à§‡à¦Ÿ means Rocket.
- cash/COD means COD.

IMPORTANT PRODUCT RULES:
- Match products to the closest SELLER PRODUCTS name/tag/Bangla name.
- Return one product object per product mentioned.
- Quantity must be separate per product.
- If quantity is not mentioned for a product, use 1.
- Do not invent products that are not in the chat.

CUSTOMER CHAT:
"""
${chatText}
"""

Return ONLY valid JSON. No markdown. No explanation.
Use null when a field is missing.

{
  "customerName": "string or null",
  "phone": "11 digit string or null",
  "address": "complete address exactly as mentioned or null",
  "zone": "closest zone name from DELIVERY ZONES or null",
  "products": [
    {
      "productName": "closest seller product name or extracted product name",
      "quantity": 1
    }
  ],
  "paymentMethod": "COD|bKash|Nagad|Rocket|Bank|Other",
  "deliveryPaymentMethod": "COD|bKash|Nagad|Rocket|Bank|Other|null",
  "transactionId": "string or null",
  "notes": "string or null"
}
`
  const fallback = convertBanglishFallback(chatText, productCatalog, zones)
  const parsed = await convertJsonWithGroq(prompt, aiConfig)
  return hasUsefulExtraction(parsed) ? mergeWithFallback(parsed, fallback) : fallback
}

export async function convertToStructuredText(chatText, productCatalog = [], zones = [], ragProducts = [], ragZones = [], aiConfig = {}) {
  const localFallback = structuredTextFromFallback(convertBanglishFallback(chatText, productCatalog, zones))

  const productList = ragProducts.length > 0
    ? ragProducts.map((p) => `${p.product_name}${p.bangla_name ? "/" + p.bangla_name : ""} (৳${p.price}) [${Math.round((p.similarity || 0) * 100)}% match]`).join("\n")
    : productCatalog.slice(0, 15).map((p) => `${p.name}${p.banglaName ? "/" + p.banglaName : ""}${p.tags?.length ? " (tags: " + p.tags.join(", ") + ")" : ""}`).join("\n")
  const zoneList = ragZones.length > 0
    ? ragZones.map((z) => `${z.area}${z.bangla_area ? "/" + z.bangla_area : ""} (৳${z.charge}) [${Math.round((z.similarity || 0) * 100)}% match]`).join(", ")
    : zones.slice(0, 15).map((z) => `${z.area}${z.banglaArea ? "/" + z.banglaArea : ""}`).join(", ")

  const prompt = `
You are SellerBot's AI pre-formatter for Bangladeshi Facebook/WhatsApp sellers.

YOUR ONLY JOB:
Convert the customer's messy UNSTRUCTURED chat into the exact STRUCTURED TEXT format below.
Do not return JSON. Do not explain. Return only structured text with labels.

RAG pre-filtered products (most relevant):
${productList || "No product catalog provided. Use product names from chat."}

RAG pre-filtered zones (most likely):
${zoneList || "No delivery zones provided."}

Prefer products and zones with higher match scores when RAG candidates are listed.

TARGET STRUCTURED FORMAT:
Name: customer name or blank
Mobile: 01XXXXXXXXX or blank
Address: full address exactly as customer said it or closest clean address

Product: product name
Quantity: number

Product: second product name
Quantity: number

Payment: COD/bKash/Nagad/Rocket/Bank/Other
Note: optional instruction or blank

UNDERSTAND BANGLA, ENGLISH, AND BANGLISH:
- "à¦†à¦ªà§ à¦†à¦®à¦¾à¦° à¦¨à¦¾à¦® à¦¸à§à¦®à¦¾à¦‡à¦¯à¦¼à¦¾" => Name: à¦¸à§à¦®à¦¾à¦‡à¦¯à¦¼à¦¾
- "à¦­à¦¾à¦‡ à¦†à¦®à¦¾à¦° à¦¨à¦¾à¦® à¦•à¦°à¦¿à¦®" => Name: à¦•à¦°à¦¿à¦®
- "ami karim" / "amar nam karim" => Name: karim
- Never include à¦†à¦ªà§, à¦­à¦¾à¦‡, apu, vai, bhai, apa in the name.
- "à¦¢à¦¾à¦•à¦¾ à¦®à¦¿à¦°à¦ªà§à¦° à§§à§¦ à¦ à¦¥à¦¾à¦•à¦¿" => Address: à¦¢à¦¾à¦•à¦¾ à¦®à¦¿à¦°à¦ªà§à¦° à§§à§¦
- "sylhet e thaki" => Address: sylhet
- "mirpur 10 e achi" => Address: mirpur 10
- "à¦à¦•à¦Ÿà¦¾ à¦¶à¦¾à¦°à§à¦Ÿ à¦†à¦° à¦¦à§à¦‡à¦Ÿà¦¾ à¦ªà§à¦¯à¦¾à¦¨à§à¦Ÿ à¦¨à¦¿à¦¬à§‹" => Product: à¦¶à¦¾à¦°à§à¦Ÿ Quantity: 1 and Product: à¦ªà§à¦¯à¦¾à¦¨à§à¦Ÿ Quantity: 2
- "2ta shirt ar 1ta pant lagbe" => Product: shirt Quantity: 2 and Product: pant Quantity: 1
- à¦à¦•à¦Ÿà¦¾/à¦à¦•à¦Ÿà¦¿/ekta=1, à¦¦à§à¦‡à¦Ÿà¦¾/à¦¦à§à¦Ÿà§‹/duita=2, à¦¤à¦¿à¦¨à¦Ÿà¦¾/tinta=3, à¦šà¦¾à¦°à¦Ÿà¦¾/charta=4, à¦ªà¦¾à¦à¦šà¦Ÿà¦¾/pachta=5.
- "à¦¨à¦¿à¦¬à§‹", "à¦¨à§‡à¦¬", "à¦šà¦¾à¦‡", "lagbe", "nibo", "need", "want" indicate products.
- "à¦¬à¦¿à¦•à¦¾à¦¶à§‡ à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦•à¦°à¦¬à§‹" or "bkash/bikash e dibo" => Payment: bKash
- "à¦¨à¦—à¦¦à§‡ à¦¦à¦¿à¦¬à§‹" or "nagad e dibo" => Payment: Nagad
- "cash" or "cod" => Payment: COD
- Phone may use Bangla digits. Convert phone to English digits.
- Match product words to the closest seller catalog item when possible, but keep the extracted product name if unsure.
- Quantity must be attached to the correct product.
- If payment is not stated, use Payment: COD.

EXAMPLE 1 INPUT:
à¦†à¦ªà§ à¦†à¦®à¦¾à¦° à¦¨à¦¾à¦® à¦¸à§à¦®à¦¾à¦‡à¦¯à¦¼à¦¾
à¦¢à¦¾à¦•à¦¾ à¦®à¦¿à¦°à¦ªà§à¦° à§§à§¦ à¦ à¦¥à¦¾à¦•à¦¿
à¦à¦•à¦Ÿà¦¾ à¦¶à¦¾à¦°à§à¦Ÿ à¦†à¦° à¦¦à§à¦‡à¦Ÿà¦¾ à¦ªà§à¦¯à¦¾à¦¨à§à¦Ÿ à¦¨à¦¿à¦¬à§‹
à¦¬à¦¿à¦•à¦¾à¦¶à§‡ à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦•à¦°à¦¬à§‹
à§¦à§§à§­à§§à§¨à§©à§ªà§«à§¬à§­à§®

EXAMPLE 1 OUTPUT:
Name: à¦¸à§à¦®à¦¾à¦‡à¦¯à¦¼à¦¾
Mobile: 01712345678
Address: à¦¢à¦¾à¦•à¦¾ à¦®à¦¿à¦°à¦ªà§à¦° à§§à§¦

Product: à¦¶à¦¾à¦°à§à¦Ÿ
Quantity: 1

Product: à¦ªà§à¦¯à¦¾à¦¨à§à¦Ÿ
Quantity: 2

Payment: bKash
Note:

EXAMPLE 2 INPUT:
vai asalamu alaikum
ami karim, sylhet e thaki
2ta shirt ar 1ta pant lagbe
nagad e dibo
01812345678

EXAMPLE 2 OUTPUT:
Name: karim
Mobile: 01812345678
Address: sylhet

Product: shirt
Quantity: 2

Product: pant
Quantity: 1

Payment: Nagad
Note:

CUSTOMER CHAT:
"""
${chatText}
"""

Return only the structured text. No markdown. No JSON.
`
  const groqText = await convertWithGroq(prompt, aiConfig)
  return groqText || localFallback
}

async function convertWithGroq(prompt, aiConfig = {}) {
  const apiKey = aiConfig.groqApiKey || import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    return null
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiConfig.groqModel || import.meta.env.VITE_GROQ_MODEL || DEFAULT_GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: "You convert Bangladeshi seller chats into the exact structured text format requested. Return only structured text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_completion_tokens: Number(aiConfig.maxTokens || import.meta.env.VITE_GROQ_MAX_COMPLETION_TOKENS || 800),
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      console.error("Groq structured text conversion failed:", response.status, message)
      return null
    }

    const data = await response.json()
    updateGroqUsageFromHeaders(response.headers, aiConfig.groqModel || import.meta.env.VITE_GROQ_MODEL || DEFAULT_GROQ_MODEL, data.usage)
    return cleanStructuredText(data.choices?.[0]?.message?.content || "")
  } catch (error) {
    console.error("Groq structured text conversion failed:", error)
    return null
  }
}

async function convertJsonWithGroq(prompt, aiConfig = {}) {
  const text = await convertWithGroq(`${prompt}\n\nReturn only valid JSON.`, aiConfig)
  return text ? parseJsonResponse(text) : null
}
function structuredTextFromFallback(result) {
  if (!result) return null
  const lines = [
    `Name: ${result.customerName || ""}`,
    `Mobile: ${result.phone || ""}`,
    `Address: ${result.address || ""}`,
    "",
  ]

  ;(result.products || []).forEach((product) => {
    lines.push(`Product: ${product.productName || ""}`)
    lines.push(`Quantity: ${product.quantity || 1}`)
    lines.push("")
  })

  lines.push(`Payment: ${result.paymentMethod || "COD"}`)
  lines.push(`Note: ${result.notes || ""}`)
  return lines.join("\n").trim()
}
function cleanStructuredText(text = "") {
  return String(text)
    .replace(/```(?:text)?/gi, "")
    .replace(/```/g, "")
    .trim()
}
export async function extractWithAI() {
  return {}
}

function mergeWithFallback(parsed, fallback) {
  if (!fallback) return sanitizeStructuredResult(parsed)

  const merged = {
    ...parsed,
    customerName: isBadName(parsed.customerName) && fallback.customerName ? fallback.customerName : parsed.customerName || fallback.customerName || null,
    phone: parsed.phone || fallback.phone || null,
    address: parsed.address || fallback.address || null,
    zone: parsed.zone || fallback.zone || null,
    products: parsed.products?.length ? parsed.products : fallback.products || [],
    paymentMethod: choosePaymentMethod(parsed.paymentMethod, fallback.paymentMethod),
    deliveryPaymentMethod: parsed.deliveryPaymentMethod || fallback.deliveryPaymentMethod || null,
    transactionId: parsed.transactionId || fallback.transactionId || null,
    notes: parsed.notes || fallback.notes || null,
  }

  return sanitizeStructuredResult(merged)
}

function choosePaymentMethod(parsedMethod, fallbackMethod) {
  if (parsedMethod && parsedMethod !== "COD") return parsedMethod
  if (fallbackMethod && fallbackMethod !== "COD") return fallbackMethod
  return parsedMethod || fallbackMethod || "COD"
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
  const banglaDigits = "\u09e6\u09e7\u09e8\u09e9\u09ea\u09eb\u09ec\u09ed\u09ee\u09ef"
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
    .replace(/à¦­à¦¾à¦‡|à¦†à¦ªà§|à¦†à¦ªà¦¾/g, "")
    .replace(/\s+/g, " ")
    .trim() || null
}

function extractBanglishAddress(text, zones) {
  const locationPatterns = [
    /(?:ami\s+[^,\n]+,\s*)?([a-zA-Z\u0980-\u09FF\s.'-]+?)\s+(?:e|te)\s+thaki/i,
    /([a-zA-Z\u0980-\u09FF\s.'-]+?)\s+theke/i,
    /([a-zA-Z\u0980-\u09FF\s.'-]+?)\s+(?:e|te)\s+achi/i,
    /([a-zA-Z\u0980-\u09FF\s.'-]+?)\s+à¦¤à§‡\s+à¦¥à¦¾à¦•à¦¿/i,
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
  const quantityWords = {
    ekta: 1,
    duita: 2,
    tinta: 3,
    charta: 4,
    pachta: 5,
    "\u098f\u0995\u099f\u09be": 1,
    "\u098f\u0995\u099f\u09bf": 1,
    "\u09a6\u09c1\u0987\u099f\u09be": 2,
    "\u09a6\u09c1\u099f\u09cb": 2,
    "\u09a4\u09bf\u09a8\u099f\u09be": 3,
  }
  const quantityPattern = "(\\d+|ekta|duita|tinta|charta|pachta|\\u098f\\u0995\\u099f\\u09be|\\u098f\\u0995\\u099f\\u09bf|\\u09a6\\u09c1\\u0987\\u099f\\u09be|\\u09a6\\u09c1\\u099f\\u09cb|\\u09a4\\u09bf\\u09a8\\u099f\\u09be)"
  const pattern = new RegExp(`${quantityPattern}\\s*(?:ta|\\u099f\\u09be|pcs|piece|pieces|nos)?\\s+([a-zA-Z\\u0980-\\u09FF][a-zA-Z\\u0980-\\u09FF'-]*)`, "gi")
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
  if (lower.includes("bkash") || lower.includes("bikash") || lower.includes("à¦¬à¦¿à¦•à¦¾à¦¶")) return "bKash"
  if (lower.includes("nagad") || lower.includes("à¦¨à¦—à¦¦")) return "Nagad"
  if (lower.includes("rocket") || lower.includes("à¦°à¦•à§‡à¦Ÿ")) return "Rocket"
  if (lower.includes("bank") || lower.includes("à¦¬à§à¦¯à¦¾à¦‚à¦•")) return "Bank"
  return "COD"
}

function matchZoneName(address, zones) {
  if (!address) return null
  const lower = address.toLowerCase()
  return zones.find((zone) => [zone.area, zone.banglaArea, ...(zone.keywords || [])].filter(Boolean).some((keyword) => lower.includes(String(keyword).toLowerCase())))?.area || null
}









