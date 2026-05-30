import { useEffect, useMemo, useState } from "react"
import { Activity, KeyRound, RefreshCw, Save, ShieldAlert } from "lucide-react"
import toast from "react-hot-toast"
import { useAuth } from "../context/AuthContext.jsx"
import { DEFAULT_GROQ_MODEL, GROQ_MODEL_OPTIONS, getAISettings, getDisplayAIUsage, getStoredAIUsage, saveAISettings } from "../utils/aiUsage.js"

function AIUsage() {
  const { currentUser } = useAuth()
  const [usage, setUsage] = useState(() => getStoredAIUsage())
  const [form, setForm] = useState({ groqApiKey: "", groqModel: "", maxTokens: 800 })
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const displayUsage = getDisplayAIUsage(usage, form.groqModel || DEFAULT_GROQ_MODEL)
  const tokenPercent = percent(displayUsage.usedTokens, displayUsage.tokenLimit)
  const requestPercent = percent(displayUsage.usedRequests, displayUsage.requestLimit)

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    getAISettings(currentUser.uid).then((settings) => setForm({
      groqApiKey: settings.groqApiKey || "",
      groqModel: settings.groqModel || import.meta.env.VITE_GROQ_MODEL || DEFAULT_GROQ_MODEL,
      maxTokens: settings.maxTokens || Number(import.meta.env.VITE_GROQ_MAX_COMPLETION_TOKENS || 800),
    }))
    const onUsage = (event) => setUsage(event.detail || getStoredAIUsage())
    const onStorage = () => setUsage(getStoredAIUsage())
    window.addEventListener("sellerbot-ai-usage-updated", onUsage)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("sellerbot-ai-usage-updated", onUsage)
      window.removeEventListener("storage", onStorage)
    }
  }, [currentUser?.uid])

  const keyStatus = useMemo(() => form.groqApiKey ? "Personal key active" : import.meta.env.VITE_GROQ_API_KEY ? "Using app fallback key" : "No key configured", [form.groqApiKey])

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const save = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      await saveAISettings(currentUser.uid, form)
      toast.success("AI settings saved.")
    } catch (error) {
      toast.error(error.message || "Could not save AI settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">AI Usage</p>
        <h2 className="text-3xl font-semibold">AI Token Usage</h2>
        <p className="text-sm text-slate-600">Track Groq rate limits and let each seller use their own API key.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <UsageCard title="Token Limit" icon={Activity} used={displayUsage.usedTokens} limit={displayUsage.tokenLimit} remaining={displayUsage.remainingTokens} reset={displayUsage.resetTokens} percent={tokenPercent} unit="tokens" />
        <UsageCard title="Request Limit" icon={RefreshCw} used={displayUsage.usedRequests} limit={displayUsage.requestLimit} remaining={displayUsage.remainingRequests} reset={displayUsage.resetRequests} percent={requestPercent} unit="requests" />
      </div>

      <div className="card space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Current AI Limit Snapshot</h3>
            <p className="text-sm text-slate-600">This updates after each unstructured AI parse. Groq resets token limits per minute.</p>
          </div>
          <span className="badge badge-blue">{displayUsage.model || form.groqModel || "No model yet"}</span>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Info label="Last updated" value={displayUsage.updatedAt ? new Date(displayUsage.updatedAt).toLocaleString() : "Estimated from selected model"} />
          <Info label="Source" value={displayUsage.source || "estimated"} />
          <Info label="Reset" value={displayUsage.resetTokens || displayUsage.resetRequests || "per minute"} />
        </div>
      </div>

      <form className="card space-y-4" onSubmit={save}>
        <div className="flex items-start gap-3">
          <KeyRound className="mt-1 h-5 w-5 text-[#1D9E75]" />
          <div>
            <h3 className="text-lg font-semibold">Personal Groq API Settings</h3>
            <p className="text-sm text-slate-600">If saved, SellerBot will use this seller's key for AI parsing instead of the app fallback key.</p>
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert className="mr-2 inline h-4 w-4" />For this prototype, the key is saved in this seller's Firestore settings. Use Firebase rules so users can only read their own settings.
        </div>
        <label>
          <span>Groq API Key</span>
          <div className="mt-2 flex gap-2">
            <input type={showKey ? "text" : "password"} value={form.groqApiKey} onChange={(event) => update("groqApiKey", event.target.value)} placeholder="gsk_..." autoComplete="off" />
            <button className="btn-outline" type="button" onClick={() => setShowKey((current) => !current)}>{showKey ? "Hide" : "Show"}</button>
          </div>
          <span className="mt-1 block text-xs text-slate-500">Status: {keyStatus}</span>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label><span>Groq Model</span><select value={form.groqModel || DEFAULT_GROQ_MODEL} onChange={(event) => update("groqModel", event.target.value)}>{GROQ_MODEL_OPTIONS.map((model) => <option key={model.value} value={model.value}>{model.label} - {model.description}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Limit shown below uses this selected model. Browser mode estimates usage when Groq hides real headers.</span></label>
          <label><span>Max Output Tokens Per Parse</span><input type="number" min="100" max="4000" value={form.maxTokens} onChange={(event) => update("maxTokens", event.target.value)} /></label>
        </div>
        <button className="btn-primary" type="submit" disabled={saving}><Save className="h-4 w-4" />{saving ? "Saving..." : "Save AI Settings"}</button>
      </form>
    </section>
  )
}

function UsageCard({ title, icon: Icon, used, limit, remaining, reset, percent, unit }) {
  const barClass = percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-[#1D9E75]"
  const width = Math.min(100, percent) + "%"
  return <div className="card space-y-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{title}</p><h3 className="mt-1 text-2xl font-bold">{limit ? used + " / " + limit : "No data yet"}</h3></div><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1D9E75]/10 text-[#1D9E75]"><Icon className="h-5 w-5" /></div></div><div className="h-4 overflow-hidden rounded-full bg-slate-100"><div className={"h-full rounded-full " + barClass} style={{ width }} /></div><div className="flex flex-wrap justify-between gap-3 text-sm text-slate-600"><span>{percent}% used</span><span>{remaining || 0} {unit} remaining</span><span>Reset: {reset || "Unknown"}</span></div></div>
}
function Info({ label, value }) { return <div className="rounded-lg bg-[var(--bg-secondary)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div> }
function percent(used, limit) { return limit ? Math.round((Number(used || 0) / Number(limit)) * 100) : 0 }

export default AIUsage
