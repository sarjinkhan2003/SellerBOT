import { forwardRef } from "react"

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB").format(date)
}

function money(value) {
  return `৳${Number(value || 0).toFixed(0)}`
}

function PaymentInfo({ order }) {
  if (order.paymentType === "delivery_only_online") {
    return <><p>Delivery Charge: {money(order.deliveryRevenue || order.deliveryCharge)} - Paid via {order.deliveryPaymentMethod || "bKash"} ({order.deliveryPaymentStatus === "Paid" ? "Paid" : "Pending"})</p><p>Delivery Transaction: {order.deliveryTransactionId || ""}</p><p>Product Amount: {money(order.productRevenue || order.subtotal)} - Cash on Delivery</p></>
  }
  if (order.paymentType === "full_online") {
    return <><p>Total Paid: {money(order.grossRevenue || order.grandTotal)} via {order.productPaymentMethod || order.paymentMethod || "bKash"}</p><p>Transaction: {order.productTransactionId || order.transactionId || ""}</p></>
  }
  return <p>Amount to Pay on Delivery: {money(order.grossRevenue || order.grandTotal)}</p>
}

const InvoiceTemplate = forwardRef(function InvoiceTemplate({ order, shop }, ref) {
  const orderNumber = order.orderNumber || "SB-PREVIEW"

  return (
    <div ref={ref} className="sellerbot-invoice-print mx-auto w-full max-w-3xl p-8" style={{ fontSize: 12, lineHeight: 1.45, backgroundColor: "#ffffff", color: "#000000" }}>
      <div className="invoice-box border border-black">
        <header className="flex items-start justify-between gap-6 border-b border-black p-5">
          <div className="flex items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold">{shop?.shopName || "SELLERBOT"}</h1>
              <p>{shop?.address || ""}</p>
              <p>Phone: {shop?.phone || ""}</p>
              <p>bKash: {shop?.bkash || ""} {shop?.nagad ? "Nagad: " + shop.nagad : ""}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">SELLERBOT</p>
            <p>Invoice #{orderNumber}</p>
            <p>Date: {formatDate()}</p>
          </div>
        </header>

        <section className="border-b border-black p-5">
          <h2 className="font-bold">BILL TO:</h2>
          <p>Name: {order.customerName || ""}</p>
          <p>Phone: {order.phone || ""}</p>
          <p className="whitespace-pre-wrap break-words">Address: {order.address || ""}</p>
          <p>Zone: {order.zone || ""}</p>
        </section>

        <table className="w-full border-b border-black text-left">
          <thead>
            <tr className="border-b border-black">
              <th className="p-3">SL</th>
              <th className="p-3">Product</th>
              <th className="p-3">Qty</th>
              <th className="p-3">Price</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.products || []).map((item, index) => (
              <tr key={(item.productId || item.productName || "product") + "-" + index} className="border-b border-gray-300 last:border-b-0">
                <td className="p-3">{index + 1}</td>
                <td className="p-3">{item.productCode ? "[" + item.productCode + "] " : ""}{item.productName}</td>
                <td className="p-3">{item.quantity}</td>
                <td className="p-3">{money(item.unitPrice)}</td>
                <td className="p-3 text-right">{money(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="border-b border-black p-5 text-right">
          <p>Subtotal: {money(order.subtotal)}</p>
          <p>Delivery: {money(order.deliveryCharge)}</p>
          <p>Discount: -{money(order.discount)}</p>
          <p className="mt-2 border-t border-black pt-2 text-xl font-bold">TOTAL: {money(order.grandTotal)}</p>
        </section>

        <section className="border-b border-black p-5">
          <PaymentInfo order={order} />
        </section>

        {order.notes && <section className="border-b border-black p-5"><p className="whitespace-pre-wrap">Notes: {order.notes}</p></section>}

        <footer className="p-5 text-center">
          <p className="font-bold">Thank you for your order!</p>
          <p>Powered by SellerBot</p>
        </footer>
      </div>
    </div>
  )
})

export default InvoiceTemplate
