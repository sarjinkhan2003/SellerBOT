import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import Dashboard from "./pages/Dashboard.jsx"
import DeliveryZones from "./pages/DeliveryZones.jsx"
import Login from "./pages/Login.jsx"
import NewOrder from "./pages/NewOrder.jsx"
import Products from "./pages/Products.jsx"
import Sales from "./pages/Sales.jsx"

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/products", label: "Products" },
  { to: "/delivery-zones", label: "Delivery Zones" },
  { to: "/new-order", label: "New Order" },
  { to: "/sales", label: "Sales" },
]

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">SellerBot</p>
              <h1 className="text-2xl font-semibold tracking-normal">
                AI POS for F-commerce sellers
              </h1>
            </div>
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
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
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-emerald-700 text-white"
                      : "text-emerald-700 hover:bg-emerald-50"
                  }`
                }
              >
                Login
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/products" element={<Products />} />
            <Route path="/delivery-zones" element={<DeliveryZones />} />
            <Route path="/new-order" element={<NewOrder />} />
            <Route path="/sales" element={<Sales />} />
          </Routes>
        </main>
      </div>
      <Toaster position="top-right" />
    </BrowserRouter>
  )
}

export default App
