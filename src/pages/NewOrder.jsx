import { useMemo, useRef, useState } from "react"
import { addDoc, collection, getDoc, getDocs, doc, serverTimestamp } from "firebase/firestore"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { ArrowLeft, CreditCard, FileDown, ImageDown, Loader2, Plus, Trash2, Truck, Wallet } from "lucide-react"
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom"
import InvoiceTemplate from "../components/InvoiceTemplate.jsx"
import { useAuth } from "../context/AuthContext.jsx"
import { db } from "../firebase/config.js"
import { applyCorrections, saveCorrection } from "../utils/correctionMemory.js"
import { fuzzyMatchSingle } from "../utils/fuzzyMatcher.js"
import { convertToStructured } from "../utils/geminiHelper.js"
import { convertBanglaToEnglish, isStructuredChat, parseChat, parseProductQuantityPairs } from "../utils/parser.js"
import { detectZone } from "../utils/zoneDetector.js"

const banglaTemplate = `আমাদের কাছে অর্ডার করতে নিচের ফরম্যাটে মেসেজ করুন:\n\nনামঃ (আপনার নাম)\nমোবাইলঃ (আপনার নম্বর)\nঠিকানাঃ (সম্পূর্ণ ঠিকানা)\n\nপণ্যঃ (প্রথম পণ্যের নাম)\nপরিমাণঃ (সংখ্যা)\n\nপণ্যঃ (দ্বিতীয় পণ্যের নাম)\nপরিমাণঃ (সংখ্যা)\n\nউদাহরণঃ\nনামঃ রহিম মিয়া\nমোবাইলঃ ০১৭১২৩৪৫৬৭৮\nঠিকানাঃ মিরপুর ১০, ঢাকা ১২১৬\n\nপণ্যঃ নীল শার্ট\nপরিমাণঃ ২\n\nপণ্যঃ কালো প্যান্ট\nপরিমাণঃ ১`
const englishTemplate = `To place an order please message us:\n\nName: (your name)\nMobile: (your number)\nAddress: (full address)\n\nProduct: (first product name)\nQuantity: (number)\n\nProduct: (second product name)\nQuantity: (number)\n\nExample:\nName: Rahim Mia\nMobile: 01712345678\nAddress: Mirpur 10, Dhaka 1216\n\nProduct: Blue Shirt\nQuantity: 2\n\nProduct: Black Pant\nQuantity: 1`
const onlineMethods = ["bKash", "Nagad", "Rocket", "Bank", "Other"]
const deliveryMethods = ["bKash", "Nagad", "Rocket"]

function NewOrder() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const invoiceRef = useRef(null)
  const [stage, setStage] = useState(1)
  const [chatText, setChatText] = useState("")
  const [loadingMessage, setLoadingMessage] = useState("")
  const [confidence, setConfidence] = useState(0)
  const [parsedBy, setParsedBy] = useState("manual")
  const [products, setProducts] = useState([])
  const [zones, setZones] = useState([])
  const [shop, setShop] = useState(null)
  const [order, setOrder] = useState(createEmptyOrder())
  const [orderNumber] = useState(() => `SB-${String(Date.now()).slice(-8)}`)
  const [saving, setSaving] = useState(false)

  const subtotal = useMemo(() => order.products.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0), [order.products])
  const totalCost = useMemo(() => order.products.reduce((sum, item) => sum + Number(item.costPrice || 0) * Number(item.quantity || 1), 0), [order.products])
  const grandTotal = subtotal + Number(order.deliveryCharge || 0) - Number(order.discount || 0)
  const paymentAmounts = getPaymentAmounts(order.paymentType, subtotal, Number(order.deliveryCharge || 0), grandTotal)
  const enrichedOrder = { ...order, ...getLegacyPaymentFields(order), subtotal, grandTotal, productRevenue: subtotal, deliveryRevenue: Number(order.deliveryCharge || 0), grossRevenue: grandTotal, totalCost, grossProfit: subtotal - totalCost, profitMargin: subtotal > 0 ? (((subtotal - totalCost) / subtotal) * 100).toFixed(1) : "0.0", onlineAmount: paymentAmounts.onlineAmount, codAmount: paymentAmounts.codAmount, parsedBy }

  const handleParseChat = async () => {
    if (!chatText.trim()) return toast.error("Paste customer chat first.")
    try {
      setLoadingMessage("Loading catalog...")
      const [productsSnapshot, zonesSnapshot, shopSnapshot] = await Promise.all([getDocs(collection(db, "users", currentUser.uid, "products")), getDocs(collection(db, "users", currentUser.uid, "deliveryZones")), getDoc(doc(db, "users", currentUser.uid, "settings", "shop"))])
      const loadedProducts = productsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      const loadedZones = zonesSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      setProducts(loadedProducts); setZones(loadedZones); setShop(shopSnapshot.data() || {})
      let parsedResult

      if (isStructuredChat(chatText)) {
        setLoadingMessage("Structured format detected — parsing...")
        parsedResult = parseChat(chatText, loadedProducts, loadedZones)
        const productPairs = parseProductQuantityPairs(chatText)
        if (productPairs.length > 0) parsedResult.products = productPairs.map((pair) => buildProductRow(pair.productName, pair.quantity, loadedProducts))
        parsedResult.parsedBy = "regex"
      } else {
        setLoadingMessage("Unstructured chat — AI is reading...")
        const structured = await convertToStructured(chatText, loadedProducts, loadedZones)
        if (structured) {
          setLoadingMessage("AI extracted info — matching products...")
          parsedResult = { customerName: structured.customerName || "", phone: convertBanglaToEnglish(structured.phone || ""), address: structured.address || "", products: (structured.products || []).map((p) => buildProductRow(p.productName, p.quantity || 1, loadedProducts)), paymentMethod: structured.paymentMethod || "COD", deliveryPaymentMethod: structured.deliveryPaymentMethod || null, transactionId: structured.transactionId || "", notes: structured.notes || "", parsedBy: "gemini" }
        } else {
          parsedResult = parseChat(chatText, loadedProducts, loadedZones)
          parsedResult.parsedBy = "regex-fallback"
        }
      }

      if (parsedResult.address) {
        const zone = detectZone(parsedResult.address, loadedZones)
        if (zone) { parsedResult.detectedZone = zone; parsedResult.zone = zone; parsedResult.deliveryCharge = zone.charge }
      }
      parsedResult = await applyCorrections(currentUser.uid, parsedResult, chatText)
      const selectedZone = parsedResult.zone || parsedResult.detectedZone || null
      const initialPaymentType = parsedResult.paymentMethod && parsedResult.paymentMethod !== "COD" ? "full_online" : "full_cod"
      setOrder({ ...createEmptyOrder(), customerName: parsedResult.customerName || "", phone: parsedResult.phone || "", address: parsedResult.address || "", zoneId: selectedZone?.id || "", zone: selectedZone?.area || "", zoneAutoDetected: Boolean(selectedZone?.autoDetected), zoneIsFallback: Boolean(selectedZone?.isFallback), deliveryCharge: parsedResult.deliveryCharge || 0, products: normalizeProductRows(parsedResult.products), paymentType: initialPaymentType, productPaymentMethod: parsedResult.paymentMethod || "COD", productTransactionId: parsedResult.transactionId || "", deliveryPaymentMethod: parsedResult.deliveryPaymentMethod || "bKash", deliveryTransactionId: parsedResult.transactionId || "", notes: parsedResult.notes || "" })
      setConfidence(parsedResult.confidence || 0.75)
      setParsedBy(parsedResult.parsedBy)
      setStage(2)
    } catch (err) {
      toast.error("Failed to parse chat")
      console.error(err)
    } finally {
      setLoadingMessage("")
    }
  }

  const updateOrder = (field, value) => {
    const previous = order[field]
    setOrder((current) => ({ ...current, [field]: value }))
    if (["customerName", "address"].includes(field) && previous && previous !== value) saveCorrection(currentUser.uid, previous, value, field).catch(() => {})
  }
  const updateZone = (zoneId) => {
    const zone = zones.find((item) => item.id === zoneId)
    setOrder((current) => ({ ...current, zoneId, zone: zone?.area || "", zoneAutoDetected: Boolean(zone), zoneIsFallback: false, deliveryCharge: zone?.charge || current.deliveryCharge }))
  }
  const updateProductRow = (index, field, value) => setOrder((current) => ({ ...current, products: current.products.map((row, rowIndex) => rowIndex === index ? recalcRow(updateRowFromField(row, field, value, products)) : row) }))
  const addProductRow = () => setOrder((current) => ({ ...current, products: [...current.products, createProductRow()] }))
  const removeProductRow = (index) => setOrder((current) => ({ ...current, products: current.products.filter((_, rowIndex) => rowIndex !== index) }))

  const handlePDFDownload = async () => { const canvas = await html2canvas(invoiceRef.current, { scale: 2 }); const pdf = new jsPDF("p", "mm", "a4"); const width = pdf.internal.pageSize.getWidth(); pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, width, (canvas.height * width) / canvas.width); pdf.save(`SellerBot-Invoice-${orderNumber}.pdf`) }
  const handleImageDownload = async () => { const canvas = await html2canvas(invoiceRef.current, { scale: 2 }); const link = document.createElement("a"); link.download = `SellerBot-Invoice-${orderNumber}.png`; link.href = canvas.toDataURL("image/png"); link.click() }
  const saveSale = async () => { try { setSaving(true); await addDoc(collection(db, "users", currentUser.uid, "orders"), { ...enrichedOrder, orderNumber, invoiceURL: "", createdAt: serverTimestamp() }); toast.success("Order saved and sale recorded."); navigate("/sales") } catch (error) { toast.error(error.message || "Could not save order.") } finally { setSaving(false) } }

  if (stage === 1) return <ChatStage chatText={chatText} loadingMessage={loadingMessage} onChatChange={setChatText} onParse={handleParseChat} />
  if (stage === 2) return <ReviewStage confidence={confidence} order={order} products={products} zones={zones} subtotal={subtotal} grandTotal={grandTotal} paymentAmounts={paymentAmounts} parsedBy={parsedBy} onAddProduct={addProductRow} onBack={() => setStage(1)} onGenerate={() => setStage(3)} onProductRemove={removeProductRow} onProductUpdate={updateProductRow} onUpdate={updateOrder} onZoneChange={updateZone} />
  return <section className="space-y-6"><div className="flex items-center justify-between"><h2 className="text-3xl font-semibold">Invoice Preview</h2><button className="btn-outline" onClick={() => setStage(2)}><ArrowLeft className="mr-2 inline h-4 w-4" />Back to Edit</button></div><InvoiceTemplate ref={invoiceRef} order={{ ...enrichedOrder, orderNumber }} shop={shop} /><div className="grid gap-3 sm:grid-cols-3"><button className="btn-outline" onClick={handlePDFDownload}><FileDown className="mr-2 inline h-4 w-4" />Download PDF</button><button className="btn-outline" onClick={handleImageDownload}><ImageDown className="mr-2 inline h-4 w-4" />Download Image</button><button className="btn-primary" onClick={saveSale} disabled={saving}>{saving ? "Saving..." : "Save & Record Sale"}</button></div></section>
}

function ChatStage({ chatText, loadingMessage, onChatChange, onParse }) { return <section className="space-y-6"><div><h2 className="text-3xl font-semibold">New Order</h2><p className="text-sm text-slate-600">Paste structured format or regular customer chat. Gemini will pre-process unstructured messages.</p></div><div className="grid gap-4 lg:grid-cols-2"><pre className="card whitespace-pre-wrap text-xs bangla">{banglaTemplate}</pre><pre className="card whitespace-pre-wrap text-xs">{englishTemplate}</pre></div><textarea className="min-h-[320px] w-full rounded-lg border border-slate-300 bg-white p-4 text-sm outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20" rows={12} value={chatText} onChange={(event) => onChatChange(event.target.value)} placeholder="Paste customer chat here..." /><button className="btn-primary h-12 w-full" onClick={onParse} disabled={Boolean(loadingMessage)}>{loadingMessage && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}{loadingMessage || "Parse Chat"}</button></section> }
function ReviewStage(props) { const { confidence, order, products, zones, subtotal, grandTotal, paymentAmounts, parsedBy, onAddProduct, onBack, onGenerate, onProductRemove, onProductUpdate, onUpdate, onZoneChange } = props; return <section className="space-y-6"><div className="flex items-center justify-between"><div><h2 className="text-3xl font-semibold">Review Order</h2><p className="mt-2 text-sm text-slate-600">Confidence {Math.round(confidence * 100)}% ({parsedBy})</p></div><button className="btn-outline" onClick={onBack}>Back to Chat</button></div><Card title="Customer Info"><div className="grid gap-4 md:grid-cols-2"><Input label="Customer Name" value={order.customerName} onChange={(v) => onUpdate("customerName", v)} /><Input label="Phone" value={order.phone} onChange={(v) => onUpdate("phone", v)} /></div><Textarea label="Full Address" value={order.address} onChange={(v) => onUpdate("address", v)} /><ZoneNotice order={order} /><Select label="Zone override" value={order.zoneId} onChange={onZoneChange} options={[{ label: "Select zone", value: "" }, ...zones.map((z) => ({ label: `${z.area} - ৳${z.charge}`, value: z.id }))]} /><Input label="Delivery Charge" type="number" value={order.deliveryCharge} onChange={(v) => onUpdate("deliveryCharge", Number(v))} /></Card><Card title="Products"><ProductTable rows={order.products} products={products} onAdd={onAddProduct} onRemove={onProductRemove} onUpdate={onProductUpdate} /></Card><Card title="Order Summary"><SummaryLine label="Subtotal" value={subtotal} /><SummaryLine label="Delivery" value={order.deliveryCharge} /><Input label="Discount" type="number" value={order.discount} onChange={(v) => onUpdate("discount", Number(v))} /><div className="border-t pt-3 text-2xl font-bold text-[#1D9E75]">GRAND TOTAL: ৳{grandTotal}</div></Card><PaymentSection order={order} grandTotal={grandTotal} subtotal={subtotal} paymentAmounts={paymentAmounts} onUpdate={onUpdate} /><Card title="Notes"><Textarea label="Special Instructions" value={order.notes} onChange={(v) => onUpdate("notes", v)} /></Card><button className="btn-primary h-12 w-full text-lg" onClick={onGenerate}>Generate Invoice</button></section> }
function PaymentSection({ order, grandTotal, subtotal, paymentAmounts, onUpdate }) { return <Card title="Payment"><div className="grid gap-3 md:grid-cols-3"><PaymentCard active={order.paymentType === "full_online"} icon={CreditCard} title="Full Payment Online" desc="Customer pays everything online" onClick={() => onUpdate("paymentType", "full_online")} /><PaymentCard active={order.paymentType === "delivery_only_online"} icon={Truck} title="Delivery Charge Online Only" desc="Delivery online, product COD" onClick={() => onUpdate("paymentType", "delivery_only_online")} /><PaymentCard active={order.paymentType === "full_cod"} icon={Wallet} title="Full COD" desc="Everything paid on delivery" onClick={() => onUpdate("paymentType", "full_cod")} /></div>{order.paymentType === "full_online" && <div className="grid gap-4 md:grid-cols-3"><Select label="Payment Method" value={order.productPaymentMethod} onChange={(v) => onUpdate("productPaymentMethod", v)} options={onlineMethods.map((m) => ({ label: m, value: m }))} /><Input label="Transaction ID" value={order.productTransactionId} onChange={(v) => onUpdate("productTransactionId", v)} /><Select label="Status" value={order.productPaymentStatus} onChange={(v) => onUpdate("productPaymentStatus", v)} options={["Paid", "Unpaid", "Partial"].map((s) => ({ label: s, value: s }))} /></div>}{order.paymentType === "delivery_only_online" && <div className="grid gap-4 md:grid-cols-2"><div className="rounded-md bg-emerald-50 p-3"><h4 className="font-semibold">Delivery Payment ৳{order.deliveryCharge}</h4><Select label="Delivery Method" value={order.deliveryPaymentMethod} onChange={(v) => onUpdate("deliveryPaymentMethod", v)} options={deliveryMethods.map((m) => ({ label: m, value: m }))} /><Input label="Delivery Transaction ID" value={order.deliveryTransactionId} onChange={(v) => onUpdate("deliveryTransactionId", v)} /><Select label="Delivery Status" value={order.deliveryPaymentStatus} onChange={(v) => onUpdate("deliveryPaymentStatus", v)} options={["Paid", "Unpaid"].map((s) => ({ label: s, value: s }))} /></div><div className="rounded-md bg-slate-50 p-3"><h4 className="font-semibold">Product Payment</h4><p>Method: COD</p><p>Status: Unpaid</p><p>Amount: ৳{subtotal}</p></div></div>}{order.paymentType === "full_cod" && <p className="rounded-md bg-slate-50 p-3 font-semibold">Status: Unpaid. Amount to collect on delivery: ৳{grandTotal}</p>}<p className="rounded-md bg-[#e8f8f3] p-3 font-semibold text-[#157a5c]">Online: ৳{paymentAmounts.onlineAmount} | On Delivery: ৳{paymentAmounts.codAmount}</p></Card> }
function ProductTable({ rows, products, onAdd, onRemove, onUpdate }) { return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="text-left"><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Remove</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td><select className="h-10 w-full rounded-md border px-2" value={row.productId} onChange={(e) => onUpdate(index, "productId", e.target.value)}><option value="">Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td><td><input className="h-10 w-20 rounded-md border px-2" type="number" min="1" value={row.quantity} onChange={(e) => onUpdate(index, "quantity", e.target.value)} /></td><td><input className="h-10 w-28 rounded-md border px-2" type="number" value={row.unitPrice} onChange={(e) => onUpdate(index, "unitPrice", e.target.value)} /></td><td>৳{row.totalPrice}</td><td><button className="text-red-600" onClick={() => onRemove(index)}><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table><button className="btn-outline mt-4" onClick={onAdd}><Plus className="mr-2 inline h-4 w-4" />Add Product Row</button></div> }
function PaymentCard({ active, icon: Icon, title, desc, onClick }) { return <button className={`rounded-lg border p-4 text-left ${active ? "border-[#1D9E75] bg-emerald-50" : "border-slate-200 bg-white"}`} onClick={onClick}><Icon className="mb-2 h-5 w-5 text-[#1D9E75]" /><p className="font-semibold">{title}</p><p className="text-xs text-slate-600">{desc}</p></button> }
function ZoneNotice({ order }) { if (!order.zone) return <p className="rounded-md bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">Could not detect zone — please select manually</p>; if (order.zoneIsFallback) return <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm font-semibold text-yellow-800">No specific area detected — defaulting to {order.zone} (৳{order.deliveryCharge}). Please verify.</p>; return <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Auto-detected: {order.zone} (৳{order.deliveryCharge})</p> }
function Card({ title, children }) { return <div className="card space-y-4"><h3 className="text-lg font-semibold">{title}</h3>{children}</div> }
function Input({ label, value, onChange, type = "text" }) { return <label className="block"><span className="text-sm font-medium">{label}</span><input className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function Textarea({ label, value, onChange }) { return <label className="block"><span className="text-sm font-medium">{label}</span><textarea className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function Select({ label, value, options, onChange }) { return <label className="block"><span className="text-sm font-medium">{label}</span><select className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label> }
function SummaryLine({ label, value }) { return <p className="flex justify-between text-sm"><span>{label}</span><span className="font-semibold">৳{value}</span></p> }
function buildProductRow(name, quantity, catalog) { const match = fuzzyMatchSingle(name, catalog); return { productId: match?.id || "", productName: match?.name || name, banglaName: match?.banglaName || "", quantity: Number(quantity || 1), unitPrice: match?.price || 0, costPrice: match?.costPrice || 0, totalPrice: (match?.price || 0) * Number(quantity || 1) } }
function createProductRow() { return { productId: "", productName: "", banglaName: "", quantity: 1, unitPrice: 0, costPrice: 0, totalPrice: 0 } }
function createEmptyOrder() { return { customerName: "", phone: "", address: "", zoneId: "", zone: "", zoneAutoDetected: false, zoneIsFallback: false, deliveryCharge: 0, products: [createProductRow()], discount: 0, paymentType: "full_cod", productPaymentMethod: "COD", productPaymentStatus: "Unpaid", productTransactionId: "", deliveryPaymentMethod: "bKash", deliveryPaymentStatus: "Unpaid", deliveryTransactionId: "", paymentMethod: "COD", paymentStatus: "Unpaid", transactionId: "", notes: "" } }
function updateRowFromField(row, field, value, catalog) { if (field !== "productId") return { ...row, [field]: value }; const product = catalog.find((item) => item.id === value); return { ...row, productId: value, productName: product?.name || "", banglaName: product?.banglaName || "", unitPrice: product?.price || 0, costPrice: product?.costPrice || 0 } }
function recalcRow(row) { const quantity = Number(row.quantity || 1); const unitPrice = Number(row.unitPrice || 0); return { ...row, quantity, unitPrice, totalPrice: quantity * unitPrice } }
function normalizeProductRows(rows = []) { return rows.length ? rows.map(recalcRow) : [createProductRow()] }
function getPaymentAmounts(type, subtotal, delivery, grandTotal) { if (type === "full_online") return { onlineAmount: grandTotal, codAmount: 0 }; if (type === "delivery_only_online") return { onlineAmount: delivery, codAmount: subtotal }; return { onlineAmount: 0, codAmount: grandTotal } }

function getLegacyPaymentFields(order) {
  if (order.paymentType === "full_online") {
    return {
      paymentMethod: order.productPaymentMethod || "bKash",
      paymentStatus: order.productPaymentStatus || "Unpaid",
      transactionId: order.productTransactionId || "",
    }
  }

  if (order.paymentType === "delivery_only_online") {
    return {
      productPaymentMethod: "COD",
      productPaymentStatus: "Unpaid",
      paymentMethod: order.deliveryPaymentMethod || "bKash",
      paymentStatus: order.deliveryPaymentStatus === "Paid" ? "Partial" : "Unpaid",
      transactionId: order.deliveryTransactionId || "",
    }
  }

  return { paymentMethod: "COD", paymentStatus: "Unpaid", transactionId: "" }
}

export default NewOrder


