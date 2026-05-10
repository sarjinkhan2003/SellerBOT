import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "../firebase/config"

export async function saveCorrection(uid, originalText, correctedValue, fieldType) {
  const key = originalText.toLowerCase().trim()
  if (!key) return
  const ref = doc(db, "users", uid, "corrections", fieldType)
  const snap = await getDoc(ref)
  const existing = snap.exists() ? snap.data() : {}
  existing[key] = correctedValue
  await setDoc(ref, existing)
}

export async function applyCorrections(uid, parsedResult, originalChat) {
  const fields = ["customerName", "address", "products"]
  const corrections = {}

  for (const field of fields) {
    const ref = doc(db, "users", uid, "corrections", field)
    const snap = await getDoc(ref)
    if (snap.exists()) corrections[field] = snap.data()
  }

  const chatLower = originalChat.toLowerCase()

  if (corrections.customerName) {
    for (const [pattern, correction] of Object.entries(corrections.customerName)) {
      if (chatLower.includes(pattern)) {
        parsedResult.customerName = correction
        break
      }
    }
  }

  if (corrections.address) {
    for (const [pattern, correction] of Object.entries(corrections.address)) {
      if (chatLower.includes(pattern)) {
        parsedResult.address = correction
        break
      }
    }
  }

  return parsedResult
}
