const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

/**
 * Shop Management Utility Functions
 * Centralized management for shop details across the shop module
 */

// Default shop data
const DEFAULT_SHOP_DATA = {
  shopName: {
    english: "Hungry Puppets",
    bengali: "",
    arabic: "",
    spanish: ""
  },
  phoneNumber: "+101747410000",
  address: "House: 00, Road: 00, Test City",
  logo: null,
  cover: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&h=400&fit=crop",
  metaTitle: "Hungry Puppets Shop: Where Fla",
  metaDescription: "Satisfy your cravings and indulge in a culinary adventure at Hungry Puppets Shop. Our menu is a symphony of taste, offering a delightful fusion of flavors that excite both palate and",
  metaImage: null,
  rating: 4.7,
  totalRatings: 3
}

const SHOP_STORAGE_KEY = 'shop_data'

const isValidImageValue = (value) => {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false

  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/')
  )
}

const normalizeShopData = (data = {}) => {
  const shopName = data.shopName || {};
  return {
    ...DEFAULT_SHOP_DATA,
    ...data,
    shopName: {
      ...DEFAULT_SHOP_DATA.shopName,
      ...shopName
    },
    logo: isValidImageValue(data.logo) ? data.logo : null,
    cover: isValidImageValue(data.cover) ? data.cover : DEFAULT_SHOP_DATA.cover,
    metaImage: isValidImageValue(data.metaImage) ? data.metaImage : null
  };
}

/**
 * Get shop data from localStorage
 * @returns {Object} - Shop data object
 */
export const getShopData = () => {
  try {
    const saved = localStorage.getItem(SHOP_STORAGE_KEY)
    if (saved) {
      const normalizedData = normalizeShopData(JSON.parse(saved))
      localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(normalizedData))
      return normalizedData
    }
    // Initialize with default data
    setShopData(DEFAULT_SHOP_DATA)
    return DEFAULT_SHOP_DATA
  } catch (error) {
    debugError('Error reading shop data from localStorage:', error)
    return DEFAULT_SHOP_DATA
  }
}

/**
 * Save shop data to localStorage
 * @param {Object} shopData - Shop data object
 */
export const setShopData = (shopData) => {
  try {
    const normalizedData = normalizeShopData(shopData)
    localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(normalizedData))
    // Dispatch custom events for other components
    window.dispatchEvent(new CustomEvent('shopDataUpdated'))
    // Trigger storage event for cross-tab updates
    window.dispatchEvent(new Event('storage'))
  } catch (error) {
    debugError('Error saving shop data to localStorage:', error)
  }
}

/**
 * Update shop data (merge with existing)
 * @param {Object} updates - Partial shop data to update
 * @returns {Object} - Updated shop data
 */
export const updateShopData = (updates) => {
  const currentData = getShopData()
  const shopNameUpdates = updates.shopName;
  const updatedData = {
    ...currentData,
    ...updates,
    shopName: shopNameUpdates 
      ? { ...currentData.shopName, ...shopNameUpdates }
      : currentData.shopName
  }
  setShopData(updatedData)
  return updatedData
}
