export function detectZone(addressString = "", zonesArray = []) {
  const address = addressString.toLowerCase()

  if (!address.trim()) {
    return null
  }

  return (
    zonesArray.find((zone) =>
      (zone.keywords || []).some((keyword) =>
        address.includes(String(keyword).toLowerCase()),
      ),
    ) || null
  )
}
