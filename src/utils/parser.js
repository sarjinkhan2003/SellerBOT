import { matchProducts } from "./fuzzyMatcher.js"
import { detectZone } from "./zoneDetector.js"

function convertBanglaToEnglish(str = "") {
  const banglaDigits = "০১২৩৪৫৬৭৮৯"
  const englishDigits = "0123456789"
  return str.replace(/[০-৯]/g, (d) => englishDigits[banglaDigits.indexOf(d)])
}

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

const nameTriggers = ["নামঃ", "নাম:", "নাম :", "name:", "Name:", "customer:", "nam:", "ami ", "আমি ", "buyer:"]
const addressTriggers = ["ঠিকানাঃ", "ঠিকানা:", "ঠিকানা :", "address:", "Address:", "ADDRESS:", "deliver to:", "delivery address:", "thikana:", "Thikana:", "pathaben:", "পাঠাবেন:", "deliver korben:"]
const phoneTriggers = ["মোবাইলঃ", "মোবাইল:", "mobile:", "phone:", "Mobile:", "নম্বরঃ", "নাম্বারঃ", "number:", "contact:"]
const itemTriggers = ["আইটেমঃ", "আইটেম:", "item:", "items:", "পণ্যঃ", "product:", "order:", "lagbe:", "লাগবেঃ", "লাগবে:"]
const noteTriggers = ["note:", "Note:", "বিশেষ:", "special:", "kheal rakben:", "খেয়াল রাখবেন:", "important:", "please note:", "instruction:"]

const addressWords = ["road", "lane", "avenue", "street", "village", "gram", "para", "ward", "union", "upazila", "thana", "district", "division", "house", "flat", "floor", "apartment", "building", "tower", "goli", "bari", "mahal", "nagar", "pur", "bazar", "hat", "north", "south", "east", "west", "uttar", "dakkhin", "purbo", "paschim"]

export function parseChat(chatText = "", products = [], zones = []) {
  const convertedText = convertBanglaToEnglish(chatText)
  const lineParsed = parseLines(chatText, convertedText, products)
  const fullTextProducts = matchProducts(convertedText, products)
  const productsMatched = lineParsed.products.length ? lineParsed.products : fullTextProducts
  const address = lineParsed.address || extractAddress(chatText)
  const zone = address ? detectZone(address, zones) : null
  const payment = extractPayment(convertedText)
  const parsedResult = {
    rawText: chatText,
    customerName: lineParsed.customerName || extractName(chatText),
    phone: lineParsed.phone || extractPhone(convertedText),
    address,
    products: productsMatched,
    paymentMethod: payment.paymentMethod,
    transactionId: payment.transactionId,
    notes: extractNotes(chatText),
    zone,
    deliveryCharge: zone?.charge || 0,
    parsedBy: "regex",
    lineMatches: lineParsed.lineMatches,
  }

  parsedResult.confidence = calculateConfidence(parsedResult)
  return parsedResult
}

function parseLines(originalText, convertedText, products) {
  const originalLines = originalText.split(/\r?\n/)
  const convertedLines = convertedText.split(/\r?\n/)
  const result = {
    customerName: null,
    phone: null,
    address: null,
    products: [],
    lineMatches: { name: false, phone: false, address: false, products: false },
  }

  originalLines.forEach((rawLine, index) => {
    const originalLine = rawLine.trim()
    const convertedLine = (convertedLines[index] || originalLine).trim()
    if (!originalLine) return

    const nameValue = extractAfterLineTrigger(originalLine, nameTriggers)
    if (nameValue && !result.customerName) {
      result.customerName = nameValue
      result.lineMatches.name = true
    }

    const addressValue = extractAfterLineTrigger(originalLine, addressTriggers)
    if (addressValue && !result.address) {
      result.address = addressValue
      result.lineMatches.address = true
    }

    const phoneValue = extractAfterLineTrigger(convertedLine, phoneTriggers)
    if (phoneValue && !result.phone) {
      result.phone = extractPhone(phoneValue)
      result.lineMatches.phone = Boolean(result.phone)
    }

    const itemValue = extractAfterLineTrigger(convertedLine, itemTriggers)
    if (itemValue) {
      const matches = matchProducts(itemValue, products).map((product) => ({
        ...product,
        quantity: extractQuantity(itemValue),
        totalPrice: product.unitPrice * extractQuantity(itemValue),
      }))
      if (matches.length) {
        result.products.push(...matches)
        result.lineMatches.products = true
      }
    }
  })

  return result
}

function extractAfterLineTrigger(line, triggers) {
  const lower = line.toLowerCase()
  const trigger = triggers.find((item) => lower.startsWith(item.toLowerCase()))
  if (!trigger) return null
  return line.slice(trigger.length).trim() || null
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
  const converted = convertBanglaToEnglish(text)
  const match = converted.match(phoneRegex)?.[0]
  if (!match) return null
  const digits = match.replace(/\D/g, "")
  return digits.startsWith("88") && digits.length === 13 ? digits.slice(2) : digits.slice(-11)
}

export function extractQuantity(text = "") {
  const lower = convertBanglaToEnglish(text).toLowerCase()
  for (const [word, quantity] of Object.entries(quantityMap)) {
    if (lower.includes(convertBanglaToEnglish(word).toLowerCase())) return quantity
  }

  const unitMatch = lower.match(/(\d+)\s*(ta|টা|pcs|piece|pieces|পিছ|পিস|nos|number|set|packet|pack|box)/i)
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
    if (index >= 0) {
      paymentMethod = method
      keywordIndex = index
      break
    }
  }

  let transactionId = null
  if (keywordIndex >= 0) {
    const windowText = converted.slice(Math.max(0, keywordIndex - 50), keywordIndex + 50).toUpperCase()
    transactionId = windowText.match(/[A-Z0-9]{8,10}/g)?.[0] || null
  }

  return { paymentMethod, transactionId }
}

export function extractAddress(text = "") {
  for (const trigger of addressTriggers) {
    const index = text.toLowerCase().indexOf(trigger.toLowerCase())
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
    const index = text.toLowerCase().indexOf(trigger.toLowerCase())
    if (index >= 0) {
      const after = text.slice(index + trigger.length).split(/\r?\n/)[0].trim()
      const words = after.split(/\s+/).slice(0, 4).join(" ")
      if (words) return words
    }
  }

  const firstLine = text.split(/\r?\n/).find((line) => line.trim())?.trim()
  if (firstLine && !/[\d০-৯]/.test(firstLine) && /^[\p{L}\s.'-]+$/u.test(firstLine) && firstLine.split(/\s+/).length < 5) {
    return firstLine
  }

  return null
}

export function extractNotes(text = "") {
  for (const trigger of noteTriggers) {
    const index = text.toLowerCase().indexOf(trigger.toLowerCase())
    if (index >= 0) {
      const value = text.slice(index + trigger.length).trim()
      return value || null
    }
  }
  return null
}
