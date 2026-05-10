import { useEffect, useState } from "react"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { Bot, Loader2 } from "lucide-react"
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom"
import DistrictSelect from "../components/DistrictSelect.jsx"
import { useAuth } from "../context/AuthContext.jsx"
import { auth, db } from "../firebase/config.js"

const accountInitial = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
}

const shopInitial = {
  shopName: "",
  phone: "",
  bkash: "",
  nagad: "",
  address: "",
}

function Register() {
  const { currentUser } = useAuth()
  const [step, setStep] = useState(currentUser ? 2 : 1)
  const [account, setAccount] = useState(accountInitial)
  const [shop, setShop] = useState(shopInitial)
  const [district, setDistrict] = useState(null)
  const [ownerName, setOwnerName] = useState(currentUser?.displayName || "")
  const [email, setEmail] = useState(currentUser?.email || "")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (currentUser) {
      setStep(2)
      setOwnerName(currentUser.displayName || ownerName)
      setEmail(currentUser.email || email)
    }
  }, [currentUser])

  const handleAccountChange = (event) => {
    const { name, value } = event.target
    setAccount((current) => ({ ...current, [name]: value }))
  }

  const handleShopChange = (event) => {
    const { name, value } = event.target
    setShop((current) => ({ ...current, [name]: value }))
  }

  const createAccount = async (event) => {
    event.preventDefault()

    if (!account.fullName.trim() || !account.email.trim() || !account.password) {
      toast.error("Fill in your name, email, and password.")
      return
    }

    if (account.password !== account.confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }

    try {
      setLoading(true)
      const credential = await createUserWithEmailAndPassword(
        auth,
        account.email.trim(),
        account.password,
      )
      await updateProfile(credential.user, { displayName: account.fullName.trim() })
      setOwnerName(account.fullName.trim())
      setEmail(account.email.trim())
      toast.success("Account created. Set up your shop next.")
      setStep(2)
    } catch (error) {
      toast.error(getRegisterError(error))
    } finally {
      setLoading(false)
    }
  }

  const completeSetup = async (event) => {
    event.preventDefault()

    const activeUser = auth.currentUser

    if (!activeUser) {
      toast.error("Create your account first.")
      setStep(1)
      return
    }

    if (!shop.shopName.trim() || !shop.phone.trim() || !district) {
      toast.error("Shop name, phone number, and base district are required.")
      return
    }

    try {
      setLoading(true)
      await setDoc(doc(db, "users", activeUser.uid, "settings", "shop"), {
        shopName: shop.shopName.trim(),
        ownerName: ownerName || activeUser.displayName || "",
        baseCity: district.name,
        baseCityBangla: district.bangla,
        baseCityDivision: district.division,
        phone: shop.phone.trim(),
        bkash: shop.bkash.trim(),
        nagad: shop.nagad.trim(),
        email: email || activeUser.email || "",
        address: shop.address.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      toast.success("Shop setup complete.")
      navigate("/dashboard", { replace: true })
    } catch (error) {
      toast.error(error.message || "Could not save shop settings.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <section className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <BrandHeader step={step} />

        {step === 1 ? (
          <form className="space-y-5" onSubmit={createAccount}>
            <Field label="Full Name" name="fullName" value={account.fullName} onChange={handleAccountChange} disabled={loading} />
            <Field label="Email" name="email" value={account.email} onChange={handleAccountChange} type="email" disabled={loading} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password" name="password" value={account.password} onChange={handleAccountChange} type="password" disabled={loading} />
              <Field label="Confirm Password" name="confirmPassword" value={account.confirmPassword} onChange={handleAccountChange} type="password" disabled={loading} />
            </div>
            <SubmitButton loading={loading}>Next</SubmitButton>
          </form>
        ) : (
          <form className="space-y-5" onSubmit={completeSetup}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Shop Name" name="shopName" value={shop.shopName} onChange={handleShopChange} disabled={loading} />
              <Field label="Phone Number" name="phone" value={shop.phone} onChange={handleShopChange} disabled={loading} />
            </div>
            <DistrictSelect label="Base City/District" selectedDistrict={district} onSelect={setDistrict} disabled={loading} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="bKash Number (optional)" name="bkash" value={shop.bkash} onChange={handleShopChange} disabled={loading} />
              <Field label="Nagad Number (optional)" name="nagad" value={shop.nagad} onChange={handleShopChange} disabled={loading} />
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Shop Address (optional)</span>
              <textarea className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20" name="address" value={shop.address} onChange={handleShopChange} disabled={loading} />
            </label>
            <SubmitButton loading={loading}>Complete Setup</SubmitButton>
          </form>
        )}
      </section>
    </main>
  )
}

function BrandHeader({ step }) {
  return (
    <div className="mb-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#1D9E75] text-white">
        <Bot className="h-7 w-7" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">SellerBot</p>
      <h1 className="mt-2 text-3xl font-semibold">Create Seller Account</h1>
      <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
        <span className={step === 1 ? "text-[#1D9E75]" : "text-slate-400"}>Step 1 of 2</span>
        <span className="h-px w-10 bg-slate-200" />
        <span className={step === 2 ? "text-[#1D9E75]" : "text-slate-400"}>Step 2 of 2</span>
      </div>
    </div>
  )
}

function Field({ label, name, value, onChange, type = "text", disabled }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20" name={name} type={type} value={value} onChange={onChange} disabled={disabled} />
    </label>
  )
}

function SubmitButton({ children, loading }) {
  return (
    <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1D9E75] px-4 text-sm font-semibold text-white transition hover:bg-[#178765] disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={loading}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

function getRegisterError(error) {
  switch (error.code) {
    case "auth/email-already-in-use":
      return "An account already exists for this email."
    case "auth/invalid-email":
      return "Enter a valid email address."
    case "auth/weak-password":
      return "Use a password with at least 6 characters."
    default:
      return error.message || "Registration failed. Please try again."
  }
}

export default Register
