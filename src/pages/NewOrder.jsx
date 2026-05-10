import { useMemo, useRef, useState } from "react"
import { addDoc, collection, getDocs, doc, getDoc, serverTimestamp } from "firebase/firestore"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { ArrowLeft, FileDown, ImageDown, Loader2, Plus, Trash2 } from "lucide-react"
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom"
import InvoiceTemplate from "../components/InvoiceTemplate.jsx"
import { useAuth } from "../context/AuthContext.jsx"
import { db } from "../firebase/config.js"
import { applyCorrections, saveCorrection } from "../utils/correctionMemory.js"
import { matchProducts } from "../utils/fuzzyMatcher.js"
import { extractWithGemini } from "../utils/geminiHelper.js"
import { calculateConfidence, parseChat } from "../utils/parser.js"
import { detectZone } from "../utils/zoneDetector.js"

const parseMessages = ["Reading chat...", "Matching products...", "Calculating..."]
const paymentMethods = ["COD", "bKash", "Nagad", "Rocket", "Bank Transfer", "uPay", "Other"]

function NewOrder() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const invoiceRef = useRef(null)
  const [stage, setStage] = useState(1)
  const [chatText, setChatText] = useState("")
  const [parseStep, setParseStep] = useState("")
  const [confidence, setConfidence] = useState(0)
  const [parsedBy, setParsedBy] = useState("manual")
  const [products, setProducts] = useState([])
  const [zones, setZones] = useState([])
  const [shop, setShop] = useState(null)
  const [order, setOrder] = useState(createEmptyOrder())
  const [saving, setSaving] = useState(false)

  const subtotal = useMemo(() => order.products.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0), [order.products])
  const grandTotal = subtotal + Number(order.deliveryCharge || 0) - Number(order.discount || 0)
  const enrichedOrder = { ...order, subtotal, grandTotal, parsedBy }

  const handleParseChat = async () => {
    if (!chatText.trim()) {
      toast.error("Paste customer chat first.")
      return
    }

    try {
      setParseStep(parseMessages[0])
      const [productsSnapshot, zonesSnapshot, shopSnapshot] = await Promise.all([
        getDocs(collection(db, "users", currentUser.uid, "products")),
        getDocs(collection(db, "users", currentUser.uid, "deliveryZones")),
        getDoc(doc(db, "users", currentUser.uid, "settings", "shop")),
      ])
      const loadedProducts = productsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      const loadedZones = zonesSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      setProducts(loadedProducts)
      setZones(loadedZones)
      setShop(shopSnapshot.data() || {})

      setParseStep(parseMessages[1])
      let parsed = parseChat(chatText, loadedProducts, loadedZones)
      const productMatches = matchProducts(chatText, loadedProducts)
      parsed.products = productMatches.length ? productMatches : parsed.products
      parsed.zone = detectZone(parsed.address || "", loadedZones)
      parsed.deliveryCharge = parsed.zone?.charge || 0
      parsed.confidence = calculateConfidence(parsed)
      let usedParser = "regex"

      setParseStep(parseMessages[2])
      if (parsed.confidence < 0.7) {
        const missingFields = getMissingFields(parsed)
        const gemini = await extractWithGemini(chatText, missingFields, loadedProducts)
        parsed = { ...parsed, ...removeNullValues(gemini) }
        parsed.zone = detectZone(parsed.address || "", loadedZones)
        parsed.deliveryCharge = parsed.zone?.charge || parsed.deliveryCharge || 0
        parsed.confidence = calculateConfidence(parsed)
        usedParser = "gemini"
      }

      parsed = await applyCorrections(currentUser.uid, parsed, chatText)
      const selectedZone = parsed.zone || null
      setOrder({
        customerName: parsed.customerName || "",
        phone: parsed.phone || "",
        address: parsed.address || "",
        zoneId: selectedZone?.id || "",
        zone: selectedZone?.area || "",
        zoneAutoDetected: Boolean(selectedZone?.autoDetected),
        zoneIsFallback: Boolean(selectedZone?.isFallback),
        deliveryCharge: parsed.deliveryCharge || 0,
        products: normalizeProductRows(parsed.products),
        discount: 0,
        paymentMethod: parsed.paymentMethod || "COD",
        transactionId: parsed.transactionId || "",
        paymentStatus: "Unpaid",
        notes: parsed.notes || "",
      })
      setConfidence(parsed.confidence)
      setParsedBy(usedParser)
      setStage(2)
    } catch (error) {
      toast.error(error.message || "Could not parse chat.")
    } finally {
      setParseStep("")
    }
  }

  const updateOrder = (field, value) => {
    const previous = order[field]
    setOrder((current) => ({ ...current, [field]: value }))
    if (["customerName", "address"].includes(field) && previous && previous !== value) {
      saveCorrection(currentUser.uid, previous, value, field).catch(() => {})
    }
  }

  const updateZone = (zoneId) => {
    const zone = zones.find((item) => item.id === zoneId)
    setOrder((current) => ({ ...current, zoneId, zone: zone?.area || "", zoneAutoDetected: Boolean(zone), zoneIsFallback: false, deliveryCharge: zone?.charge || current.deliveryCharge }))
  }

  const updateProductRow = (index, field, value) => {
    setOrder((current) => {
      const rows = [...current.products]
      const row = { ...rows[index], [field]: value }
      if (field === "productId") {
        const product = products.find((item) => item.id === value)
        row.productName = product?.name || ""
        row.banglaName = product?.banglaName || ""
        row.unitPrice = product?.price || 0
      }
      row.quantity = Number(row.quantity || 1)
      row.unitPrice = Number(row.unitPrice || 0)
      row.totalPrice = row.quantity * row.unitPrice
      rows[index] = row
      return { ...current, products: rows }
    })
  }

  const addProductRow = () => setOrder((current) => ({ ...current, products: [...current.products, createProductRow()] }))
  const removeProductRow = (index) => setOrder((current) => ({ ...current, products: current.products.filter((_, rowIndex) => rowIndex !== index) }))

  const orderNumber = useMemo(() => `SB-${String(Date.now()).slice(-8)}`, [stage])

  const handlePDFDownload = async () => {
    const element = invoiceRef.current
    const canvas = await html2canvas(element, { scale: 2 })
    const imgData = canvas.toDataURL("image/png")
    const pdf = new jsPDF("p", "mm", "a4")
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
    pdf.save(`SellerBot-Invoice-${orderNumber}.pdf`)
  }

  const handleImageDownload = async () => {
    const element = invoiceRef.current
    const canvas = await html2canvas(element, { scale: 2 })
    const link = document.createElement("a")
    link.download = `SellerBot-Invoice-${orderNumber}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  const saveSale = async () => {
    try {
      setSaving(true)
      await addDoc(collection(db, "users", currentUser.uid, "orders"), {
        ...enrichedOrder,
        orderNumber,
        invoiceURL: "",
        createdAt: serverTimestamp(),
      })
      toast.success("Order saved and sale recorded.")
      navigate("/sales")
    } catch (error) {
      toast.error(error.message || "Could not save order.")
    } finally {
      setSaving(false)
    }
  }

  if (stage === 1) {
    return <ChatStage chatText={chatText} parseStep={parseStep} onChatChange={setChatText} onParse={handleParseChat} />
  }

  if (stage === 2) {
    return <ReviewStage confidence={confidence} order={order} products={products} zones={zones} subtotal={subtotal} grandTotal={grandTotal} parsedBy={parsedBy} onAddProduct={addProductRow} onBack={() => setStage(1)} onGenerate={() => setStage(3)} onProductRemove={removeProductRow} onProductUpdate={updateProductRow} onUpdate={updateOrder} onZoneChange={updateZone} />
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">Invoice Preview</p><h2 className="mt-1 text-3xl font-semibold">New Order</h2></div>
        <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold" onClick={() => setStage(2)}><ArrowLeft className="h-4 w-4" />Back to Edit</button>
      </div>
      <InvoiceTemplate ref={invoiceRef} order={{ ...enrichedOrder, orderNumber }} shop={shop} />
      <div className="grid gap-3 sm:grid-cols-3">
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold" onClick={handlePDFDownload}><FileDown className="h-4 w-4" />Download PDF</button>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold" onClick={handleImageDownload}><ImageDown className="h-4 w-4" />Download Image</button>
        <button className="inline-flex h-11 items-center justify-center rounded-md bg-[#1D9E75] px-4 text-sm font-semibold text-white disabled:opacity-70" onClick={saveSale} disabled={saving}>{saving ? "Saving..." : "Save & Record Sale"}</button>
      </div>
    </section>
  )
}

function ChatStage({ chatText, parseStep, onChatChange, onParse }) {
  return <section className="space-y-6"><div><p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">Chat Parser</p><h2 className="mt-1 text-3xl font-semibold">New Order</h2></div><textarea className="min-h-[320px] w-full rounded-lg border border-slate-300 bg-white p-4 text-sm outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20" rows={12} value={chatText} onChange={(event) => onChatChange(event.target.value)} placeholder={`এখানে customer এর chat paste করুন...\n\nExample:\nName: Rahim vai\n01712345678\nAddress: Mirpur 10, Dhaka 1216\n2ta blue shirt lagbe\nbkash korbo`} /><button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#1D9E75] font-semibold text-white disabled:opacity-70" onClick={onParse} disabled={Boolean(parseStep)}>{parseStep && <Loader2 className="h-4 w-4 animate-spin" />}{parseStep || "Parse Chat"}</button></section>
}

function ReviewStage({ confidence, order, products, zones, subtotal, grandTotal, parsedBy, onAddProduct, onBack, onGenerate, onProductRemove, onProductUpdate, onUpdate, onZoneChange }) {
  const badge = confidence >= 0.9 ? "bg-emerald-50 text-emerald-800 High Confidence" : confidence >= 0.7 ? "bg-yellow-50 text-yellow-800 Medium Confidence — please review" : "bg-orange-50 text-orange-800 Low Confidence — AI assist used"
  return <section className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-3xl font-semibold">Review Order</h2><p className={`mt-2 inline-flex rounded-md px-3 py-1 text-sm font-semibold ${badge.split(" ").slice(0,2).join(" ")}`}>{Math.round(confidence * 100)}% {badge.split(" ").slice(2).join(" ")} ({parsedBy})</p></div><button className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold" onClick={onBack}>Back to Chat</button></div><Card title="Customer Info"><div className="grid gap-4 md:grid-cols-2"><Input label="Customer Name" value={order.customerName} onChange={(v) => onUpdate("customerName", v)} /><Input label="Phone" value={order.phone} onChange={(v) => onUpdate("phone", v)} /></div><Textarea label="Full Address" value={order.address} onChange={(v) => onUpdate("address", v)} /><ZoneNotice order={order} /><label className="block"><span className="text-sm font-medium">Zone override</span><select className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3" value={order.zoneId} onChange={(e) => onZoneChange(e.target.value)}><option value="">Select zone</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.area} - ৳{zone.charge}</option>)}</select></label><Input label="Delivery Charge" type="number" value={order.deliveryCharge} onChange={(v) => onUpdate("deliveryCharge", Number(v))} /></Card><Card title="Products"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="text-left"><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Remove</th></tr></thead><tbody>{order.products.map((row, index) => <tr key={index}><td><select className="h-10 w-full rounded-md border px-2" value={row.productId} onChange={(e) => onProductUpdate(index, "productId", e.target.value)}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></td><td><input className="h-10 w-20 rounded-md border px-2" type="number" min="1" value={row.quantity} onChange={(e) => onProductUpdate(index, "quantity", e.target.value)} /></td><td><input className="h-10 w-28 rounded-md border px-2" type="number" value={row.unitPrice} onChange={(e) => onProductUpdate(index, "unitPrice", e.target.value)} /></td><td>৳{row.totalPrice}</td><td><button className="text-red-600" onClick={() => onProductRemove(index)}><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div><button className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold" onClick={onAddProduct}><Plus className="h-4 w-4" />Add Product Row</button></Card><Card title="Order Summary"><SummaryLine label="Subtotal" value={subtotal} /><SummaryLine label="Delivery Charge" value={order.deliveryCharge} /><Input label="Discount" type="number" value={order.discount} onChange={(v) => onUpdate("discount", Number(v))} /><div className="border-t pt-3 text-2xl font-bold text-[#1D9E75]">GRAND TOTAL: ৳{grandTotal}</div></Card><Card title="Payment"><label className="block"><span className="text-sm font-medium">Payment Method</span><select className="mt-2 h-11 w-full rounded-md border px-3" value={order.paymentMethod} onChange={(e) => onUpdate("paymentMethod", e.target.value)}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label><Input label="Transaction ID" value={order.transactionId} onChange={(v) => onUpdate("transactionId", v)} /><div className="flex gap-4">{["Unpaid", "Paid", "Partial"].map((status) => <label key={status} className="flex items-center gap-2 text-sm"><input type="radio" checked={order.paymentStatus === status} onChange={() => onUpdate("paymentStatus", status)} />{status}</label>)}</div></Card><Card title="Notes"><Textarea label="Special Instructions" value={order.notes} onChange={(v) => onUpdate("notes", v)} /></Card><button className="h-12 w-full rounded-md bg-[#1D9E75] text-lg font-semibold text-white" onClick={onGenerate}>Generate Invoice</button></section>
}

function ZoneNotice({ order }) {
  if (!order.zone) return <p className="rounded-md bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">Could not detect zone — please select manually</p>
  if (order.zoneIsFallback) return <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm font-semibold text-yellow-800">No specific area detected — defaulting to {order.zone} (৳{order.deliveryCharge}). Please verify.</p>
  if (order.zoneAutoDetected) return <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Auto-detected: {order.zone} (৳{order.deliveryCharge})</p>
  return <p className="rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Selected zone: {order.zone} (৳{order.deliveryCharge})</p>
}

function Card({ title, children }) { return <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-semibold">{title}</h3>{children}</div> }
function Input({ label, value, onChange, type = "text" }) { return <label className="block"><span className="text-sm font-medium">{label}</span><input className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function Textarea({ label, value, onChange }) { return <label className="block"><span className="text-sm font-medium">{label}</span><textarea className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function SummaryLine({ label, value }) { return <p className="flex justify-between text-sm"><span>{label}</span><span className="font-semibold">৳{value}</span></p> }
function createProductRow() { return { productId: "", productName: "", banglaName: "", quantity: 1, unitPrice: 0, totalPrice: 0 } }
function createEmptyOrder() { return { customerName: "", phone: "", address: "", zoneId: "", zone: "", zoneAutoDetected: false, zoneIsFallback: false, deliveryCharge: 0, products: [createProductRow()], discount: 0, paymentMethod: "COD", transactionId: "", paymentStatus: "Unpaid", notes: "" } }
function normalizeProductRows(rows = []) { return rows.length ? rows.map((row) => ({ ...row, quantity: Number(row.quantity || 1), unitPrice: Number(row.unitPrice || 0), totalPrice: Number(row.totalPrice || 0) })) : [createProductRow()] }
function getMissingFields(parsed) { return [!parsed.customerName && "customerName", !parsed.phone && "phone", !parsed.address && "address", parsed.products?.length === 0 && "products", !parsed.notes && "notes"].filter(Boolean) }
function removeNullValues(data) { return Object.fromEntries(Object.entries(data || {}).filter(([, value]) => value !== null && value !== undefined)) }

export default NewOrder


