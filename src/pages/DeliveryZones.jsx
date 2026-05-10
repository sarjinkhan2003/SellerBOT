import { useEffect, useMemo, useState } from "react"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore"
import { Edit2, Loader2, MapPin, PackagePlus, Trash2, X } from "lucide-react"
import toast from "react-hot-toast"
import DistrictSelect from "../components/DistrictSelect.jsx"
import { useAuth } from "../context/AuthContext.jsx"
import { districts } from "../data/districts.js"
import { db } from "../firebase/config.js"
import { detectZone } from "../utils/zoneDetector.js"

const initialForm = {
  charge: "",
  keywords: "",
  isHomeCity: false,
}

function DeliveryZones() {
  const { currentUser } = useAuth()
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState(null)
  const [selectedDistrict, setSelectedDistrict] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [customerAddress, setCustomerAddress] = useState("")
  const [manualZoneId, setManualZoneId] = useState("")

  useEffect(() => {
    if (!currentUser?.uid) {
      return undefined
    }

    const zonesRef = collection(db, "users", currentUser.uid, "deliveryZones")
    const zonesQuery = query(zonesRef, orderBy("createdAt", "asc"))

    const unsubscribe = onSnapshot(
      zonesQuery,
      (snapshot) => {
        setZones(snapshot.docs.map((zoneDoc) => ({ id: zoneDoc.id, ...zoneDoc.data() })))
        setLoading(false)
      },
      (error) => {
        toast.error(error.message || "Could not load delivery zones.")
        setLoading(false)
      },
    )

    return unsubscribe
  }, [currentUser?.uid])

  const detectedZone = useMemo(
    () => detectZone(customerAddress, zones),
    [customerAddress, zones],
  )
  const manualZone = zones.find((zone) => zone.id === manualZoneId) || null
  const activeZone = manualZone || detectedZone

  const openAddModal = () => {
    setEditingZone(null)
    setSelectedDistrict(null)
    setForm(initialForm)
    setIsModalOpen(true)
  }

  const openEditModal = (zone) => {
    setEditingZone(zone)
    setSelectedDistrict(districts.find((district) => district.name === zone.area) || null)
    setForm({
      charge: String(zone.charge ?? ""),
      keywords: (zone.keywords || []).join(", "),
      isHomeCity: Boolean(zone.isHomeCity),
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (saving) {
      return
    }

    setIsModalOpen(false)
    setEditingZone(null)
    setSelectedDistrict(null)
    setForm(initialForm)
  }

  const handleDistrictSelect = (district) => {
    setSelectedDistrict(district)
    setForm((current) => ({
      ...current,
      keywords: district.keywords.join(", "),
    }))
  }

  const handleSave = async (event) => {
    event.preventDefault()

    if (!selectedDistrict) {
      toast.error("Select an area district.")
      return
    }

    const charge = Number(form.charge)

    if (!Number.isFinite(charge) || charge < 0) {
      toast.error("Enter a valid delivery charge.")
      return
    }

    const payload = {
      area: selectedDistrict.name,
      banglaArea: selectedDistrict.bangla,
      division: selectedDistrict.division,
      charge,
      keywords: splitCommaList(form.keywords),
      isHomeCity: form.isHomeCity,
    }

    try {
      setSaving(true)

      if (editingZone) {
        await updateDoc(doc(db, "users", currentUser.uid, "deliveryZones", editingZone.id), payload)
        toast.success("Delivery zone updated.")
      } else {
        await setDoc(doc(collection(db, "users", currentUser.uid, "deliveryZones")), {
          ...payload,
          createdAt: serverTimestamp(),
        })
        toast.success("Delivery zone added.")
      }

      setIsModalOpen(false)
      setEditingZone(null)
      setSelectedDistrict(null)
      setForm(initialForm)
    } catch (error) {
      toast.error(error.message || "Could not save delivery zone.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (zone) => {
    if (!window.confirm(`Delete ${zone.area}? This cannot be undone.`)) {
      return
    }

    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "deliveryZones", zone.id))
      toast.success("Delivery zone deleted.")
    } catch (error) {
      toast.error(error.message || "Could not delete delivery zone.")
    }
  }

  const quickSetup = async () => {
    if (!window.confirm("Generate delivery zones for all Bangladesh districts?")) {
      return
    }

    try {
      const shopSnapshot = await getDoc(doc(db, "users", currentUser.uid, "settings", "shop"))
      const shop = shopSnapshot.data()
      const homeDistrict = districts.find((district) => district.name === shop?.baseCity)

      if (!homeDistrict) {
        toast.error("Set your shop base district before quick setup.")
        return
      }

      const batch = writeBatch(db)
      const zonesRef = collection(db, "users", currentUser.uid, "deliveryZones")

      districts.forEach((district) => {
        const charge = district.name === homeDistrict.name ? 60 : district.division === homeDistrict.division ? 100 : 120
        batch.set(doc(zonesRef), {
          area: district.name,
          banglaArea: district.bangla,
          division: district.division,
          charge,
          keywords: district.keywords,
          isHomeCity: district.name === homeDistrict.name,
          createdAt: serverTimestamp(),
        })
      })

      batch.set(doc(zonesRef), {
        area: "Outside Bangladesh",
        banglaArea: "বিদেশ",
        division: "International",
        charge: 500,
        keywords: ["abroad", "foreign", "international", "বিদেশ"],
        isHomeCity: false,
        createdAt: serverTimestamp(),
      })

      await batch.commit()
      toast.success("Delivery zones generated.")
    } catch (error) {
      toast.error(error.message || "Could not run quick setup.")
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">Delivery</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">Delivery Zones</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Configure area keywords and charges while keeping customer addresses unchanged for orders.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!loading && zones.length === 0 && (
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100" type="button" onClick={quickSetup}>
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Quick Setup
            </button>
          )}
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1D9E75] px-4 text-sm font-semibold text-white transition hover:bg-[#178765]" type="button" onClick={openAddModal}>
            <PackagePlus className="h-4 w-4" aria-hidden="true" />
            Add Zone
          </button>
        </div>
      </div>

      <AddressZonePanel address={customerAddress} activeZone={activeZone} detectedZone={detectedZone} manualZoneId={manualZoneId} onAddressChange={setCustomerAddress} onManualChange={setManualZoneId} zones={zones} />

      {loading ? (
        <div className="flex min-h-52 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#1D9E75]" aria-hidden="true" />
        </div>
      ) : zones.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {zones.map((zone) => <ZoneCard key={zone.id} zone={zone} onEdit={openEditModal} onDelete={handleDelete} />)}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h3 className="text-lg font-semibold text-slate-950">No delivery zones yet.</h3>
          <p className="mt-2 text-sm text-slate-600">Use quick setup or add a custom delivery zone.</p>
        </div>
      )}

      {isModalOpen && (
        <ZoneModal form={form} isEditing={Boolean(editingZone)} saving={saving} selectedDistrict={selectedDistrict} onClose={closeModal} onDistrictSelect={handleDistrictSelect} onFormChange={setForm} onSave={handleSave} />
      )}
    </section>
  )
}

function AddressZonePanel({ address, activeZone, detectedZone, manualZoneId, onAddressChange, onManualChange, zones }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Customer Address</span>
          <textarea className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20" value={address} onChange={(event) => onAddressChange(event.target.value)} placeholder="Paste full address exactly as customer sent it" />
        </label>
        <div className="space-y-3">
          {detectedZone ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Auto-detected: {detectedZone.area}</p>
          ) : (
            <p className="rounded-md bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">No zone matched. Select manually.</p>
          )}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Manual override</span>
            <select className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20" value={manualZoneId} onChange={(event) => onManualChange(event.target.value)}>
              <option value="">Use auto-detected zone</option>
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.area} - ৳{zone.charge}</option>)}
            </select>
          </label>
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-600">Delivery charge: </span>
            <span className="font-semibold text-slate-950">{activeZone ? `৳${activeZone.charge}` : "Not set"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ZoneCard({ zone, onEdit, onDelete }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-950">{zone.area}</h3>
          <p className="mt-1 text-sm font-medium text-[#1D9E75]">{zone.banglaArea}</p>
          <p className="mt-1 text-sm text-slate-500">{zone.division}</p>
        </div>
        {zone.isHomeCity && <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Home City</span>}
      </div>
      <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-600">Charge </span><span className="font-semibold text-slate-950">৳{zone.charge}</span></div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(zone.keywords || []).map((keyword) => <span key={keyword} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{keyword}</span>)}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" type="button" onClick={() => onEdit(zone)}><Edit2 className="h-4 w-4" aria-hidden="true" />Edit</button>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100" type="button" onClick={() => onDelete(zone)}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete</button>
      </div>
    </article>
  )
}

function ZoneModal({ form, isEditing, saving, selectedDistrict, onClose, onDistrictSelect, onFormChange, onSave }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <section className="max-h-full w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-xl font-semibold text-slate-950">{isEditing ? "Edit Zone" : "Add Zone"}</h3>
          <button className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" type="button" onClick={onClose} disabled={saving} aria-label="Close zone modal"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <form className="space-y-5 px-5 py-5" onSubmit={onSave}>
          <DistrictSelect label="Area Name" selectedDistrict={selectedDistrict} onSelect={onDistrictSelect} disabled={saving} />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Delivery Charge (৳)</span>
            <input className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20" type="number" min="0" value={form.charge} onChange={(event) => onFormChange((current) => ({ ...current, charge: event.target.value }))} disabled={saving} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Keywords</span>
            <input className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20" value={form.keywords} onChange={(event) => onFormChange((current) => ({ ...current, keywords: event.target.value }))} disabled={saving} />
          </label>
          <label className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
            <input className="h-4 w-4 accent-[#1D9E75]" type="checkbox" checked={form.isHomeCity} onChange={(event) => onFormChange((current) => ({ ...current, isHomeCity: event.target.checked }))} disabled={saving} />
            Mark as home city zone
          </label>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button className="h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="h-11 rounded-md bg-[#1D9E75] px-4 text-sm font-semibold text-white transition hover:bg-[#178765] disabled:opacity-70" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Zone"}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function splitCommaList(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

export default DeliveryZones
