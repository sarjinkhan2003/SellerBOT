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
You are SellerBot's order pre-processor for Bangladeshi F-commerce sellers.

TASK:
Convert the customer's UNSTRUCTURED chat into one clean STRUCTURED ORDER object.
The chat may be Bangla, English, or Banglish. Understand the meaning first, then output JSON only.

SELLER PRODUCTS:
${productList || "No products listed"}

DELIVERY ZONES:
${zoneList || "No zones listed"}

USE THESE STRUCTURED FORMATS AS THE TARGET MEANING:

BANGLA TEMPLATE:
নামঃ customer name
মোবাইলঃ 01XXXXXXXXX
ঠিকানাঃ full delivery address
পণ্যঃ first product name
পরিমাণঃ quantity
পণ্যঃ second product name
পরিমাণঃ quantity
পেমেন্টঃ COD/bKash/Nagad/Rocket/Bank/Other
নোটঃ optional instruction

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
- Never include vai, bhai, apu, apa, ভাই, আপু, আপা in customerName.
- "X e thaki", "X te thaki", "X theke", "X e achi", "X তে থাকি" means address/location is X.
- Keep the address exactly as the customer wrote it when possible.
- "lagbe", "chai", "nibo", "নেব", "চাই" means the customer wants to order.
- "ar", "and", "+", "আর" separates multiple products.
- "2ta shirt ar 1ta pant" means shirt quantity 2 and pant quantity 1.
- ekta/একটা=1, duita/দুইটা=2, tinta/তিনটা=3, charta=4, pachta=5.
- 2ta/২টা, 2 pcs, 2 piece, 2 nos all mean quantity 2.
- bkash/bikash/বিকাশ korbo/dibo means bKash.
- nagad/নগদ e dibo means Nagad.
- rocket/রকেট means Rocket.
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

  try {
    const result = await model.generateContent(prompt)
    const parsed = parseJsonResponse(result.response.text())
    return hasUsefulExtraction(parsed) ? mergeWithFallback(parsed, fallback) : fallback
  } catch (err) {
    console.error("Gemini pre-processor failed:", err)
    return fallback
  }
}

export async function convertToStructuredText(chatText, productCatalog = [], zones = []) {
  const model = getModel()
  if (!model) return null

  const productList = productCatalog
    .map((p) => `${p.name}${p.banglaName ? "/" + p.banglaName : ""}${p.tags?.length ? " (tags: " + p.tags.join(", ") + ")" : ""}`)
    .join("\n")
  const zoneList = zones.map((z) => `${z.area}${z.banglaArea ? "/" + z.banglaArea : ""}`).join(", ")

  const prompt = `
You are SellerBot's AI pre-formatter for Bangladeshi Facebook/WhatsApp sellers.

YOUR ONLY JOB:
Convert the customer's messy UNSTRUCTURED chat into the exact STRUCTURED TEXT format below.
Do not return JSON. Do not explain. Return only structured text with labels.

SELLER PRODUCT CATALOG:
${productList || "No product catalog provided. Use product names from chat."}

DELIVERY ZONES:
${zoneList || "No delivery zones provided."}

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
- "আপু আমার নাম সুমাইয়া" => Name: সুমাইয়া
- "ভাই আমার নাম করিম" => Name: করিম
- "ami karim" / "amar nam karim" => Name: karim
- Never include আপু, ভাই, apu, vai, bhai, apa in the name.
- "ঢাকা মিরপুর ১০ এ থাকি" => Address: ঢাকা মিরপুর ১০
- "sylhet e thaki" => Address: sylhet
- "mirpur 10 e achi" => Address: mirpur 10
- "একটা শার্ট আর দুইটা প্যান্ট নিবো" => Product: শার্ট Quantity: 1 and Product: প্যান্ট Quantity: 2
- "2ta shirt ar 1ta pant lagbe" => Product: shirt Quantity: 2 and Product: pant Quantity: 1
- একটা/একটি/ekta=1, দুইটা/দুটো/duita=2, তিনটা/tinta=3, চারটা/charta=4, পাঁচটা/pachta=5.
- "নিবো", "নেব", "চাই", "lagbe", "nibo", "need", "want" indicate products.
- "বিকাশে পেমেন্ট করবো" or "bkash/bikash e dibo" => Payment: bKash
- "নগদে দিবো" or "nagad e dibo" => Payment: Nagad
- "cash" or "cod" => Payment: COD
- Phone may use Bangla digits. Convert phone to English digits.
- Match product words to the closest seller catalog item when possible, but keep the extracted product name if unsure.
- Quantity must be attached to the correct product.
- If payment is not stated, use Payment: COD.

EXAMPLE 1 INPUT:
আপু আমার নাম সুমাইয়া
ঢাকা মিরপুর ১০ এ থাকি
একটা শার্ট আর দুইটা প্যান্ট নিবো
বিকাশে পেমেন্ট করবো
০১৭১২৩৪৫৬৭৮

EXAMPLE 1 OUTPUT:
Name: সুমাইয়া
Mobile: 01712345678
Address: ঢাকা মিরপুর ১০

Product: শার্ট
Quantity: 1

Product: প্যান্ট
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

  try {
    const result = await model.generateContent(prompt)
    return cleanStructuredText(result.response.text())
  } catch (error) {
    console.error("Gemini structured text conversion failed:", error)
    return null
  }
}

function cleanStructuredText(text = "") {
  return String(text)
    .replace(/```(?:text)?/gi, "")
    .replace(/```/g, "")
    .trim()
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





