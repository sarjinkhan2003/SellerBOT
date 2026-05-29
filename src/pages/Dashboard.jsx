import { useEffect, useMemo, useState } from "react"
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore"
import { AlertTriangle, MapPin, PackagePlus, Plus, Settings } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { useAuth } from "../context/AuthContext.jsx"
import { db } from "../firebase/config.js"
import { getCollectionSummary, getPaymentBreakdown, getProfitByProduct, getRevenueBreakdown, getSalesByZone, getThisMonthSales, getTodaysSales, getTopProducts, getUnpaidOrders, getYesterdaysSales, getOrderDateValue } from "../utils/analytics.js"

function Dashboard() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [deliveryItems, setDeliveryItems] = useState([])
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    const unsubscribeOrders = onSnapshot(query(collection(db, "users", currentUser.uid, "orders"), orderBy("createdAt", "desc")), (snapshot) => { setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false) }, (error) => { toast.error(error.message || "Could not load dashboard."); setLoading(false) })
    const unsubscribeProducts = onSnapshot(collection(db, "users", currentUser.uid, "products"), (snapshot) => setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))))
    const unsubscribeDeliveries = onSnapshot(collection(db, "users", currentUser.uid, "deliveryInventory"), (snapshot) => setDeliveryItems(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))))
    getDoc(doc(db, "users", currentUser.uid, "settings", "shop")).then((snap) => setShop(snap.data() || {}))
    return () => { unsubscribeOrders(); unsubscribeProducts(); unsubscribeDeliveries() }
  }, [currentUser?.uid])


  const today = useMemo(() => getTodaysSales(orders), [orders])
  const yesterday = useMemo(() => getYesterdaysSales(orders), [orders])
  const month = useMemo(() => getThisMonthSales(orders), [orders])
  const unpaid = useMemo(() => getUnpaidOrders(orders), [orders])
  const revenue = useMemo(() => getRevenueBreakdown(orders), [orders])
  const collectionSummary = useMemo(() => getCollectionSummary(orders), [orders])
  const profitProducts = useMemo(() => getProfitByProduct(orders).slice(0, 10), [orders])
  const topProducts = useMemo(() => getTopProducts(orders), [orders])
  const zones = useMemo(() => getSalesByZone(orders).slice(0, 5), [orders])
  const payments = useMemo(() => getPaymentBreakdown(orders), [orders])
  const lowStock = products.filter((p) => Number(p.stock ?? 999) < 5)
  const unpaidTotal = unpaid.reduce((sum, order) => sum + (order.grandTotal || 0), 0)
  const pendingDeliveries = deliveryItems.filter((item) => item.deliveryStatus === "pending")
  const yesterdayCompare = yesterday.revenue ? Math.round(((today.revenue - yesterday.revenue) / yesterday.revenue) * 100) : today.revenue > 0 ? 100 : 0

  if (loading) return <p className="card text-center text-slate-600">Loading dashboard...</p>

  return <section className="space-y-6"><div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1D9E75] text-xl font-bold text-white">{initials(shop?.shopName)}</div><div><p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p><h2 className="text-3xl font-semibold">Welcome back, {shop?.ownerName || currentUser?.displayName || "Seller"}!</h2><p className="text-slate-600">{shop?.shopName || "SellerBot Shop"}</p></div></div></div>{unpaid.length > 0 && <Alert text={`You have ${unpaid.length} unpaid orders totaling ৳${unpaidTotal}`} action={() => navigate("/sales?status=Unpaid")} />}{pendingDeliveries.length > 0 && <Alert text={`${pendingDeliveries.length} orders are in transit - check Delivery Inventory`} action={() => navigate("/delivery-inventory")} />}{lowStock.slice(0, 3).map((p) => <div key={p.id} className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm font-semibold text-yellow-900"><AlertTriangle className="mr-2 inline h-4 w-4" />{p.name} is running low ({p.stock} left)</div>)}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Metric title="Today's Sales" value={`৳${today.revenue}`} detail={`${today.count} orders`} compare={`${yesterdayCompare >= 0 ? "↑" : "↓"} ${Math.abs(yesterdayCompare)}% vs yesterday`} /><Metric title="This Month" value={`৳${month.revenue}`} detail={`${month.count} orders`} /><Metric title="Total Orders" value={orders.length} detail={`৳${orders.reduce((s, o) => s + (o.grandTotal || 0), 0)} all time`} /><button className="card text-left" onClick={() => navigate("/sales?status=Unpaid")}><p className="text-sm text-slate-500">Pending Payments</p><p className="text-3xl font-bold text-orange-600">{unpaid.length}</p><p className="text-sm text-slate-600">৳{unpaidTotal} unpaid</p></button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Metric title="Product Revenue" value={`৳${revenue.productRevenue}`} detail="From sales only" /><Metric title="Delivery Revenue" value={`৳${revenue.deliveryRevenue}`} detail="From delivery charges" /><Metric title="Total Cost" value={`৳${revenue.totalCost}`} detail="Your product costs" /><Metric title="Gross Profit" value={`৳${revenue.grossProfit}`} detail={`${revenue.productRevenue ? ((revenue.grossProfit / revenue.productRevenue) * 100).toFixed(1) : 0}% margin`} positive={revenue.grossProfit >= 0} /></div><div className="grid gap-4 md:grid-cols-2"><Metric title="Online Collected" value={`৳${collectionSummary.onlineReceived}`} detail="Received via bKash/Nagad/Rocket" /><Metric title="COD Pending" value={`৳${collectionSummary.codPending}`} detail={`${orders.filter((o) => (o.codAmount || 0) > 0).length} COD orders`} /></div><div className="grid gap-6 xl:grid-cols-2"><Panel title="Recent Orders" action={<Link className="text-sm font-semibold text-[#1D9E75]" to="/sales">View All</Link>}><RecentOrders orders={orders.slice(0, 5)} /></Panel><Panel title="Top Products"><BarList items={topProducts} labelKey="name" value={(i) => `${i.units} units · ৳${i.revenue}`} metric="units" /></Panel><Panel title="Sales by Zone"><BarList items={zones} labelKey="zone" value={(i) => `${i.count} orders · ৳${i.revenue}`} metric="revenue" /></Panel><Panel title="Payment Method Breakdown"><div className="flex flex-wrap gap-2">{payments.map((i) => <span key={i.method} className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold">{i.method}: {i.count} orders</span>)}</div></Panel></div><Panel title="Product Profitability"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="text-left text-slate-500"><th>Product</th><th>Units Sold</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin%</th></tr></thead><tbody>{profitProducts.map((p) => <tr key={p.name} className="border-t"><td className="py-2 font-semibold">{p.name}</td><td>{p.unitsSold}</td><td>৳{p.revenue}</td><td>৳{p.cost}</td><td>৳{p.profit}</td><td><span className={marginClass(p.margin)}>{p.margin}%</span></td></tr>)}</tbody></table></div></Panel><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><QuickAction icon={Plus} label="New Order" to="/new-order" /><QuickAction icon={PackagePlus} label="Add Product" to="/products" /><QuickAction icon={MapPin} label="Manage Zones" to="/delivery-zones" /><QuickAction icon={Settings} label="Shop Settings" to="/shop-settings" /></div></section>
}

function Metric({ title, value, detail, compare, positive = true }) { return <div className="card"><p className="text-sm text-slate-500">{title}</p><p className={`mt-2 text-3xl font-bold ${positive ? "text-slate-950" : "text-red-600"}`}>{value}</p><p className="text-sm text-slate-600">{detail}</p>{compare && <p className="mt-2 text-sm font-semibold text-[#1D9E75]">{compare}</p>}</div> }
function Alert({ text, action }) { return <div className="flex flex-col gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-900 sm:flex-row sm:items-center sm:justify-between"><p className="font-semibold">Warning: {text}</p><button className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white" onClick={action}>View Unpaid Orders</button></div> }
function Panel({ title, action, children }) { return <div className="card"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">{title}</h3>{action}</div>{children}</div> }
function RecentOrders({ orders }) { if (!orders.length) return <p className="text-sm text-slate-500">No recent orders.</p>; return <table className="w-full text-sm"><tbody>{orders.map((o) => <tr key={o.id} className="border-t"><td className="py-2 font-semibold">{o.orderNumber}</td><td>{o.customerName}</td><td>৳{o.grandTotal}</td><td>{o.paymentStatus || o.productPaymentStatus}</td><td>{getOrderDateValue(o).toLocaleDateString("en-GB")}</td></tr>)}</tbody></table> }
function BarList({ items, labelKey, value, metric }) { const max = Math.max(1, ...items.map((i) => i[metric] || 0)); if (!items.length) return <p className="text-sm text-slate-500">No data yet.</p>; return <div className="space-y-3">{items.map((i) => <div key={i[labelKey]}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{i[labelKey]}</span><span>{value(i)}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-[#1D9E75]" style={{ width: `${Math.max(6, ((i[metric] || 0) / max) * 100)}%` }} /></div></div>)}</div> }
function QuickAction({ icon: Icon, label, to }) { return <Link className="btn-outline inline-flex h-12 items-center justify-center gap-2" to={to}><Icon className="h-4 w-4" />{label}</Link> }
function marginClass(margin) { const m = Number(margin); return `rounded-full px-2 py-1 text-xs font-semibold ${m > 30 ? "bg-emerald-50 text-emerald-800" : m >= 15 ? "bg-yellow-50 text-yellow-800" : "bg-red-50 text-red-800"}` }
function initials(name = "SB") { return name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() }

export default Dashboard




