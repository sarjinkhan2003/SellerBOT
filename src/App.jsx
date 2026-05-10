import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import Navbar from "./components/Navbar.jsx"
import ProtectedRoute from "./components/ProtectedRoute.jsx"
import { AuthProvider } from "./context/AuthContext.jsx"
import Dashboard from "./pages/Dashboard.jsx"
import DeliveryZones from "./pages/DeliveryZones.jsx"
import Login from "./pages/Login.jsx"
import NewOrder from "./pages/NewOrder.jsx"
import Products from "./pages/Products.jsx"
import Sales from "./pages/Sales.jsx"

function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
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
            <Route path="/new-order" element={<NewOrder />} />
            <Route path="/sales" element={<Sales />} />
          </Route>
        </Routes>
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
