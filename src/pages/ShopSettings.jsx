import { useEffect, useRef, useState } from "react"
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import { Loader2, Save, Upload } from "lucide-react"
import toast from "react-hot-toast"
import DistrictSelect from "../components/DistrictSelect.jsx"
import { districts } from "../data/districts.js"
import { useAuth } from "../context/AuthContext.jsx"
import { db } from "../firebase/config.js"
import { uploadShopLogo } from "../utils/logoUpload.js"

const initialForm = {
  shopName: "",
  ownerName: "",
  phone: "",
  bkash: "",
  nagad: "",
  email: "",
  address: "",
  logoURL: "",
}

function ShopSettings() {
  const { currentUser } = useAuth()
  const fileInputRef = useRef(null)
  const [form, setForm] = useState(initialForm)
  const [district, setDistrict] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    let active = true
    getDoc(doc(db, "users", currentUser.uid, "settings", "shop"))
      .then((snapshot) => {
        if (!active) return
        const data = snapshot.data() || {}
        setForm({
          shopName: data.shopName || "",
          ownerName: data.ownerName || currentUser.displayName || "",
          phone: data.phone || "",
          bkash: data.bkash || "",
          nagad: data.nagad || "",
          email: data.email || currentUser.email || "",
          address: data.address || "",
          logoURL: data.logoURL || "",
        })
        setDistrict(districts.find((item) => item.name === data.baseCity) || null)
        setLoading(false)
      })
      .catch((error) => {
        toast.error(error.message || "Could not load shop settings.")
        setLoading(false)
      })
    return () => { active = false }
  }, [currentUser])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setUploadingLogo(true)
      const logoURL = await uploadShopLogo(currentUser.uid, file)
      setForm((current) => ({ ...current, logoURL }))
      toast.success("Logo uploaded.")
    } catch (error) {
      toast.error(error.message || "Could not upload logo.")
    } finally {
      setUploadingLogo(false)
      event.target.value = ""
    }
  }

  const removeLogo = async () => {
    try {
      setUploadingLogo(true)
      await setDoc(doc(db, "users", currentUser.uid, "settings", "shop"), { logoURL: "", updatedAt: serverTimestamp() }, { merge: true })
      setForm((current) => ({ ...current, logoURL: "" }))
      toast.success("Logo removed.")
    } catch (error) {
      toast.error(error.message || "Could not remove logo.")
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!form.shopName.trim() || !form.ownerName.trim() || !form.phone.trim() || !district) {
      toast.error("Shop name, owner name, phone, and base district are required.")
      return
    }
    try {
      setSaving(true)
      await setDoc(doc(db, "users", currentUser.uid, "settings", "shop"), {
        shopName: form.shopName.trim(),
        ownerName: form.ownerName.trim(),
        baseCity: district.name,
        baseCityBangla: district.bangla,
        baseCityDivision: district.division,
        phone: form.phone.trim(),
        bkash: form.bkash.trim(),
        nagad: form.nagad.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        logoURL: form.logoURL,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      toast.success("Shop settings saved.")
    } catch (error) {
      toast.error(error.message || "Could not save shop settings.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-52 items-center justify-center rounded-lg border border-slate-200 bg-white"><Loader2 className="h-8 w-8 animate-spin text-[#1D9E75]" aria-hidden="true" /></div>
  }

  const initials = (form.shopName || "SB").split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">Settings</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">Shop Settings</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Keep seller profile, payment numbers, logo, and base district ready for invoices and delivery automation.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {form.logoURL ? <img className="h-[100px] w-[100px] rounded-full object-cover" src={form.logoURL} alt="Shop logo" /> : <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-[#1D9E75] text-2xl font-bold text-white">{initials}</div>}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-950">Shop Logo</h3>
            <div className="flex flex-wrap gap-3">
              <input ref={fileInputRef} className="hidden" type="file" accept="image/*" onChange={handleLogoUpload} />
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1D9E75] px-4 text-sm font-semibold text-white disabled:opacity-70" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload Logo
              </button>
              {form.logoURL && <button className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700" type="button" onClick={removeLogo} disabled={uploadingLogo}>Remove Logo</button>}
            </div>
            {uploadingLogo && <p className="text-sm text-slate-500">Uploading...</p>}
          </div>
        </div>
      </div>

      <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={handleSave}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Shop Name" name="shopName" value={form.shopName} onChange={handleChange} disabled={saving} />
          <Field label="Owner Name" name="ownerName" value={form.ownerName} onChange={handleChange} disabled={saving} />
          <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} disabled={saving} />
          <Field label="Email" name="email" value={form.email} onChange={handleChange} type="email" disabled={saving} />
          <Field label="bKash" name="bkash" value={form.bkash} onChange={handleChange} disabled={saving} />
          <Field label="Nagad" name="nagad" value={form.nagad} onChange={handleChange} disabled={saving} />
        </div>
        <div className="mt-5"><DistrictSelect label="Base City/District" selectedDistrict={district} onSelect={setDistrict} disabled={saving} /></div>
        <label className="mt-5 block"><span className="text-sm font-medium text-slate-700">Shop Address</span><textarea className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20" name="address" value={form.address} onChange={handleChange} disabled={saving} /></label>
        <button className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1D9E75] px-4 text-sm font-semibold text-white transition hover:bg-[#178765] disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}Save Changes</button>
      </form>
    </section>
  )
}

function Field({ label, name, value, onChange, type = "text", disabled }) {
  return <label className="block"><span className="text-sm font-medium text-slate-700">{label}</span><input className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20" name={name} type={type} value={value} onChange={onChange} disabled={disabled} /></label>
}

export default ShopSettings
