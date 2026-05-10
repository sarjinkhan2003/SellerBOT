function convertBanglaToEnglish(str = "") {
  const banglaDigits = "০১২৩৪৫৬৭৮৯"
  const englishDigits = "0123456789"
  return str.replace(/[০-৯]/g, (d) => englishDigits[banglaDigits.indexOf(d)])
}

export function detectZone(addressString = "", zonesArray = []) {
  if (!addressString || !zonesArray) return null

  const addressLower = addressString.toLowerCase()
  const convertedLower = convertBanglaToEnglish(addressString).toLowerCase()

  const specificZones = zonesArray.filter((zone) => !zone.isOutsideBaseCity)
  for (const zone of specificZones) {
    for (const keyword of zone.keywords || []) {
      const keywordLower = String(keyword).toLowerCase()
      const convertedKeyword = convertBanglaToEnglish(String(keyword)).toLowerCase()
      if (addressLower.includes(keywordLower) || convertedLower.includes(convertedKeyword)) {
        return { ...zone, autoDetected: true }
      }
    }
  }

  const outsideZone = zonesArray.find((zone) => zone.isOutsideBaseCity)
  if (outsideZone) {
    return { ...outsideZone, autoDetected: false, isFallback: true }
  }

  return null
}


