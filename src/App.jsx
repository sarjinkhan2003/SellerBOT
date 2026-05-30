import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import ErrorBoundary from "./components/ErrorBoundary.jsx"
import InstallPrompt from "./components/InstallPrompt.jsx"
import Navbar from "./components/Navbar.jsx"
import ProtectedRoute from "./components/ProtectedRoute.jsx"
import { AuthProvider } from "./context/AuthContext.jsx"
import { LanguageProvider } from "./context/LanguageContext.jsx"
import { ThemeProvider } from "./context/ThemeContext.jsx"
import Dashboard from "./pages/Dashboard.jsx"
import DeliveryInventory from "./pages/DeliveryInventory.jsx"
import DeliveryZones from "./pages/DeliveryZones.jsx"
import Login from "./pages/Login.jsx"
import NewOrder from "./pages/NewOrder.jsx"
import Orders from "./pages/Orders.jsx"
import Products from "./pages/Products.jsx"
import Register from "./pages/Register.jsx"
import Sales from "./pages/Sales.jsx"
import ShopSettings from "./pages/ShopSettings.jsx"

function AppShell() {
  return (
    <div className="page">
      <Navbar />
      <main className="page-content">
        <Outlet />
      </main>
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
