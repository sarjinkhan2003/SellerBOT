import { forwardRef } from "react"

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB").format(date)
}

function money(value) {
  return `৳${Number(value || 0).toFixed(0)}`
}

const InvoiceTemplate = forwardRef(function InvoiceTemplate({ order, shop }, ref) {
  const orderNumber = order.orderNumber || `SB-${String(Date.now()).slice(-8)}`

  return (
    <div ref={ref} className="mx-auto w-full max-w-3xl bg-white p-8 text-black" style={{ fontSize: 12, lineHeight: 1.45 }}>
      <div className="border border-black">
        <header className="flex items-start justify-between gap-6 border-b border-black p-5">
          <div className="flex items-start gap-4">
            {shop?.logoURL && <img className="h-[60px] w-[60px] rounded object-cover" src={shop.logoURL} alt="Shop logo" />}
            <div>
              <h1 className="text-2xl font-bold">{shop?.shopName || "SELLERBOT"}</h1>
              <p>{shop?.address || ""}</p>
              <p>Phone: {shop?.phone || ""}</p>
              <p>bKash: {shop?.bkash || ""} {shop?.nagad ? `Nagad: ${shop.nagad}` : ""}</p>
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
              <tr key={`${item.productId}-${index}`} className="border-b border-gray-300 last:border-b-0">
                <td className="p-3">{index + 1}</td>
                <td className="p-3">{item.productName}</td>
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
          <p>Payment: {order.paymentMethod || "COD"} Status: {order.paymentStatus || "Unpaid"}</p>
          <p>Transaction ID: {order.transactionId || ""}</p>
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
