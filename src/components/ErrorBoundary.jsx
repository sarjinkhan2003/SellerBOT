import { Component } from "react"

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error("SellerBot UI error", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <section className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#1D9E75] text-lg font-bold text-white">SB</div>
            <h1 className="text-2xl font-semibold text-slate-950">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600">SellerBot hit an unexpected UI error. Reloading usually gets you back to work.</p>
            <button className="mt-5 rounded-md bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => window.location.reload()}>Reload App</button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
