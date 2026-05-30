import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { collection, doc, getDoc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { Eye, FileDown, Printer, X } from "lucide-react"
import toast from "react-hot-toast"
import * as XLSX from "xlsx"
import { useNavigate, useSearchParams } from "react-router-dom"
import InvoiceTemplate from "../components/InvoiceTemplate.jsx"
import { useAuth } from "../context/AuthContext.jsx"
import { db } from "../firebase/config.js"
import { getOrderDateValue, getRevenueBreakdown } from "../utils/analytics.js"
import { printInvoiceElement } from "../utils/printInvoice.js"

const pageSize = 20
const paymentTypes = ["All", "Full Online", "Delivery Online", "Full COD"]
const typeMap = { "Full Online": "full_online", "Delivery Online": "delivery_only_online", "Full COD": "full_cod" }

function Sales() {
  const { t } = useTranslation()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const invoiceRef = useRef(null)
  const [orders, setOrders] = useState([])
  const [shop, setShop] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [invoiceOrder, setInvoiceOrder] = useState(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ from: "", to: "", status: searchParams.get("status") || "All", method: "All", paymentType: "All", search: "" })

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    const unsubscribe = onSnapshot(query(collection(db, "users", currentUser.uid, "orders"), orderBy("createdAt", "desc")), (snapshot) => setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))), (error) => toast.error(error.message || "Could not load sales."))
    getDoc(doc(db, "users", currentUser.uid, "settings", "shop")).then((snap) => setShop(snap.data() || {}))
    return unsubscribe
  }, [currentUser?.uid])

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const date = getOrderDateValue(order)
    const search = filters.search.trim().toLowerCase()
    if (filters.from && date < new Date(`${filters.from}T00:00:00`)) return false
    if (filters.to && date > new Date(`${filters.to}T23:59:59`)) return false
    if (filters.status !== "All" && (order.paymentStatus || order.productPaymentStatus) !== filters.status) return false
    if (filters.method !== "All" && (order.paymentMethod || order.productPaymentMethod) !== filters.method) return false
    if (filters.paymentType !== "All" && order.paymentType !== typeMap[filters.paymentType]) return false
    if (search && ![order.customerName, order.phone, order.orderNumber].join(" ").toLowerCase().includes(search)) return false
    return true
  }), [orders, filters])
  const revenue = useMemo(() => getRevenueBreakdown(filteredOrders), [filteredOrders])
  const margin = revenue.productRevenue ? ((revenue.grossProfit / revenue.productRevenue) * 100).toFixed(1) : "0.0"
  const start = (page - 1) * pageSize
  const paginated = filteredOrders.slice(start, start + pageSize)
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const updateFilter = (field, value) => { setFilters((c) => ({ ...c, [field]: value })); setPage(1) }

  const markAsPaid = async (order) => { await updateDoc(doc(db, "users", currentUser.uid, "orders", order.id), { paymentStatus: "Paid", productPaymentStatus: "Paid", deliveryPaymentStatus: "Paid" }); setSelectedOrder((o) => ({ ...o, paymentStatus: "Paid", productPaymentStatus: "Paid", deliveryPaymentStatus: "Paid" })) }
  const downloadPDF = async (order) => { setInvoiceOrder(order); await waitFrame(); const canvas = await html2canvas(invoiceRef.current, { scale: 2 }); const pdf = new jsPDF("p", "mm", "a4"); const width = pdf.internal.pageSize.getWidth(); pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, width, (canvas.height * width) / canvas.width); pdf.save(`SellerBot-Invoice-${order.orderNumber}.pdf`) }
  const printInvoice = async (order) => { setInvoiceOrder(order); await waitFrame(); await printInvoiceElement(invoiceRef.current) }

  return <section className="space-y-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">{t("sales.title")}</p><h2 className="text-3xl font-semibold">{t("sales.title")}</h2></div><div className="flex gap-3"><button className="btn-outline" onClick={() => navigate("/orders")}>Order Desk</button><button className="btn-primary" onClick={() => navigate("/new-order")}>{t("sales.newOrder")}</button><button className="btn-outline" onClick={() => exportSalesToExcel(filteredOrders)}><FileDown className="mr-2 inline h-4 w-4" />{t("sales.exportExcel")}</button></div></div><div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-7"><Field label="From" type="date" value={filters.from} onChange={(v) => updateFilter("from", v)} /><Field label="To" type="date" value={filters.to} onChange={(v) => updateFilter("to", v)} /><Select label="Status" value={filters.status} options={["All", "Paid", "Unpaid", "Partial"]} onChange={(v) => updateFilter("status", v)} /><Select label="Method" value={filters.method} options={["All", "COD", "bKash", "Nagad", "Rocket", "Other"]} onChange={(v) => updateFilter("method", v)} /><Select label="Payment Type" value={filters.paymentType} options={paymentTypes} onChange={(v) => updateFilter("paymentType", v)} /><Field label="Search" value={filters.search} onChange={(v) => updateFilter("search", v)} /><button className="mt-6 rounded-md border px-3 text-sm font-semibold" onClick={() => setFilters({ from: "", to: "", status: "All", method: "All", paymentType: "All", search: "" })}>Clear</button></div><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">Gross: ৳{revenue.grossRevenue} | Products: ৳{revenue.productRevenue} | Delivery: ৳{revenue.deliveryRevenue} | Profit: ৳{revenue.grossProfit} ({margin}%)</div>{filteredOrders.length ? <SalesTable orders={paginated} onInvoice={setInvoiceOrder} onView={setSelectedOrder} /> : <div className="card text-center"><h3 className="text-lg font-semibold">{t("sales.noSales")}</h3><button className="btn-primary mt-4" onClick={() => navigate("/new-order")}>Create your first order</button></div>}<div className="flex justify-between rounded-lg border bg-white p-4 text-sm"><span>Showing {filteredOrders.length ? start + 1 : 0}-{Math.min(start + pageSize, filteredOrders.length)} of {filteredOrders.length} orders</span><span className="space-x-2"><button className="btn-outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button><button className="btn-outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</button></span></div>{selectedOrder && <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onPDF={downloadPDF} onPrint={printInvoice} onPaid={markAsPaid} />}{invoiceOrder && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-4 py-6"><div className="mx-auto max-w-4xl rounded-lg bg-white p-4"><div className="no-print mb-3 flex flex-wrap gap-3"><button className="btn-outline" onClick={() => setInvoiceOrder(null)}>Close</button><button className="btn-outline" onClick={() => printInvoice(invoiceOrder)}><Printer className="mr-2 inline h-4 w-4" />Print Invoice</button><button className="btn-outline" onClick={() => downloadPDF(invoiceOrder)}><FileDown className="mr-2 inline h-4 w-4" />Download PDF</button></div><InvoiceTemplate ref={invoiceRef} order={invoiceOrder} shop={shop} /></div></div>}</section>
}

function exportSalesToExcel(orders) {
  const data = orders.map((order) => ({
    "Order #": order.orderNumber,
    Date: order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString("en-GB") : "",
    Customer: order.customerName,
    Phone: order.phone,
    Address: order.address,
    Zone: order.zone,
    Products: (order.products || []).map((product) => `${product.productCode || product.productName} x${product.quantity}`).join(", "),
    "Subtotal (৳)": order.subtotal || 0,
    "Delivery (৳)": order.deliveryCharge || 0,
    "Discount (৳)": order.discount || 0,
    "Total (৳)": order.grandTotal || 0,
    "Cost (৳)": order.totalCost || 0,
    "Profit (৳)": order.grossProfit || 0,
    "Margin (%)": order.profitMargin || 0,
    "Payment Method": order.paymentMethod,
    "Payment Status": order.paymentStatus,
    "Payment Type": order.paymentType,
    "Parsed By": order.parsedBy || "",
  }))
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sales")
  XLSX.writeFile(workbook, `SellerBot-Sales-${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}.xlsx`)
}
function SalesTable({ orders, onInvoice, onView }) {
  const cellClass = "px-4 py-3 align-middle whitespace-nowrap"

  return <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[1120px] table-auto text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Order #", "Date", "Customer", "Phone", "Zone", "Items", "Grand Total", "Cost", "Profit", "Payment Type", "Payment Status", "Finance Actions"].map((h) => <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{orders.map((o) => <tr key={o.id} className="border-t hover:bg-slate-50"><td className={`${cellClass} font-semibold`}>{o.orderNumber}</td><td className={cellClass}>{getOrderDateValue(o).toLocaleDateString("en-GB")}</td><td className="px-4 py-3 align-middle"><span className="block max-w-36 truncate" title={o.customerName || ""}>{o.customerName}</span></td><td className={cellClass}>{o.phone}</td><td className={cellClass}>{o.zone}</td><td className={cellClass}>{o.products?.length || 0}</td><td className={cellClass}>৳{o.grandTotal || o.grossRevenue || 0}</td><td className={cellClass}>৳{o.totalCost || 0}</td><td className={cellClass}>৳{o.grossProfit || 0}</td><td className={cellClass}><PaymentTypeBadge type={o.paymentType} /></td><td className={cellClass}><StatusBadge status={o.paymentStatus || o.productPaymentStatus} /></td><td className={cellClass}><div className="flex items-center gap-3"><Action icon={Eye} label="View" onClick={() => onView(o)} /><Action icon={Printer} label="Invoice" onClick={() => onInvoice(o)} /></div></td></tr>)}</tbody></table></div>
}
function OrderModal({ order, onClose, onPDF, onPrint, onPaid }) { return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-4 py-6"><section className="mx-auto max-w-3xl rounded-lg bg-white p-5"><div className="mb-4 flex justify-between"><h3 className="text-xl font-semibold">Order Details</h3><button onClick={onClose}><X className="h-5 w-5" /></button></div><div className="space-y-3 text-sm"><p><b>Customer:</b> {order.customerName} / {order.phone}</p><p className="whitespace-pre-wrap"><b>Address:</b> {order.address}</p><p><b>Payment Type:</b> {paymentTypeLabel(order.paymentType)}</p><PaymentBreakdown order={order} /><div className="flex flex-wrap items-center gap-2"><b>Parsed by:</b><ChatTypeBadge order={order} /></div><p><b>Notes:</b> {order.notes || ""}</p>{(order.products || []).map((p, i) => <p key={i} className="rounded bg-slate-50 p-2">{p.productName} x {p.quantity} · ৳{p.totalPrice}</p>)}</div><div className="mt-5 flex flex-wrap gap-3"><button className="btn-primary" onClick={() => onPDF(order)}>Download Invoice PDF</button><button className="btn-outline" onClick={() => onPrint(order)}><Printer className="mr-2 inline h-4 w-4" />Print Invoice</button>{(order.paymentStatus || order.productPaymentStatus) === "Unpaid" && <button className="btn-outline" onClick={() => onPaid(order)}>Mark as Paid</button>}<button className="btn-outline" onClick={onClose}>Close</button></div></section></div> }
function ChatTypeBadge({ order }) { const ai = order.chatType === "unstructured" || order.parsedBy === "gemini"; return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${ai ? "bg-blue-50 text-blue-800" : "bg-emerald-50 text-emerald-800"}`}>{ai ? "AI AI Parsed" : "Structured Structured"}</span> }
function PaymentBreakdown({ order }) { if (order.paymentType === "delivery_only_online") return <div className="rounded bg-slate-50 p-3"><p>Online Payment: ৳{order.onlineAmount || order.deliveryCharge} via {order.deliveryPaymentMethod} (TXN: {order.deliveryTransactionId || ""}) {order.deliveryPaymentStatus === "Paid" ? "Paid" : "Pending"}</p><p>On Delivery: ৳{order.codAmount || order.subtotal} Cash Pending</p></div>; if (order.paymentType === "full_online") return <p className="rounded bg-slate-50 p-3">Online Payment: ৳{order.onlineAmount || order.grandTotal} via {order.productPaymentMethod} (TXN: {order.productTransactionId || ""})</p>; return <p className="rounded bg-slate-50 p-3">On Delivery: ৳{order.codAmount || order.grandTotal} Cash Pending</p> }
function Field({ label, value, onChange, type = "text" }) { return <label><span className="text-xs font-semibold text-slate-600">{label}</span><input className="mt-1 h-10 w-full rounded-md border px-3 text-sm" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function Select({ label, value, options, onChange }) { return <label><span className="text-xs font-semibold text-slate-600">{label}</span><select className="mt-1 h-10 w-full rounded-md border px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select></label> }
function StatusBadge({ status = "Unpaid" }) { const c = status === "Paid" ? "badge-paid" : status === "Partial" ? "badge-partial" : "badge-unpaid"; return <span className={c}>{status}</span> }
function PaymentTypeBadge({ type }) { const c = type === "full_online" ? "bg-blue-50 text-blue-800" : type === "delivery_only_online" ? "bg-purple-50 text-purple-800" : "bg-slate-100 text-slate-700"; return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${c}`}>{paymentTypeLabel(type)}</span> }
function paymentTypeLabel(type) { return type === "full_online" ? "Full Online" : type === "delivery_only_online" ? "Delivery Online" : "Full COD" }
function Action({ icon: Icon, label, onClick, danger = false }) { return <button className={danger ? "text-red-700" : "text-slate-700"} onClick={onClick}><Icon className="mr-1 inline h-4 w-4" />{label}</button> }
function waitFrame() { return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))) }

export default Sales


