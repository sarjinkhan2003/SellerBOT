import { useEffect, useState } from "react"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { ArrowLeft, Bot, CheckCircle2, Eye, EyeOff, Languages, Loader2, LockKeyhole, Mail, MapPin, Moon, Phone, ShieldCheck, Store, Sparkles, Sun, UserRound, Wallet } from "lucide-react"
import toast from "react-hot-toast"
import { Link, useNavigate } from "react-router-dom"
import DistrictSelect from "../components/DistrictSelect.jsx"
import { useAuth } from "../context/AuthContext.jsx"
import { useLanguage } from "../context/LanguageContext.jsx"
import { useTheme } from "../context/ThemeContext.jsx"
import { auth, db } from "../firebase/config.js"

const accountInitial = { fullName: "", email: "", password: "", confirmPassword: "" }
const shopInitial = { shopName: "", phone: "", bkash: "", nagad: "", address: "" }

function Register() {
  const { currentUser } = useAuth()
  const { language, toggleLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const [step, setStep] = useState(currentUser ? 2 : 1)
  const [account, setAccount] = useState(accountInitial)
  const [shop, setShop] = useState(shopInitial)
  const [district, setDistrict] = useState(null)
  const [ownerName, setOwnerName] = useState(currentUser?.displayName || "")
  const [email, setEmail] = useState(currentUser?.email || "")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (currentUser) {
      setStep(2)
      setOwnerName(currentUser.displayName || ownerName)
      setEmail(currentUser.email || email)
    }
  }, [currentUser])

  const handleAccountChange = (event) => setAccount((current) => ({ ...current, [event.target.name]: event.target.value }))
  const handleShopChange = (event) => setShop((current) => ({ ...current, [event.target.name]: event.target.value }))

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
      const credential = await createUserWithEmailAndPassword(auth, account.email.trim(), account.password)
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
    <main className="auth-animated-bg relative min-h-screen overflow-hidden px-4 py-6 text-[var(--text-primary)] sm:px-6 lg:px-10">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-grid" />

      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
        <Link className="inline-flex items-center gap-3 text-[var(--text-primary)] no-underline" to="/login">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1D9E75] text-sm font-black text-white shadow-lg shadow-emerald-500/20">SB</span>
          <span>
            <span className="block text-lg font-black gradient-text">SellerBot</span>
            <span className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>AI selling workspace</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link className="btn-secondary btn-sm" to="/login"><ArrowLeft className="h-4 w-4" /> Home</Link>
          <button className="btn-secondary btn-sm" type="button" onClick={toggleLanguage}><Languages className="h-4 w-4" />{language === "en" ? "বাংলা" : "EN"}</button>
          <button className="btn-secondary btn-sm" type="button" onClick={toggleTheme}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-90px)] w-full max-w-7xl items-center gap-8 py-8 lg:grid-cols-[.86fr_1.14fr]">
        <aside className="hidden lg:block">
          <div className="max-w-xl">
            <p className="mb-4 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-emerald-100 backdrop-blur"><Sparkles className="mr-2 h-4 w-4" />Launch your shop command center</p>
            <h1 className="text-5xl font-black leading-tight text-white">Set up SellerBot in two clean steps.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">Create your account, add shop details, then start turning customer chats into invoices, deliveries, and sales records.</p>
            <div className="mt-8 grid gap-3">
              <Feature icon={ShieldCheck} title="Private seller workspace" text="Each seller only sees their own shop, products, orders and settings." />
              <Feature icon={Bot} title="AI-ready order flow" text="Structured and AI chat parsing are ready once your shop setup is complete." />
              <Feature icon={MapPin} title="Bangladesh delivery zones" text="Choose your base district now, then generate delivery zones later." />
            </div>
          </div>
        </aside>

        <section className="auth-card mx-auto w-full max-w-3xl overflow-visible rounded-[28px] border p-5 shadow-2xl sm:p-7 lg:p-8" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
          <BrandHeader step={step} />
          {step === 1 ? (
            <form className="space-y-5" onSubmit={createAccount}>
              <AuthField icon={UserRound} label="Full Name" name="fullName" value={account.fullName} onChange={handleAccountChange} disabled={loading} placeholder="Rahim Mia" />
              <AuthField icon={Mail} label="Email" name="email" value={account.email} onChange={handleAccountChange} type="email" disabled={loading} placeholder="seller@example.com" />
              <div className="grid gap-4 sm:grid-cols-2">
                <PasswordField label="Password" name="password" value={account.password} onChange={handleAccountChange} visible={showPassword} setVisible={setShowPassword} disabled={loading} />
                <PasswordField label="Confirm Password" name="confirmPassword" value={account.confirmPassword} onChange={handleAccountChange} visible={showConfirmPassword} setVisible={setShowConfirmPassword} disabled={loading} />
              </div>
              <SubmitButton loading={loading}>Create Account & Continue</SubmitButton>
              <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>Already registered? <Link className="font-bold text-[#1D9E75]" to="/login">Login here</Link></p>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={completeSetup}>
              <div className="grid gap-4 sm:grid-cols-2">
                <AuthField icon={Store} label="Shop Name" name="shopName" value={shop.shopName} onChange={handleShopChange} disabled={loading} placeholder="Your shop name" />
                <AuthField icon={Phone} label="Phone Number" name="phone" value={shop.phone} onChange={handleShopChange} disabled={loading} placeholder="017XXXXXXXX" />
              </div>
              <div className="district-auth-field"><DistrictSelect label="Base City/District" selectedDistrict={district} onSelect={setDistrict} disabled={loading} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AuthField icon={Wallet} label="bKash Number (optional)" name="bkash" value={shop.bkash} onChange={handleShopChange} disabled={loading} placeholder="01XXXXXXXXX" />
                <AuthField icon={Wallet} label="Nagad Number (optional)" name="nagad" value={shop.nagad} onChange={handleShopChange} disabled={loading} placeholder="01XXXXXXXXX" />
              </div>
              <label className="block">
                <span>Shop Address (optional)</span>
                <textarea className="mt-2 min-h-28" name="address" value={shop.address} onChange={handleShopChange} disabled={loading} placeholder="Shop or pickup address" />
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                {!currentUser && <button className="btn-secondary h-12 flex-1" type="button" onClick={() => setStep(1)} disabled={loading}>Back</button>}
                <SubmitButton loading={loading}>Complete Setup</SubmitButton>
              </div>
            </form>
          )}
        </section>
      </section>
    </main>
  )
}

function BrandHeader({ step }) {
  const progress = step === 1 ? 50 : 100
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1D9E75] text-white shadow-lg shadow-emerald-500/20"><Bot className="h-8 w-8" aria-hidden="true" /></div>
          <div><p className="text-sm font-black uppercase tracking-wide text-[#1D9E75]">SellerBot</p><h1 className="text-2xl font-black sm:text-3xl">Create Seller Account</h1></div>
        </div>
        <span className="badge badge-primary self-start sm:self-center">Step {step} of 2</span>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <StepChip active={step === 1} done={step > 1} title="Account" text="Name, email and password" />
        <StepChip active={step === 2} done={false} title="Shop Setup" text="Base city and payment numbers" />
      </div>
      <div className="progress-bar mt-5 h-2"><div className="progress-fill" style={{ width: String(progress) + "%" }} /></div>
    </div>
  )
}

function StepChip({ active, done, title, text }) {
  return <div className={(active ? "glow-border " : "") + "rounded-2xl border p-4"} style={{ borderColor: active ? "var(--primary)" : "var(--border)", background: active ? "var(--primary-light)" : "var(--bg-secondary)" }}><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1D9E75] text-white">{done ? <CheckCircle2 className="h-5 w-5" /> : title.slice(0, 1)}</span><span><span className="block font-black">{title}</span><span className="block text-xs" style={{ color: "var(--text-secondary)" }}>{text}</span></span></div></div>
}

function AuthField({ icon: Icon, label, name, value, onChange, type = "text", disabled, placeholder }) {
  return <label className="block"><span>{label}</span><span className="mt-2 flex items-center gap-3 rounded-xl border bg-[var(--bg-primary)] px-3 py-2.5 focus-within:border-[#1D9E75] focus-within:ring-2 focus-within:ring-[#1D9E75]/20" style={{ borderColor: "var(--border)" }}><Icon className="h-5 w-5 text-slate-400" /><input className="border-0 bg-transparent p-0 shadow-none focus:ring-0" name={name} type={type} value={value} onChange={onChange} disabled={disabled} placeholder={placeholder} /></span></label>
}

function PasswordField({ label, name, value, onChange, visible, setVisible, disabled }) {
  return <label className="block"><span>{label}</span><span className="mt-2 flex items-center gap-3 rounded-xl border bg-[var(--bg-primary)] px-3 py-2.5 focus-within:border-[#1D9E75] focus-within:ring-2 focus-within:ring-[#1D9E75]/20" style={{ borderColor: "var(--border)" }}><LockKeyhole className="h-5 w-5 text-slate-400" /><input className="border-0 bg-transparent p-0 shadow-none focus:ring-0" name={name} type={visible ? "text" : "password"} value={value} onChange={onChange} disabled={disabled} placeholder="********" /><button type="button" className="text-slate-400" onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
}

function Feature({ icon: Icon, title, text }) {
  return <div className="glass rounded-2xl p-4 text-white"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-200"><Icon className="h-5 w-5" /></span><span><span className="block font-black">{title}</span><span className="mt-1 block text-sm leading-6 text-slate-300">{text}</span></span></div></div>
}

function SubmitButton({ children, loading }) {
  return <button className="btn-primary h-12 flex-1" type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{children}</button>
}

function getRegisterError(error) {
  switch (error.code) {
    case "auth/email-already-in-use": return "An account already exists for this email."
    case "auth/invalid-email": return "Enter a valid email address."
    case "auth/weak-password": return "Use a password with at least 6 characters."
    default: return error.message || "Registration failed. Please try again."
  }
}

export default Register
