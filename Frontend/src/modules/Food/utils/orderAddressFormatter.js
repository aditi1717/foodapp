const isCoordinateLikeText = (value) => {
  const text = String(value || "").trim()
  if (!text) return false
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(text)
}

const cleanText = (value) => String(value || "").trim()

export const formatFullOrderAddress = (address) => {
  if (!address) return ""
  if (typeof address === "string") return cleanText(address)
  if (typeof address !== "object") return ""

  const building = cleanText(address.buildingName || address.houseNo || address.flatNo || address.addressLine1)
  const floorRaw = cleanText(address.floor)
  const floor = floorRaw ? (floorRaw.toLowerCase().includes("floor") ? floorRaw : `Floor ${floorRaw}`) : ""
  const street = cleanText(address.street || address.addressLine2)
  const area = cleanText(address.additionalDetails || address.area)
  const landmark = cleanText(address.landmark)
  const city = cleanText(address.city)
  const state = cleanText(address.state)
  const zipCode = cleanText(address.zipCode || address.postalCode || address.pincode)

  const parts = [building, floor, street, area, landmark, city, state, zipCode].filter(Boolean)

  const seen = new Set()
  const uniqueParts = parts.filter((part) => {
    const key = part.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const formatted = cleanText(address.formattedAddress || address.address)
  if (uniqueParts.length > 0) {
    const fullStr = uniqueParts.join(", ")
    if (
      formatted &&
      formatted !== "Select location" &&
      !isCoordinateLikeText(formatted) &&
      !fullStr.toLowerCase().includes(formatted.toLowerCase()) &&
      !formatted.toLowerCase().includes(fullStr.toLowerCase())
    ) {
      return `${fullStr}, ${formatted}`
    }
    return fullStr
  }

  if (formatted && formatted !== "Select location" && !isCoordinateLikeText(formatted)) {
    return formatted
  }

  return ""
}

export const formatOrderAddressWithLabels = (address) => {
  if (!address) return "Address not available"
  if (typeof address === "string") return cleanText(address) || "Address not available"
  if (typeof address !== "object") return "Address not available"

  const label = cleanText(address.label)
  const building = cleanText(address.buildingName || address.houseNo || address.flatNo || address.addressLine1)
  const floor = cleanText(address.floor)
  const street = cleanText(address.street || address.addressLine2)
  const area = cleanText(address.additionalDetails || address.area)
  const landmark = cleanText(address.landmark)
  const hasDistinctLandmark =
    landmark && (!area || landmark.toLowerCase() !== area.toLowerCase())
  const city = cleanText(address.city)
  const state = cleanText(address.state)
  const zipCode = cleanText(address.zipCode || address.postalCode || address.pincode)

  const labeledParts = [
    label ? `Type: ${label}` : "",
    building ? `Building: ${building}` : "",
    floor ? `Floor/Flat: ${floor}` : "",
    street ? `Street: ${street}` : "",
    area ? `Area: ${area}` : "",
    hasDistinctLandmark ? `Landmark: ${landmark}` : "",
    city ? `City: ${city}` : "",
    state ? `State: ${state}` : "",
    zipCode ? `Pincode: ${zipCode}` : "",
  ].filter(Boolean)

  if (labeledParts.length > 0) return labeledParts.join(", ")

  const formatted = cleanText(address.formattedAddress || address.address)
  if (formatted && !isCoordinateLikeText(formatted)) return formatted

  return "Address not available"
}

export const formatOrderAddressForMap = (address) => {
  if (!address) return ""
  if (typeof address === "string") return cleanText(address)
  if (typeof address !== "object") return ""

  const fullAddr = formatFullOrderAddress(address)
  if (fullAddr) return fullAddr

  const formatted = cleanText(address.formattedAddress || address.address)
  if (formatted && !isCoordinateLikeText(formatted)) return formatted

  return ""
}
