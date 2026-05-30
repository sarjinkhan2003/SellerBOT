import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp } from "firebase/firestore"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { ArrowLeft, Check, ClipboardList, CreditCard, FileDown, ImageDown, Loader2, MessageCircle, Printer, Plus, Trash2, Truck, Wallet } from "lucide-react"
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom"
import InvoiceTemplate from "../components/InvoiceTemplate.jsx"
import { useAuth } from "../context/AuthContext.jsx"
import { db } from "../firebase/config.js"
import { applyCorrections, saveCorrection } from "../utils/correctionMemory.js"
import { fuzzyMatchSingle } from "../utils/fuzzyMatcher.js"
import { convertToStructuredText } from "../utils/geminiHelper.js"
import { parseChat, parseProductQuantityPairs } from "../utils/parser.js"
import { moveToDeliveryInventory } from "../utils/inventoryManager.js"
import { printInvoiceElement } from "../utils/printInvoice.js"
import { searchProductsByVector, searchZonesByVector } from "../utils/ragOperations.js"
import { detectZone } from "../utils/zoneDetector.js"

const banglaTemplate = `\u0986\u09ae\u09be\u09a6\u09c7\u09b0 \u0995\u09be\u099b\u09c7 \u0985\u09b0\u09cd\u09a1\u09be\u09b0 \u0995\u09b0\u09a4\u09c7 \u09a8\u09bf\u099a\u09c7\u09b0 \u09ab\u09b0\u09ae\u09cd\u09af\u09be\u099f\u09c7 \u09ae\u09c7\u09b8\u09c7\u099c \u0995\u09b0\u09c1\u09a8:

\u09a8\u09be\u09ae\u0983 (\u0986\u09aa\u09a8\u09be\u09b0 \u09a8\u09be\u09ae)
\u09ae\u09cb\u09ac\u09be\u0987\u09b2\u0983 (\u0986\u09aa\u09a8\u09be\u09b0 \u09a8\u09ae\u09cd\u09ac\u09b0)
\u09a0\u09bf\u0995\u09be\u09a8\u09be\u0983 (\u09b8\u09ae\u09cd\u09aa\u09c2\u09b0\u09cd\u09a3 \u09a0\u09bf\u0995\u09be\u09a8\u09be)

\u09aa\u09a3\u09cd\u09af\u0983 (\u09aa\u09cd\u09b0\u09a5\u09ae \u09aa\u09a3\u09cd\u09af\u09c7\u09b0 \u09a8\u09be\u09ae)
\u09aa\u09b0\u09bf\u09ae\u09be\u09a3\u0983 (\u09b8\u0982\u0996\u09cd\u09af\u09be)

\u09aa\u09a3\u09cd\u09af\u0983 (\u09a6\u09cd\u09ac\u09bf\u09a4\u09c0\u09af\u09bc \u09aa\u09a3\u09cd\u09af\u09c7\u09b0 \u09a8\u09be\u09ae)
\u09aa\u09b0\u09bf\u09ae\u09be\u09a3\u0983 (\u09b8\u0982\u0996\u09cd\u09af\u09be)

\u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f\u0983 (COD / bKash / Nagad)
\u09a8\u09cb\u099f\u0983 (\u09af\u09a6\u09bf \u09a5\u09be\u0995\u09c7)

\u0989\u09a6\u09be\u09b9\u09b0\u09a3\u0983
\u09a8\u09be\u09ae\u0983 \u09b0\u09b9\u09bf\u09ae \u09ae\u09bf\u09af\u09bc\u09be
\u09ae\u09cb\u09ac\u09be\u0987\u09b2\u0983 \u09e6\u09e7\u09ed\u09e7\u09e8\u09e9\u09ea\u09eb\u09ec\u09ed\u09ee
\u09a0\u09bf\u0995\u09be\u09a8\u09be\u0983 \u09ae\u09bf\u09b0\u09aa\u09c1\u09b0 \u09e7\u09e6, \u09a2\u09be\u0995\u09be \u09e7\u09e8\u09e7\u09ec

\u09aa\u09a3\u09cd\u09af\u0983 \u09a8\u09c0\u09b2 \u09b6\u09be\u09b0\u09cd\u099f
\u09aa\u09b0\u09bf\u09ae\u09be\u09a3\u0983 \u09e8

\u09aa\u09a3\u09cd\u09af\u0983 \u0995\u09be\u09b2\u09cb \u09aa\u09cd\u09af\u09be\u09a8\u09cd\u099f
\u09aa\u09b0\u09bf\u09ae\u09be\u09a3\u0983 \u09e7

\u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f\u0983 Nagad`
const englishTemplate = `To place an order, please message us in this format:

Name: (your name)
Mobile: (your number)
Address: (full address)

Product: (first product name)
Quantity: (number)

Product: (second product name)
Quantity: (number)

Payment: (COD / bKash / Nagad)
Note: (optional)

Example:
Name: Rahim Mia
Mobile: 01712345678
Address: Mirpur 10, Dhaka 1216

Product: Blue Shirt
Quantity: 2

Product: Black Pant
Quantity: 1

Payment: Nagad`
const banglishTemplate = `Order korte ei format e message korun:

Nam: (apnar nam)
Mobile: (apnar number)
Thikana: (full address)

Product: (prothom product name)
Quantity: (number)

Product: (ditiyo product name)
Quantity: (number)

Payment: (COD / bKash / Nagad)
Note: (optional)

Example:
Nam: Karim
Mobile: 01812345678
Thikana: Sylhet sadar

Product: Shirt
Quantity: 2

Product: Pant
Quantity: 1

Payment: Nagad`
const structuredPlaceholder = `Bangla:
\u09a8\u09be\u09ae\u0983 \u09b0\u09b9\u09bf\u09ae \u09ae\u09bf\u09af\u09bc\u09be
\u09ae\u09cb\u09ac\u09be\u0987\u09b2\u0983 \u09e6\u09e7\u09ed\u09e7\u09e8\u09e9\u09ea\u09eb\u09ec\u09ed\u09ee
\u09a0\u09bf\u0995\u09be\u09a8\u09be\u0983 \u09ae\u09bf\u09b0\u09aa\u09c1\u09b0 \u09e7\u09e6, \u09a2\u09be\u0995\u09be

\u09aa\u09a3\u09cd\u09af\u0983 \u09a8\u09c0\u09b2 \u09b6\u09be\u09b0\u09cd\u099f
\u09aa\u09b0\u09bf\u09ae\u09be\u09a3\u0983 \u09e8

English:
Name: Rahim Mia
Mobile: 01712345678
Address: Mirpur 10, Dhaka

Product: Blue Shirt
Quantity: 2

Banglish:
Nam: Karim
Mobile: 01812345678
Thikana: Sylhet sadar

Product: Shirt
Quantity: 2`
const unstructuredPlaceholder = `vai asalamu alaikum
ami karim, sylhet e thaki
2ta shirt ar 1ta pant lagbe
nagad e dibo
01812345678

(Paste any chat - AI will understand it)`
const onlineMethods = ["bKash", "Nagad", "Rocket", "Bank", "Other"]
const deliveryMethods = ["bKash", "Nagad", "Rocket"]
const structuredSteps = ["Reading structured chat...", "Matching products to catalog...", "Detecting delivery zone...", "Done!"]
const unstructuredSteps = ["AI is reading the conversation...", "Extracting customer details...", "Matching products to your catalog...", "Detecting delivery zone...", "Done!"]

function NewOrder() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const invoiceRef = useRef(null)
  const [stage, setStage] = useState(1)
  const [chatType, setChatType] = useState("structured")
  const [chatText, setChatText] = useState("")
  const [loadingMessage, setLoadingMessage] = useState("")
  const [loadingSteps, setLoadingSteps] = useState([])
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
  const enrichedOrder = { ...order, ...getLegacyPaymentFields(order), chatType, subtotal, grandTotal, productRevenue: subtotal, deliveryRevenue: Number(order.deliveryCharge || 0), grossRevenue: grandTotal, totalCost, grossProfit: subtotal - totalCost, profitMargin: subtotal > 0 ? (((subtotal - totalCost) / subtotal) * 100).toFixed(1) : "0.0", onlineAmount: paymentAmounts.onlineAmount, codAmount: paymentAmounts.codAmount, parsedBy }
  const setStep = (index) => {
    const source = chatType === "manual" ? manualSteps : chatType === "structured" ? structuredSteps : unstructuredSteps
    setLoadingMessage(source[index] || "")
    setLoadingSteps(source.map((label, stepIndex) => ({ label, status: stepIndex < index ? "done" : stepIndex === index ? "current" : "pending" })))
  }

  const completeSteps = () => {
    const source = chatType === "manual" ? manualSteps : chatType === "structured" ? structuredSteps : unstructuredSteps
    setLoadingMessage("Done!")
    setLoadingSteps(source.map((label) => ({ label, status: "done" })))
  }

  const handleParseChat = async () => {
    if (chatType !== "manual" && !chatText.trim()) {
      toast.error("Please paste a customer chat first")
      return
    }

    try {
      setStep(0)
      const [loadedProducts, loadedZones, loadedShop] = await fetchSellerData(currentUser.uid)
      setProducts(loadedProducts)
      setZones(loadedZones)
      setShop(loadedShop)

      if (chatType === "manual") {
        setStep(1)
        setOrder(createEmptyOrder())
        setParsedBy("manual")
        completeSteps()
        setStage(2)
        return
      }

      let parsedResult = null

      if (chatType === "structured") {
        parsedResult = parseChat(chatText, loadedProducts, loadedZones)
        parsedResult.parsedBy = "regex"

        setStep(1)
        const productPairs = parseProductQuantityPairs(chatText)
        const ragProducts = await searchProductsByVector(currentUser.uid, chatText, 8)
        if (productPairs.length > 0) {
          parsedResult.products = productPairs.map((pair) =>
            ragProducts.length > 0
              ? buildProductRowFromRag(pair, ragProducts, loadedProducts)
              : buildProductRow(pair.productName, pair.quantity, loadedProducts),
          )
          if (ragProducts.length > 0) parsedResult.parsedBy = "regex+rag"
        }
      } else {
        if (!import.meta.env.VITE_GROQ_API_KEY) {
          toast.error("AI parsing is not configured. Please contact support.")
          return
        }

        setStep(1)
        const [ragProducts, ragZones] = await Promise.all([
          searchProductsByVector(currentUser.uid, chatText, 8),
          searchZonesByVector(currentUser.uid, chatText, 3),
        ])
        const structuredText = await convertToStructuredText(chatText, loadedProducts, loadedZones, ragProducts, ragZones)
        if (!structuredText) {
          toast.error("AI could not format this chat. Try Structured mode or paste a clearer message.")
          return
        }

        parsedResult = parseChat(structuredText, loadedProducts, loadedZones)
        parsedResult.rawText = chatText
        parsedResult.structuredText = structuredText
        parsedResult.parsedBy = ragProducts.length > 0 || ragZones.length > 0 ? "gemini+rag" : "gemini"

        setStep(2)
        const productPairs = parseProductQuantityPairs(structuredText)
        if (productPairs.length > 0) {
          parsedResult.products = productPairs.map((pair) =>
            ragProducts.length > 0
              ? buildProductRowFromRag(pair, ragProducts, loadedProducts)
              : buildProductRow(pair.productName, pair.quantity, loadedProducts),
          )
        }
      }

      setStep(chatType === "structured" ? 2 : 3)
      if (parsedResult.address) {
        const ragZones = await searchZonesByVector(currentUser.uid, parsedResult.address, 3)
        if (ragZones.length > 0) {
          const topZone = ragZones[0]
          parsedResult.detectedZone = {
            id: topZone.zone_id,
            area: topZone.area,
            banglaArea: topZone.bangla_area,
            charge: topZone.charge,
            autoDetected: true,
            detectionMethod: "rag",
            similarity: topZone.similarity,
          }
          parsedResult.deliveryCharge = topZone.charge
        } else {
          const zone = detectZone(parsedResult.address, loadedZones)
          if (zone) {
            parsedResult.detectedZone = zone
            parsedResult.deliveryCharge = zone.charge
          }
        }
      }

      if (!parsedResult.detectedZone && typeof parsedResult.zone === "string" && loadedZones.length > 0) {
        const geminiZone = loadedZones.find((zone) => zone.area.toLowerCase() === parsedResult.zone.toLowerCase())
        if (geminiZone) {
          parsedResult.detectedZone = geminiZone
          parsedResult.deliveryCharge = geminiZone.charge
        }
      }

      parsedResult = await applyCorrections(currentUser.uid, parsedResult, chatText)
      completeSteps()
      const selectedZone = parsedResult.detectedZone || (typeof parsedResult.zone === "object" ? parsedResult.zone : null)
      const initialPaymentType = parsedResult.paymentMethod && parsedResult.paymentMethod !== "COD" ? "full_online" : "full_cod"
      const normalizedProducts = normalizeProductRows(parsedResult.products)
      setOrder({ ...createEmptyOrder(), customerName: parsedResult.customerName || "", phone: parsedResult.phone || "", address: parsedResult.address || "", zoneId: selectedZone?.id || "", zone: selectedZone?.area || "", zoneAutoDetected: Boolean(selectedZone?.autoDetected), zoneIsFallback: Boolean(selectedZone?.isFallback), zoneDetectionMethod: selectedZone?.detectionMethod || "", zoneSimilarity: selectedZone?.similarity || 0, deliveryCharge: parsedResult.deliveryCharge || 0, products: normalizedProducts, paymentType: initialPaymentType, productPaymentMethod: parsedResult.paymentMethod || "COD", productTransactionId: parsedResult.transactionId || "", deliveryPaymentMethod: parsedResult.deliveryPaymentMethod || "bKash", deliveryTransactionId: parsedResult.transactionId || "", notes: parsedResult.notes || "" })
      setParsedBy(parsedResult.parsedBy)
      setStage(2)
    } catch (error) {
      console.error("Parse error:", error)
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoadingMessage("")
      setLoadingSteps([])
    }
  }
  const updateOrder = (field, value) => {
    const previous = order[field]
    setOrder((current) => ({ ...current, [field]: value }))
    if (["customerName", "address"].includes(field) && previous && previous !== value) saveCorrection(currentUser.uid, previous, value, field).catch(() => {})
  }
  const updateZone = (zoneId) => {
    const zone = zones.find((item) => item.id === zoneId)
    setOrder((current) => ({ ...current, zoneId, zone: zone?.area || "", zoneAutoDetected: Boolean(zone), zoneIsFallback: false, zoneDetectionMethod: "manual", zoneSimilarity: 0, deliveryCharge: zone?.charge || current.deliveryCharge }))
  }
  const updateProductRow = (index, field, value) => setOrder((current) => ({ ...current, products: current.products.map((row, rowIndex) => rowIndex === index ? recalcRow(updateRowFromField(row, field, value, products)) : row) }))
  const addProductRow = () => setOrder((current) => ({ ...current, products: [...current.products, createProductRow()] }))
  const removeProductRow = (index) => setOrder((current) => ({ ...current, products: current.products.filter((_, rowIndex) => rowIndex !== index) }))

  const handleGenerateInvoice = () => {
    const warnings = order.products
      .map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId)
        return product && Number(product.stock || 0) < Number(item.quantity || 1)
          ? `${item.productName} only has ${product.stock || 0} in stock but ${item.quantity || 1} ordered`
          : null
      })
      .filter(Boolean)

    warnings.forEach((message) => toast.error(message))
    setStage(3)
  }
  const handlePDFDownload = async () => { const canvas = await html2canvas(invoiceRef.current, { scale: 2 }); const pdf = new jsPDF("p", "mm", "a4"); const width = pdf.internal.pageSize.getWidth(); pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, width, (canvas.height * width) / canvas.width); pdf.save(`SellerBot-Invoice-${orderNumber}.pdf`) }
  const handleImageDownload = async () => { const canvas = await html2canvas(invoiceRef.current, { scale: 2 }); const link = document.createElement("a"); link.download = `SellerBot-Invoice-${orderNumber}.png`; link.href = canvas.toDataURL("image/png"); link.click() }
  const handlePrintInvoice = async () => { await printInvoiceElement(invoiceRef.current) }
  const saveSale = async () => { try { setSaving(true); const confirmedOrder = { ...enrichedOrder, orderNumber, invoiceURL: "" }; const docRef = await addDoc(collection(db, "users", currentUser.uid, "orders"), { ...confirmedOrder, createdAt: serverTimestamp() }); const inventoryResult = await moveToDeliveryInventory(currentUser.uid, { ...confirmedOrder, id: docRef.id }); if (inventoryResult.success) toast.success("Order saved! Stock updated."); else { toast.success("Order saved!"); toast.error("Stock update failed - check inventory."); } navigate("/orders") } catch (error) { toast.error(error.message || "Could not save order.") } finally { setSaving(false) } }

  if (stage === 1) return <ChatStage chatText={chatText} chatType={chatType} loadingSteps={loadingSteps} loadingMessage={loadingMessage} onChatChange={setChatText} onChatTypeChange={setChatType} onParse={handleParseChat} />
  if (stage === 2) return <ReviewStage order={order} products={products} zones={zones} subtotal={subtotal} grandTotal={grandTotal} paymentAmounts={paymentAmounts} parsedBy={parsedBy} onAddProduct={addProductRow} onBack={() => setStage(1)} onGenerate={handleGenerateInvoice} onProductRemove={removeProductRow} onProductUpdate={updateProductRow} onUpdate={updateOrder} onZoneChange={updateZone} />
  return <section className="space-y-6"><div className="flex items-center justify-between"><h2 className="text-3xl font-semibold">Invoice Preview</h2><button className="btn-outline" onClick={() => setStage(2)}><ArrowLeft className="mr-2 inline h-4 w-4" />Back to Edit</button></div><InvoiceTemplate ref={invoiceRef} order={{ ...enrichedOrder, orderNumber }} shop={shop} /><div className="grid gap-3 sm:grid-cols-4"><button className="btn-outline" onClick={handlePDFDownload}><FileDown className="mr-2 inline h-4 w-4" />Download PDF</button><button className="btn-outline" onClick={handleImageDownload}><ImageDown className="mr-2 inline h-4 w-4" />Download Image</button><button className="btn-outline" onClick={handlePrintInvoice}><Printer className="mr-2 inline h-4 w-4" />Print Invoice</button><button className="btn-primary" onClick={saveSale} disabled={saving}>{saving ? "Saving..." : "Save & Record Sale"}</button></div></section>
}

function ChatStage({ chatText, chatType, loadingSteps, loadingMessage, onChatChange, onChatTypeChange, onParse }) {
  const { t } = useTranslation()
  const isManual = chatType === "manual"
  const isStructured = chatType === "structured"
  const isUnstructured = chatType === "unstructured"
  const orderFlow = isManual ? "manual" : "chat"
  const copyFormat = async () => {
    await navigator.clipboard.writeText(`${banglaTemplate}\n\n--- ENGLISH ---\n\n${englishTemplate}\n\n--- BANGLISH ---\n\n${banglishTemplate}`)
    toast.success("Order format copied.")
  }
  const handleFlowChange = (value) => {
    onChatTypeChange(value === "manual" ? "manual" : "structured")
  }

  return <section className="space-y-6"><div><h2 className="text-3xl font-semibold">{t("order.title")}</h2><p className="text-sm text-slate-600">Choose Chat to Invoice for pasted messages, or Manual Invoice for direct entry.</p></div><div className="card grid gap-3 md:grid-cols-[260px_1fr]"><label><span>New Order Type</span><select value={orderFlow} onChange={(event) => handleFlowChange(event.target.value)}><option value="chat">Chat to Invoice</option><option value="manual">Manual Invoice</option></select></label><div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{isManual ? "Manual Invoice opens the editable order form without parsing chat text." : "Chat to Invoice reads a customer message first, then lets you review before invoice generation."}</div></div>{!isManual && <><div className="grid gap-4 md:grid-cols-2"><ChatTypeCard active={isStructured} badge="Fast & Accurate" badgeClass="bg-emerald-100 text-emerald-800" color="green" desc="Customer followed your order format with labels like name, address, product" icon={ClipboardList} title={t("order.structuredChat")} onClick={() => onChatTypeChange("structured")} /><ChatTypeCard active={isUnstructured} badge="AI Powered" badgeClass="bg-blue-100 text-blue-800" color="blue" desc={t("order.unstructuredDesc")} icon={MessageCircle} title={t("order.unstructuredChat")} onClick={() => onChatTypeChange("unstructured")} /></div><textarea className="min-h-[320px] w-full rounded-lg border border-slate-300 bg-white p-4 text-sm outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20" rows={12} value={chatText} onChange={(event) => onChatChange(event.target.value)} placeholder={isStructured ? structuredPlaceholder : unstructuredPlaceholder} />{isStructured ? <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between"><p>Tip: Share the order format with your customers for best accuracy.</p><button className="rounded-md border border-emerald-300 bg-white px-3 py-2 font-semibold text-emerald-800" type="button" onClick={copyFormat}>{t("order.copyTemplate")}</button></div> : <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Tip: AI will read the conversation and extract order details automatically. Works with Bangla, English and Banglish.</p>}</>}{isManual && <div className="card border-purple-200 bg-purple-50 text-sm text-purple-900"><p className="font-semibold">Manual invoice mode</p><p className="mt-1">Click below to load your products and zones, then fill customer, product, payment, and delivery details manually.</p></div>}<button className={`h-12 w-full rounded-md px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${isStructured || isManual ? "bg-[#1D9E75] hover:bg-[#178765]" : "bg-blue-600 hover:bg-blue-700"}`} onClick={onParse} disabled={Boolean(loadingMessage)}>{loadingMessage && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}{loadingMessage ? "Preparing..." : isManual ? "Create Manual Invoice" : isStructured ? t("order.parseChat") : t("order.parseWithAI")}</button>{loadingSteps.length > 0 && <LoadingSteps steps={loadingSteps} />}</section>
}

function ChatTypeCard({ active, badge, badgeClass, color, desc, icon: Icon, title, onClick }) {
  const activeClass = color === "blue" ? "border-blue-500 bg-blue-50" : color === "purple" ? "border-purple-500 bg-purple-50" : "border-[#1D9E75] bg-emerald-50"
  return <button className={`rounded-lg border-2 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${active ? activeClass : "border-slate-200 hover:border-slate-300"}`} type="button" onClick={onClick}><div className="flex items-start justify-between gap-3"><Icon className={`h-8 w-8 ${color === "blue" ? "text-blue-600" : color === "purple" ? "text-purple-600" : "text-[#1D9E75]"}`} /><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>{badge}</span></div><h3 className="mt-4 text-lg font-semibold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p></button>
}

function LoadingSteps({ steps }) { return <div className="rounded-lg border border-slate-200 bg-white p-4"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{steps.map((step) => <div key={step.label} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${step.status === "done" ? "bg-emerald-50 text-emerald-800" : step.status === "current" ? "bg-slate-100 text-slate-900" : "bg-white text-slate-400"}`}>{step.status === "done" ? <Check className="h-4 w-4" /> : step.status === "current" ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-4 w-4 rounded-full border border-slate-300" />}{step.label}</div>)}</div></div> }
function ReviewStage(props) {
  const { t } = useTranslation()
  const {
    order,
    products,
    zones,
    subtotal,
    grandTotal,
    paymentAmounts,
    parsedBy,
    onAddProduct,
    onBack,
    onGenerate,
    onProductRemove,
    onProductUpdate,
    onUpdate,
    onZoneChange,
  } = props

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold">{t("order.reviewOrder")}</h2>
          <ParseBadge parsedBy={parsedBy} />
        </div>
        <button className="btn-outline" onClick={onBack}>{t("order.backToChat")}</button>
      </div>


      <Card title={t("order.customerInfo")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label={t("order.customerName")} value={order.customerName} onChange={(v) => onUpdate("customerName", v)} />
          <Input label={t("order.phone")} value={order.phone} onChange={(v) => onUpdate("phone", v)} />
        </div>
        <Textarea label={t("order.fullAddress")} value={order.address} onChange={(v) => onUpdate("address", v)} />
        <ZoneNotice order={order} />
        <Select label={t("order.zoneOverride")} value={order.zoneId} onChange={onZoneChange} options={[{ label: "Select zone", value: "" }, ...zones.map((z) => ({ label: `${z.area} - ৳${z.charge}`, value: z.id }))]} />
        <Input label={t("order.deliveryCharge")} type="number" value={order.deliveryCharge} onChange={(v) => onUpdate("deliveryCharge", Number(v))} />
      </Card>

      <Card title={t("order.products")}>
        <ProductTable rows={order.products} products={products} onAdd={onAddProduct} onRemove={onProductRemove} onUpdate={onProductUpdate} />
      </Card>

      <Card title={t("order.orderSummary")}>
        <SummaryLine label="Subtotal" value={subtotal} />
        <SummaryLine label="Delivery" value={order.deliveryCharge} />
        <Input label="Discount" type="number" value={order.discount} onChange={(v) => onUpdate("discount", Number(v))} />
        <div className="border-t pt-3 text-2xl font-bold text-[#1D9E75]">GRAND TOTAL: ৳{grandTotal}</div>
      </Card>

      <PaymentSection order={order} grandTotal={grandTotal} subtotal={subtotal} paymentAmounts={paymentAmounts} onUpdate={onUpdate} />
      <Card title="Notes"><Textarea label="Special Instructions" value={order.notes} onChange={(v) => onUpdate("notes", v)} /></Card>
      <button className="btn-primary h-12 w-full text-lg" onClick={onGenerate}>{t("order.generateInvoice")}</button>
    </section>
  )
}

function ParseBadge({ parsedBy }) {
  if (parsedBy === "regex+rag") return <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">Structured + RAG Search</p>
  if (parsedBy === "gemini+rag") return <p className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">AI + RAG Search ? Please review all fields carefully</p>
  if (parsedBy === "gemini") return <p className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">AI Parsed ? Please review all fields carefully</p>
  if (parsedBy === "regex-fallback") return <p className="mt-2 inline-flex rounded-full bg-yellow-50 px-3 py-1 text-sm font-semibold text-yellow-800">Basic Parse - review carefully</p>
  return <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">Structured Parse</p>
}
function PaymentSection({ order, grandTotal, subtotal, paymentAmounts, onUpdate }) { return <Card title="Payment"><div className="grid gap-3 md:grid-cols-3"><PaymentCard active={order.paymentType === "full_online"} icon={CreditCard} title="Full Payment Online" desc="Customer pays everything online" onClick={() => onUpdate("paymentType", "full_online")} /><PaymentCard active={order.paymentType === "delivery_only_online"} icon={Truck} title="Delivery Charge Online Only" desc="Delivery online, product COD" onClick={() => onUpdate("paymentType", "delivery_only_online")} /><PaymentCard active={order.paymentType === "full_cod"} icon={Wallet} title="Full COD" desc="Everything paid on delivery" onClick={() => onUpdate("paymentType", "full_cod")} /></div>{order.paymentType === "full_online" && <div className="grid gap-4 md:grid-cols-3"><Select label="Payment Method" value={order.productPaymentMethod} onChange={(v) => onUpdate("productPaymentMethod", v)} options={onlineMethods.map((m) => ({ label: m, value: m }))} /><Input label="Transaction ID" value={order.productTransactionId} onChange={(v) => onUpdate("productTransactionId", v)} /><Select label="Status" value={order.productPaymentStatus} onChange={(v) => onUpdate("productPaymentStatus", v)} options={["Paid", "Unpaid", "Partial"].map((s) => ({ label: s, value: s }))} /></div>}{order.paymentType === "delivery_only_online" && <div className="grid gap-4 md:grid-cols-2"><div className="rounded-md bg-emerald-50 p-3"><h4 className="font-semibold">Delivery Payment ৳{order.deliveryCharge}</h4><Select label="Delivery Method" value={order.deliveryPaymentMethod} onChange={(v) => onUpdate("deliveryPaymentMethod", v)} options={deliveryMethods.map((m) => ({ label: m, value: m }))} /><Input label="Delivery Transaction ID" value={order.deliveryTransactionId} onChange={(v) => onUpdate("deliveryTransactionId", v)} /><Select label="Delivery Status" value={order.deliveryPaymentStatus} onChange={(v) => onUpdate("deliveryPaymentStatus", v)} options={["Paid", "Unpaid"].map((s) => ({ label: s, value: s }))} /></div><div className="rounded-md bg-slate-50 p-3"><h4 className="font-semibold">Product Payment</h4><p>Method: COD</p><p>Status: Unpaid</p><p>Amount: ৳{subtotal}</p></div></div>}{order.paymentType === "full_cod" && <p className="rounded-md bg-slate-50 p-3 font-semibold">Status: Unpaid. Amount to collect on delivery: ৳{grandTotal}</p>}<p className="rounded-md bg-[#e8f8f3] p-3 font-semibold text-[#157a5c]">Online: ৳{paymentAmounts.onlineAmount} | On Delivery: ৳{paymentAmounts.codAmount}</p></Card> }
function ProductTable({ rows, products, onAdd, onRemove, onUpdate }) { return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="text-left"><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Remove</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td><select className="h-10 w-full rounded-md border px-2" value={row.productId} onChange={(e) => onUpdate(index, "productId", e.target.value)}><option value="">Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{formatProductOption(p)}</option>)}</select></td><td><input className="h-10 w-20 rounded-md border px-2" type="number" min="1" value={row.quantity} onChange={(e) => onUpdate(index, "quantity", e.target.value)} /></td><td><input className="h-10 w-28 rounded-md border px-2" type="number" value={row.unitPrice} onChange={(e) => onUpdate(index, "unitPrice", e.target.value)} /></td><td>৳{row.totalPrice}<MatchBadge matchedBy={row.matchedBy} /></td><td><button className="text-red-600" onClick={() => onRemove(index)}><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table><button className="btn-outline mt-4" onClick={onAdd}><Plus className="mr-2 inline h-4 w-4" />Add Product Row</button></div> }
function formatProductOption(product) { const code = product.productCode || product.id; return code ? `[${code}] ${product.name}` : product.name }
function MatchBadge({ matchedBy }) { const label = matchedBy === "productCode" ? "Code Match" : matchedBy === "rag" || matchedBy === "fuzzy" ? "AI Match" : "Manual"; const tone = matchedBy === "productCode" ? "bg-emerald-50 text-emerald-800" : matchedBy === "manual" ? "bg-slate-100 text-slate-700" : "bg-blue-50 text-blue-800"; return <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{label}</span> }
function PaymentCard({ active, icon: Icon, title, desc, onClick }) { return <button className={`rounded-lg border p-4 text-left ${active ? "border-[#1D9E75] bg-emerald-50" : "border-slate-200 bg-white"}`} onClick={onClick}><Icon className="mb-2 h-5 w-5 text-[#1D9E75]" /><p className="font-semibold">{title}</p><p className="text-xs text-slate-600">{desc}</p></button> }
function ZoneNotice({ order }) { if (!order.zone) return <p className="rounded-md bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">Could not detect zone - please select manually</p>; if (order.zoneIsFallback) return <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm font-semibold text-yellow-800">No specific area detected - defaulting to {order.zone} (৳{order.deliveryCharge}). Please verify.</p>; if (order.zoneDetectionMethod === "rag") return <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Auto-detected via AI: {order.zone} (৳{order.deliveryCharge}){order.zoneSimilarity ? ` - ${Math.round(order.zoneSimilarity * 100)}% match` : ""}</p>; return <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Auto-detected: {order.zone} (৳{order.deliveryCharge})</p> }
function Card({ title, children }) { return <div className="card space-y-4"><h3 className="text-lg font-semibold">{title}</h3>{children}</div> }
function Input({ label, value, onChange, type = "text" }) { return <label className="block"><span className="text-sm font-medium">{label}</span><input className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function Textarea({ label, value, onChange }) { return <label className="block"><span className="text-sm font-medium">{label}</span><textarea className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function Select({ label, value, options, onChange }) { return <label className="block"><span className="text-sm font-medium">{label}</span><select className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label> }
function SummaryLine({ label, value }) { return <p className="flex justify-between text-sm"><span>{label}</span><span className="font-semibold">৳{value}</span></p> }
async function fetchSellerData(uid) { const [productsSnapshot, zonesSnapshot, shopSnapshot] = await Promise.all([getDocs(collection(db, "users", uid, "products")), getDocs(collection(db, "users", uid, "deliveryZones")), getDoc(doc(db, "users", uid, "settings", "shop"))]); return [productsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })), zonesSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })), shopSnapshot.data() || {}] }
function buildProductRow(name, quantity, catalog) { const match = fuzzyMatchSingle(name, catalog); return { productId: match?.id || "", productCode: match?.productCode || "", productName: match?.name || name || "", banglaName: match?.banglaName || "", quantity: Number(quantity || 1), unitPrice: match?.price || 0, costPrice: match?.costPrice || 0, totalPrice: (match?.price || 0) * Number(quantity || 1), matchedBy: match?.productCode && String(name || "").toUpperCase().includes(String(match.productCode).toUpperCase()) ? "productCode" : match ? "fuzzy" : "manual" } }
function buildProductRowFromRag(pair, ragProducts, catalog) { const quantity = Number(pair.quantity || 1); const productName = String(pair.productName || "").toLowerCase(); const ragMatch = ragProducts.find((item) => item.similarity > 0.6 && (String(item.product_name || "").toLowerCase().includes(productName) || productName.includes(String(item.product_name || "").toLowerCase()))) || ragProducts[0]; if (!ragMatch) return buildProductRow(pair.productName, quantity, catalog); const unitPrice = Number(ragMatch.price || 0); return { productId: ragMatch.product_id || "", productCode: ragMatch.product_code || "", productName: ragMatch.product_name || pair.productName || "", banglaName: ragMatch.bangla_name || "", quantity, unitPrice, costPrice: Number(ragMatch.cost_price || 0), totalPrice: unitPrice * quantity, ragSimilarity: ragMatch.similarity || 0, matchedBy: "rag" } }
function createProductRow() { return { productId: "", productCode: "", matchedBy: "manual", productName: "", banglaName: "", quantity: 1, unitPrice: 0, costPrice: 0, totalPrice: 0 } }
function createEmptyOrder() { return { customerName: "", phone: "", address: "", zoneId: "", zone: "", zoneAutoDetected: false, zoneIsFallback: false, zoneDetectionMethod: "", zoneSimilarity: 0, deliveryCharge: 0, products: [createProductRow()], discount: 0, paymentType: "full_cod", productPaymentMethod: "COD", productPaymentStatus: "Unpaid", productTransactionId: "", deliveryPaymentMethod: "bKash", deliveryPaymentStatus: "Unpaid", deliveryTransactionId: "", paymentMethod: "COD", paymentStatus: "Unpaid", transactionId: "", notes: "" } }
function updateRowFromField(row, field, value, catalog) { if (field !== "productId") return { ...row, [field]: value }; const product = catalog.find((item) => item.id === value); return { ...row, productId: value, productCode: product?.productCode || "", matchedBy: "manual", productName: product?.name || "", banglaName: product?.banglaName || "", unitPrice: product?.price || 0, costPrice: product?.costPrice || 0 } }
function recalcRow(row) { const quantity = Number(row.quantity || 1); const unitPrice = Number(row.unitPrice || 0); return { ...row, quantity, unitPrice, totalPrice: quantity * unitPrice } }
function normalizeProductRows(rows = []) { return rows.length ? rows.map(recalcRow) : [createProductRow()] }
function getPaymentAmounts(type, subtotal, delivery, grandTotal) { if (type === "full_online") return { onlineAmount: grandTotal, codAmount: 0 }; if (type === "delivery_only_online") return { onlineAmount: delivery, codAmount: subtotal }; return { onlineAmount: 0, codAmount: grandTotal } }
function getLegacyPaymentFields(order) { if (order.paymentType === "full_online") return { paymentMethod: order.productPaymentMethod || "bKash", paymentStatus: order.productPaymentStatus || "Unpaid", transactionId: order.productTransactionId || "" }; if (order.paymentType === "delivery_only_online") return { productPaymentMethod: "COD", productPaymentStatus: "Unpaid", paymentMethod: order.deliveryPaymentMethod || "bKash", paymentStatus: order.deliveryPaymentStatus === "Paid" ? "Partial" : "Unpaid", transactionId: order.deliveryTransactionId || "" }; return { paymentMethod: "COD", paymentStatus: "Unpaid", transactionId: "" } }

export default NewOrder





