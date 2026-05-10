import { useState } from "react"
import { signInWithEmailAndPassword } from "firebase/auth"
import { Bot, Loader2, LockKeyhole, Mail } from "lucide-react"
import toast from "react-hot-toast"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext.jsx"
import { auth } from "../firebase/config.js"

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loadingLogin, setLoadingLogin] = useState(false)
  const { currentUser, loading } = useAuth()
  const navigate = useNavigate()

  if (!loading && currentUser) {
    return <Navigate to="/dashboard" replace />
  }

  const handleLogin = async (event) => {
    event.preventDefault()

    if (!email.trim() || !password) {
      toast.error("Enter your email and password.")
      return
    }

    try {
      setLoadingLogin(true)
      await signInWithEmailAndPassword(auth, email.trim(), password)
      toast.success("Welcome back to SellerBot.")
      navigate("/dashboard", { replace: true })
    } catch (error) {
      toast.error(getAuthErrorMessage(error))
    } finally {
      setLoadingLogin(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <BrandHeader title="Seller Login" />

        <form className="space-y-5" onSubmit={handleLogin}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <span className="mt-2 flex items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2.5 focus-within:border-[#1D9E75] focus-within:ring-2 focus-within:ring-[#1D9E75]/20">
              <Mail className="h-5 w-5 text-slate-400" aria-hidden="true" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seller@example.com"
                autoComplete="email"
                disabled={loadingLogin}
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <span className="mt-2 flex items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2.5 focus-within:border-[#1D9E75] focus-within:ring-2 focus-within:ring-[#1D9E75]/20">
              <LockKeyhole className="h-5 w-5 text-slate-400" aria-hidden="true" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loadingLogin}
              />
            </span>
          </label>

          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1D9E75] px-4 text-sm font-semibold text-white transition hover:bg-[#178765] disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={loadingLogin}
          >
            {loadingLogin && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Login
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          New seller?{" "}
          <Link className="font-semibold text-[#1D9E75] hover:text-[#178765]" to="/register">
            Create Account
          </Link>
        </p>
      </section>
    </main>
  )
}

function BrandHeader({ title }) {
  return (
    <div className="mb-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#1D9E75] text-white">
        <Bot className="h-7 w-7" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">SellerBot</p>
      <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Access your AI-powered POS workspace for Facebook and WhatsApp sales.
      </p>
    </div>
  )
}

function getAuthErrorMessage(error) {
  switch (error.code) {
    case "auth/invalid-email":
      return "Enter a valid email address."
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Email or password is incorrect."
    default:
      return error.message || "Login failed. Please try again."
  }
}

export default Login
