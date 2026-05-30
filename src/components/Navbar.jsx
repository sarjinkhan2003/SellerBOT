import { useEffect, useRef, useState } from "react"
import { BarChart3, ChevronDown, ClipboardList, Languages, LogOut, MoreVertical, Moon, Package, PackageCheck, PlusCircle, Settings, Store, Sun, User, X } from "lucide-react"
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
  { to: "/dashboard", key: "dashboard", icon: BarChart3 },
  { to: "/products", key: "products", icon: Package },
  { to: "/delivery-inventory", key: "delivery", icon: PackageCheck },
  { to: "/new-order", key: "newOrder", icon: PlusCircle },
  { to: "/orders", key: "orders", icon: ClipboardList },
  { to: "/sales", key: "sales", icon: Store },
]

function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [shop, setShop] = useState(null)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [pendingDeliveryCount, setPendingDeliveryCount] = useState(0)
  const profileRef = useRef(null)
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
    return () => { unsubscribeProducts(); unsubscribeDeliveries() }
  }, [currentUser?.uid])

  useEffect(() => {
    const handlePointer = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false)
    }
    window.addEventListener("pointerdown", handlePointer)
    return () => window.removeEventListener("pointerdown", handlePointer)
  }, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      toast.success("Logged out successfully.")
      navigate("/login", { replace: true })
    } catch (error) {
      toast.error(error.message || "Could not log out. Please try again.")
    }
  }

  const counts = { lowStockCount, pendingDeliveryCount }

  return (
    <>
      <aside className="app-sidebar hidden lg:flex">
        <Brand shop={shop} currentUser={currentUser} />
        <NavItems t={t} counts={counts} onNavigate={() => setIsOpen(false)} />
        <div className="mt-auto rounded-2xl border p-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <p className="font-bold text-[var(--text-primary)]">SellerBot</p>
          <p>AI POS workspace</p>
        </div>
      </aside>

      <header className="app-topbar">
        <div className="flex items-center gap-3 lg:hidden">
          <button className="btn-secondary btn-icon" type="button" onClick={() => setIsOpen((current) => !current)} aria-label="Toggle menu">
            {isOpen ? <X className="h-5 w-5" /> : <MoreVertical className="h-5 w-5" />}
          </button>
          <Brand shop={shop} currentUser={currentUser} compact />
        </div>
        <div className="hidden min-w-0 lg:block">
          <p className="text-xs font-bold uppercase tracking-wide text-[#1D9E75]">{shop?.shopName || "SellerBot"}</p>
          <p className="truncate text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{currentUser?.displayName || shop?.ownerName || "Seller"}</p>
        </div>
        <ProfileMenu
          refEl={profileRef}
          open={profileOpen}
          setOpen={setProfileOpen}
          shop={shop}
          currentUser={currentUser}
          theme={theme}
          language={language}
          toggleTheme={toggleTheme}
          toggleLanguage={toggleLanguage}
          onLogout={handleLogout}
          navigate={navigate}
          t={t}
        />
      </header>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setIsOpen(false)}>
          <aside className="mobile-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <Brand shop={shop} currentUser={currentUser} />
              <button className="btn-secondary btn-icon" type="button" onClick={() => setIsOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <NavItems t={t} counts={counts} onNavigate={() => setIsOpen(false)} />
            <button className="mt-3 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold" style={{ color: "var(--text-secondary)" }} onClick={() => { setIsOpen(false); navigate("/shop-settings") }}>
              <Settings className="h-5 w-5" />{t("nav.settings")}
            </button>
          </aside>
        </div>
      )}
    </>
  )
}

function Brand({ shop, currentUser, compact = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className={`${compact ? "h-9 w-9" : "h-11 w-11"} flex shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-sm font-black text-white shadow-lg shadow-emerald-500/20`}>SB</div>
      <div className="min-w-0">
        <p className="gradient-text truncate text-lg font-black leading-tight">SellerBot</p>
        <p className="truncate text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{shop?.shopName || currentUser?.displayName || "Seller"}</p>
      </div>
    </div>
  )
}

function NavItems({ onNavigate, counts, t }) {
  return (
    <nav className="flex flex-col gap-2">
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink key={item.to} to={item.to} onClick={onNavigate} className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
            <span className="relative"><Icon className="h-5 w-5" />{item.to === "/delivery-inventory" && counts.pendingDeliveryCount > 0 && <Badge>{counts.pendingDeliveryCount}</Badge>}{item.to === "/products" && counts.lowStockCount > 0 && <Dot />}</span>
            <span>{t(`nav.${item.key}`)}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

function ProfileMenu({ refEl, open, setOpen, shop, currentUser, theme, language, toggleTheme, toggleLanguage, onLogout, navigate, t }) {
  return (
    <div className="relative ml-auto" ref={refEl}>
      <button className="profile-trigger" type="button" onClick={() => setOpen((current) => !current)}>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1D9E75] text-xs font-black text-white">{initials(shop?.ownerName || currentUser?.displayName || "SB")}</div>
        <span className="hidden text-left sm:block"><span className="block text-sm font-bold">{shop?.ownerName || currentUser?.displayName || "Seller"}</span><span className="block text-xs" style={{ color: "var(--text-secondary)" }}>{shop?.shopName || "SellerBot"}</span></span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="profile-menu">
          <button className="profile-menu-item" type="button" onClick={() => { setOpen(false); navigate("/shop-settings") }}><User className="h-4 w-4" />Profile</button>
          <button className="profile-menu-item" type="button" onClick={toggleTheme}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{theme === "dark" ? t("common.lightMode") : t("common.darkMode")}</button>
          <button className="profile-menu-item" type="button" onClick={toggleLanguage}><Languages className="h-4 w-4" />{language === "en" ? "Bangla" : "English"}</button>
          <div className="my-1 h-px bg-[var(--border)]" />
          <button className="profile-menu-item text-red-600" type="button" onClick={onLogout}><LogOut className="h-4 w-4" />{t("nav.logout")}</button>
        </div>
      )}
    </div>
  )
}

function Badge({ children }) { return <span className="absolute -right-3 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{children}</span> }
function Dot() { return <span className="absolute -right-1 -top-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white dark:ring-slate-900" /> }
function initials(name = "SB") { return name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() }

export default Navbar
