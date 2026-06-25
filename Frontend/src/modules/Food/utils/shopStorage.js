// Utility for managing shop data across pages
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const SHOP_STORAGE_KEY = "appzeto_shops"

// Get shops from localStorage
export const getShops = () => {
  try {
    const stored = localStorage.getItem(SHOP_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
    return []
  } catch (error) {
    debugError("Error loading shops:", error)
    return []
  }
}

// Save shops to localStorage
export const saveShops = (shops) => {
  try {
    localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(shops))
    return true
  } catch (error) {
    debugError("Error saving shops:", error)
    return false
  }
}

// Add a new shop
export const addShop = (shopData) => {
  const shops = getShops()
  const newShop = {
    id: shops.length > 0 ? Math.max(...shops.map(s => s.id)) + 1 : 1,
    name: shopData.shopName,
    shopName: shopData.shopName,
    ownerName: `${shopData.firstName} ${shopData.lastName}`,
    ownerPhone: `${shopData.phoneCode} ${shopData.phone}`,
    zone: shopData.zone,
    cuisine: shopData.cuisine,
    status: true,
    rating: 0,
    logo: shopData.logo ? URL.createObjectURL(shopData.logo) : null,
    ...shopData
  }
  const updatedShops = [...shops, newShop]
  saveShops(updatedShops)
  return newShop
}

// Update a shop
export const updateShop = (id, updates) => {
  const shops = getShops()
  const updatedShops = shops.map(s => 
    s.id === id ? { ...s, ...updates } : s
  )
  saveShops(updatedShops)
  return updatedShops.find(s => s.id === id)
}

// Delete a shop
export const deleteShop = (id) => {
  const shops = getShops()
  const updatedShops = shops.filter(s => s.id !== id)
  saveShops(updatedShops)
  return true
}
