import { supabase } from "../supabase/client.js"
import {
  generateBatchEmbeddings,
  generateEmbedding,
  generateQueryEmbedding,
  prepareProductText,
  prepareZoneText,
  prepareChatQueryText,
} from "./embeddings.js"

function isRagConfigured() {
  if (supabase) return true
  console.warn("RAG skipped: Supabase is not configured.")
  return false
}

export async function embedAndStoreProduct(uid, product) {
  try {
    console.log("Starting embed for product:", product?.name, "uid:", uid)

    if (!isRagConfigured() || !uid || !product?.id) {
      console.error("embedAndStoreProduct missing config or required data:", {
        supabaseConfigured: Boolean(supabase),
        uid,
        productId: product?.id,
      })
      return false
    }

    const text = prepareProductText(product)
    console.log("Prepared text:", text)

    const embedding = await generateEmbedding(text)
    console.log("Embedding result:", embedding ? `Success (${embedding.length} dims)` : "FAILED - null returned")

    if (!embedding) throw new Error("Embedding generation returned null")

    console.log("Saving to Supabase...")
    const { data, error } = await supabase
      .from("product_embeddings")
      .upsert({
        seller_uid: uid,
        product_id: product.id,
        product_name: product.name,
        bangla_name: product.banglaName || "",
        price: product.price,
        cost_price: product.costPrice || 0,
        tags: product.tags || [],
        embedding,
      }, {
        onConflict: "seller_uid,product_id",
      })

    if (error) {
      console.error("Supabase upsert error:", error.message, error.details, error.hint)
      throw error
    }

    console.log("Success! Product embedded:", product.name, data)
    return true
  } catch (error) {
    console.error("embedAndStoreProduct FAILED:", error.message, error)
    return false
  }
}

export async function embedAndStoreZone(uid, zone) {
  try {
    if (!isRagConfigured() || !uid || !zone?.id) return false
    const embedding = await generateEmbedding(prepareZoneText(zone))
    if (!embedding) throw new Error("Embedding failed")

    const { error } = await supabase
      .from("zone_embeddings")
      .upsert({
        seller_uid: uid,
        zone_id: zone.id,
        area: zone.area || "",
        bangla_area: zone.banglaArea || "",
        charge: Number(zone.charge || 0),
        keywords: zone.keywords || [],
        embedding,
      }, { onConflict: "seller_uid,zone_id" })

    if (error) throw error
    return true
  } catch (error) {
    console.error("Store zone embedding failed:", error)
    return false
  }
}

export async function deleteProductEmbedding(uid, productId) {
  if (!isRagConfigured() || !uid || !productId) return
  const { error } = await supabase.from("product_embeddings").delete().match({ seller_uid: uid, product_id: productId })
  if (error) console.error("Delete embedding failed:", error)
}

export async function deleteZoneEmbedding(uid, zoneId) {
  if (!isRagConfigured() || !uid || !zoneId) return
  const { error } = await supabase.from("zone_embeddings").delete().match({ seller_uid: uid, zone_id: zoneId })
  if (error) console.error("Delete zone embedding failed:", error)
}

export async function searchProductsByVector(uid, chatText, limit = 5) {
  try {
    if (!isRagConfigured() || !uid) return []
    const queryText = prepareChatQueryText(chatText)
    if (!queryText) return []
    const queryEmbedding = await generateQueryEmbedding(queryText)
    if (!queryEmbedding) return []

    const { data, error } = await supabase.rpc("match_products", {
      query_embedding: queryEmbedding,
      seller_uid_filter: uid,
      match_threshold: 0.5,
      match_count: limit,
    })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Vector product search failed:", error)
    return []
  }
}

export async function searchZonesByVector(uid, addressText, limit = 3) {
  try {
    if (!isRagConfigured() || !uid || !addressText) return []
    const queryEmbedding = await generateQueryEmbedding(addressText)
    if (!queryEmbedding) return []

    const { data, error } = await supabase.rpc("match_zones", {
      query_embedding: queryEmbedding,
      seller_uid_filter: uid,
      match_threshold: 0.4,
      match_count: limit,
    })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Vector zone search failed:", error)
    return []
  }
}

export async function syncAllProductEmbeddings(uid, products, onProgress) {
  try {
    if (!isRagConfigured() || !uid || !products?.length) return { succeeded: 0, total: products?.length || 0 }

    const texts = products.map((product) => prepareProductText(product))
    const embeddings = await generateBatchEmbeddings(texts)

    if (!embeddings || embeddings.length === 0) {
      console.error("Batch embedding failed")
      return { succeeded: 0, total: products.length }
    }

    let succeeded = 0
    for (let index = 0; index < products.length; index += 1) {
      const product = products[index]
      const embedding = embeddings[index]
      if (!embedding) {
        onProgress?.(index + 1, products.length)
        continue
      }

      const { error } = await supabase
        .from("product_embeddings")
        .upsert({
          seller_uid: uid,
          product_id: product.id,
          product_name: product.name,
          bangla_name: product.banglaName || "",
          price: product.price,
          cost_price: product.costPrice || 0,
          tags: product.tags || [],
          embedding,
        }, { onConflict: "seller_uid,product_id" })

      if (!error) succeeded += 1
      else console.error("Upsert failed for", product.name, error)
      onProgress?.(index + 1, products.length)
    }

    return { succeeded, total: products.length }
  } catch (error) {
    console.error("syncAllProductEmbeddings failed:", error)
    return { succeeded: 0, total: products?.length || 0 }
  }
}

export async function syncAllZoneEmbeddings(uid, zones, onProgress) {
  try {
    if (!isRagConfigured() || !uid || !zones?.length) return { succeeded: 0, total: zones?.length || 0 }

    const texts = zones.map((zone) => prepareZoneText(zone))
    const embeddings = await generateBatchEmbeddings(texts)

    if (!embeddings || embeddings.length === 0) {
      console.error("Batch zone embedding failed")
      return { succeeded: 0, total: zones.length }
    }

    let succeeded = 0
    for (let index = 0; index < zones.length; index += 1) {
      const zone = zones[index]
      const embedding = embeddings[index]
      if (!embedding) {
        onProgress?.(index + 1, zones.length)
        continue
      }

      const { error } = await supabase
        .from("zone_embeddings")
        .upsert({
          seller_uid: uid,
          zone_id: zone.id,
          area: zone.area || "",
          bangla_area: zone.banglaArea || "",
          charge: Number(zone.charge || 0),
          keywords: zone.keywords || [],
          embedding,
        }, { onConflict: "seller_uid,zone_id" })

      if (!error) succeeded += 1
      else console.error("Zone upsert failed for", zone.area, error)
      onProgress?.(index + 1, zones.length)
    }

    return { succeeded, total: zones.length }
  } catch (error) {
    console.error("syncAllZoneEmbeddings failed:", error)
    return { succeeded: 0, total: zones?.length || 0 }
  }
}

export async function hasProductEmbeddings(uid) {
  if (!isRagConfigured() || !uid) return false
  const { data, error } = await supabase.from("product_embeddings").select("id").eq("seller_uid", uid).limit(1)
  if (error) {
    console.error("Product embedding status check failed:", error)
    return false
  }
  return Boolean(data?.length)
}
