import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { collection, onSnapshot, orderBy, query } from "firebase/firestore"
import { Download, Eye, PackageCheck } from "lucide-react"
import toast from "react-hot-toast"
import * as XLSX from "xlsx"
import { useAuth } from "../context/AuthContext.jsx"
import { db } from "../firebase/config.js"
import { updateDeliveryStatus } from "../utils/inventoryManager.js"

const statuses = ["All", "Pending", "Delivered", "Not Delivered", "Returned", "Cancelled"]
const statusValues = {
  Pending: "pending",
  Delivered: "delivered",
  "Not Delivered": "not_delivered",
  Returned: "returned",
  Cancelled: "cancelled",
}
const statusLabels = {
  pending: "Pending",
  delivered: "Delivered",
  not_delivered: "Not Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
}

function DeliveryInventory() {
  const { t } = useTranslation()
  const { currentUser } = useAuth()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState("All")
  const [selected, setSelected] = useState(null)
  const [updatingId, setUpdatingId] = useState("")

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    return onSnapshot(
      query(collection(db, "users", currentUser.uid, "deliveryInventory"), orderBy("createdAt", "desc")),
      (snapshot) => setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => toast.error(error.message || "Could not load delivery inventory."),
    )
  }, [currentUser?.uid])

  const filteredItems = useMemo(() => {
    if (filter === "All") return items
    return items.filter((item) => item.deliveryStatus === statusValues[filter])
  }, [filter, items])

  const changeStatus = async (item, status) => {
    if (!currentUser?.uid || item.deliveryStatus === status) return
    try {
      setUpdatingId(item.id)
      const result = await updateDeliveryStatus(currentUser.uid, item.id, status, item)
      if (!result.success) throw new Error(result.error || "Could not update status")
      toast.success(`Delivery marked as ${statusLabels[status]}.`)
    } catch (error) {
      toast.error(error.message || "Could not update delivery status.")
    } finally {
      setUpdatingId("")
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">{t("delivery.title")}</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">{t("delivery.title")}</h2>
          <p className="mt-2 text-sm text-slate-600">{t("delivery.subtitle")}</p>
        </div>
        <button className="btn-outline inline-flex items-center gap-2" type="button" onClick={() => exportDeliveryToExcel(filteredItems)} disabled={!filteredItems.length}>
          <Download className="h-4 w-4" /> {t("delivery.exportExcel")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3">
        {statuses.map((status) => (
          <button key={status} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === status ? "bg-[#1D9E75] text-white" : "bg-slate-100 text-slate-700"}`} type="button" onClick={() => setFilter(status)}>{status}</button>
        ))}
      </div>

      {filteredItems.length ? (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>{["Order #", "Date", "Customer", "Phone", "Zone", "Products", "Total", "Status", "Actions"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold">{item.orderNumber}</td>
                  <td className="px-4 py-3">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">{item.customerName}</td>
                  <td className="px-4 py-3">{item.phone}</td>
                  <td className="px-4 py-3">{item.zone}</td>
                  <td className="px-4 py-3"><ProductPills products={item.products} /></td>
                  <td className="px-4 py-3">৳{item.grandTotal || 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.deliveryStatus} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select className="h-9 rounded-md border px-2 text-xs" value={item.deliveryStatus || "pending"} disabled={updatingId === item.id} onChange={(event) => changeStatus(item, event.target.value)}>
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>Mark as {label}</option>)}
                      </select>
                      <button className="text-slate-700" type="button" onClick={() => setSelected(item)}><Eye className="mr-1 inline h-4 w-4" />View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card py-12 text-center">
          <PackageCheck className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 text-lg font-semibold">{t("delivery.noDeliveries")}</h3>
          <p className="mt-2 text-sm text-slate-600">Orders appear here when saved from New Order.</p>
        </div>
      )}

      {selected && <DetailsModal item={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}

function ProductPills({ products = [] }) {
  return <div className="flex flex-wrap gap-1">{products.map((product, index) => <span key={`${product.productId || product.productName}-${index}`} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">[{product.productCode || product.productName} x {product.quantity || 1}]</span>)}</div>
}

function StatusBadge({ status = "pending" }) {
  const styles = {
    pending: "bg-blue-50 text-blue-800",
    delivered: "bg-emerald-50 text-emerald-800",
    not_delivered: "bg-red-50 text-red-800",
    returned: "bg-orange-50 text-orange-800",
    cancelled: "bg-slate-100 text-slate-700",
  }
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status] || styles.pending}`}>{statusLabels[status] || "Pending"}</span>
}

function DetailsModal({ item, onClose }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-4 py-6"><section className="mx-auto max-w-3xl rounded-lg bg-white p-5"><div className="mb-4 flex justify-between"><h3 className="text-xl font-semibold">Delivery Details</h3><button className="btn-outline" onClick={onClose}>Close</button></div><div className="space-y-3 text-sm"><p><b>Order:</b> {item.orderNumber}</p><p><b>Customer:</b> {item.customerName} / {item.phone}</p><p className="whitespace-pre-wrap"><b>Address:</b> {item.address}</p><p><b>Zone:</b> {item.zone}</p><p><b>Status:</b> {statusLabels[item.deliveryStatus]}</p>{(item.products || []).map((product, index) => <p key={index} className="rounded bg-slate-50 p-2">[{product.productCode || "-"}] {product.productName} x {product.quantity}</p>)}</div></section></div>
}

function formatDate(value) {
  if (!value) return ""
  const date = value.toDate ? value.toDate() : new Date(value)
  return date.toLocaleDateString("en-GB")
}

function exportDeliveryToExcel(items) {
  const data = items.map((item) => ({
    "Order #": item.orderNumber,
    Date: formatDate(item.createdAt),
    Customer: item.customerName,
    Phone: item.phone,
    Address: item.address,
    Zone: item.zone,
    Products: (item.products || []).map((product) => `${product.productCode || product.productName} x${product.quantity}`).join(", "),
    Status: item.deliveryStatus,
    "Delivered At": item.deliveredAt ? formatDate(item.deliveredAt) : "-",
  }))
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Delivery")
  XLSX.writeFile(workbook, `SellerBot-Delivery-${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}.xlsx`)
}

export default DeliveryInventory
