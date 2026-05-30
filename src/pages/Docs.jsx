import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { collection, onSnapshot } from "firebase/firestore"
import { CalendarClock, Download, Eye, EyeOff, FileText, Lock, Search, Share2, Shield, Sparkles, Users, Zap } from "lucide-react"
import toast from "react-hot-toast"
import { useAuth } from "../context/AuthContext.jsx"
import { db } from "../firebase/config.js"

const DOCS_CONFIG_KEY = "sellerbot-docs-config"
const DEFAULT_CONFIG = {
  enabled: true,
  startAt: "2026-06-10T00:00",
  endAt: "2026-06-14T23:59",
  teamName: "Team ParityCode",
}

const teamMembers = [
  { name: "Saumyadip Das", role: "Product & Full-stack Lead", email: "saumyadip@example.com" },
  { name: "Nur-E Sarjina Khan", role: "AI Workflow & Product Research", email: "sarjina@example.com" },
  { name: "Team ParityCode", role: "Design, Engineering & Demo Operations", email: "team@paritycode.dev" },
]

const pitchSections = [
  ["Problem", "Small Bangladeshi F-commerce sellers receive messy Facebook and WhatsApp orders, then manually extract names, addresses, products, delivery charges and payment details. That wastes time, causes mistakes and makes scaling painful."],
  ["Solution", "SellerBot turns a customer chat into a verified invoice, order record, delivery workflow and sales insight in one mobile-first workspace."],
  ["Why Now", "Bangladesh social commerce is growing fast, AI parsing is now affordable, and sellers already operate from phones. The missing layer is a localized operating system for chat-driven sales."],
  ["Product Demo", "Paste a structured or unstructured chat, review extracted customer and product data, generate a printable invoice, save the order, reduce inventory and track delivery status."],
  ["Market Opportunity", "Millions of micro and small sellers run on Facebook, WhatsApp and courier workflows. SellerBot starts with solo sellers and can expand into agency stores, courier integrations and marketplace tooling."],
  ["Business Model", "Freemium for solo sellers, paid tiers for higher AI usage, inventory scale, analytics, team accounts and integrations."],
  ["Traction", "Hackathon prototype includes chat parsing, invoices, inventory, delivery tracking, product codes, AI usage controls, RAG product search and PWA installability."],
  ["Competition", "Generic POS tools do not understand Bangla/Banglish chats. Generic AI chat tools do not manage stock, invoices, delivery zones or sales records."],
  ["Unique Advantage", "Localized Bangla, English and Banglish order intelligence combined with seller-owned API keys, delivery pricing, product code matching and invoice exports."],
  ["Go-To-Market", "Start with Facebook seller communities, courier partner demos, short-form tutorial content and referral loops among F-commerce operators."],
  ["Vision", "Become the lightweight AI operating system for South Asian social commerce sellers."],
]

const featureRows = [
  ["Chat-to-Invoice", "Live", "Structured and AI-assisted unstructured chat parsing."],
  ["Manual Invoice", "Live", "Create invoices without chat input."],
  ["Product Codes", "Live", "Seller-defined product IDs for faster ordering."],
  ["Inventory Flow", "Live", "Stock validation, delivery inventory and returned/refunded handling."],
  ["Delivery Zones", "Live", "Home city, specific districts and outside-base-city fallback."],
  ["Sales Analytics", "Live", "Revenue, profit, collection and order history."],
  ["AI Usage Controls", "Live", "Seller-owned Groq API key and model selection."],
  ["RAG Search", "Prototype", "Supabase pgvector plus Cohere embeddings for semantic matching."],
  ["Courier API Integrations", "Planned", "Automated shipment booking and status sync."],
]

const roadmap = [
  ["Short term", "Harden parsing quality, add templates per seller, improve mobile invoice workflows and complete admin-controlled docs publishing."],
  ["Mid term", "Courier integrations, team roles, server-side AI usage metering, multi-shop support and customer CRM."],
  ["Long term", "Predictive inventory, campaign intelligence, payment reconciliation and marketplace-grade seller automation."],
]

const techStack = [
  ["Frontend", "React, Vite, React Router, Tailwind-style utility classes, PWA plugin"],
  ["Core backend", "Firebase Auth and Firestore per-seller collections"],
  ["AI generation", "Groq API for unstructured chat formatting and parsing"],
  ["Retrieval", "Cohere multilingual embeddings and Supabase pgvector"],
  ["Matching", "Fuse.js fuzzy matching plus product-code matching"],
  ["Exports", "jsPDF, html2canvas, XLSX and browser print"],
  ["Deployment", "Vercel static app with React Router rewrite"],
]

function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...(JSON.parse(localStorage.getItem(DOCS_CONFIG_KEY) || "{}")) }
  } catch {
    return DEFAULT_CONFIG
  }
}

function formatWindowDate(value) {
  if (!value) return "Not set"
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
}

function Docs() {
  const { currentUser } = useAuth()
  const [searchParams] = useSearchParams()
  const [config, setConfig] = useState(loadConfig)
  const [draft, setDraft] = useState(config)
  const [query, setQuery] = useState("")
  const [live, setLive] = useState({ products: 0, orders: 0, zones: 0, deliveries: 0, loading: Boolean(currentUser?.uid) })

  const preview = searchParams.get("preview") === "1"
  const adminEmails = (import.meta.env.VITE_DOCS_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
  const isAdmin = Boolean(currentUser?.email) && (adminEmails.length === 0 || adminEmails.includes(currentUser.email.toLowerCase()))

  const now = new Date()
  const starts = new Date(config.startAt)
  const ends = new Date(config.endAt)
  const inWindow = now >= starts && now <= ends
  const visible = preview || (config.enabled && inWindow)

  useEffect(() => {
    if (!currentUser?.uid) {
      setLive((prev) => ({ ...prev, loading: false }))
      return undefined
    }

    const collections = [
      ["products", "products"],
      ["orders", "orders"],
      ["deliveryZones", "zones"],
      ["deliveryInventory", "deliveries"],
    ]

    const unsubscribers = collections.map(([name, key]) => onSnapshot(
      collection(db, "users", currentUser.uid, name),
      (snapshot) => setLive((prev) => ({ ...prev, [key]: snapshot.size, loading: false })),
      () => setLive((prev) => ({ ...prev, loading: false })),
    ))

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [currentUser?.uid])

  const searchableSections = useMemo(() => buildSections(live), [live])
  const filteredSections = searchableSections.filter((section) => {
    const haystack = (section.title + " " + section.body).toLowerCase()
    return haystack.includes(query.toLowerCase())
  })

  const saveConfig = () => {
    const next = { ...draft }
    localStorage.setItem(DOCS_CONFIG_KEY, JSON.stringify(next))
    setConfig(next)
    toast.success("Docs publishing settings saved.")
  }

  const applyDuration = (hours) => {
    const start = new Date()
    const end = new Date(start.getTime() + Number(hours || 0) * 60 * 60 * 1000)
    setDraft((prev) => ({ ...prev, enabled: true, startAt: toLocalInputValue(start), endAt: toLocalInputValue(end) }))
  }

  const exportMarkdown = () => {
    const markdown = buildMarkdown(live, config)
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "SellerBot-Docs.md"
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(window.location.origin + "/docs")
    toast.success("Share link copied.")
  }

  if (!visible) {
    return <DocsUnavailable config={config} isAdmin={isAdmin} draft={draft} setDraft={setDraft} saveConfig={saveConfig} applyDuration={applyDuration} />
  }

  return (
    <main className="docs-shell">
      <header className="docs-hero docs-print-page">
        <nav className="docs-top docs-no-print">
          <Link to="/login" className="docs-brand"><span>SB</span><strong>SellerBot</strong></Link>
          <div className="docs-actions">
            <button className="btn-secondary btn-sm" type="button" onClick={copyShareLink}><Share2 className="h-4 w-4" />Share</button>
            <button className="btn-secondary btn-sm" type="button" onClick={exportMarkdown}><FileText className="h-4 w-4" />Markdown</button>
            <button className="btn-primary btn-sm" type="button" onClick={() => window.print()}><Download className="h-4 w-4" />PDF</button>
          </div>
        </nav>
        <div className="docs-hero-grid">
          <section>
            <p className="docs-kicker"><Sparkles className="h-4 w-4" />Live hackathon documentation</p>
            <h1>SellerBot</h1>
            <p className="docs-lede">AI-powered POS and invoice automation for Bangladeshi Facebook and WhatsApp sellers. Understand the business in 2 minutes, inspect the system in 10 minutes, and verify the live product state from the same page.</p>
            <div className="docs-cta-row docs-no-print">
              <a className="btn-primary" href="#pitch">View Pitch Deck</a>
              <a className="btn-secondary" href="#architecture">Technical Architecture</a>
            </div>
          </section>
          <LiveSystemCard live={live} config={config} />
        </div>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar docs-no-print">
          <div className="docs-search"><Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documentation" /></div>
          <a href="#pitch">Pitch Deck</a>
          <a href="#team">Team</a>
          {filteredSections.map((section) => <a key={section.id} href={"#" + section.id}>{section.title}</a>)}
          {isAdmin && <a href="#admin">Admin Controls</a>}
        </aside>

        <section className="docs-content docs-print-page">
          <section id="pitch" className="docs-section">
            <div className="docs-section-head"><p>YC-style deck</p><h2>Business Pitch</h2></div>
            <div className="docs-pitch-grid">
              {pitchSections.map(([title, body], index) => <article className="docs-card" key={title}><span className="docs-step">{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></article>)}
            </div>
          </section>

          <section id="team" className="docs-section">
            <div className="docs-section-head"><p>Builders</p><h2>{config.teamName}</h2></div>
            <div className="docs-team-grid">
              {teamMembers.map((member) => <article className="docs-team-card" key={member.email}><div className="docs-avatar">{getInitials(member.name)}</div><h3>{member.name}</h3><p>{member.role}</p><a href={"mailto:" + member.email}>{member.email}</a></article>)}
            </div>
          </section>

          <FeatureMatrix />
          <ArchitectureSection />
          {filteredSections.map((section) => <InfoSection key={section.id} section={section} />)}
          {isAdmin && <AdminPanel draft={draft} setDraft={setDraft} saveConfig={saveConfig} applyDuration={applyDuration} />}
        </section>
      </div>
    </main>
  )
}

function DocsUnavailable({ config, isAdmin, draft, setDraft, saveConfig, applyDuration }) {
  return (
    <main className="docs-shell docs-unavailable">
      <section className="docs-blocked-card">
        <div className="docs-lock"><Lock className="h-8 w-8" /></div>
        <p className="docs-kicker">Restricted showcase window</p>
        <h1>Documentation Not Available</h1>
        <p>The SellerBot live documentation is currently closed. Public access is scheduled from {formatWindowDate(config.startAt)} to {formatWindowDate(config.endAt)}.</p>
        <Link className="btn-secondary" to="/login">Back to SellerBot</Link>
      </section>
      {isAdmin && <AdminPanel draft={draft} setDraft={setDraft} saveConfig={saveConfig} applyDuration={applyDuration} compact />}
    </main>
  )
}

function LiveSystemCard({ live, config }) {
  const metrics = [
    ["Products", live.products],
    ["Orders", live.orders],
    ["Delivery zones", live.zones],
    ["Delivery items", live.deliveries],
  ]
  return <aside className="docs-live-card"><p className="docs-kicker"><Zap className="h-4 w-4" />Live system view</p><div className="docs-metric-grid">{metrics.map(([label, value]) => <div key={label}><strong>{live.loading ? "..." : value}</strong><span>{label}</span></div>)}</div><p className="docs-window"><CalendarClock className="h-4 w-4" />Public window: {formatWindowDate(config.startAt)} - {formatWindowDate(config.endAt)}</p></aside>
}

function FeatureMatrix() {
  return <section id="feature-matrix" className="docs-section"><div className="docs-section-head"><p>Live synced roadmap</p><h2>Feature Matrix</h2></div><div className="docs-table-wrap"><table><thead><tr><th>Feature</th><th>Status</th><th>Notes</th></tr></thead><tbody>{featureRows.map(([feature, status, notes]) => <tr key={feature}><td>{feature}</td><td><span className={"docs-status docs-status-" + status.toLowerCase().replace(/\s+/g, "-")}>{status}</span></td><td>{notes}</td></tr>)}</tbody></table></div></section>
}

function ArchitectureSection() {
  return <section id="architecture" className="docs-section"><div className="docs-section-head"><p>Editable system map</p><h2>Architecture & Data Flow</h2></div><div className="docs-diagram"><div>React PWA UI</div><span>to</span><div>Firebase Auth</div><span>to</span><div>Firestore Seller Data</div><span>to</span><div>Groq + RAG Services</div><span>to</span><div>Invoice, Sales & Delivery</div></div><div className="docs-diagram docs-diagram-secondary"><div>Customer Chat</div><span>to</span><div>Structured Parser</div><span>to</span><div>Product/Zone Matching</div><span>to</span><div>Seller Review</div><span>to</span><div>Invoice + Inventory Update</div></div></section>
}

function InfoSection({ section }) {
  return <section id={section.id} className="docs-section"><div className="docs-section-head"><p>{section.eyebrow}</p><h2>{section.title}</h2></div><div className="docs-card docs-wide"><p>{section.body}</p>{section.items?.length > 0 && <div className="docs-chip-row">{section.items.map((item) => <span key={item}>{item}</span>)}</div>}</div></section>
}

function AdminPanel({ draft, setDraft, saveConfig, applyDuration, compact = false }) {
  return <section id="admin" className={compact ? "docs-admin docs-admin-compact" : "docs-section docs-admin"}><div className="docs-section-head"><p>Admin publishing</p><h2>Visibility & Scheduling</h2></div><div className="docs-admin-grid"><label className="docs-toggle"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />{draft.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}Public visibility</label><label><span>Start date and time</span><input type="datetime-local" value={draft.startAt} onChange={(event) => setDraft((prev) => ({ ...prev, startAt: event.target.value }))} /></label><label><span>End date and time</span><input type="datetime-local" value={draft.endAt} onChange={(event) => setDraft((prev) => ({ ...prev, endAt: event.target.value }))} /></label><label><span>Team name</span><input value={draft.teamName} onChange={(event) => setDraft((prev) => ({ ...prev, teamName: event.target.value }))} /></label></div><div className="docs-admin-actions"><button className="btn-secondary" type="button" onClick={() => applyDuration(24)}>Publish 24h</button><button className="btn-secondary" type="button" onClick={() => applyDuration(96)}>Publish 4 days</button><button className="btn-primary" type="button" onClick={saveConfig}>Save Publishing Settings</button></div><p className="docs-admin-note"><Shield className="h-4 w-4" />Prototype admin controls are stored locally for the hackathon demo. A production version should persist this config in an admin-only Firestore document.</p></section>
}

function buildSections(live) {
  return [
    { id: "product-overview", eyebrow: "Who it serves", title: "Product Overview", body: "SellerBot is built for Bangladeshi online sellers who receive orders through chat. It converts conversations into invoices, sales records, stock movement and delivery tracking while keeping the seller in control before confirmation.", items: ["F-commerce sellers", "Boutique shops", "Home-based businesses", "Courier-driven stores"] },
    { id: "technology-stack", eyebrow: "Implementation", title: "Technology Stack", body: techStack.map(([area, tech]) => area + ": " + tech).join(". ") + "." },
    { id: "api-documentation", eyebrow: "Interfaces", title: "API Documentation", body: "SellerBot consumes Firebase Auth and Firestore APIs for user and seller data, Groq for AI chat parsing, Cohere for embeddings, Supabase RPC for vector search, and browser export APIs for printing and downloads. Exposed public app routes include /docs, /login and /register; operational routes are protected by Firebase auth." },
    { id: "data-layer", eyebrow: "Storage", title: "Data Layer", body: "Data is stored per seller under users/{uid}. Collections include products, orders, settings, deliveryZones, deliveryInventory and AI usage settings. Full customer addresses are stored as provided and zone detection is handled separately." },
    { id: "ai-layer", eyebrow: "Intelligence", title: "AI Layer", body: "Structured orders use deterministic parsing. Unstructured orders are first transformed by the seller-configured Groq model, then normalized through product code, fuzzy and RAG matching. Seller-owned API keys make the prototype flexible for judging and future production billing." },
    { id: "live-state", eyebrow: "Current system", title: "Live Data Snapshot", body: "For the logged-in seller this page is currently seeing " + live.products + " products, " + live.orders + " orders, " + live.zones + " delivery zones and " + live.deliveries + " delivery inventory records." },
    { id: "roadmap", eyebrow: "Execution", title: "Product Roadmap", body: roadmap.map(([term, text]) => term + ": " + text).join(" ") },
    { id: "performance", eyebrow: "Scale", title: "Performance & Scalability", body: "The app is static and CDN-friendly through Vercel, while seller data stays partitioned by uid. Heavy AI and vector work is optional, cached where possible and scoped to relevant products instead of sending large catalogs to the LLM." },
    { id: "security", eyebrow: "Trust", title: "Security", body: "Firebase Auth protects seller operations, Firestore rules isolate each seller's data, and API keys are stored in seller settings for prototype use. Production hardening should move AI keys and usage metering to server-side functions." },
    { id: "analytics", eyebrow: "KPIs", title: "Analytics", body: "Core KPIs include orders, revenue, product profit, delivery revenue, unpaid collections, low stock, pending deliveries, AI parsing usage and conversion from chat to invoice." },
    { id: "changelog", eyebrow: "Version history", title: "Changelog", body: "Current version includes PWA support, bilingual UI, dark mode, chat/manual invoices, delivery zones, delivery inventory, product codes, sales exports, AI usage settings and this live docs module." },
  ]
}

function buildMarkdown(live, config) {
  const lines = ["# SellerBot", "", "AI-powered POS for Bangladeshi F-commerce sellers.", "", "## Publishing Window", "", "Start: " + formatWindowDate(config.startAt), "End: " + formatWindowDate(config.endAt), "", "## Live Metrics", "", "- Products: " + live.products, "- Orders: " + live.orders, "- Delivery zones: " + live.zones, "- Delivery inventory: " + live.deliveries, "", "## Pitch Deck", ""]
  pitchSections.forEach(([title, body]) => lines.push("### " + title, "", body, ""))
  lines.push("## Team", "")
  teamMembers.forEach((member) => lines.push("- " + member.name + " - " + member.role + " - " + member.email))
  lines.push("", "## Features", "")
  featureRows.forEach(([feature, status, notes]) => lines.push("- " + feature + " (" + status + "): " + notes))
  return lines.join("\n")
}

function toLocalInputValue(date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function getInitials(name) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()
}

export default Docs
