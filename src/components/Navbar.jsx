import { useEffect, useState } from "react"
import { BarChart3, LogOut, Menu, Package, PlusCircle, Settings, Store, X } from "lucide-react"
import toast from "react-hot-toast"
import { NavLink, useNavigate } from "react-router-dom"
import { signOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { useAuth } from "../context/AuthContext.jsx"
import { auth, db } from "../firebase/config.js"

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/products", label: "Products" },
  { to: "/delivery-zones", label: "Delivery Zones" },
  { to: "/shop-settings", label: "Shop Settings" },
  { to: "/new-order", label: "New Order" },
  { to: "/sales", label: "Sales" },
]

const bottomItems = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/new-order", label: "New Order", icon: PlusCircle },
  { to: "/sales", label: "Sales", icon: Store },
  { to: "/products", label: "Products", icon: Package },
]

function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [shop, setShop] = useState(null)
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    let active = true
    getDoc(doc(db, "users", currentUser.uid, "settings", "shop")).then((snapshot) => {
      if (active) setShop(snapshot.data() || null)
    })
    return () => { active = false }
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
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {shop?.logoURL ? (
                <img className="h-8 w-8 rounded-lg object-cover" src={shop.logoURL} alt="Shop logo" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D9E75] text-xs font-bold text-white">SB</div>
              )}
              <div>
                <p className="text-lg font-semibold leading-tight text-slate-950">SellerBot</p>
                <p className="hidden text-xs font-medium text-slate-500 sm:block">{currentUser?.displayName || shop?.ownerName || "Seller"}</p>
              </div>
            </div>

            <button className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition lg:hidden" type="button" onClick={() => setIsOpen((current) => !current)} aria-label="Toggle menu">
              <span className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>{isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</span>
            </button>

            <div className="hidden items-center gap-3 lg:flex">
              <NavItems onNavigate={() => setIsOpen(false)} />
              <LogoutButton onLogout={handleLogout} />
            </div>
          </div>

          <div className={`grid overflow-hidden transition-all duration-300 lg:hidden ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="min-h-0">
              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                <NavItems onNavigate={() => setIsOpen(false)} mobileMenu />
                <LogoutButton onLogout={handleLogout} fullWidth />
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white shadow-2xl lg:hidden">
        {bottomItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex flex-col items-center gap-1 px-2 py-2 text-[11px] font-semibold ${isActive ? "text-[#1D9E75]" : "text-slate-500"}`}>
              <Icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}

function NavItems({ onNavigate, mobileMenu = false }) {
  return (
    <nav className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-[#e8f8f3] text-[#1D9E75]"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            } ${mobileMenu && ["/dashboard", "/new-order", "/sales", "/products"].includes(item.to) ? "hide-mobile" : ""}`
          }
        >
          {item.label === "Shop Settings" ? <span className="inline-flex items-center gap-2"><Settings className="h-4 w-4" />{item.label}</span> : item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function LogoutButton({ onLogout, fullWidth = false }) {
  return (
    <button className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 ${fullWidth ? "w-full" : ""}`} type="button" onClick={onLogout}>
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Logout
    </button>
  )
}

export default Navbar
