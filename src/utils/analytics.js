const excludedRevenueStatuses = ["not_delivered", "returned", "refunded", "cancelled"]

function getOrderDate(order) {
  return order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || Date.now())
}

export function isRevenueOrder(order = {}) {
  const status = order.deliveryStatus || order.fulfillmentStatus || ""
  return !order.salesExcluded && !excludedRevenueStatuses.includes(status)
}

export function filterRevenueOrders(orders = []) {
  return orders.filter(isRevenueOrder)
}

export function getTodaysSales(orders) {
  const today = new Date().toDateString()
  const todayOrders = filterRevenueOrders(orders).filter((o) => getOrderDate(o).toDateString() === today)
  return {
    count: todayOrders.length,
    revenue: todayOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0),
  }
}

export function getThisMonthSales(orders) {
  const now = new Date()
  const monthOrders = filterRevenueOrders(orders).filter((o) => {
    const d = getOrderDate(o)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  return {
    count: monthOrders.length,
    revenue: monthOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0),
  }
}

export function getTopProducts(orders, limit = 5) {
  const productMap = {}
  filterRevenueOrders(orders).forEach((order) => {
    ;(order.products || []).forEach((p) => {
      if (!productMap[p.productName]) {
        productMap[p.productName] = { name: p.productName, units: 0, revenue: 0 }
      }
      productMap[p.productName].units += Number(p.quantity || 0)
      productMap[p.productName].revenue += Number(p.totalPrice || 0)
    })
  })
  return Object.values(productMap)
    .sort((a, b) => b.units - a.units)
    .slice(0, limit)
}

export function getSalesByZone(orders) {
  const zoneMap = {}
  filterRevenueOrders(orders).forEach((order) => {
    const zone = order.zone || "Unknown"
    if (!zoneMap[zone]) zoneMap[zone] = { zone, count: 0, revenue: 0 }
    zoneMap[zone].count += 1
    zoneMap[zone].revenue += order.grandTotal || 0
  })
  return Object.values(zoneMap).sort((a, b) => b.revenue - a.revenue)
}

export function getPaymentBreakdown(orders) {
  const methodMap = {}
  filterRevenueOrders(orders).forEach((order) => {
    const method = order.paymentMethod || "COD"
    if (!methodMap[method]) methodMap[method] = { method, count: 0, revenue: 0 }
    methodMap[method].count += 1
    methodMap[method].revenue += order.grandTotal || 0
  })
  return Object.values(methodMap).sort((a, b) => b.count - a.count)
}

export function getUnpaidOrders(orders) {
  return filterRevenueOrders(orders).filter((o) => o.paymentStatus === "Unpaid")
}

export function getYesterdaysSales(orders) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yDate = yesterday.toDateString()
  const yOrders = filterRevenueOrders(orders).filter((o) => getOrderDate(o).toDateString() === yDate)
  return {
    count: yOrders.length,
    revenue: yOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0),
  }
}

export function exportToCSV(orders) {
  const headers = [
    "Order#",
    "Date",
    "CustomerName",
    "Phone",
    "Address",
    "Zone",
    "DeliveryCharge",
    "Products",
    "Subtotal",
    "Discount",
    "GrandTotal",
    "PaymentMethod",
    "TransactionID",
    "PaymentStatus",
    "Notes",
    "ParsedBy",
    "ProductRevenue",
    "DeliveryRevenue",
    "GrossRevenue",
    "TotalCost",
    "GrossProfit",
    "ProfitMargin",
    "PaymentType",
    "OnlineAmount",
    "CODAmount",
  ]
  const rows = filterRevenueOrders(orders).map((o) => [
    o.orderNumber || "",
    o.createdAt ? getOrderDate(o).toLocaleDateString("en-GB") : "",
    o.customerName || "",
    o.phone || "",
    (o.address || "").replace(/,/g, " "),
    o.zone || "",
    o.deliveryCharge || 0,
    (o.products || []).map((p) => `${p.productName}x${p.quantity}`).join(" | "),
    o.subtotal || 0,
    o.discount || 0,
    o.grandTotal || 0,
    o.paymentMethod || "",
    o.transactionId || "",
    o.paymentStatus || "",
    (o.notes || "").replace(/,/g, " "),
    o.parsedBy || "",
    o.productRevenue || o.subtotal || 0,
    o.deliveryRevenue || o.deliveryCharge || 0,
    o.grossRevenue || o.grandTotal || 0,
    o.totalCost || 0,
    o.grossProfit || 0,
    o.profitMargin || "",
    o.paymentType || "",
    o.onlineAmount || 0,
    o.codAmount || 0,
  ])
  const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `SellerBot-Sales-${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

export function getOrderDateValue(order) {
  return getOrderDate(order)
}

export function getRevenueBreakdown(orders) {
  return filterRevenueOrders(orders).reduce((acc, order) => {
    acc.grossRevenue += order.grossRevenue || order.grandTotal || 0
    acc.productRevenue += order.productRevenue || order.subtotal || 0
    acc.deliveryRevenue += order.deliveryRevenue || order.deliveryCharge || 0
    acc.totalCost += order.totalCost || 0
    acc.grossProfit += order.grossProfit || 0
    acc.onlineCollected += order.onlineAmount || 0
    acc.codPending += (order.paymentType === "full_cod" || order.paymentType === "delivery_only_online") ? order.codAmount || 0 : 0
    return acc
  }, { grossRevenue: 0, productRevenue: 0, deliveryRevenue: 0, totalCost: 0, grossProfit: 0, onlineCollected: 0, codPending: 0 })
}

export function getProfitByProduct(orders) {
  const productMap = {}
  filterRevenueOrders(orders).forEach((order) => {
    ;(order.products || []).forEach((p) => {
      if (!productMap[p.productName]) productMap[p.productName] = { name: p.productName, unitsSold: 0, revenue: 0, cost: 0, profit: 0, margin: 0 }
      const revenue = p.totalPrice || 0
      const cost = (p.costPrice || 0) * (p.quantity || 1)
      productMap[p.productName].unitsSold += p.quantity || 0
      productMap[p.productName].revenue += revenue
      productMap[p.productName].cost += cost
      productMap[p.productName].profit += revenue - cost
    })
  })
  return Object.values(productMap).map((p) => ({ ...p, margin: p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : 0 })).sort((a, b) => b.profit - a.profit)
}

export function getCollectionSummary(orders) {
  const revenueOrders = filterRevenueOrders(orders)
  const collected = revenueOrders.filter((o) => o.paymentStatus === "Paid" || o.productPaymentStatus === "Paid").reduce((sum, o) => sum + (o.grandTotal || 0), 0)
  const onlineReceived = revenueOrders.reduce((sum, o) => sum + (o.onlineAmount || 0), 0)
  const codPending = revenueOrders.filter((o) => o.paymentStatus !== "Paid" && o.productPaymentStatus !== "Paid").reduce((sum, o) => sum + (o.codAmount || 0), 0)
  return { collected, onlineReceived, codPending }
}

