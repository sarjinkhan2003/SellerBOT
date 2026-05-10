import { matchProducts } from "./fuzzyMatcher.js"
import { detectZone } from "./zoneDetector.js"

const phoneRegex = /(?:\+?88)?01[3-9]\d{8}/g

const quantityMap = {
  ekta: 1,
  "একটা": 1,
  "একটি": 1,
  "1ta": 1,
  "1টা": 1,
  duita: 2,
  "দুইটা": 2,
  "দুটো": 2,
  "2ta": 2,
  "2টা": 2,
  tinta: 3,
  "তিনটা": 3,
  "3ta": 3,
  "3টা": 3,
  charta: 4,
  "চারটা": 4,
  "4ta": 4,
  "4টা": 4,
  pachta: 5,
  "পাঁচটা": 5,
  "5ta": 5,
  "5টা": 5,
  chota: 6,
  "ছয়টা": 6,
  "6ta": 6,
  satta: 7,
  "সাতটা": 7,
  "7ta": 7,
  atta: 8,
  "আটটা": 8,
  "8ta": 8,
  nota: 9,
  "নয়টা": 9,
  "9ta": 9,
  dosta: 10,
  "দশটা": 10,
  "10ta": 10,
}

const paymentKeywords = {
  bkash: "bKash",
  "বিকাশ": "bKash",
  bikash: "bKash",
  nagad: "Nagad",
  "নগদ": "Nagad",
  rocket: "Rocket",
  "রকেট": "Rocket",
  bank: "Bank Transfer",
  "ব্যাংক": "Bank Transfer",
  cash: "COD",
  "ক্যাশ": "COD",
  cod: "COD",
  upay: "uPay",
  cellfin: "CellFin",
}

const addressTriggers = [
  "address:",
  "Address:",
  "ADDRESS:",
  "ঠিকানা:",
  "thikana:",
  "Thikana:",
  "deliver to:",
  "delivery address:",
  "pathaben:",
  "পাঠাবেন:",
  "deliver korben:",
]

const addressWords = [
  "road",
  "lane",
  "avenue",
  "street",
  "village",
  "gram",
  "para",
  "ward",
  "union",
  "upazila",
  "thana",
  "district",
  "division",
  "house",
  "flat",
  "floor",
  "apartment",
  "building",
  "tower",
  "goli",
  "bari",
  "mahal",
  "nagar",
  "pur",
  "bazar",
  "hat",
  "north",
  "south",
  "east",
  "west",
  "uttar",
  "dakkhin",
  "purbo",
  "paschim",
]

const nameTriggers = ["name:", "Name:", "নাম:", "nam:", "ami ", "আমি ", "customer:", "buyer:"]
const noteTriggers = [
  "note:",
  "Note:",
  "বিশেষ:",
  "special:",
  "kheal rakben:",
  "খেয়াল রাখবেন:",
  "important:",
  "please note:",
  "instruction:",
]

export function parseChat(chatText = "", products = [], zones = []) {
  const matchedProducts = matchProducts(chatText, products)
  const address = extractAddress(chatText)
  const zone = address ? detectZone(address, zones) : null
  const parsedResult = {
    rawText: chatText,
    customerName: extractName(chatText),
    phone: extractPhone(chatText),
    address,
    products: matchedProducts,
    paymentMethod: extractPayment(chatText).paymentMethod,
    transactionId: extractPayment(chatText).transactionId,
    notes: extractNotes(chatText),
    zone,
    deliveryCharge: zone?.charge || 0,
    parsedBy: "regex",
  }

  parsedResult.confidence = calculateConfidence(parsedResult)
  return parsedResult
}

export function calculateConfidence(parsedResult) {
  let score = 0
  if (parsedResult.phone) score += 0.25
  if (parsedResult.address) score += 0.25
  if (parsedResult.products?.length > 0) score += 0.3
  if (parsedResult.customerName) score += 0.2
  return Math.min(1, Number(score.toFixed(2)))
}

export function extractPhone(text = "") {
  const match = text.match(phoneRegex)?.[0]
  if (!match) return null
  const digits = match.replace(/\D/g, "")
  return digits.startsWith("88") && digits.length === 13 ? digits.slice(2) : digits.slice(-11)
}

export function extractQuantity(text = "") {
  const lower = text.toLowerCase()
  for (const [word, quantity] of Object.entries(quantityMap)) {
    if (lower.includes(word.toLowerCase())) return quantity
  }

  const unitMatch = lower.match(/(\d+)\s*(ta|টা|pcs|piece|pieces|nos|number|set|packet|pack|box)/i)
  if (unitMatch) return Number(unitMatch[1])

  const xPrefix = lower.match(/x\s*(\d+)/i)
  if (xPrefix) return Number(xPrefix[1])

  const xSuffix = lower.match(/(\d+)\s*x/i)
  if (xSuffix) return Number(xSuffix[1])

  return 1
}

export function extractPayment(text = "") {
  const lower = text.toLowerCase()
  let paymentMethod = "COD"
  let keywordIndex = -1

  for (const [keyword, method] of Object.entries(paymentKeywords)) {
    const index = lower.indexOf(keyword.toLowerCase())
    if (index >= 0) {
      paymentMethod = method
      keywordIndex = index
      break
    }
  }

  let transactionId = null
  if (keywordIndex >= 0) {
    const windowText = text.slice(Math.max(0, keywordIndex - 50), keywordIndex + 50).toUpperCase()
    transactionId = windowText.match(/[A-Z0-9]{8,10}/g)?.[0] || null
  }

  return { paymentMethod, transactionId }
}

export function extractAddress(text = "") {
  for (const trigger of addressTriggers) {
    const index = text.indexOf(trigger)
    if (index >= 0) {
      const value = text.slice(index + trigger.length).trim()
      return value || null
    }
  }

  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const lower = line.toLowerCase()
    const hits = addressWords.filter((word) => lower.includes(word)).length
    if (hits >= 2) return line.trim()
  }

  return null
}

export function extractName(text = "") {
  for (const trigger of nameTriggers) {
    const index = text.indexOf(trigger)
    if (index >= 0) {
      const after = text.slice(index + trigger.length).split(/\r?\n/)[0].trim()
      const words = after.split(/\s+/).slice(0, 4).join(" ")
      if (words) return words
    }
  }

  const firstLine = text.split(/\r?\n/).find((line) => line.trim())?.trim()
  if (firstLine && !/\d/.test(firstLine) && /^[\p{L}\s.'-]+$/u.test(firstLine) && firstLine.split(/\s+/).length < 5) {
    return firstLine
  }

  return null
}

export function extractNotes(text = "") {
  for (const trigger of noteTriggers) {
    const index = text.indexOf(trigger)
    if (index >= 0) {
      const value = text.slice(index + trigger.length).trim()
      return value || null
    }
  }
  return null
}
