import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { useLocation, useNavigate } from "react-router-dom"
import LoadingScreen from "../components/LoadingScreen.jsx"
import { auth, db } from "../firebase/config"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [checkingShop, setCheckingShop] = useState(false)
  const [shopSetupComplete, setShopSetupComplete] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setAuthLoading(false)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (authLoading) return undefined

    if (!currentUser) {
      setShopSetupComplete(false)
      setCheckingShop(false)
      return undefined
    }

    let active = true
    setCheckingShop(true)

    getDoc(doc(db, "users", currentUser.uid, "settings", "shop"))
      .then((snapshot) => {
        if (!active) return
        const data = snapshot.data()
        const hasShop = snapshot.exists() && Boolean(data?.shopName?.trim())
        setShopSetupComplete(hasShop)
        setCheckingShop(false)

        if (!hasShop && location.pathname !== "/register") {
          navigate("/register", { replace: true })
        }

        if (hasShop && location.pathname === "/register") {
          navigate("/dashboard", { replace: true })
        }
      })
      .catch(() => {
        if (!active) return
        setShopSetupComplete(false)
        setCheckingShop(false)

        if (location.pathname !== "/register") {
          navigate("/register", { replace: true })
        }
      })

    return () => {
      active = false
    }
  }, [authLoading, currentUser, location.pathname, navigate])

  const loading = authLoading || checkingShop
  const value = useMemo(
    () => ({ currentUser, loading, shopSetupComplete }),
    [currentUser, loading, shopSetupComplete],
  )

  if (authLoading) {
    return <LoadingScreen message="Starting SellerBot..." />
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
