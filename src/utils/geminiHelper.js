import { GoogleGenerativeAI } from "@google/generative-ai"

export async function extractWithGemini(chatText, missingFields, productCatalog) {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    console.warn("Gemini API key not set. AI fallback disabled.")
    return {}
  }

  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

  const productNames = productCatalog
    .slice(0, 20)
    .map((p) => p.name + (p.banglaName ? "/" + p.banglaName : ""))
    .join(", ")

  const prompt = `
You are parsing a Bangladeshi online seller chat. 
The chat may be in English, Bangla, or Banglish (mixed).

Extract ONLY these missing fields: ${missingFields.join(", ")}

Seller's products (for reference): ${productNames}

Chat text:
"""
${chatText}
"""

Return ONLY a valid JSON object with the missing fields.
If a field cannot be found, set it to null.
No explanation. No markdown. Just JSON.

Example output:
{
  "customerName": "Rahim",
  "address": "Mirpur 10, Dhaka 1216"
}
`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const cleaned = text.replace(/```json|```/g, "").trim()
    return JSON.parse(cleaned)
  } catch (error) {
    console.error("Gemini extraction failed:", error)
    return {}
  }
}
