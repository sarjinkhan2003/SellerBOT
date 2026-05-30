import { useState } from "react"
import { signInWithEmailAndPassword } from "firebase/auth"
import { Bot, Eye, EyeOff, Loader2, LockKeyhole, Mail, Moon, Sparkles, Sun, Zap } from "lucide-react"
import toast from "react-hot-toast"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "../context/AuthContext.jsx"
import { useLanguage } from "../context/LanguageContext.jsx"
import { useTheme } from "../context/ThemeContext.jsx"
import { auth } from "../firebase/config.js"

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loadingLogin, setLoadingLogin] = useState(false)
  const { currentUser, loading } = useAuth()
  const { t } = useTranslation()
  const { language, toggleLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  if (!loading && currentUser) return <Navigate to="/dashboard" replace />

  const handleLogin = async (event) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      toast.error("Enter your email and password.")
      return
    }
    try {
      setLoadingLogin(true)
      await signInWithEmailAndPassword(auth, email.trim(), password)
      if (remember) localStorage.setItem("sellerbot-last-email", email.trim())
      toast.success("Welcome back to SellerBot.")
      navigate("/dashboard", { replace: true })
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setLoadingLogin(false)
    }
  }

  return (
    <main className="auth-animated-bg relative grid min-h-screen overflow-hidden text-[var(--text-primary)] lg:grid-cols-[1.05fr_.95fr]"><div className="auth-orb auth-orb-one" /><div className="auth-orb auth-orb-two" /><div className="auth-grid" />
      <section className="relative z-10 hidden overflow-hidden bg-slate-950/80 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(29,158,117,.35),transparent_28rem),radial-gradient(circle_at_80%_30%,rgba(6,182,212,.25),transparent_24rem)]" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1D9E75] text-lg font-black">SB</div>
          <div><p className="text-2xl font-black">SellerBot</p><p className="text-sm text-emerald-100">স্মার্ট F-commerce POS</p></div>
        </div>
        <div className="relative z-10 max-w-xl">
          <p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-emerald-100 backdrop-blur"><Sparkles className="mr-2 h-4 w-4" />AI powered selling desk</p>
          <h1 className="text-5xl font-black leading-tight">{t("auth.tagline")}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">Paste chats, detect products, manage delivery, track sales, and generate invoices from one installable mobile-first workspace.</p>
          <div className="mt-8 grid gap-3 text-sm font-semibold text-slate-100">
            {["Bangla, English and Banglish parsing", "RAG powered product search", "PDF, image and print invoices"].map((item) => <p key={item} className="glass rounded-xl px-4 py-3"><Zap className="mr-2 inline h-4 w-4 text-emerald-300" />{item}</p>)}
          </div>
        </div>
        <div className="relative z-10 space-y-1 text-sm text-slate-400"><p>Built for Bangladeshi Facebook and WhatsApp sellers.</p><p className="font-semibold text-emerald-200">Developed by Team ParityCode.</p></div>
      </section>

      <section className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border bg-[var(--bg-card)] p-6 shadow-2xl sm:p-8" style={{ borderColor: "var(--border)" }}>
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1D9E75] text-white shadow-lg shadow-emerald-500/20"><Bot className="h-8 w-8" /></div>
            <p className="text-sm font-black uppercase tracking-wide text-[#1D9E75]">SellerBot</p>
            <h1 className="mt-2 text-3xl font-black">{t("auth.welcome")}</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>{t("auth.tagline")}</p>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            <Field label={t("auth.email")} icon={Mail} type="email" value={email} onChange={setEmail} placeholder="seller@example.com" disabled={loadingLogin} />
            <label className="block">
              <span>{t("auth.password")}</span>
              <span className="mt-2 flex items-center gap-3 rounded-xl border bg-[var(--bg-primary)] px-3 py-2.5 focus-within:border-[#1D9E75] focus-within:ring-2 focus-within:ring-[#1D9E75]/20" style={{ borderColor: "var(--border)" }}>
                <LockKeyhole className="h-5 w-5 text-slate-400" />
                <input className="border-0 bg-transparent p-0 shadow-none focus:ring-0" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" disabled={loadingLogin} />
                <button type="button" className="text-slate-400" onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}><input className="h-4 w-4" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />{t("auth.rememberMe")}</label>
            <button className="btn-primary btn-full h-12" type="submit" disabled={loadingLogin}>{loadingLogin && <Loader2 className="h-4 w-4 animate-spin" />}{t("auth.loginBtn")}</button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase" style={{ color: "var(--text-tertiary)" }}><span className="h-px flex-1 bg-[var(--border)]" />or<span className="h-px flex-1 bg-[var(--border)]" /></div>
          <Link className="btn-outline btn-full" to="/register">{t("auth.register")}</Link>
          <Link className="btn-secondary btn-full mt-3" to="/docs">View Docs & Pitch Deck</Link>

          <p className="mt-6 text-center text-xs font-semibold" style={{ color: "var(--text-tertiary)" }}>Developed by Team ParityCode.</p>

          <div className="mt-4 flex justify-center gap-2">
            <button className="btn-secondary btn-sm" type="button" onClick={toggleLanguage}>{language === "en" ? "বাংলা" : "English"}</button>
            <button className="btn-secondary btn-sm" type="button" onClick={toggleTheme}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{theme === "dark" ? t("common.lightMode") : t("common.darkMode")}</button>
          </div>
        </div>
      </section>
    </main>
  )
}

function Field({ label, icon: Icon, type, value, onChange, placeholder, disabled }) {
  return <label className="block"><span>{label}</span><span className="mt-2 flex items-center gap-3 rounded-xl border bg-[var(--bg-primary)] px-3 py-2.5 focus-within:border-[#1D9E75] focus-within:ring-2 focus-within:ring-[#1D9E75]/20" style={{ borderColor: "var(--border)" }}><Icon className="h-5 w-5 text-slate-400" /><input className="border-0 bg-transparent p-0 shadow-none focus:ring-0" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} /></span></label>
}

function getAuthErrorMessage(error) {
  switch (error.code) {
    case "auth/invalid-email": return "Enter a valid email address."
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password": return "Email or password is incorrect."
    default: return error.message || "Login failed. Please try again."
  }
}

export default Login
