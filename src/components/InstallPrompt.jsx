import { useEffect, useState } from "react"

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handleBeforeInstall = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      setShowPrompt(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall)
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") setShowPrompt(false)
    setDeferredPrompt(null)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] flex items-center justify-between gap-3 bg-[#1D9E75] px-4 py-3 text-white shadow-2xl">
      <div>
        <p className="m-0 font-semibold">Install SellerBot</p>
        <p className="m-0 text-xs opacity-90">Add to home screen for quick access</p>
      </div>
      <div className="flex gap-2">
        <button className="rounded-md border border-white bg-transparent px-3 py-1.5 text-sm font-semibold text-white" type="button" onClick={() => setShowPrompt(false)}>Later</button>
        <button className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-[#1D9E75]" type="button" onClick={handleInstall}>Install</button>
      </div>
    </div>
  )
}
