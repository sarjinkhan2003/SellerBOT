import { db } from "../firebase/config.js"
import { collection, doc, getDoc, increment, writeBatch } from "firebase/firestore"

export async function moveToDeliveryInventory(uid, order) {
  const batch = writeBatch(db)

  try {
    const deliveryRef = doc(collection(db, "users", uid, "deliveryInventory"))
    batch.set(deliveryRef, {
      orderId: order.id || "",
      orderNumber: order.orderNumber || "",
      customerName: order.customerName || "",
      phone: order.phone || "",
      address: order.address || "",
      zone: order.zone || "",
      grandTotal: order.grandTotal || order.grossRevenue || 0,
      products: order.products || [],
      deliveryStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      deliveredAt: null,
      notes: "",
    })

    for (const product of order.products || []) {
      if (!product.productId) continue
      batch.update(doc(db, "users", uid, "products", product.productId), {
        stock: increment(-(product.quantity || 1)),
      })
    }

    await batch.commit()
    return { success: true, deliveryId: deliveryRef.id }
  } catch (error) {
    console.error("moveToDeliveryInventory failed:", error)
    return { success: false, error: error.message }
  }
}

export async function updateDeliveryStatus(uid, deliveryId, newStatus, order, options = {}) {
  const batch = writeBatch(db)

  try {
    const deliveryRef = doc(db, "users", uid, "deliveryInventory", deliveryId)
    const updatePayload = {
      deliveryStatus: newStatus,
      updatedAt: new Date(),
      deliveredAt: newStatus === "delivered" ? new Date() : order.deliveredAt || null,
    }

    if (["returned", "refunded"].includes(newStatus)) {
      updatePayload.refundStatus = newStatus === "refunded" ? "refunded" : "refund_pending"
      updatePayload.refundAmount = Number(options.refundAmount || 0)
      updatePayload.refundNotes = options.refundNotes || ""
      updatePayload.refundedAt = newStatus === "refunded" ? new Date() : null
    }

    batch.update(deliveryRef, updatePayload)

    const restockStatuses = ["not_delivered", "returned", "refunded", "cancelled"]
    const shouldRestock = restockStatuses.includes(newStatus) && !restockStatuses.includes(order.deliveryStatus)
    if (shouldRestock) {
      for (const product of order.products || []) {
        if (!product.productId) continue
        batch.update(doc(db, "users", uid, "products", product.productId), {
          stock: increment(product.quantity || 1),
        })
      }
    }

    await batch.commit()
    return { success: true }
  } catch (error) {
    console.error("updateDeliveryStatus failed:", error)
    return { success: false, error: error.message }
  }
}

export async function getStockLevel(uid, productId) {
  try {
    const snap = await getDoc(doc(db, "users", uid, "products", productId))
    return snap.exists() ? snap.data().stock || 0 : 0
  } catch {
    return 0
  }
}

