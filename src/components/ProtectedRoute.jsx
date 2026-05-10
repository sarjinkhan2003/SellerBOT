import { Navigate, useLocation } from "react-router-dom"
import LoadingScreen from "./LoadingScreen.jsx"
import { useAuth } from "../context/AuthContext"

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen message="Loading your shop..." />
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

export default ProtectedRoute
