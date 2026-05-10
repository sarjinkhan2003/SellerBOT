import Fuse from "fuse.js"

const quantityWords = {
  ekta: 1,
  duita: 2,
  tinta: 3,
  charta: 4,
  pachta: 5,
}

export function createProductMatcher(products = []) {
  return new Fuse(products, {
    keys: ["name", "sku", "aliases"],
    threshold: 0.35,
    ignoreLocation: true,
  })
}

export function matchProducts(chatText, productCatalog) {
  if (!productCatalog || productCatalog.length === 0) return []

  const fuse = new Fuse(productCatalog, {
    keys: [
      { name: "name", weight: 0.4 },
      { name: "banglaName", weight: 0.3 },
      { name: "tags", weight: 0.3 },
    ],
    threshold: 0.45,
    includeScore: true,
    minMatchCharLength: 2,
  })

  const lines = chatText.split("\n")
  const matchedProducts = []
  const usedProductIds = new Set()

  for (const line of lines) {
    const words = line.split(/\s+/)
    for (let i = 0; i < words.length; i += 1) {
      const chunk2 = words.slice(i, i + 2).join(" ")
      const chunk3 = words.slice(i, i + 3).join(" ")

      for (const chunk of [chunk3, chunk2, words[i]]) {
        if (chunk.length < 2) continue
        const results = fuse.search(chunk)
        if (results.length > 0 && results[0].score < 0.45) {
          const product = results[0].item
          if (!usedProductIds.has(product.id)) {
            usedProductIds.add(product.id)
            const qty = extractQuantityNearMatch(line, chunk)
            matchedProducts.push({
              productId: product.id,
              productName: product.name,
              banglaName: product.banglaName || "",
              quantity: qty,
              unitPrice: product.price,
              totalPrice: product.price * qty,
            })
          }
          break
        }
      }
    }
  }
  return matchedProducts
}

function extractQuantityNearMatch(line) {
  const qtyPatterns = [
    /(\d+)\s*(ta|টা|pcs|piece|pieces|nos|x)/i,
    /x\s*(\d+)/i,
    /(ekta|duita|tinta|charta|pachta)/i,
  ]
  for (const pattern of qtyPatterns) {
    const match = line.match(pattern)
    if (!match) continue
    if (quantityWords[match[1]?.toLowerCase()]) return quantityWords[match[1].toLowerCase()]
    return parseInt(match[1], 10) || 1
  }
  return 1
}
