import { fuzzyMatchSingle, matchProducts } from "./fuzzyMatcher.js"
import { detectZone } from "./zoneDetector.js"

export function convertBanglaToEnglish(str = "") {
  const banglaDigits = "\u09e6\u09e7\u09e8\u09e9\u09ea\u09eb\u09ec\u09ed\u09ee\u09ef"
  const englishDigits = "0123456789"
  return String(str).replace(/[\u09e6-\u09ef]/g, (d) => englishDigits[banglaDigits.indexOf(d)])
}

const phoneRegex = /(?:\+?88)?01[3-9]\d{8}/g
const nameTriggers = ["\u09a8\u09be\u09ae\u0983", "\u09a8\u09be\u09ae:", "\u09a8\u09be\u09ae :", "name:", "Name:", "name :", "customer:", "customer :", "nam:", "nam :", "buyer:", "amar nam:", "amar name:"]
const addressTriggers = ["\u09a0\u09bf\u0995\u09be\u09a8\u09be\u0983", "\u09a0\u09bf\u0995\u09be\u09a8\u09be:", "\u09a0\u09bf\u0995\u09be\u09a8\u09be :", "address:", "Address:", "address :", "thikana:", "thikana :", "deliver to:", "delivery address:"]
const phoneTriggers = ["\u09ae\u09cb\u09ac\u09be\u0987\u09b2\u0983", "\u09ae\u09cb\u09ac\u09be\u0987\u09b2:", "mobile:", "Mobile:", "mobile :", "phone:", "phone :", "\u09a8\u09ae\u09cd\u09ac\u09b0\u0983", "\u09a8\u09be\u09ae\u09cd\u09ac\u09be\u09b0\u0983", "number:", "number :", "contact:", "contact :"]
const itemTriggers = ["\u0986\u0987\u099f\u09c7\u09ae\u0983", "\u0986\u0987\u099f\u09c7\u09ae:", "item:", "Item:", "item :", "items:", "\u09aa\u09a3\u09cd\u09af\u0983", "\u09aa\u09a3\u09cd\u09af:", "product:", "Product:", "product :", "ponno:", "ponno :", "order:", "order :", "lagbe:", "\u09b2\u09be\u0997\u09ac\u09c7\u0983", "\u09b2\u09be\u0997\u09ac\u09c7:"]
const quantityTriggers = ["\u09aa\u09b0\u09bf\u09ae\u09be\u09a3\u0983", "\u09aa\u09b0\u09bf\u09ae\u09be\u09a3:", "\u09aa\u09b0\u09bf\u09ae\u09be\u09a3 :", "quantity:", "Quantity:", "quantity :", "qty:", "Qty:", "qty :", "poriman:", "poriman :", "\u09aa\u09bf\u09b8\u0983", "\u09aa\u09bf\u09b8:"]
const noteTriggers = ["note:", "Note:", "\u09ac\u09bf\u09b6\u09c7\u09b7:", "special:", "important:", "please note:", "instruction:"]
const addressWords = ["road", "lane", "street", "village", "gram", "para", "ward", "union", "upazila", "thana", "district", "house", "flat", "floor", "building", "tower", "bazar", "north", "south", "east", "west", "uttar", "dakkhin", "purbo", "paschim"]

const quantityMap = { ekta: 1, "\u098f\u0995\u099f\u09be": 1, "\u098f\u0995\u099f\u09bf": 1, duita: 2, "\u09a6\u09c1\u0987\u099f\u09be": 2, "\u09a6\u09c1\u099f\u09cb": 2, tinta: 3, "\u09a4\u09bf\u09a8\u099f\u09be": 3, charta: 4, "\u099a\u09be\u09b0\u099f\u09be": 4, pachta: 5, "\u09aa\u09be\u0981\u099a\u099f\u09be": 5, chota: 6, "\u099b\u09af\u09bc\u099f\u09be": 6, satta: 7, "\u09b8\u09be\u09a4\u099f\u09be": 7, atta: 8, "\u0986\u099f\u099f\u09be": 8, nota: 9, "\u09a8\u09af\u09bc\u099f\u09be": 9, dosta: 10, "\u09a6\u09b6\u099f\u09be": 10 }
const paymentKeywords = { bkash: "bKash", "\u09ac\u09bf\u0995\u09be\u09b6": "bKash", bikash: "bKash", nagad: "Nagad", "\u09a8\u0997\u09a6": "Nagad", rocket: "Rocket", "\u09b0\u0995\u09c7\u099f": "Rocket", bank: "Bank", "\u09ac\u09cd\u09af\u09be\u0982\u0995": "Bank", cash: "COD", "\u0995\u09cd\u09af\u09be\u09b6": "COD", cod: "COD", upay: "uPay", cellfin: "Other" }

export function parseProductQuantityPairs(chatText = "") {
  const lines = chatText.split("\n").map((line) => line.trim())
  const products = []
  let currentProduct = null

  for (const line of lines) {
    const productName = extractAfterAnyTrigger(line, itemTriggers)
    if (productName) {
      if (currentProduct) products.push(currentProduct)
      currentProduct = { productName, quantity: 1 }
      continue
    }

    const qtyText = extractAfterAnyTrigger(line, quantityTriggers)
    if (qtyText && currentProduct) {
      currentProduct.quantity = parseInt(convertBanglaToEnglish(qtyText), 10) || extractQuantity(qtyText)
    }
  }

  if (currentProduct) products.push(currentProduct)
  return products
}

export function extractProductCodes(chatText = "", products = []) {
  const matched = []
  const usedCodes = new Set()
  const chatUpper = convertBanglaToEnglish(chatText).toUpperCase()

  for (const product of products) {
    if (!product.productCode) continue
    const code = String(product.productCode).toUpperCase()
    if (!chatUpper.includes(code) || usedCodes.has(code)) continue

    usedCodes.add(code)
    const escapedCode = escapeRegExp(code)
    const qtyPatterns = [
      new RegExp(`${escapedCode}\\s*(\\d+)`, "i"),
      new RegExp(`(\\d+)\\s*${escapedCode}`, "i"),
      new RegExp(`${escapedCode}\\s*x\\s*(\\d+)`, "i"),
      new RegExp(`(\\d+)\\s*x\\s*${escapedCode}`, "i"),
      new RegExp(`${escapedCode}[^\\d]*(\\d+)\\s*(?:ta|টা|pcs|piece)`, "i"),
    ]

    let quantity = 1
    for (const pattern of qtyPatterns) {
      const match = chatUpper.match(pattern)
      if (match) {
        quantity = parseInt(match[1], 10) || 1
        break
      }
    }

    matched.push({
      productId: product.id,
      productCode: product.productCode,
      productName: product.name,
      banglaName: product.banglaName || "",
      quantity,
      unitPrice: product.price || 0,
      costPrice: product.costPrice || 0,
      totalPrice: (product.price || 0) * quantity,
      matchedBy: "productCode",
    })
  }

  return matched
}
export function parseChat(chatText = "", products = [], zones = []) {
  const convertedText = convertBanglaToEnglish(chatText)
  const lineParsed = parseLines(chatText, convertedText)
  const codeProducts = extractProductCodes(chatText, products)
  const productPairs = parseProductQuantityPairs(chatText)
  const pairProducts = productPairs.map((pair) => {
    const match = fuzzyMatchSingle(pair.productName, products)
    return { productId: match?.id || "", productCode: match?.productCode || "", productName: match?.name || pair.productName, banglaName: match?.banglaName || "", quantity: pair.quantity || 1, unitPrice: match?.price || 0, costPrice: match?.costPrice || 0, totalPrice: (match?.price || 0) * (pair.quantity || 1), matchedBy: match ? "fuzzy" : "manual" }
  })
  const matchedProducts = codeProducts.length ? codeProducts : pairProducts.length ? pairProducts : matchProducts(convertedText, products)
  const address = lineParsed.address || extractAddress(chatText)
  const zone = address ? detectZone(address, zones) : null
  const payment = extractPayment(convertedText)
  const parsedResult = { rawText: chatText, customerName: lineParsed.customerName || extractName(chatText), phone: lineParsed.phone || extractPhone(convertedText), address, products: matchedProducts, paymentMethod: payment.paymentMethod, deliveryPaymentMethod: null, transactionId: payment.transactionId, notes: extractNotes(chatText), zone, deliveryCharge: zone?.charge || 0, parsedBy: "regex", lineMatches: lineParsed.lineMatches }
  parsedResult.confidence = calculateConfidence(parsedResult)
  return parsedResult
}

function extractAfterAnyTrigger(line, triggers) {
  const trimmed = line.trim()
  for (const trigger of triggers) {
    const escaped = escapeRegExp(trigger.trim())
    const match = trimmed.match(new RegExp(`^\\s*${escaped}\\s*(.*)$`, "i"))
    if (match?.[1]) return match[1].replace(/^[:ঃ\s]+/, "").trim() || null
  }
  return null
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
function parseLines(originalText, convertedText) {
  const originalLines = originalText.split(/\r?\n/)
  const convertedLines = convertedText.split(/\r?\n/)
  const result = { customerName: null, phone: null, address: null, lineMatches: { name: false, phone: false, address: false, products: false } }
  originalLines.forEach((rawLine, index) => {
    const originalLine = rawLine.trim()
    const convertedLine = (convertedLines[index] || originalLine).trim()
    const name = extractAfterLineTrigger(originalLine, nameTriggers)
    if (name && !result.customerName) { result.customerName = name; result.lineMatches.name = true }
    const address = extractAfterLineTrigger(originalLine, addressTriggers)
    if (address && !result.address) { result.address = address; result.lineMatches.address = true }
    const phoneValue = extractAfterLineTrigger(convertedLine, phoneTriggers)
    if (phoneValue && !result.phone) { result.phone = extractPhone(phoneValue); result.lineMatches.phone = Boolean(result.phone) }
  })
  result.lineMatches.products = parseProductQuantityPairs(originalText).length > 0
  return result
}

function extractAfterLineTrigger(line, triggers) {
  return extractAfterAnyTrigger(line, triggers)
}

export function calculateConfidence(parsedResult) {
  let score = 0
  if (parsedResult.customerName) score += 0.25
  if (parsedResult.phone) score += 0.25
  if (parsedResult.address) score += 0.25
  if (parsedResult.products?.length > 0) score += 0.25
  return Math.min(1, Number(score.toFixed(2)))
}

export function extractPhone(text = "") {
  const match = convertBanglaToEnglish(text).match(phoneRegex)?.[0]
  if (!match) return null
  const digits = match.replace(/\D/g, "")
  return digits.startsWith("88") && digits.length === 13 ? digits.slice(2) : digits.slice(-11)
}

export function extractQuantity(text = "") {
  const lower = convertBanglaToEnglish(text).toLowerCase()
  for (const [word, quantity] of Object.entries(quantityMap)) if (lower.includes(convertBanglaToEnglish(word).toLowerCase())) return quantity
  const unitMatch = lower.match(/(\d+)\s*(ta|\u099f\u09be|pcs|piece|pieces|\u09aa\u09bf\u099b|\u09aa\u09bf\u09b8|nos|number|set|packet|pack|box)/i)
  if (unitMatch) return Number(unitMatch[1])
  const xPrefix = lower.match(/x\s*(\d+)/i)
  if (xPrefix) return Number(xPrefix[1])
  const xSuffix = lower.match(/(\d+)\s*x/i)
  if (xSuffix) return Number(xSuffix[1])
  return 1
}

export function extractPayment(text = "") {
  const converted = convertBanglaToEnglish(text)
  const lower = converted.toLowerCase()
  let paymentMethod = "COD"
  let keywordIndex = -1
  for (const [keyword, method] of Object.entries(paymentKeywords)) {
    const index = lower.indexOf(keyword.toLowerCase())
    if (index >= 0) { paymentMethod = method; keywordIndex = index; break }
  }
  const windowText = keywordIndex >= 0 ? converted.slice(Math.max(0, keywordIndex - 50), keywordIndex + 50).toUpperCase() : ""
  const ignoredWords = new Set(["QUANTITY", "PRODUCT", "PAYMENT", "ADDRESS", "MOBILE", "DELIVER", "DELIVERY", "PLEASE", "NAGAD", "BKASH", "BIKASH", "ROCKET"])
  const transactionId = (windowText.match(/[A-Z0-9]{8,10}/g) || []).find((candidate) =>
    /[A-Z]/.test(candidate) && /\d/.test(candidate) && !ignoredWords.has(candidate) && !/^01[3-9]\d{8}$/.test(candidate),
  ) || null
  return { paymentMethod, transactionId }
}

export function extractAddress(text = "") {
  for (const trigger of addressTriggers) {
    const index = text.toLowerCase().indexOf(trigger.toLowerCase())
    if (index >= 0) return text.slice(index + trigger.length).trim() || null
  }
  for (const line of text.split(/\r?\n/)) {
    const hits = addressWords.filter((word) => line.toLowerCase().includes(word)).length
    if (hits >= 2) return line.trim()
  }
  return null
}

export function extractName(text = "") {
  for (const trigger of nameTriggers) {
    const index = text.toLowerCase().indexOf(trigger.toLowerCase())
    if (index >= 0) return text.slice(index + trigger.length).split(/\r?\n/)[0].trim().split(/\s+/).slice(0, 4).join(" ") || null
  }
  const firstLine = text.split(/\r?\n/).find((line) => line.trim())?.trim()
  return firstLine && !/[\d\u09e6-\u09ef]/.test(firstLine) && /^[\p{L}\s.'-]+$/u.test(firstLine) && firstLine.split(/\s+/).length < 5 ? firstLine : null
}

export function extractNotes(text = "") {
  for (const trigger of noteTriggers) {
    const index = text.toLowerCase().indexOf(trigger.toLowerCase())
    if (index >= 0) return text.slice(index + trigger.length).trim() || null
  }
  return null
}






