function LoadingScreen({ message = "Loading SellerBot..." }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] px-4">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1D9E75] text-xl font-bold text-white shadow-lg">SB</div>
        <div className="mx-auto mt-5 h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-[#1D9E75]" />
        <p className="mt-4 text-sm font-semibold text-slate-600">{message}</p>
      </div>
    </div>
  )
}

export default LoadingScreen
