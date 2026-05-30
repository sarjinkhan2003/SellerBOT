import { useEffect, useState } from "react"
import { BarChart3, Languages, LogOut, Menu, Moon, Package, PackageCheck, PlusCircle, Settings, Store, Sun, X } from "lucide-react"
import toast from "react-hot-toast"
import { NavLink, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { signOut } from "firebase/auth"
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore"
import { useAuth } from "../context/AuthContext.jsx"
import { useLanguage } from "../context/LanguageContext.jsx"
import { useTheme } from "../context/ThemeContext.jsx"
import { auth, db } from "../firebase/config.js"

const navItems = [
  { to: "/dashboard", key: "dashboard" },
  { to: "/products", key: "products" },
  { to: "/delivery-inventory", key: "delivery" },
  { to: "/shop-settings", key: "settings", settings: true },
  { to: "/new-order", key: "newOrder" },
  { to: "/sales", key: "sales" },
]

const bottomItems = [
  { to: "/dashboard", key: "dashboard", icon: BarChart3 },
  { to: "/new-order", key: "newOrder", icon: PlusCircle },
  { to: "/delivery-inventory", key: "delivery", icon: PackageCheck },
  { to: "/sales", key: "sales", icon: Store },
  { to: "/products", key: "products", icon: Package },
]

function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [shop, setShop] = useState(null)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [pendingDeliveryCount, setPendingDeliveryCount] = useState(0)
  const { currentUser } = useAuth()
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const { language, toggleLanguage } = useLanguage()
  const navigate = useNavigate()

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    let active = true
    getDoc(doc(db, "users", currentUser.uid, "settings", "shop")).then((snapshot) => {
      if (active) setShop(snapshot.data() || null)
    })
    return () => { active = false }
  }, [currentUser?.uid])

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    const unsubscribeProducts = onSnapshot(collection(db, "users", currentUser.uid, "products"), (snapshot) => {
      setLowStockCount(snapshot.docs.filter((item) => Number(item.data().stock ?? 999) < 5).length)
    })
    const unsubscribeDeliveries = onSnapshot(query(collection(db, "users", currentUser.uid, "deliveryInventory"), where("deliveryStatus", "==", "pending")), (snapshot) => {
      setPendingDeliveryCount(snapshot.size)
    })
    return () => {
      unsubscribeProducts()
      unsubscribeDeliveries()
    }
  }, [currentUser?.uid])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      toast.success("Logged out successfully.")
      navigate("/login", { replace: true })
    } catch (error) {
      toast.error(error.message || "Could not log out. Please try again.")
    }
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b backdrop-blur-xl" style={{ background: "color-mix(in srgb, var(--bg-card) 92%, transparent)", borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Brand shop={shop} currentUser={currentUser} />

            <div className="hidden items-center gap-2 lg:flex">
              <NavItems lowStockCount={lowStockCount} pendingDeliveryCount={pendingDeliveryCount} t={t} onNavigate={() => setIsOpen(false)} />
            </div>

            <div className="flex items-center gap-2">
              <ControlButton onClick={toggleLanguage} label={t("common.language")}>
                <Languages className="h-4 w-4" />
                <span className="text-xs font-bold">{language === "en" ? "বাং" : "EN"}</span>
              </ControlButton>
              <ControlButton onClick={toggleTheme} label={t("common.theme")} iconOnly>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </ControlButton>
              <div className="hidden lg:block"><LogoutButton onLogout={handleLogout} t={t} /></div>
              <button className="btn-secondary btn-icon lg:hidden" type="button" onClick={() => setIsOpen((current) => !current)} aria-label="Toggle menu">
                <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>{isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</span>
              </button>
            </div>
          </div>

          <div className={`grid overflow-hidden transition-all duration-300 lg:hidden ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="min-h-0">
              <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <NavItems lowStockCount={lowStockCount} pendingDeliveryCount={pendingDeliveryCount} t={t} onNavigate={() => setIsOpen(false)} mobileMenu />
                <LogoutButton onLogout={handleLogout} t={t} fullWidth />
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="bottom-tab lg:hidden">
        {bottomItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `tab-item ${isActive ? "active" : ""}`}>
              <span className="relative"><Icon className="h-5 w-5" />{item.to === "/delivery-inventory" && pendingDeliveryCount > 0 && <Badge>{pendingDeliveryCount}</Badge>}{item.to === "/products" && lowStockCount > 0 && <Dot />}</span>
              {t(`nav.${item.key}`)}
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}

function Brand({ shop, currentUser }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-sm font-black text-white shadow-lg shadow-emerald-500/20">SB</div>
      <div className="min-w-0">
        <p className="gradient-text truncate text-lg font-black leading-tight">SellerBot</p>
        <p className="hidden truncate text-xs font-semibold sm:block" style={{ color: "var(--text-secondary)" }}>{shop?.shopName || currentUser?.displayName || "Seller"}</p>
      </div>
    </div>
  )
}

function NavItems({ onNavigate, mobileMenu = false, lowStockCount = 0, pendingDeliveryCount = 0, t }) {
  return (
    <nav className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `relative rounded-md px-3 py-2 text-sm font-bold transition ${isActive ? "bg-primary-50 text-primary-500 dark:bg-emerald-500/10" : "hover:bg-slate-100 dark:hover:bg-slate-800"} ${mobileMenu && ["/dashboard", "/new-order", "/delivery-inventory", "/sales", "/products"].includes(item.to) ? "hide-mobile" : ""}`
          }
          style={({ isActive }) => ({ color: isActive ? "var(--primary)" : "var(--text-secondary)" })}
        >
          {item.settings ? <span className="inline-flex items-center gap-2"><Settings className="h-4 w-4" />{t(`nav.${item.key}`)}</span> : <span className="relative inline-flex items-center gap-2">{t(`nav.${item.key}`)}{item.to === "/delivery-inventory" && pendingDeliveryCount > 0 && <Badge>{pendingDeliveryCount}</Badge>}{item.to === "/products" && lowStockCount > 0 && <Dot />}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

function ControlButton({ children, onClick, label, iconOnly = false }) {
  return <button className={`btn-secondary ${iconOnly ? "btn-icon" : "px-3"}`} type="button" onClick={onClick} aria-label={label}>{children}</button>
}
function Badge({ children }) { return <span className="absolute -right-3 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{children}</span> }
function Dot() { return <span className="absolute -right-1 -top-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white dark:ring-slate-900" /> }
function LogoutButton({ onLogout, fullWidth = false, t }) {
  return (
    <button className={`btn-secondary ${fullWidth ? "w-full" : ""}`} type="button" onClick={onLogout}>
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {t("nav.logout")}
    </button>
  )
}

export default Navbar
