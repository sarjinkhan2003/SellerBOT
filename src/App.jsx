import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { useEffect, useState } from "react"
import { KeyRound, Sparkles, X } from "lucide-react"
import ErrorBoundary from "./components/ErrorBoundary.jsx"
import InstallPrompt from "./components/InstallPrompt.jsx"
import Navbar from "./components/Navbar.jsx"
import ProtectedRoute from "./components/ProtectedRoute.jsx"
import { AuthProvider, useAuth } from "./context/AuthContext.jsx"
import { LanguageProvider } from "./context/LanguageContext.jsx"
import { ThemeProvider } from "./context/ThemeContext.jsx"
import Dashboard from "./pages/Dashboard.jsx"
import AIUsage from "./pages/AIUsage.jsx"
import DeliveryInventory from "./pages/DeliveryInventory.jsx"
import DeliveryZones from "./pages/DeliveryZones.jsx"
import Login from "./pages/Login.jsx"
import NewOrder from "./pages/NewOrder.jsx"
import Orders from "./pages/Orders.jsx"
import Products from "./pages/Products.jsx"
import Register from "./pages/Register.jsx"
import Sales from "./pages/Sales.jsx"
import ShopSettings from "./pages/ShopSettings.jsx"
import { getAISettings } from "./utils/aiUsage.js"

function AppShell() {
  return (
    <div className="page">
      <Navbar />
      <GroqKeyPrompt />
      <main className="page-content">
        <Outlet />
      </main>
    </div>
  )
}


function GroqKeyPrompt() {
  const { currentUser } = useAuth()
  const [show, setShow] = useState(false)
  const [checking, setChecking] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    let active = true
    setChecking(true)
    getAISettings(currentUser.uid).then((settings) => {
      if (!active) return
      const dismissedKey = "sellerbot-groq-key-reminder-" + currentUser.uid
      const dismissedThisSession = sessionStorage.getItem(dismissedKey) === "1"
      setShow(!settings?.groqApiKey && !dismissedThisSession && location.pathname !== "/ai-usage")
    }).finally(() => {
      if (active) setChecking(false)
    })
    return () => { active = false }
  }, [currentUser?.uid, location.pathname])

  if (checking || !show) return null

  const dismiss = () => {
    if (currentUser?.uid) sessionStorage.setItem("sellerbot-groq-key-reminder-" + currentUser.uid, "1")
    setShow(false)
  }

  const openSettings = () => {
    dismiss()
    navigate("/ai-usage")
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-3xl border bg-[var(--bg-card)] p-6 shadow-2xl" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1D9E75]/15 text-[#1D9E75]">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#1D9E75]">AI Setup</p>
              <h2 className="mt-1 text-xl font-black">Add your Groq API key</h2>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                Unstructured chat parsing works best when each seller uses their own Groq key. You can add it now, or continue and set it later from Profile - AI Token Usage.
              </p>
            </div>
          </div>
          <button className="btn-ghost btn-icon" type="button" onClick={dismiss} aria-label="Close API key reminder"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5 rounded-2xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
          <Sparkles className="mr-2 inline h-4 w-4 text-[#1D9E75]" />Your key is saved only in your seller settings and used for your own AI parsing requests.
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button className="btn-primary flex-1" type="button" onClick={openSettings}>Set API Key</button>
          <button className="btn-secondary flex-1" type="button" onClick={dismiss}>Later</button>
        </div>
      </section>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/delivery-zones" element={<DeliveryZones />} />
                  <Route path="/delivery-inventory" element={<DeliveryInventory />} />
                  <Route path="/shop-settings" element={<ShopSettings />} />
                  <Route path="/new-order" element={<NewOrder />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/ai-usage" element={<AIUsage />} />
                </Route>
              </Routes>
              <InstallPrompt />
              <Toaster position="top-right" />
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </LanguageProvider>
    </ThemeProvider>
  )
}

export default App
