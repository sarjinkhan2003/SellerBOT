import { useEffect, useMemo, useRef, useState } from "react"
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { Edit2, Eye, FileDown, Printer, Search, Trash2, X } from "lucide-react"
import toast from "react-hot-toast"
import InvoiceTemplate from "../components/InvoiceTemplate.jsx"
import { useAuth } from "../context/AuthContext.jsx"
import { db } from "../firebase/config.js"
import { getOrderDateValue } from "../utils/analytics.js"
import { printInvoiceElement } from "../utils/printInvoice.js"

const statusOptions = ["All", "Paid", "Unpaid", "Partial"]

function Orders() {
  const { currentUser } = useAuth()
  const invoiceRef = useRef(null)
  const [orders, setOrders] = useState([])
  const [shop, setShop] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [invoiceOrder, setInvoiceOrder] = useState(null)
  const [editingOrder, setEditingOrder] = useState(null)
  const [filters, setFilters] = useState({ status: "All", search: "" })

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    const unsubscribe = onSnapshot(
      query(collection(db, "users", currentUser.uid, "orders"), orderBy("createdAt", "desc")),
      (snapshot) => setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => toast.error(error.message || "Could not load orders."),
    )
    getDoc(doc(db, "users", currentUser.uid, "settings", "shop")).then((snap) => setShop(snap.data() || {}))
    return unsubscribe
  }, [currentUser?.uid])

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const status = order.paymentStatus || order.productPaymentStatus || "Unpaid"
    const search = filters.search.trim().toLowerCase()
    if (filters.status !== "All" && status !== filters.status) return false
    if (search && ![order.orderNumber, order.customerName, order.phone, order.zone].join(" ").toLowerCase().includes(search)) return false
    return true
  }), [orders, filters])

  const markAsPaid = async (order) => {
    await updateDoc(doc(db, "users", currentUser.uid, "orders", order.id), {
      paymentStatus: "Paid",
      productPaymentStatus: "Paid",
      deliveryPaymentStatus: "Paid",
    })
    toast.success(`${order.orderNumber} marked paid.`)
    setSelectedOrder((current) => current ? { ...current, paymentStatus: "Paid", productPaymentStatus: "Paid", deliveryPaymentStatus: "Paid" } : current)
  }

  const deleteOrder = async (order) => {
    if (!window.confirm(`Delete ${order.orderNumber}?`)) return
    await deleteDoc(doc(db, "users", currentUser.uid, "orders", order.id))
    toast.success("Order deleted.")
    setSelectedOrder(null)
  }

  const saveOrderEdit = async (orderId, updates) => {
    await updateDoc(doc(db, "users", currentUser.uid, "orders", orderId), updates)
    const deliveryMatches = await getDocs(query(collection(db, "users", currentUser.uid, "deliveryInventory"), where("orderId", "==", orderId)))
    const deliveryUpdates = { customerName: updates.customerName || "", phone: updates.phone || "", address: updates.address || "", zone: updates.zone || "", grandTotal: Number(updates.grandTotal || 0), updatedAt: new Date() }
    await Promise.all(deliveryMatches.docs.map((item) => updateDoc(item.ref, deliveryUpdates)))
    setSelectedOrder((current) => current?.id === orderId ? { ...current, ...updates } : current)
    setEditingOrder(null)
    toast.success("Order updated.")
  }
  const downloadPDF = async (order) => {
    setInvoiceOrder(order)
    await waitFrame()
    const canvas = await html2canvas(invoiceRef.current, { scale: 2 })
    const pdf = new jsPDF("p", "mm", "a4")
    const width = pdf.internal.pageSize.getWidth()
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, width, (canvas.height * width) / canvas.width)
    pdf.save(`SellerBot-Invoice-${order.orderNumber}.pdf`)
  }

  const printInvoice = async (order) => {
    setInvoiceOrder(order)
    await waitFrame()
    await printInvoiceElement(invoiceRef.current)
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">Operations</p>
          <h2 className="text-3xl font-semibold">Orders</h2>
          <p className="text-sm text-slate-600">Manage customers, invoices, payment status, and order actions.</p>
        </div>
      </div>

      <div className="card grid gap-3 md:grid-cols-[1fr_220px]">
        <label><span>Search</span><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="pl-9" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Order, customer, phone, zone" /></div></label>
        <label><span>Payment status</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <MiniStat label="Total orders" value={orders.length} />
        <MiniStat label="Unpaid" value={orders.filter((o) => (o.paymentStatus || o.productPaymentStatus) === "Unpaid").length} tone="warning" />
        <MiniStat label="Paid" value={orders.filter((o) => (o.paymentStatus || o.productPaymentStatus) === "Paid").length} tone="success" />
        <MiniStat label="Manual invoices" value={orders.filter((o) => o.parsedBy === "manual").length} />
        <MiniStat label="AI parsed" value={orders.filter((o) => String(o.parsedBy || "").includes("gemini")).length} />
      </div>

      {filteredOrders.length ? <OrdersTable orders={filteredOrders} onView={setSelectedOrder} onInvoice={setInvoiceOrder} onPaid={markAsPaid} onEdit={setEditingOrder} /> : <div className="empty-state card"><p className="empty-state-title">No orders found</p><p className="empty-state-desc">Orders will appear here after saving invoices from New Order.</p></div>}

      {selectedOrder && <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} onPDF={downloadPDF} onPrint={printInvoice} onPaid={markAsPaid} onDelete={deleteOrder} onEdit={setEditingOrder} />}
      {editingOrder && <EditOrderModal order={editingOrder} onClose={() => setEditingOrder(null)} onSave={saveOrderEdit} />}
      {invoiceOrder && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-4 py-6"><div className="mx-auto max-w-4xl rounded-lg bg-white p-4"><div className="no-print mb-3 flex flex-wrap gap-3"><button className="btn-outline" onClick={() => setInvoiceOrder(null)}>Close</button><button className="btn-outline" onClick={() => printInvoice(invoiceOrder)}><Printer className="mr-2 inline h-4 w-4" />Print</button><button className="btn-outline" onClick={() => downloadPDF(invoiceOrder)}><FileDown className="mr-2 inline h-4 w-4" />PDF</button></div><InvoiceTemplate ref={invoiceRef} order={invoiceOrder} shop={shop} /></div></div>}
    </section>
  )
}

function MiniStat({ label, value, tone = "default" }) { const color = tone === "success" ? "text-emerald-500" : tone === "warning" ? "text-amber-500" : "text-[var(--text-primary)]"; return <div className="card"><p className="text-sm text-slate-500">{label}</p><p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p></div> }
function OrdersTable({ orders, onView, onInvoice, onPaid, onEdit }) { return <div className="table-container"><table className="min-w-[1000px]"><thead><tr>{["Order", "Date", "Customer", "Phone", "Zone", "Items", "Total", "Status", "Actions"].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td className="font-semibold">{order.orderNumber}</td><td>{getOrderDateValue(order).toLocaleDateString("en-GB")}</td><td>{order.customerName}</td><td>{order.phone}</td><td>{order.zone}</td><td>{order.products?.length || 0}</td><td>৳{order.grandTotal || 0}</td><td><StatusBadge status={order.paymentStatus || order.productPaymentStatus} /></td><td><div className="flex flex-wrap gap-2"><IconAction icon={Eye} label="View" onClick={() => onView(order)} /><IconAction icon={Edit2} label="Edit" onClick={() => onEdit(order)} /><IconAction icon={Printer} label="Invoice" onClick={() => onInvoice(order)} />{(order.paymentStatus || order.productPaymentStatus) !== "Paid" && <button className="btn-secondary btn-sm" onClick={() => onPaid(order)}>Mark paid</button>}</div></td></tr>)}</tbody></table></div> }
function OrderDetail({ order, onClose, onPDF, onPrint, onPaid, onDelete, onEdit }) { return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-4 py-6"><section className="mx-auto max-w-3xl rounded-lg bg-[var(--bg-card)] p-5"><div className="mb-4 flex justify-between"><h3 className="text-xl font-semibold">Order Details</h3><button onClick={onClose}><X className="h-5 w-5" /></button></div><div className="space-y-3 text-sm"><p><b>Customer:</b> {order.customerName} / {order.phone}</p><p className="whitespace-pre-wrap"><b>Address:</b> {order.address}</p><p><b>Zone:</b> {order.zone}</p><p><b>Payment:</b> {paymentTypeLabel(order.paymentType)} · {order.paymentStatus || order.productPaymentStatus}</p><p><b>Parsed:</b> {order.parsedBy || "manual"}</p>{(order.products || []).map((product, index) => <p key={index} className="rounded bg-slate-50 p-2">{product.productCode ? `[${product.productCode}] ` : ""}{product.productName} x {product.quantity} · ৳{product.totalPrice}</p>)}</div><div className="mt-5 flex flex-wrap gap-3"><button className="btn-primary" onClick={() => onPDF(order)}>Download PDF</button><button className="btn-outline" onClick={() => onEdit(order)}><Edit2 className="mr-2 h-4 w-4" />Edit Order</button><button className="btn-outline" onClick={() => onPrint(order)}><Printer className="mr-2 inline h-4 w-4" />Print</button>{(order.paymentStatus || order.productPaymentStatus) !== "Paid" && <button className="btn-outline" onClick={() => onPaid(order)}>Mark as Paid</button>}<button className="btn-danger" onClick={() => onDelete(order)}><Trash2 className="mr-2 h-4 w-4" />Delete</button><button className="btn-outline" onClick={onClose}>Close</button></div></section></div> }
function EditOrderModal({ order, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ customerName: order.customerName || "", phone: order.phone || "", address: order.address || "", zone: order.zone || "", deliveryCharge: Number(order.deliveryCharge || 0), discount: Number(order.discount || 0), paymentStatus: order.paymentStatus || order.productPaymentStatus || "Unpaid", notes: order.notes || "" }))
  const subtotal = Number(order.subtotal || 0)
  const grandTotal = subtotal + Number(form.deliveryCharge || 0) - Number(form.discount || 0)
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const submit = (event) => { event.preventDefault(); onSave(order.id, { ...form, deliveryCharge: Number(form.deliveryCharge || 0), discount: Number(form.discount || 0), grandTotal, grossRevenue: grandTotal, deliveryRevenue: Number(form.deliveryCharge || 0), paymentStatus: form.paymentStatus, productPaymentStatus: form.paymentStatus, updatedAt: new Date() }) }
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-4 py-6"><form className="mx-auto max-w-3xl rounded-lg bg-[var(--bg-card)] p-5" onSubmit={submit}><div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-semibold">Edit Order</h3><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div><div className="grid gap-4 md:grid-cols-2"><label><span>Customer</span><input value={form.customerName} onChange={(e) => update("customerName", e.target.value)} /></label><label><span>Phone</span><input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></label><label className="md:col-span-2"><span>Address</span><textarea rows={3} value={form.address} onChange={(e) => update("address", e.target.value)} /></label><label><span>Zone</span><input value={form.zone} onChange={(e) => update("zone", e.target.value)} /></label><label><span>Payment Status</span><select value={form.paymentStatus} onChange={(e) => update("paymentStatus", e.target.value)}>{["Unpaid", "Paid", "Partial"].map((status) => <option key={status}>{status}</option>)}</select></label><label><span>Delivery Charge</span><input type="number" value={form.deliveryCharge} onChange={(e) => update("deliveryCharge", e.target.value)} /></label><label><span>Discount</span><input type="number" value={form.discount} onChange={(e) => update("discount", e.target.value)} /></label><label className="md:col-span-2"><span>Notes</span><textarea rows={3} value={form.notes} onChange={(e) => update("notes", e.target.value)} /></label></div><div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-semibold">New grand total: {"\u09F3"}{grandTotal}</div><div className="mt-5 flex flex-wrap gap-3"><button className="btn-primary" type="submit">Save Changes</button><button className="btn-outline" type="button" onClick={onClose}>Cancel</button></div></form></div>
}
function IconAction({ icon: Icon, label, onClick }) { return <button className="btn-secondary btn-sm" onClick={onClick}><Icon className="h-4 w-4" />{label}</button> }
function StatusBadge({ status = "Unpaid" }) { const cls = status === "Paid" ? "badge-paid" : status === "Partial" ? "badge-partial" : "badge-unpaid"; return <span className={cls}>{status}</span> }
function paymentTypeLabel(type) { return type === "full_online" ? "Full Online" : type === "delivery_only_online" ? "Delivery Online" : "Full COD" }
function waitFrame() { return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))) }

export default Orders
