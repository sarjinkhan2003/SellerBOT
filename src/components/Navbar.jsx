import { useState } from "react"
import { LogOut, Menu, Store, X } from "lucide-react"
import toast from "react-hot-toast"
import { NavLink, useNavigate } from "react-router-dom"
import { signOut } from "firebase/auth"
import { auth } from "../firebase/config.js"

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/products", label: "Products" },
  { to: "/delivery-zones", label: "Delivery Zones" },
  { to: "/shop-settings", label: "Shop Settings" },
  { to: "/new-order", label: "New Order" },
  { to: "/sales", label: "Sales" },
]

function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

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
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#1D9E75] text-white">
              <Store className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-950">SellerBot</p>
              <p className="text-xs font-medium text-[#1D9E75]">AI POS for F-commerce sellers</p>
            </div>
          </div>

          <button className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-700 lg:hidden" type="button" onClick={() => setIsOpen((current) => !current)} aria-label="Toggle menu">
            {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>

          <div className="hidden items-center gap-3 lg:flex">
            <NavItems onNavigate={() => setIsOpen(false)} />
            <LogoutButton onLogout={handleLogout} />
          </div>
        </div>

        {isOpen && (
          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 lg:hidden">
            <NavItems onNavigate={() => setIsOpen(false)} />
            <LogoutButton onLogout={handleLogout} fullWidth />
          </div>
        )}
      </div>
    </header>
  )
}

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`
          }
        >
          {item.label}
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
