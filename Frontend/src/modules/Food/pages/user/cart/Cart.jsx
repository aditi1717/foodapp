import { useState, useEffect, useRef, useMemo, Fragment } from "react"
import { createPortal } from "react-dom"
import { Link, useNavigate } from "react-router-dom"
import { Plus, Minus, ArrowLeft, ChevronRight, Clock, MapPin, Phone, FileText, Utensils, Tag, Percent, Share2, ChevronUp, ChevronDown, X, Check, Settings, CreditCard, Wallet, Building2, Sparkles, Banknote, Zap, CheckCircle2, MessageCircle, Send, Mail, Copy } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"

import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { useCart } from "@food/context/CartContext"
import { useProfile } from "@food/context/ProfileContext"
import { useOrders } from "@food/context/OrdersContext"
import QuickSharedCart from "@food/pages/user/cart/QuickSharedCart"
import MixedSharedCart from "@food/pages/user/cart/MixedSharedCart"
import { useLocation as useUserLocation } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"
import { useLocationSelector } from "@food/components/user/UserLayout"
import { orderAPI, shopAPI, adminAPI, userAPI, API_ENDPOINTS } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { initRazorpayPayment } from "@food/utils/razorpay"
import { toast } from "sonner"
import { getCompanyNameAsync } from "@food/utils/businessSettings"
import { useCompanyName } from "@food/hooks/useCompanyName"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import iggymetSound from "@food/assets/audio/iggymet_sms.mp3"
import BRAND_THEME from "@/config/brandTheme"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

const getUniqueAddressParts = (parts = []) => {
  const seen = new Set()
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}



// Removed hardcoded suggested items - now fetching approved addons from backend
// Coupons will be fetched from backend based on items in cart

/**
 * Format full address string from address object
 * @param {Object} address - Address object with street, additionalDetails, city, state, zipCode, or formattedAddress
 * @returns {String} Formatted address string
 */
const formatFullAddress = (address) => {
  if (!address) return ""

  const looksLikeLatLng = (s) => {
    if (!s) return false
    const v = String(s).trim()
    // Matches "12.34, 56.78" (lat,lng) with optional decimals/spaces
    return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(v)
  }

  const dedupeAddressSegments = (text) =>
    getUniqueAddressParts(String(text || "").split(",")).join(", ")

  // Priority 1: Use formattedAddress if available (for live location addresses)
  if (address.formattedAddress && address.formattedAddress !== "Select location") {
    // If formattedAddress is still raw coordinates, don't show it as-is.
    // Fall back to composing from city/state/area instead.
    if (!looksLikeLatLng(address.formattedAddress)) {
      return dedupeAddressSegments(address.formattedAddress)
    }
  }

  // Priority 2: Build address from parts
  const addressParts = []
  if (address.floor) addressParts.push(`Floor ${address.floor}`)
  if (address.buildingName) addressParts.push(address.buildingName)
  if (address.street) addressParts.push(address.street)
  if (address.additionalDetails) addressParts.push(address.additionalDetails)
  if (address.landmark) addressParts.push(address.landmark)
  if (address.city) addressParts.push(address.city)
  if (address.state) addressParts.push(address.state)
  if (address.zipCode) addressParts.push(address.zipCode)

  if (addressParts.length > 0) {
    return dedupeAddressSegments(addressParts.join(', '))
  }

  // Priority 3: Use address field if available
  if (address.address && address.address !== "Select location") {
    return address.address
  }

  return ""
}

const composeSavedAddressText = (address) =>
  getUniqueAddressParts([
    address?.floor ? `Floor ${address.floor}` : "",
    address?.buildingName,
    address?.street,
    address?.additionalDetails,
    address?.landmark,
    address?.city,
    address?.state,
    address?.zipCode,
  ])
    .join(", ")

const RUPEE_SYMBOL = "\u20B9"
const CART_RECIPIENT_DETAILS_STORAGE_KEY = "food-cart-recipient-details-v1"
const CART_ORDER_NOTE_STORAGE_KEY = "food-cart-order-note-v1"
const getNormalizedFoodType = (item = {}) =>
  String(item?.foodType || item?.type || item?.category || "")
    .trim()
    .toLowerCase()

const isItemVeg = (item = {}) => {
  const normalizedFoodType = getNormalizedFoodType(item)
  if (normalizedFoodType === "veg" || normalizedFoodType === "vegetarian") return true
  if (
    normalizedFoodType === "non-veg" ||
    normalizedFoodType === "non veg" ||
    normalizedFoodType === "nonveg" ||
    normalizedFoodType === "egg"
  ) {
    return false
  }
  if (item?.isVeg === true) return true
  if (item?.isVeg === false) return false
  return false
}

const normalizeBulkOrderPricing = (raw = {}) => {
  const minQuantity = Number(raw?.minQuantity)
  const bulkPrice = Number(raw?.bulkPrice)

  return {
    enabled: raw?.enabled === true,
    minQuantity: Number.isInteger(minQuantity) && minQuantity > 0 ? minQuantity : null,
    bulkPrice: Number.isFinite(bulkPrice) && bulkPrice >= 0 ? bulkPrice : null,
  }
}

export default function Cart() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const orderSuccessAudioRef = useRef(null)
  const hasRestoredRecipientRef = useRef(false)
  const lastAutoOfferToastRef = useRef("")
  const pricingRequestIdRef = useRef(0)
  const bulkModeIssueToastShownRef = useRef(false)

  // Defensive check: Ensure CartProvider is available
  let cartContext;
  try {
    cartContext = useCart();
  } catch (error) {
    debugError('? CartProvider not found. Make sure Cart component is rendered within UserLayout.');
    // Return early with error message
    return (
      <div className={`min-h-screen flex items-center justify-center ${BRAND_THEME.tokens.cart.pageBackground}`}>
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Cart Error</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Cart functionality is not available. Please refresh the page.
          </p>
          <button
            onClick={() => navigate('/')}
            className={`mt-4 px-4 py-2 ${BRAND_THEME.tokens.cart.primaryButton} rounded-lg`}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const {
    cart,
    updateQuantity,
    addToCart,
    getCartCount,
    clearCart,
    cleanCartForShop,
    bulkOrderMode,
    activateBulkOrderMode,
    deactivateBulkOrderMode,
  } = cartContext;
  const hasQuickItems = cart.some((item) => (item?.orderType || "food") === "quick")
  const hasFoodItems = cart.some((item) => (item?.orderType || "food") === "food")

  const resolveShopMongoId = (data = null, fallback = null) =>
    data?._id || data?.shopId || fallback || null
  const isMongoObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || "").trim())
  if (hasQuickItems && hasFoodItems) {
    return <MixedSharedCart />
  }
  const isQuickCart = cart.length > 0 && cart.every((item) => (item?.orderType || "food") === "quick")
  if (isQuickCart) {
    return <QuickSharedCart />
  }

  const { getDefaultAddress, getDefaultPaymentMethod, setDefaultAddress, addresses, paymentMethods, userProfile } = useProfile()
  const { createOrder } = useOrders()
  const { openLocationSelector } = useLocationSelector()
  const { location: currentLocation, loading: currentLocationLoading } = useUserLocation() // Get live location address

  const [showCoupons, setShowCoupons] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponCode, setCouponCode] = useState("")
  const [manualCouponCode, setManualCouponCode] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash")
  const [showPaymentSheet, setShowPaymentSheet] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [isLoadingWallet, setIsLoadingWallet] = useState(false)
  const [shopNote, setShopNote] = useState("")
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharePayload, setSharePayload] = useState(null)
  const [isEditingRecipient, setIsEditingRecipient] = useState(false)
  const [recipientDetails, setRecipientDetails] = useState({
    name: "",
    phone: "",
  })
  const [currentLocationLabel, setCurrentLocationLabel] = useState("Home")

  const [sendCutlery, setSendCutlery] = useState(true)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [showBillDetails, setShowBillDetails] = useState(true)
  const [showPlacingOrder, setShowPlacingOrder] = useState(false)
  const [orderProgress, setOrderProgress] = useState(0)
  const [showOrderSuccess, setShowOrderSuccess] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState(null)
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [deliveryAddressMode, setDeliveryAddressMode] = useState(() => {
    try {
      if (typeof window === "undefined") return "saved"
      return localStorage.getItem("deliveryAddressMode") || "saved"
    } catch {
      return "saved"
    }
  })

  useEffect(() => {
    const audio = new Audio(iggymetSound)
    audio.preload = "auto"
    audio.volume = 0.8
    orderSuccessAudioRef.current = audio

    return () => {
      if (orderSuccessAudioRef.current) {
        orderSuccessAudioRef.current.pause()
        orderSuccessAudioRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!showOrderSuccess || !orderSuccessAudioRef.current) return

    orderSuccessAudioRef.current.currentTime = 0
    orderSuccessAudioRef.current.play().catch((error) => {
      debugWarn("Order success sound blocked by browser:", error?.message || error)
    })
  }, [showOrderSuccess])

  // Shop and pricing state
  const [shopData, setShopData] = useState(null)
  const [loadingShop, setLoadingShop] = useState(false)
  const [pricing, setPricing] = useState(null)
  const [loadingPricing, setLoadingPricing] = useState(false)
  const [takeawayCashOption, setTakeawayCashOption] = useState({
    available: true,
    reason: "",
  })

  // Scheduled Delivery states
  const [fulfillmentType, setFulfillmentType] = useState("delivery")
  const [isScheduled, setIsScheduled] = useState(false)
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("")
  const [shopTimings, setShopTimings] = useState(null)
  const [loadingTimings, setLoadingTimings] = useState(false)
  const isTakeaway = fulfillmentType === "takeaway"
  const takeawayEnabled = shopData?.takeawayEnabled !== false
  const isTakeawayCashBlocked = isTakeaway && takeawayCashOption.available === false

  const syncTakeawayCashAvailability = (payload = null) => {
    if (!isTakeaway) {
      setTakeawayCashOption({ available: true, reason: "" })
      return
    }

    const cashOption = payload?.paymentOptions?.cash
    setTakeawayCashOption({
      available: cashOption?.available !== false,
      reason: cashOption?.reason || "",
    })
  }

  useEffect(() => {
    if (!takeawayEnabled && fulfillmentType === "takeaway") {
      setFulfillmentType("delivery")
    }
  }, [takeawayEnabled, fulfillmentType])

  useEffect(() => {
    if (!bulkOrderMode) return
    if (fulfillmentType !== "delivery") {
      setFulfillmentType("delivery")
    }
    if (!isScheduled) {
      setIsScheduled(true)
    }
  }, [bulkOrderMode, fulfillmentType, isScheduled])

  useEffect(() => {
    if ((isTakeawayCashBlocked || bulkOrderMode) && selectedPaymentMethod === "cash") {
      setSelectedPaymentMethod("razorpay")
    }
  }, [isTakeawayCashBlocked, bulkOrderMode, selectedPaymentMethod])

  useEffect(() => {
    const fetchTimings = async () => {
      const rId = shopData?._id || shopData?.shopId || cart[0]?.shopId || null;
      if (!rId) return;
      try {
        setLoadingTimings(true);
        const res = await shopAPI.getOutletTimingsByShopId(rId);
        if (res?.data?.success && res?.data?.data?.outletTimings) {
          setShopTimings(res.data.data.outletTimings);
        }
      } catch (err) {
        debugError("Error fetching shop timings:", err);
      } finally {
        setLoadingTimings(false);
      }
    };
    fetchTimings();
  }, [shopData, cart]);

  const dateOptions = useMemo(() => {
    const dates = [];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`;
      
      let label = "";
      if (i === 0) label = "Today";
      else if (i === 1) label = "Tomorrow";
      else {
        label = `${days[d.getDay()]}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      }
      
      dates.push({ dateStr, label, dayName: days[d.getDay()] });
    }
    return dates;
  }, []);

  useEffect(() => {
    if (dateOptions.length > 0 && !selectedDate) {
      setSelectedDate(dateOptions[0].dateStr);
    }
  }, [dateOptions, selectedDate]);

  const timeSlots = useMemo(() => {
    if (!shopTimings || !selectedDate) return [];
    
    const dateObj = dateOptions.find(d => d.dateStr === selectedDate);
    if (!dateObj) return [];
    
    const dayTimings = shopTimings[dateObj.dayName];
    if (!dayTimings || !dayTimings.isOpen) return [];
    
    const slots = [];
    const openingTime = dayTimings.openingTime || "09:00";
    const closingTime = dayTimings.closingTime || "22:00";
    
    const [openH, openM] = openingTime.split(':').map(Number);
    const [closeH, closeM] = closingTime.split(':').map(Number);
    
    const openMinutes = openH * 60 + openM;
    let closeMinutes = closeH * 60 + closeM;
    
    if (closeMinutes < openMinutes) {
      closeMinutes += 24 * 60;
    }
    
    const now = new Date();
    const isToday = selectedDate === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const minStartMinutes = isToday ? (now.getHours() * 60 + now.getMinutes() + 60) : openMinutes;
    
    const latestSlotStart = closeMinutes - 30;
    
    let currentMin = Math.max(openMinutes, minStartMinutes);
    const remainder = currentMin % 30;
    if (remainder !== 0) {
      currentMin += (30 - remainder);
    }
    
    while (currentMin <= latestSlotStart) {
      const h = Math.floor((currentMin % (24 * 60)) / 60);
      const m = currentMin % 60;
      const startStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      
      const endMin = currentMin + 30;
      const endH = Math.floor((endMin % (24 * 60)) / 60);
      const endM = endMin % 60;
      
      const format12H = (hour, min) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
        return `${String(formattedHour).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;
      };
      
      const label = `${format12H(h, m)} - ${format12H(endH, endM)}`;
      
      slots.push({ value: startStr, label });
      currentMin += 30;
    }
    
    return slots;
  }, [shopTimings, selectedDate, dateOptions]);

  useEffect(() => {
    if (timeSlots.length > 0) {
      const isValid = timeSlots.some(s => s.value === selectedTimeSlot);
      if (!isValid) {
        setSelectedTimeSlot(timeSlots[0].value);
      }
    } else {
      setSelectedTimeSlot("");
    }
  }, [timeSlots, selectedTimeSlot]);

  // Addons state
  const [addons, setAddons] = useState([])
  const [loadingAddons, setLoadingAddons] = useState(false)

  // Coupons state - fetched from backend
  const [availableCoupons, setAvailableCoupons] = useState([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)
  const [userOrderCount, setUserOrderCount] = useState(0)

  // Fee settings from database (used for platform fee and GST fallback only)
  const [feeSettings, setFeeSettings] = useState({
    deliveryFee: 25,
    deliveryFeeRanges: [],
    freeDeliveryThreshold: 149,
    platformFee: 5,
    gstRate: 5,
  })

  const cartCount = getCartCount()
  const getAddressId = (address) => address?.id || address?._id || null
  const normalizeAddressLabel = (label) => {
    if (!label) return ""
    const value = String(label).trim().toLowerCase()
    if (value === "work" || value === "office") return "office"
    if (value === "home") return "home"
    if (value === "other") return "other"
    return value
  }
  const getDisplayAddressLabel = (label) => {
    const normalized = normalizeAddressLabel(label)
    if (normalized === "office") return "Work"
    if (normalized === "home") return "Home"
    if (normalized === "other") return "Other"
    return label || "Saved address"
  }
  const sanitizeRecipientName = (value) =>
    String(value || "")
      .replace(/[^A-Za-z\s.'-]/g, "")
      .replace(/\s{2,}/g, " ")
      .trimStart()
  const isValidRecipientName = (value) =>
    /^[A-Za-z][A-Za-z\s.'-]*$/.test(String(value || "").trim())
  const sanitizeRecipientPhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "")
    if (digits.length <= 10) return digits
    return digits.slice(-10)
  }
  const isValidRecipientPhone = (value) => /^[6-9]\d{9}$/.test(sanitizeRecipientPhone(value))
  const savedAddress = getDefaultAddress()
  const selectedAddress = addresses.find((addr) => getAddressId(addr) && getAddressId(addr) === selectedAddressId)

  const currentLocationAddress = useMemo(() => {
    // `LocationSelectorOverlay` updates backend + localStorage, but Cart's live hook might lag.
    // So we fall back to `localStorage.userLocation` when `currentLocation` doesn't have a usable payload yet.
    let locFromStorage = null
    try {
      const storedRaw = localStorage.getItem("userLocation")
      locFromStorage = storedRaw ? JSON.parse(storedRaw) : null
    } catch {
      locFromStorage = null
    }

    const loc = currentLocation?.latitude && currentLocation?.longitude ? currentLocation : locFromStorage
    if (!loc?.latitude || !loc?.longitude) return null

    const formattedAddress = loc?.formattedAddress || loc?.address || ""
    if (!formattedAddress || formattedAddress === "Select location") return null

    return {
      // Backend deliveryAddressSchema expects label in ['Home','Office','Other'].
      label: currentLocationLabel === "Work" ? "Office" : currentLocationLabel,
      formattedAddress,
      address: formattedAddress,
      street: loc?.street || loc?.address || loc?.area || "Current Location",
      additionalDetails: loc?.area || "",
      buildingName: "",
      floor: "",
      landmark: "",
      city: loc?.city || loc?.area || "Current City",
      state: loc?.state || loc?.city || "Current State",
      zipCode: loc?.postalCode || loc?.zipCode || "",
      phone: userProfile?.phone || "",
      location: {
        type: "Point",
        coordinates: [loc.longitude, loc.latitude], // [lng, lat]
      },
    }
  }, [
    currentLocation?.latitude,
    currentLocation?.longitude,
    currentLocation?.formattedAddress,
    currentLocation?.address,
    currentLocation?.street,
    currentLocation?.area,
    currentLocation?.city,
    currentLocation?.state,
    currentLocation?.postalCode,
    currentLocation?.zipCode,
    userProfile?.phone,
    deliveryAddressMode,
    currentLocationLabel,
  ])

  const defaultAddress = useMemo(() => {
    return deliveryAddressMode === "current"
      ? currentLocationAddress || selectedAddress || savedAddress || null
      : selectedAddress || savedAddress || currentLocationAddress || null
  }, [deliveryAddressMode, currentLocationAddress, selectedAddress, savedAddress])

  const hasSavedAddress = isTakeaway || Boolean(defaultAddress && formatFullAddress(defaultAddress))
  const recipientName =
    sanitizeRecipientName(recipientDetails.name || "") ||
    sanitizeRecipientName(userProfile?.name || "") ||
    "Your Name"
  const recipientPhone =
    sanitizeRecipientPhone(recipientDetails.phone || "") ||
    sanitizeRecipientPhone(userProfile?.phone || "") ||
    ""
  const selectedAddressCoordinates = defaultAddress?.location?.coordinates
  const zoneLocation = selectedAddressCoordinates?.length === 2
    ? {
      latitude: selectedAddressCoordinates[1],
      longitude: selectedAddressCoordinates[0]
    }
    : currentLocation
  const { zoneId } = useZone(zoneLocation) // Prefer selected/saved address zone
  const defaultPayment = getDefaultPaymentMethod()

  useEffect(() => {
    // Sync delivery mode from overlay/localStorage changes.
    // No dependency array: overlay open/close re-renders Cart via provider state update,
    // even when GPS coords don't move enough to update `currentLocation`.
    try {
      const mode = localStorage.getItem("deliveryAddressMode") || "saved"
      setDeliveryAddressMode((prev) => (prev === mode ? prev : mode))
    } catch {
      // ignore
    }
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const raw = window.localStorage.getItem(CART_RECIPIENT_DETAILS_STORAGE_KEY)
      if (!raw) {
        hasRestoredRecipientRef.current = true
        return
      }

      const stored = JSON.parse(raw)
      setRecipientDetails({
        name: sanitizeRecipientName(stored?.name || ""),
        phone: sanitizeRecipientPhone(stored?.phone || ""),
      })
      setIsEditingRecipient(Boolean(stored?.isEditingRecipient))
    } catch {
      setRecipientDetails({ name: "", phone: "" })
      setIsEditingRecipient(false)
    } finally {
      hasRestoredRecipientRef.current = true
    }
  }, [])

  useEffect(() => {
    setRecipientDetails((prev) => ({
      name: prev.name || sanitizeRecipientName(userProfile?.name || "") || "",
      phone: prev.phone || sanitizeRecipientPhone(userProfile?.phone || "") || "",
    }))
  }, [userProfile?.name, userProfile?.phone])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!hasRestoredRecipientRef.current) return

    try {
      window.localStorage.setItem(
        CART_RECIPIENT_DETAILS_STORAGE_KEY,
        JSON.stringify({
          name: recipientDetails.name || "",
          phone: sanitizeRecipientPhone(recipientDetails.phone || ""),
          isEditingRecipient,
        })
      )
    } catch {
      // Ignore storage errors and keep cart flow working.
    }
  }, [recipientDetails, isEditingRecipient])

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      window.localStorage.removeItem(CART_ORDER_NOTE_STORAGE_KEY)
    } catch {
      // Ignore storage errors and keep note flow working.
    }
  }, [])

  useEffect(() => {
    if (deliveryAddressMode === "current") {
      setSelectedAddressId(null)
    }
  }, [deliveryAddressMode])

  useEffect(() => {
    const defaultId = getAddressId(savedAddress)
    if (deliveryAddressMode !== "current" && !selectedAddressId && defaultId) {
      setSelectedAddressId(defaultId)
    }
  }, [savedAddress, selectedAddressId, deliveryAddressMode])

  // Get shop ID from cart or shop data
  // Priority: shopData > cart[0].shopId
  // DO NOT use cart[0].shop as slug fallback - it creates wrong slugs
  const shopId = cart.length > 0
    ? (shopData?._id || shopData?.shopId || cart[0]?.shopId || null)
    : null

  // Stable shop ID for addons fetch (memoized to prevent dependency array issues)
  // Prefer shopData IDs (more reliable) over slug from cart
  const shopIdForAddons = useMemo(() => {
    // Only use shopData if it's loaded, otherwise wait
    if (shopData) {
      return shopData._id || shopData.shopId || null
    }
    // If shopData is not loaded yet, return null to wait
    return null
  }, [shopData])



  // Lock body scroll and scroll to top when any full-screen modal opens
  useEffect(() => {
    if (showPlacingOrder || showOrderSuccess) {
      // Lock body scroll
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.top = `-${window.scrollY}px`

      // Scroll window to top
      window.scrollTo({ top: 0, behavior: 'instant' })
    } else {
      // Restore body scroll
      const scrollY = document.body.style.top
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1)
      }
    }

    return () => {
      // Cleanup on unmount
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
    }
  }, [showPlacingOrder, showOrderSuccess])

  // Fetch shop data when cart has items
  useEffect(() => {
    const fetchShopData = async () => {
      if (cart.length === 0) {
        setShopData(null)
        return
      }

      // If we already have shopData, don't fetch again
      if (shopData) {
        return
      }

      setLoadingShop(true)

      // Strategy 1: Try using shopId from cart if available
      if (cart[0]?.shopId) {
        try {
          const cartShopId = cart[0].shopId;
          const cartShopName = cart[0].shop;

          debugLog("?? Fetching shop data by shopId from cart:", cartShopId)
          const response = await shopAPI.getShopById(cartShopId)
          const data = response?.data?.data?.shop || response?.data?.data?.shop || response?.data?.shop || response?.data?.shop

          if (data) {
            // CRITICAL: Validate that fetched shop matches cart items
            const fetchedShopId = data.shopId || data._id?.toString();
            const fetchedShopName = data.name;

            // Check if shopId matches
            const shopIdMatches =
              fetchedShopId === cartShopId ||
              data._id?.toString() === cartShopId ||
              data.shopId === cartShopId;

            // Check if shop name matches (if available in cart)
            const shopNameMatches =
              !cartShopName ||
              fetchedShopName?.toLowerCase().trim() === cartShopName.toLowerCase().trim();

            if (!shopIdMatches) {
              debugError('? CRITICAL: Fetched shop ID does not match cart shopId!', {
                cartShopId: cartShopId,
                fetchedShopId: fetchedShopId,
                fetched_id: data._id?.toString(),
                fetched_shopId: data.shopId,
                cartShopName: cartShopName,
                fetchedShopName: fetchedShopName
              });
              // Don't set shopData if IDs don't match - this prevents wrong shop assignment
              setLoadingShop(false);
              return;
            }

            if (!shopNameMatches) {
              debugWarn('?? WARNING: Shop name mismatch:', {
                cartShopName: cartShopName,
                fetchedShopName: fetchedShopName
              });
              // Still proceed but log warning
            }

            debugLog("? Shop data loaded from cart shopId:", {
              _id: data._id,
              shopId: data.shopId,
              name: data.name,
              cartShopId: cartShopId,
              cartShopName: cartShopName
            })
            setShopData(data)
            setLoadingShop(false)
            return
          }
        } catch (error) {
          debugWarn("?? Failed to fetch by cart shopId, trying fallback...", error)
        }
      }

      // Strategy 2: If no shopId in cart, search by shop name
      if (cart[0]?.shop && !shopData) {
        try {
          debugLog("?? Searching shop by name:", cart[0].shop)
          const searchResponse = await shopAPI.getShops({ limit: 100 })
          const shops = searchResponse?.data?.data?.shops || searchResponse?.data?.data || []
          debugLog("?? Fetched", shops.length, "shops for name search")

          // Try exact match first
          let matchingShop = shops.find(r =>
            r.name?.toLowerCase().trim() === cart[0].shop?.toLowerCase().trim()
          )

          // If no exact match, try partial match
          if (!matchingShop) {
            debugLog("?? No exact match, trying partial match...")
            matchingShop = shops.find(r =>
              r.name?.toLowerCase().includes(cart[0].shop?.toLowerCase().trim()) ||
              cart[0].shop?.toLowerCase().trim().includes(r.name?.toLowerCase())
            )
          }

          if (matchingShop) {
            // CRITICAL: Validate that the found shop matches cart items
            const cartShopName = cart[0]?.shop?.toLowerCase().trim();
            const foundShopName = matchingShop.name?.toLowerCase().trim();

            if (cartShopName && foundShopName && cartShopName !== foundShopName) {
              debugError("? CRITICAL: Shop name mismatch!", {
                cartShopName: cart[0]?.shop,
                foundShopName: matchingShop.name,
                cartShopId: cart[0]?.shopId,
                foundShopId: matchingShop.shopId || matchingShop._id
              });
              // Don't set shopData if names don't match - this prevents wrong shop assignment
              setLoadingShop(false);
              return;
            }

            debugLog("? Found shop by name:", {
              name: matchingShop.name,
              _id: matchingShop._id,
              shopId: matchingShop.shopId,
              slug: matchingShop.slug,
              cartShopName: cart[0]?.shop
            })
            setShopData(matchingShop)
            setLoadingShop(false)
            return
          } else {
            debugWarn("?? Shop not found even by name search. Searched in", shops.length, "shops")
            if (shops.length > 0) {
              debugLog("?? Available shop names:", shops.map(r => r.name).slice(0, 10))
            }
          }
        } catch (searchError) {
          debugWarn("?? Error searching shops by name:", searchError)
        }
      }

      // If all strategies fail, set to null
      setShopData(null)
      setLoadingShop(false)
    }

    fetchShopData()
  }, [cart.length, cart[0]?.shopId, cart[0]?.shop])

  // Fetch approved addons for the shop
  useEffect(() => {
    const fetchAddonsWithId = async (idToUse) => {

      debugLog("?? Addons fetch - Using ID:", {
        shopData: shopData ? {
          _id: shopData._id,
          shopId: shopData.shopId,
          name: shopData.name
        } : 'Not loaded',
        cartShopId: shopId,
        idToUse: idToUse
      })

      // Convert to string for validation
      const idString = String(idToUse)
      debugLog("?? Shop ID string:", idString, "Type:", typeof idString, "Length:", idString.length)

      // Validate ID format (should be ObjectId or shopId format)
      const isValidIdFormat = /^[a-zA-Z0-9\-_]+$/.test(idString) && idString.length >= 3

      if (!isValidIdFormat) {
        debugWarn("?? Shop ID format invalid:", idString)
        setAddons([])
        return
      }

      try {
        setLoadingAddons(true)
        debugLog("?? Fetching addons for shop ID:", idString)
        const response = await shopAPI.getAddonsByShopId(idString)
        debugLog("? Addons API response received:", response?.data)
        debugLog("?? Response structure:", {
          success: response?.data?.success,
          data: response?.data?.data,
          addons: response?.data?.data?.addons,
          directAddons: response?.data?.addons
        })

        const data = response?.data?.data?.addons || response?.data?.addons || []
        debugLog("?? Fetched addons count:", data.length)
        debugLog("?? Fetched addons data:", JSON.stringify(data, null, 2))

        if (data.length === 0) {
          debugWarn("?? No addons returned from API. Response:", response?.data)
        } else {
          debugLog("? Successfully fetched", data.length, "addons:", data.map(a => a.name))
        }

        setAddons(data)
      } catch (error) {
        // Log error for debugging
        debugError("? Addons fetch error:", {
          code: error.code,
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
          data: error.response?.data
        })
        // Silently handle network errors and 404 errors
        // Network errors (ERR_NETWORK) happen when backend is not running - this is OK for development
        // 404 errors mean shop might not have addons or shop not found - also OK
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          debugError("Error fetching addons:", error)
        }
        // Continue with cart even if addons fetch fails
        setAddons([])
      } finally {
        setLoadingAddons(false)
      }
    }

    const fetchAddons = async () => {
      if (cart.length === 0) {
        setAddons([])
        return
      }

      // Wait for shopData to be loaded (including fallback search)
      if (loadingShop) {
        debugLog("? Waiting for shopData to load (including fallback search)...")
        return
      }

      // Must have shopData to fetch addons
      if (!shopData) {
        debugWarn("?? No shopData available for addons fetch")
        setAddons([])
        return
      }

      // Use shopData ID (most reliable)
      const idToUse = shopData._id || shopData.shopId
      if (!idToUse) {
        debugWarn("?? No valid shop ID in shopData")
        setAddons([])
        return
      }

      debugLog("? Using shopData ID for addons:", idToUse)
      fetchAddonsWithId(idToUse)
    }

    fetchAddons()
  }, [shopData, cart.length, loadingShop])

  // Fetch coupons for items in cart
  useEffect(() => {
    const fetchCouponsForCartItems = async () => {
      if (cart.length === 0 || !shopId) {
        setAvailableCoupons([])
        return
      }

      debugLog(`[CART-COUPONS] Fetching coupons for ${cart.length} items in cart`)
      setLoadingCoupons(true)

      const allCoupons = []
      const uniqueCouponCodes = new Set()

      // Fetch coupons for each item in cart
      for (const cartItem of cart) {
        const couponItemId = cartItem.itemId || cartItem.id
        if (!couponItemId) {
          debugLog(`[CART-COUPONS] Skipping item without id:`, cartItem)
          continue
        }

        try {
          debugLog(`[CART-COUPONS] Fetching coupons for itemId: ${couponItemId}, name: ${cartItem.name}`)
          const response = await shopAPI.getCouponsByItemIdPublic(shopId, couponItemId)

          if (response?.data?.success && response?.data?.data?.coupons) {
            const coupons = response.data.data.coupons
            debugLog(`[CART-COUPONS] Found ${coupons.length} coupons for item ${couponItemId}`)

            // Add coupons, avoiding duplicates
            coupons.forEach(coupon => {
              if (!uniqueCouponCodes.has(coupon.couponCode)) {
                uniqueCouponCodes.add(coupon.couponCode)
                const rawDiscountType = String(coupon.discountType || "").toLowerCase()
                const isPercentageCoupon = rawDiscountType === "percentage" || rawDiscountType === "percent"
                const discountType = isPercentageCoupon ? "percentage" : "flat-price"
                const discountValue = Number(coupon.discountValue ?? coupon.discountAmount ?? coupon.discount ?? 0)
                const discountPercentage = Number(
                  coupon.discountPercentage || (discountType === "percentage" ? discountValue : 0),
                )
                const fallbackFlatDiscount = Math.max(
                  0,
                  Number(coupon.originalPrice || 0) - Number(coupon.discountedPrice || 0),
                )
                const flatDiscount = discountType === "flat-price"
                  ? Math.max(0, discountValue, fallbackFlatDiscount)
                  : fallbackFlatDiscount
                const maxDiscount = coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null
                const effectiveDiscount =
                  discountType === "percentage"
                    ? (maxDiscount && maxDiscount > 0
                      ? maxDiscount
                      : Math.max(0, (subtotal * discountPercentage) / 100))
                    : flatDiscount
                // Convert backend coupon format to frontend format
                allCoupons.push({
                  code: coupon.couponCode,
                  discount: effectiveDiscount,
                  discountType,
                  discountValue,
                  discountPercentage,
                  discountDisplay: discountType === "percentage"
                    ? `${discountPercentage}% OFF${maxDiscount && maxDiscount > 0 ? ` (up to ${RUPEE_SYMBOL}${maxDiscount})` : ""}`
                    : `${RUPEE_SYMBOL}${flatDiscount} OFF`,
                  minOrder: coupon.minOrderValue || 0,
                  maxDiscount,
                  description: discountType === "percentage"
                    ? `${discountPercentage}% OFF${maxDiscount && maxDiscount > 0 ? ` up to ${RUPEE_SYMBOL}${maxDiscount}` : ""} with '${coupon.couponCode}'`
                    : `Save ${RUPEE_SYMBOL}${flatDiscount} with '${coupon.couponCode}'`,
                  originalPrice: coupon.originalPrice,
                  discountedPrice: coupon.discountedPrice,
                  customerGroup: coupon.customerGroup || "all",
                  isGlobalCoupon: Boolean(coupon.isGlobalCoupon),
                  itemId: couponItemId,
                  itemName: cartItem.name,
                })
              }
            })
          }
        } catch (error) {
          debugError(`[CART-COUPONS] Error fetching coupons for item ${cartItem.id}:`, error)
        }
      }

      debugLog(`[CART-COUPONS] Total unique coupons found: ${allCoupons.length}`, allCoupons)
      setAvailableCoupons(allCoupons)
      setLoadingCoupons(false)
    }

    fetchCouponsForCartItems()
  }, [cart, shopId])

  // Calculate pricing from backend whenever cart, address, or coupon changes
  useEffect(() => {
    const calculatePricing = async () => {
      const requestId = ++pricingRequestIdRef.current
      if (cart.length === 0 || (!isTakeaway && !hasSavedAddress)) {
        if (requestId === pricingRequestIdRef.current) {
          setPricing(null)
        }
        return
      }

      try {
        setLoadingPricing(true)
        setPricing(null)
        const items = cart.map(item => ({
          itemId: item.itemId || item.id,
          name: item.name,
          price: item.price, // Price should already be in INR
          variantId: item.variantId || undefined,
          variantName: item.variantName || undefined,
          variantPrice: item.variantPrice || item.price,
          quantity: item.quantity || 1,
          image: item.image,
          description: item.description,
          isVeg: isItemVeg(item)
        }))

        const resolvedShopId = resolveShopMongoId(shopData, shopId) || undefined
        if (hasFoodItems && !isMongoObjectId(resolvedShopId)) {
          if (requestId === pricingRequestIdRef.current) {
            setPricing(null)
          }
          return
        }
        const resolvedCouponCode =
          appliedCoupon?.type === "shop-auto-offer"
            ? undefined
            : appliedCoupon?.code || couponCode || undefined

        const response = await orderAPI.calculateOrder({
          items,
          shopId: resolvedShopId,
          fulfillmentType,
          isBulkOrder: bulkOrderMode,
          deliveryAddress: isTakeaway ? null : defaultAddress,
          address: isTakeaway ? null : defaultAddress,
          couponCode: resolvedCouponCode
        })

        if (response?.data?.success && response?.data?.data?.pricing) {
          if (requestId !== pricingRequestIdRef.current) return
          syncTakeawayCashAvailability(response?.data?.data)
          const backendPricing = response.data.data.pricing
          setPricing(backendPricing)
          const backendAutoAppliedOffer =
            backendPricing.autoAppliedOffer?.type === "shop-auto-offer"
              ? backendPricing.autoAppliedOffer
              : null
          const backendAutoOfferFeedback =
            backendPricing.autoOfferFeedback?.type === "shop-auto-offer"
              ? backendPricing.autoOfferFeedback
              : null

          // Update applied coupon if backend returns one
          if (backendAutoAppliedOffer) {
            const hasManualCouponApplied =
              appliedCoupon &&
              appliedCoupon?.type !== "shop-auto-offer" &&
              Boolean(appliedCoupon?.code)
            const hasSameAutoOffer =
              appliedCoupon?.type === "shop-auto-offer" &&
              String(appliedCoupon.offerId || "") === String(backendAutoAppliedOffer.offerId || "") &&
              Number(appliedCoupon.discount || 0) === Number(backendAutoAppliedOffer.discount || 0)
            if (!hasSameAutoOffer && !hasManualCouponApplied) {
              setAppliedCoupon(backendAutoAppliedOffer)
            }
            lastAutoOfferToastRef.current = ""
          } else if (backendPricing.appliedCoupon && !appliedCoupon) {
            const backendAppliedCoupon = backendPricing.appliedCoupon
            if (backendAppliedCoupon?.type === "shop-auto-offer") {
              setAppliedCoupon(backendAppliedCoupon)
            } else {
              const coupon = availableCoupons.find(c => c.code === backendAppliedCoupon.code)
              if (coupon) {
                setAppliedCoupon(coupon)
              }
            }
          } else if (!backendPricing.appliedCoupon && appliedCoupon?.type === "shop-auto-offer") {
            setAppliedCoupon(null)
          }

          if (backendAutoOfferFeedback?.reason === "max_items_exceeded") {
            const feedbackKey = `${backendAutoOfferFeedback.offerId || "offer"}:${backendAutoOfferFeedback.eligibleItemCount || 0}:${backendAutoOfferFeedback.maxOfferQuantityPerOrder || 0}`
            if (lastAutoOfferToastRef.current !== feedbackKey) {
              lastAutoOfferToastRef.current = feedbackKey
              toast.error(
                backendAutoOfferFeedback.message ||
                  `Only ${backendAutoOfferFeedback.maxOfferQuantityPerOrder} items are allowed for this offer in one order.`,
              )
            }
          } else if (!backendAutoAppliedOffer) {
            lastAutoOfferToastRef.current = ""
          }
        }
      } catch (error) {
        if (requestId !== pricingRequestIdRef.current) return
        // Network errors or 404 errors - silently handle, fallback to frontend calculation
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          debugError("Error calculating pricing:", error)
        }
        // Fallback to frontend calculation if backend fails
        syncTakeawayCashAvailability(null)
        setPricing(null)
      } finally {
        if (requestId === pricingRequestIdRef.current) {
          setLoadingPricing(false)
        }
      }
    }

    calculatePricing()
  }, [cart, defaultAddress, appliedCoupon, couponCode, shopId, shopData, hasFoodItems, hasSavedAddress, fulfillmentType, isTakeaway, bulkOrderMode])

  // Fetch wallet balance
  useEffect(() => {
    const fetchWalletBalance = async () => {
      try {
        setIsLoadingWallet(true)
        const response = await userAPI.getWallet({ noCache: true })
        if (response?.data?.success && response?.data?.data?.wallet) {
          setWalletBalance(response.data.data.wallet.balance || 0)
        }
      } catch (error) {
        debugError("Error fetching wallet balance:", error)
        setWalletBalance(0)
      } finally {
        setIsLoadingWallet(false)
      }
    }
    fetchWalletBalance()
  }, [])

  // Fetch user order count (used for first-time coupon eligibility)
  useEffect(() => {
    const fetchOrderCount = async () => {
      try {
        const response = await userAPI.getOrders({ page: 1, limit: 1 })
        if (response?.data?.success) {
          const totalOrders = response?.data?.data?.pagination?.total || 0
          setUserOrderCount(totalOrders)
        }
      } catch (error) {
        debugError("Error fetching user order count:", error)
        setUserOrderCount(0)
      }
    }

    fetchOrderCount()
  }, [])

  // Fetch fee settings on mount
  useEffect(() => {
    const fetchFeeSettings = async () => {
      try {
        const response = await adminAPI.getPublicFeeSettings()
        if (response.data.success && response.data.data.feeSettings) {
          setFeeSettings({
            deliveryFee: response.data.data.feeSettings.deliveryFee || 25,
            deliveryFeeRanges: response.data.data.feeSettings.deliveryFeeRanges || [],
            freeDeliveryThreshold: response.data.data.feeSettings.freeDeliveryThreshold || 149,
            platformFee: response.data.data.feeSettings.platformFee || 5,
            gstRate: response.data.data.feeSettings.gstRate || 5,
          })
        }
      } catch (error) {
        debugError('Error fetching fee settings:', error)
        // Keep default values on error
      }
    }

    const handleFocus = () => {
      fetchFeeSettings()
    }

    fetchFeeSettings()
    window.addEventListener("focus", handleFocus)
    const intervalId = setInterval(fetchFeeSettings, 30000)

    return () => {
      window.removeEventListener("focus", handleFocus)
      clearInterval(intervalId)
    }
  }, [])

  const fallbackCartSubtotal = cart.reduce((sum, item) => {
    const bulkOrderPricing = normalizeBulkOrderPricing(item?.bulkOrderPricing)
    const quantity = Number(item?.quantity || 0)
    const isBulkEligible =
      bulkOrderMode &&
      bulkOrderPricing.enabled &&
      Number.isInteger(bulkOrderPricing.minQuantity) &&
      quantity >= bulkOrderPricing.minQuantity &&
      Number.isFinite(bulkOrderPricing.bulkPrice)
    const unitPrice = isBulkEligible
      ? Number(bulkOrderPricing.bulkPrice || item.price || 0)
      : Number(item.price || 0)
    return sum + unitPrice * quantity
  }, 0)

  const backendSubtotal = Number(pricing?.subtotal)
  const hasValidBackendSubtotal = Number.isFinite(backendSubtotal)

  // In bulk mode, derive the item total directly from the cart lines so stale/non-bulk
  // calculate responses cannot briefly overwrite the visible subtotal.
  const subtotal = bulkOrderMode
    ? fallbackCartSubtotal
    : hasValidBackendSubtotal
      ? backendSubtotal
      : fallbackCartSubtotal
  const fallbackDeliveryFee = (() => {
    if (appliedCoupon?.freeDelivery) {
      return 0
    }

    const ranges = Array.isArray(feeSettings.deliveryFeeRanges) ? [...feeSettings.deliveryFeeRanges] : []
    if (ranges.length > 0) {
      const sortedRanges = ranges.sort((a, b) => Number(a.min) - Number(b.min))
      for (let i = 0; i < sortedRanges.length; i += 1) {
        const range = sortedRanges[i]
        const min = Number(range.min)
        const max = Number(range.max)
        const fee = Number(range.fee)
        const isLastRange = i === sortedRanges.length - 1
        const inRange = isLastRange
          ? subtotal >= min && subtotal <= max
          : subtotal >= min && subtotal < max

        if (inRange) return fee
      }

      return 0
    }

    if (subtotal >= feeSettings.freeDeliveryThreshold) {
      return 0
    }

    return Number(feeSettings.deliveryFee || 0)
  })()
  const deliveryFee = pricing?.deliveryFee || fallbackDeliveryFee
  const deliveryFeeBreakdown = pricing?.deliveryFeeBreakdown || null
  const hasDistanceDeliveryBreakdown =
    deliveryFeeBreakdown?.source === "distance" &&
    Number.isFinite(Number(deliveryFeeBreakdown?.distanceKm))
  const deliveryFeeBreakdownText = hasDistanceDeliveryBreakdown
    ? `Distance ${Number(deliveryFeeBreakdown.distanceKm).toFixed(1)} km: ${RUPEE_SYMBOL}${Number(deliveryFeeBreakdown.basePayout || 0).toFixed(0)} base + ${Number(deliveryFeeBreakdown.extraDistanceKm || 0).toFixed(1)} km x ${RUPEE_SYMBOL}${Number(deliveryFeeBreakdown.commissionPerKm || 0).toFixed(0)}`
    : null
  const platformFee = pricing?.platformFee || feeSettings.platformFee
  const gstCharges = pricing?.tax || Math.round(subtotal * (feeSettings.gstRate / 100))
  const discount = pricing?.discount || (appliedCoupon ? Math.min(appliedCoupon.discount, subtotal * 0.5) : 0)
  const displayedAppliedCoupon = appliedCoupon?.type !== "shop-auto-offer" ? appliedCoupon : null
  const couponDiscount = pricing?.couponDiscount || (displayedAppliedCoupon ? (appliedCoupon?.discount || 0) : 0)
  const autoOfferDiscount = displayedAppliedCoupon ? 0 : (pricing?.autoOfferDiscount || (
    pricing?.autoAppliedOffer?.type === "shop-auto-offer"
      ? pricing.autoAppliedOffer.discount || 0
      : pricing?.appliedCoupon?.type === "shop-auto-offer"
        ? pricing.appliedCoupon.discount || 0
        : appliedCoupon?.type === "shop-auto-offer"
          ? appliedCoupon.discount || 0
          : 0
  ))
  const autoAppliedShopOffer =
    pricing?.autoAppliedOffer?.type === "shop-auto-offer"
      ? pricing.autoAppliedOffer
      : pricing?.appliedCoupon?.type === "shop-auto-offer"
        ? pricing.appliedCoupon
        : appliedCoupon?.type === "shop-auto-offer"
          ? appliedCoupon
          : null
  
  // Hide offer if it's already been used (check feedback from backend)
  // If backend returns null for autoAppliedOffer, it means the offer was filtered out (e.g., already used)
  const shouldShowShopOffer = !displayedAppliedCoupon &&
    autoAppliedShopOffer && 
    !pricing?.autoOfferFeedback?.reason?.includes('used') &&
    !pricing?.autoOfferFeedback?.reason?.includes('limit') &&
    !pricing?.autoOfferFeedback?.reason?.includes('per_user')
  
  const displayedShopOffer = shouldShowShopOffer ? autoAppliedShopOffer : null
  const totalBeforeDiscount = subtotal + deliveryFee + platformFee + gstCharges
  
  // Calculate effective discount based on mutual exclusivity
  const effectiveDiscount = displayedAppliedCoupon ? couponDiscount : autoOfferDiscount
  
  const backendTotal = Number(pricing?.total)
  const hasValidBackendTotal = Number.isFinite(backendTotal)
  const total = bulkOrderMode
    ? totalBeforeDiscount - effectiveDiscount
    : displayedAppliedCoupon
      ? (hasValidBackendTotal ? (backendTotal + Number(pricing?.autoOfferDiscount || 0)) : totalBeforeDiscount - effectiveDiscount)
      : (hasValidBackendTotal ? backendTotal : totalBeforeDiscount - effectiveDiscount)
  const previousDue = 0
  const totalPayable = Number(total || 0)
    
  const savings = displayedAppliedCoupon ? couponDiscount : (pricing?.savings ?? Math.max(0, totalBeforeDiscount - total))
  const selectedPaymentLabel =
    selectedPaymentMethod === "wallet"
      ? "Wallet"
      : selectedPaymentMethod === "razorpay"
        ? "Online Payment"
        : "Cash on Delivery"

  // Shop name from data or cart
  const shopName = shopData?.name || cart[0]?.shop || "Shop"
  const cartBulkOrderSummary = useMemo(() => {
    return cart.map((item) => {
      const bulkOrderPricing = normalizeBulkOrderPricing(item?.bulkOrderPricing)
      const quantity = Number(item?.quantity || 0)
      const meetsMinQuantity =
        bulkOrderPricing.enabled &&
        Number.isInteger(bulkOrderPricing.minQuantity) &&
        quantity >= bulkOrderPricing.minQuantity
      const isEligible =
        bulkOrderPricing.enabled &&
        Number.isFinite(bulkOrderPricing.bulkPrice) &&
        meetsMinQuantity

      return {
        lineItemId: item.id,
        bulkOrderPricing,
        meetsMinQuantity,
        isEligible,
        quantity,
      }
    })
  }, [cart])

  const cartBulkOrderMap = useMemo(
    () => new Map(cartBulkOrderSummary.map((entry) => [entry.lineItemId, entry])),
    [cartBulkOrderSummary],
  )
  const bulkEligibleItemsCount = cartBulkOrderSummary.filter((entry) => entry.isEligible).length
  const bulkEligibleUnitsCount = cartBulkOrderSummary
    .filter((entry) => entry.isEligible)
    .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0)
  const bulkCapableItemsCount = cartBulkOrderSummary.filter((entry) => entry.bulkOrderPricing.enabled).length
  const bulkModeBlockedItems = cartBulkOrderSummary.filter((entry) => !entry.isEligible)
  const bulkModeHasIssues = bulkOrderMode && bulkModeBlockedItems.length > 0

  useEffect(() => {
    if (!bulkOrderMode) {
      bulkModeIssueToastShownRef.current = false
      return
    }

    if (!bulkModeHasIssues || bulkModeIssueToastShownRef.current) return

    bulkModeIssueToastShownRef.current = true
    deactivateBulkOrderMode()
    toast.error("Bulk order was disabled because one or more items no longer meet the minimum quantity.")
  }, [bulkModeHasIssues, bulkOrderMode, deactivateBulkOrderMode])

  const handleActivateBulkMode = () => {
    const removableNonBulkItems = cart.filter((item) => {
      const bulkState = cartBulkOrderMap.get(item.id)
      return !bulkState?.bulkOrderPricing?.enabled
    })
    const removableBelowMinItems = cart.filter((item) => {
      const bulkState = cartBulkOrderMap.get(item.id)
      return bulkState?.bulkOrderPricing?.enabled && !bulkState?.isEligible
    })

    const result = activateBulkOrderMode()
    if (!result?.ok) {
      const warningParts = []
      if (removableNonBulkItems.length > 0) {
        warningParts.push(
          `Remove regular item${removableNonBulkItems.length > 1 ? "s" : ""}: ${removableNonBulkItems
            .map((item) => item.name)
            .slice(0, 3)
            .join(", ")}`
        )
      }
      if (removableBelowMinItems.length > 0) {
        warningParts.push(
          `Increase quantity for: ${removableBelowMinItems
            .map((item) => {
              const bulkState = cartBulkOrderMap.get(item.id)
              const minQuantity = Number(bulkState?.bulkOrderPricing?.minQuantity || 0)
              const currentQuantity = Number(item.quantity || 0)
              return `${item.name} (+${Math.max(0, minQuantity - currentQuantity)})`
            })
            .slice(0, 3)
            .join(", ")}`
        )
      }

      if (warningParts.length > 0) {
        toast.error(warningParts.join(" | "))
      } else {
      toast.error(result?.error || "Bulk order mode could not be enabled")
      }
      return
    }

    setFulfillmentType("delivery")
    setIsScheduled(true)
    if (selectedPaymentMethod === "cash") {
      setSelectedPaymentMethod("razorpay")
    }

    const removedNonBulkItems = (result.removedItems || []).filter((item) => {
      const bulkOrderPricing = normalizeBulkOrderPricing(item?.bulkOrderPricing)
      return !bulkOrderPricing.enabled
    })
    const removedBelowMinItems = (result.removedItems || []).filter((item) => {
      const bulkOrderPricing = normalizeBulkOrderPricing(item?.bulkOrderPricing)
      return bulkOrderPricing.enabled
    })

    toast.success(
      `Bulk order approved for ${result.keptCount} item${result.keptCount > 1 ? "s" : ""}. Pricing has been updated for bulk checkout.`
    )

    if (result.removedCount > 0) {
      const removalNotes = []
      if (removedNonBulkItems.length > 0) {
        removalNotes.push(
          `Removed regular item${removedNonBulkItems.length > 1 ? "s" : ""}: ${removedNonBulkItems
            .map((item) => item.name)
            .slice(0, 3)
            .join(", ")}`
        )
      }
      if (removedBelowMinItems.length > 0) {
        removalNotes.push(
          `Removed below-min bulk item${removedBelowMinItems.length > 1 ? "s" : ""}: ${removedBelowMinItems
            .map((item) => item.name)
            .slice(0, 3)
            .join(", ")}`
        )
      }

      toast.warning(
        removalNotes.length > 0
          ? removalNotes.join(" | ")
          : `${result.removedCount} item${result.removedCount > 1 ? "s were" : " was"} removed for bulk-order rules.`
      )
    }
  }

  const handleDeactivateBulkMode = () => {
    deactivateBulkOrderMode()
    toast.success("Bulk order mode disabled")
  }

  const handleCartItemQuantityChange = (item, nextQuantity) => {
    const bulkState = cartBulkOrderMap.get(item.id)
    const minQuantity = Number(bulkState?.bulkOrderPricing?.minQuantity || 0)

    if (
      bulkOrderMode &&
      bulkState?.bulkOrderPricing?.enabled &&
      nextQuantity > 0 &&
      minQuantity > 0 &&
      nextQuantity < minQuantity
    ) {
      toast.error(
        `${item.name} requires minimum quantity ${minQuantity} for bulk ordering. Remove it fully or keep ${minQuantity}+ quantity.`,
      )
      return
    }

    updateQuantity(item.id, nextQuantity)
  }

  const handleShare = async () => {
    const shopNameStr = shopName || companyName || "this shop"
    const shareUrl = window.location.href
    const shareText = `Check out what I'm ordering from ${shopNameStr}! ${shareUrl}`

    const payload = {
      title: `My Cart at ${shopNameStr}`,
      text: shareText,
      url: shareUrl,
    }

    if (isMobileDevice()) {
      openShareModal(payload)
      return
    }

    const shared = await tryNativeShare(payload)
    if (shared) {
      toast.success("Link shared successfully")
      return
    }

    openShareModal(payload)
  }

  const openShareModal = (payload) => {
    setSharePayload(payload)
    setShowShareModal(true)
  }

  const tryNativeShare = async (payload) => {
    if (typeof navigator === "undefined" || !navigator.share) return false
    try {
      await navigator.share(payload)
      return true
    } catch (error) {
      if (error?.name === "AbortError") return true
      return false
    }
  }

  const isMobileDevice = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false
    const mobileUA = /Android|iPhone|iPad|iPod|Windows Phone|Opera Mini|IEMobile/i.test(navigator.userAgent)
    const smallViewport = window.matchMedia?.("(max-width: 768px)")?.matches
    return Boolean(mobileUA || smallViewport)
  }

  const openShareTarget = (target) => {
    if (!sharePayload?.url) return

    const text = sharePayload.text || ""
    const url = sharePayload.url
    const encodedText = encodeURIComponent(text)
    const encodedUrl = encodeURIComponent(url)

    let shareLink = ""

    if (target === "whatsapp") {
      shareLink = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
    } else if (target === "telegram") {
      shareLink = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
    } else if (target === "email") {
      shareLink = `mailto:?subject=${encodeURIComponent(sharePayload.title || "Check this out")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`
    }

    if (shareLink) {
      window.open(shareLink, "_blank", "noopener,noreferrer")
      setShowShareModal(false)
    }
  }

  const copyShareLink = async () => {
    if (!sharePayload?.url) return
    await copyToClipboard(sharePayload.url)
    setShowShareModal(false)
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Link copied to clipboard!")
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.opacity = "0"
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand("copy")
        toast.success("Link copied to clipboard!")
      } catch (err) {
        toast.error("Failed to copy link")
      }
      document.body.removeChild(textArea)
    }
  }

  const handleSystemShareFromModal = async () => {
    if (!sharePayload) return
    const shared = await tryNativeShare(sharePayload)
    if (shared) {
      setShowShareModal(false)
      toast.success("Shared successfully")
    }
  }

  const handleBack = () => {
    // Priority: slug > shopId (both work for the shop details route)
    const idOrSlug = shopData?.slug || shopId
    if (idOrSlug) {
      navigate(`/food/user/shops/${idOrSlug}`)
    } else {
      goBack()
    }
  }

  // Handler to select address by label (Home, Office, Other)
  const handleSelectAddressByLabel = async (label) => {
    try {
      // Find address with matching label
      const targetLabel = normalizeAddressLabel(label)
      const address = addresses.find(addr => normalizeAddressLabel(addr.label) === targetLabel)

      if (!address) {
        toast.error(`No ${label} address found. Please add an address first.`)
        return
      }

      await handleSelectSavedAddress(address)
    } catch (error) {
      debugError(`Error selecting ${label} address:`, error)
      toast.error(`Failed to select ${label} address. Please try again.`)
    }
  }

  const handleSelectSavedAddress = async (address) => {
    try {
      const addressId = getAddressId(address)
      if (addressId) {
        setSelectedAddressId(addressId)
        setDefaultAddress(addressId)
      }

      // Get coordinates from address location
      const coordinates = address.location?.coordinates || []
      const longitude = coordinates[0]
      const latitude = coordinates[1]

      if (!latitude || !longitude) {
        toast.error(`Invalid coordinates for ${address.label || "saved"} address`)
        return
      }

      // Update location in backend
      await userAPI.updateLocation({
        latitude,
        longitude,
        address: `${address.street}, ${address.city}`,
        city: address.city,
        state: address.state,
        area: address.additionalDetails || "",
        buildingName: address.buildingName || "",
        floor: address.floor || "",
        landmark: address.landmark || "",
        formattedAddress: composeSavedAddressText(address)
      })

      // Update the location in localStorage
      const locationData = {
        city: address.city,
        state: address.state,
        address: `${address.street}, ${address.city}`,
        area: address.additionalDetails || "",
        zipCode: address.zipCode,
        buildingName: address.buildingName || "",
        floor: address.floor || "",
        landmark: address.landmark || "",
        latitude,
        longitude,
        formattedAddress: composeSavedAddressText(address)
      }
      localStorage.setItem("userLocation", JSON.stringify(locationData))
      // User selected a saved address from Cart; prefer saved mode.
      try {
        localStorage.setItem("deliveryAddressMode", "saved")
        setDeliveryAddressMode("saved")
      } catch { }

      toast.success(`${address.label || "Saved"} address selected!`)
    } catch (error) {
      debugError("Error selecting saved address:", error)
      toast.error("Failed to select address. Please try again.")
    }
  }

  const isFirstTimeCoupon = (couponLike) => {
    const scope = String(couponLike?.customerGroup || couponLike?.customerScope || "").toLowerCase()
    return scope === "new" || scope === "first-time"
  }

  const handleApplyCoupon = async (coupon) => {
    if (isFirstTimeCoupon(coupon) && userOrderCount > 0) {
      toast.error("This coupon is only for first-time users")
      return
    }

    if (subtotal < (Number(coupon.minOrder) || 0)) {
      toast.error(`Min order ${RUPEE_SYMBOL}${Number(coupon.minOrder || 0)}`)
      return
    }

    // Validate with backend first; only set applied if backend accepts
    if (cart.length > 0 && (isTakeaway || hasSavedAddress)) {
      try {
        const items = cart.map(item => ({
          itemId: item.itemId || item.id,
          name: item.name,
          price: item.price,
          variantId: item.variantId || undefined,
          variantName: item.variantName || undefined,
          variantPrice: item.variantPrice || item.price,
          quantity: item.quantity || 1,
          image: item.image,
          description: item.description,
          isVeg: isItemVeg(item)
        }))

        const response = await orderAPI.calculateOrder({
          items,
          shopId: resolveShopMongoId(shopData, shopId),
          fulfillmentType,
          isBulkOrder: bulkOrderMode,
          deliveryAddress: isTakeaway ? null : defaultAddress,
          address: isTakeaway ? null : defaultAddress,
          couponCode: coupon.code
        })

      const pricingData = response?.data?.data?.pricing
      if (!pricingData || !pricingData.appliedCoupon) {
        toast.error("Coupon not applicable")
        return
      }

      syncTakeawayCashAvailability(response?.data?.data)
      setPricing(pricingData)
      setAppliedCoupon(coupon)
        setCouponCode(coupon.code)
        setManualCouponCode(coupon.code)
        setShowCoupons(false)
      } catch (error) {
        debugError("Error recalculating pricing:", error)
        toast.error("Failed to apply coupon")
      }
    }
  }

  const handleApplyCouponCode = async () => {
    const inputCode = manualCouponCode.trim().toUpperCase()
    if (!inputCode) {
      toast.error("Enter coupon code")
      return
    }

    if (cart.length === 0 || (!isTakeaway && !hasSavedAddress)) {
      toast.error(isTakeaway ? "Add items first" : "Add items and delivery address first")
      return
    }

    const matchedCoupon = availableCoupons.find(
      (coupon) => String(coupon.code || "").toUpperCase() === inputCode,
    )

    // If we know this is first-time only and user already ordered, block early.
    if (isFirstTimeCoupon(matchedCoupon) && userOrderCount > 0) {
      toast.error("This coupon is only for first-time users")
      return
    }

    try {
      const items = cart.map(item => ({
        itemId: item.itemId || item.id,
        name: item.name,
        price: item.price,
        variantId: item.variantId || undefined,
        variantName: item.variantName || undefined,
        variantPrice: item.variantPrice || item.price,
        quantity: item.quantity || 1,
        image: item.image,
        description: item.description,
        isVeg: isItemVeg(item)
      }))

      const response = await orderAPI.calculateOrder({
        items,
        shopId: resolveShopMongoId(shopData, shopId),
        fulfillmentType,
        isBulkOrder: bulkOrderMode,
        deliveryAddress: isTakeaway ? null : defaultAddress,
        address: isTakeaway ? null : defaultAddress,
        couponCode: inputCode
      })

      const pricingData = response?.data?.data?.pricing
      if (!pricingData) {
        toast.error("Unable to validate coupon")
        return
      }

      if (!pricingData.appliedCoupon) {
        toast.error("Invalid or unavailable coupon code")
        setCouponCode("")
        return
      }

      syncTakeawayCashAvailability(response?.data?.data)
      setPricing(pricingData)
      setCouponCode(inputCode)
      setAppliedCoupon(
        matchedCoupon || {
          code: inputCode,
          discount: pricingData.appliedCoupon.discount || 0,
          minOrder: 0,
          customerGroup: "all",
        },
      )
      setShowCoupons(false)
      toast.success("Coupon applied")
    } catch (error) {
      debugError("Error applying coupon code:", error)
      toast.error("Failed to apply coupon")
    }
  }


  const handleRemoveCoupon = async () => {
    setAppliedCoupon(null)
    setCouponCode("")
    setManualCouponCode("")

    // Recalculate pricing without coupon
    if (cart.length > 0 && hasSavedAddress) {
      try {
        const items = cart.map(item => ({
          itemId: item.itemId || item.id,
          name: item.name,
          price: item.price,
          variantId: item.variantId || undefined,
          variantName: item.variantName || undefined,
          variantPrice: item.variantPrice || item.price,
          quantity: item.quantity || 1,
          image: item.image,
          description: item.description,
          isVeg: isItemVeg(item)
        }))

        const response = await orderAPI.calculateOrder({
          items,
          shopId: resolveShopMongoId(shopData, shopId),
          fulfillmentType,
          isBulkOrder: bulkOrderMode,
          deliveryAddress: isTakeaway ? null : defaultAddress,
          address: isTakeaway ? null : defaultAddress,
          couponCode: null
        })

        if (response?.data?.success && response?.data?.data?.pricing) {
          syncTakeawayCashAvailability(response?.data?.data)
          setPricing(response.data.data.pricing)
        }
      } catch (error) {
        debugError("Error recalculating pricing:", error)
      }
    }
  }


  const handlePlaceOrder = async () => {
    if (!isTakeaway && !hasSavedAddress) {
      toast.error("Please choose a delivery location to continue")
      openLocationSelector()
      return
    }

    if (cart.length === 0) {
      alert("Your cart is empty")
      return
    }

    if (isTakeawayCashBlocked && selectedPaymentMethod === "cash") {
      toast.error(takeawayCashOption.reason || "Takeaway COD is not available for this order")
      return
    }

    if (bulkOrderMode) {
      if (fulfillmentType !== "delivery") {
        toast.error("Bulk orders are available for delivery only")
        return
      }
      if (selectedPaymentMethod === "cash") {
        toast.error("Cash on Delivery is not available for bulk orders")
        return
      }
      if (bulkModeHasIssues) {
        toast.error("Some items do not meet bulk order minimum quantity requirements")
        return
      }
    }

    if (isScheduled) {
      if (!selectedDate || !selectedTimeSlot) {
        toast.error(`Please select a ${isTakeaway ? "pickup" : "delivery"} date and time slot to continue`)
        return
      }
    }

    setIsPlacingOrder(true)

    // Use API_BASE_URL from config (supports both dev and production)

    try {
      debugLog("?? Starting order placement process...")
      debugLog("?? Cart items:", cart.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, price: item.price })))
      debugLog("?? Applied coupon:", displayedAppliedCoupon?.code || displayedAppliedCoupon?.title || "None")
      debugLog("?? Delivery address:", defaultAddress?.label || defaultAddress?.city)

      // Ensure couponCode is included in pricing.
      // If `pricing` state (from calculateOrder API) is available, use it directly — it has the full
      // discount breakdown (offerByShop, couponByShop, couponByAdmin).
      // If `pricing` is null (calculateOrder failed / not called), build a fallback that still sends
      // the correct breakdown fields so backend records them in FoodOrder.pricing.
      const _isAutoOffer = displayedAppliedCoupon?.type === "shop-auto-offer" || appliedCoupon?.type === "shop-auto-offer";
      const _autoOfferAmt = _isAutoOffer ? Number(appliedCoupon?.discount || displayedAppliedCoupon?.discount || 0) : 0;
      const _couponAmt = !_isAutoOffer ? Number(appliedCoupon?.discount || 0) : 0;
      const _isCouponByShop = !_isAutoOffer && appliedCoupon?.fundedBy === "shop";
      const orderPricing = pricing || {
        subtotal,
        deliveryFee: isTakeaway ? 0 : deliveryFee,
        tax: gstCharges,
        platformFee,
        discount,
        offerByShop: _autoOfferAmt,                              // Scenario 3: item-level auto offer
        couponByShop: _isCouponByShop ? _couponAmt : 0,   // Scenario 1: shop-funded coupon
        couponByAdmin: !_isCouponByShop ? _couponAmt : 0,       // Scenario 2: platform-funded coupon
        total,
        couponCode: _isAutoOffer ? null : appliedCoupon?.code || null
      };

      // Add couponCode if not present but coupon is applied
      if (!orderPricing.couponCode && appliedCoupon?.code && appliedCoupon?.type !== "shop-auto-offer") {
        orderPricing.couponCode = appliedCoupon.code;
      }

      // Include all cart items (main items + addons)
      // Note: Addons are added as separate cart items when user clicks the + button
      const orderItems = cart.map(item => ({
        itemId: item.itemId || item.id,
        name: item.name,
        price: item.price,
        variantId: item.variantId || undefined,
        variantName: item.variantName || undefined,
        variantPrice: item.variantPrice || item.price,
        quantity: item.quantity || 1,
        image: item.image || "",
        description: item.description || "",
        isVeg: isItemVeg(item),
        preparationTime: item.preparationTime
      }))

      debugLog("?? Order items to send:", orderItems)
      debugLog("?? Order pricing:", orderPricing)

      // Check API base URL before making request (for debugging)
      const fullUrl = `${API_BASE_URL}${API_ENDPOINTS.ORDER.CREATE}`;
      debugLog("?? Making request to:", fullUrl)
      debugLog("?? Authentication token present:", !!localStorage.getItem('accessToken') || !!localStorage.getItem('user_accessToken'))

      // CRITICAL: Validate shop ID before placing order
      // Ensure we're using the correct shop from shopData (most reliable)
      const finalShopId = resolveShopMongoId(shopData);
      const finalShopName = shopData?.name || null;

      if (!finalShopId) {
        debugError('? CRITICAL: Cannot place order - Shop ID is missing!');
        debugError('?? Debug info:', {
          shopData: shopData ? {
            _id: shopData._id,
            shopId: shopData.shopId,
            name: shopData.name
          } : 'Not loaded',
          cartShopId: shopId,
          cartShopName: cart[0]?.shop,
          cartItems: cart.map(item => ({
            id: item.id,
            name: item.name,
            shop: item.shop,
            shopId: item.shopId
          }))
        });
        alert('Error: Shop information is missing. Please refresh the page and try again.');
        setIsPlacingOrder(false);
        return;
      }

      // CRITICAL: Validate that ALL cart items belong to the SAME shop
      const cartShopIds = cart
        .map(item => item.shopId)
        .filter(Boolean)
        .map(id => String(id).trim()); // Normalize to string and trim

      const cartShopNames = cart
        .map(item => item.shop)
        .filter(Boolean)
        .map(name => name.trim().toLowerCase()); // Normalize names

      // Get unique values (after normalization)
      const uniqueShopIds = [...new Set(cartShopIds)];
      const uniqueShopNames = [...new Set(cartShopNames)];

      // Check if cart has items from multiple shops
      // Note: If shop names match, allow even if IDs differ (same shop, different ID format)
      if (uniqueShopNames.length > 1) {
        // Different shop names = definitely different shops
        debugError('? CRITICAL ERROR: Cart contains items from multiple shops!', {
          shopIds: uniqueShopIds,
          shopNames: uniqueShopNames,
          cartItems: cart.map(item => ({
            id: item.id,
            name: item.name,
            shop: item.shop,
            shopId: item.shopId
          }))
        });

        // Automatically clean cart to keep items from the shop matching shopData
        if (finalShopId && finalShopName) {
          debugLog('?? Auto-cleaning cart to keep items from:', finalShopName);
          cleanCartForShop(finalShopId, finalShopName);
          toast.error('Cart contained items from different shops. Items from other shops have been removed.');
        } else {
          // If shopData is not available, keep items from first shop in cart
          const firstShopId = cart[0]?.shopId;
          const firstShopName = cart[0]?.shop;
          if (firstShopId && firstShopName) {
            debugLog('?? Auto-cleaning cart to keep items from first shop:', firstShopName);
            cleanCartForShop(firstShopId, firstShopName);
            toast.error('Cart contained items from different shops. Items from other shops have been removed.');
          } else {
            toast.error('Cart contains items from different shops. Please clear cart and try again.');
          }
        }

        setIsPlacingOrder(false);
        return;
      }

      // If shop names match but IDs differ, that's OK (same shop, different ID format)
      // But log a warning in development
      if (uniqueShopIds.length > 1 && uniqueShopNames.length === 1) {
        if (process.env.NODE_ENV === 'development') {
          debugWarn('?? Cart items have different shop IDs but same name. This is OK if IDs are in different formats.', {
            shopIds: uniqueShopIds,
            shopName: uniqueShopNames[0]
          });
        }
      }

      // Validate that cart items' shopId matches the shopData
      if (cartShopIds.length > 0) {
        const cartShopId = cartShopIds[0];

        // Check if cart shopId matches shopData
        const shopIdMatches =
          cartShopId === finalShopId ||
          cartShopId === shopData?._id?.toString() ||
          cartShopId === shopData?.shopId;

        if (!shopIdMatches) {
          debugError('? CRITICAL ERROR: Cart shopId does not match shopData!', {
            cartShopId: cartShopId,
            finalShopId: finalShopId,
            shopDataId: shopData?._id?.toString(),
            shopDataShopId: shopData?.shopId,
            shopDataName: shopData?.name,
            cartShopName: cartShopNames[0]
          });
          alert(`Error: Cart items belong to "${cartShopNames[0] || 'Unknown Shop'}" but shop data doesn't match. Please refresh the page and try again.`);
          setIsPlacingOrder(false);
          return;
        }
      }

      // Validate shop name matches
      if (cartShopNames.length > 0 && finalShopName) {
        const cartShopName = cartShopNames[0];
        if (cartShopName.toLowerCase().trim() !== finalShopName.toLowerCase().trim()) {
          debugError('? CRITICAL ERROR: Shop name mismatch!', {
            cartShopName: cartShopName,
            finalShopName: finalShopName
          });
          alert(`Error: Cart items belong to "${cartShopName}" but shop data shows "${finalShopName}". Please refresh the page and try again.`);
          setIsPlacingOrder(false);
          return;
        }
      }

      // Log order details for debugging
      debugLog('? Order validation passed - Placing order with shop:', {
        shopId: finalShopId,
        shopName: finalShopName,
        shopDataId: shopData?._id,
        shopDataShopId: shopData?.shopId,
        cartShopId: cartShopIds[0],
        cartShopName: cartShopNames[0],
        cartItemCount: cart.length
      });

      // FINAL VALIDATION: Double-check shopId before sending to backend
      const cartShopId = cart[0]?.shopId;
      if (cartShopId && cartShopId !== finalShopId &&
        cartShopId !== shopData?._id?.toString() &&
        cartShopId !== shopData?.shopId) {
        debugError('? CRITICAL: Final validation failed - shopId mismatch!', {
          cartShopId: cartShopId,
          finalShopId: finalShopId,
          shopDataId: shopData?._id?.toString(),
          shopDataShopId: shopData?.shopId,
          cartShopName: cart[0]?.shop,
          finalShopName: finalShopName
        });
        alert('Error: Shop information mismatch detected. Please refresh the page and try again.');
        setIsPlacingOrder(false);
        return;
      }

      const orderPayload = {
        items: orderItems,
        fulfillmentType,
        address: isTakeaway
          ? undefined
          : {
              ...defaultAddress,
              phone: recipientPhone || defaultAddress?.phone || "",
              name: recipientName,
              fullName: recipientName,
            },
        customerName: recipientName,
        customerPhone: recipientPhone || defaultAddress?.phone || "",
        shopId: finalShopId,
        shopName: finalShopName || undefined,
        pricing: orderPricing,
        note: "",
        shopNote: shopNote || "",
        sendCutlery: sendCutlery !== false,
        paymentMethod: selectedPaymentMethod,
        // `useZone()` can return `null`. Zod expects string/undefined, not null.
        zoneId: zoneId || undefined,
        isBulkOrder: bulkOrderMode,
        isScheduled: isScheduled || false,
        scheduledAt: isScheduled && selectedTimeSlot ? new Date(`${selectedDate}T${selectedTimeSlot}:00`).toISOString() : undefined,
      };
      // Log final order details (including paymentMethod for COD debugging)
      debugLog('?? FINAL: Sending order to backend with:', {
        shopId: finalShopId,
        shopName: finalShopName,
        itemCount: orderItems.length,
        totalAmount: orderPricing.total,
        paymentMethod: orderPayload.paymentMethod
      });

      // Check wallet balance if wallet payment selected
      if (selectedPaymentMethod === "wallet" && walletBalance < totalPayable) {
        toast.error(`Insufficient wallet balance. Required: ${RUPEE_SYMBOL}${totalPayable.toFixed(0)}, Available: ${RUPEE_SYMBOL}${walletBalance.toFixed(0)}`)
        setIsPlacingOrder(false)
        return
      }

      // Create order in backend
      const orderResponse = await orderAPI.createOrder(orderPayload)

      debugLog("? Order created successfully:", orderResponse.data)

      const { order, razorpay } = orderResponse.data.data

      // Cash flow: order placed without online payment
      if (selectedPaymentMethod === "cash") {
        toast.success("Order placed with Cash on Delivery", { id: "order-placement-success" })
        setPlacedOrderId(order?._id || order?.orderId || order?.id || null)
        setShowOrderSuccess(true)
        window.dispatchEvent(new CustomEvent('order-placed', { detail: { order } }))
        clearCart()
        setShopNote("")
        setShowNoteInput(false)
        try {
          window.localStorage.removeItem(CART_ORDER_NOTE_STORAGE_KEY)
        } catch {
          // ignore
        }
        setIsPlacingOrder(false)
        return
      }

      // Wallet flow: order placed with wallet payment (already processed in backend)
      if (selectedPaymentMethod === "wallet") {
        toast.success("Order placed with Wallet payment", { id: "order-placement-success" })
        setPlacedOrderId(order?._id || order?.orderId || order?.id || null)
        setShowOrderSuccess(true)
        window.dispatchEvent(new CustomEvent('order-placed', { detail: { order } }))
        clearCart()
        setShopNote("")
        setShowNoteInput(false)
        try {
          window.localStorage.removeItem(CART_ORDER_NOTE_STORAGE_KEY)
        } catch {
          // ignore
        }
        setIsPlacingOrder(false)
        // Refresh wallet balance
        try {
          const walletResponse = await userAPI.getWallet({ noCache: true })
          if (walletResponse?.data?.success && walletResponse?.data?.data?.wallet) {
            setWalletBalance(walletResponse.data.data.wallet.balance || 0)
          }
        } catch (error) {
          debugError("Error refreshing wallet balance:", error)
        }
        return
      }

      if (!razorpay || !razorpay.orderId || !razorpay.key) {
        debugError("? Razorpay initialization failed:", { razorpay, order })
        throw new Error(razorpay ? "Razorpay payment gateway is not configured. Please contact support." : "Failed to initialize payment")
      }

      debugLog("?? Razorpay order created:", {
        orderId: razorpay.orderId,
        amount: razorpay.amount,
        currency: razorpay.currency,
        keyPresent: !!razorpay.key
      })

      // Get user info for Razorpay prefill
      const userInfo = userProfile || {}
      const userPhone = recipientPhone || userInfo.phone || defaultAddress?.phone || ""
      const userEmail = userInfo.email || ""
      const userName = recipientName || userInfo.name || ""

      // Format phone number (remove non-digits, take last 10 digits)
      const formattedPhone = userPhone.replace(/\D/g, "").slice(-10)

      debugLog("?? User info for payment:", {
        name: userName,
        email: userEmail,
        phone: formattedPhone
      })

      // Get company name for Razorpay
      const companyName = await getCompanyNameAsync()

      // Initialize Razorpay payment
      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount, // Already in paise from backend
        currency: razorpay.currency || 'INR',
        order_id: razorpay.orderId,
        name: companyName,
        description: `Order ${order._id || order.orderId} - ${RUPEE_SYMBOL}${(razorpay.amount / 100).toFixed(2)}`,
        prefill: {
          name: userName,
          email: userEmail,
          contact: formattedPhone
        },
        notes: {
          orderId: order._id || order.orderId,
          userId: userInfo.id || "",
          shopId: shopId || "unknown"
        },
        handler: async (response) => {
          try {
            debugLog("? Payment successful, verifying...", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id
            })

            // Verify payment with backend
            const verifyOrderId = order?._id || order?.id || order?.orderMongoId
            if (!verifyOrderId) {
              throw new Error("Unable to verify payment: missing order id from create-order response")
            }
            const verifyResponse = await orderAPI.verifyPayment({
              orderId: verifyOrderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            })

            debugLog("? Payment verification response:", verifyResponse.data)

            if (verifyResponse.data.success) {
              // Payment successful
              debugLog("?? Order placed successfully:", {
                orderId: order._id || order.orderId,
                paymentId: verifyResponse.data.data?.payment?.paymentId
              })
              setPlacedOrderId(order._id || order.orderId)
              setShowOrderSuccess(true)
              window.dispatchEvent(new CustomEvent('order-placed', { detail: { order } }))
              clearCart()
              setShopNote("")
              setShowNoteInput(false)
              try {
                window.localStorage.removeItem(CART_ORDER_NOTE_STORAGE_KEY)
              } catch {
                // ignore
              }
              setIsPlacingOrder(false)
            } else {
              throw new Error(verifyResponse.data.message || "Payment verification failed")
            }
          } catch (error) {
            debugError("? Payment verification error:", error)
            const errorMessage =
              error?.response?.data?.message ||
              error?.response?.data?.error?.message ||
              error?.response?.data?.errors?.[0]?.message ||
              error?.message ||
              "Payment verification failed. Please contact support."
            alert(errorMessage)
            setIsPlacingOrder(false)
          }
        },
        onError: (error) => {
          debugError("? Razorpay payment error:", error)
          // Don't show alert for user cancellation
          if (error?.code !== 'PAYMENT_CANCELLED' && error?.message !== 'PAYMENT_CANCELLED') {
            const errorMessage = error?.description || error?.message || "Payment failed. Please try again."
            alert(errorMessage)
          }
          setIsPlacingOrder(false)
        },
        onClose: () => {
          debugLog("?? Payment modal closed by user")
          setIsPlacingOrder(false)
        }
      })
    } catch (error) {
      debugError("? Order creation error:", error)

      let errorMessage = "Failed to create order. Please try again."

      // Handle network errors
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        const backendUrl = API_BASE_URL.replace('/api', '');
        errorMessage = `Network Error: Cannot connect to backend server.\n\n` +
          `Expected backend URL: ${backendUrl}\n\n` +
          `Please check:\n` +
          `1. Backend server is running\n` +
          `2. Backend is accessible at ${backendUrl}\n` +
          `3. Check browser console (F12) for more details\n\n` +
          `If backend is not running, start it with:\n` +
          `cd appzetofood/backend && npm start`

        debugError("?? Network Error Details:", {
          code: error.code,
          message: error.message,
          config: {
            url: error.config?.url,
            baseURL: error.config?.baseURL,
            fullUrl: error.config?.baseURL + error.config?.url,
            method: error.config?.method
          },
          backendUrl: backendUrl,
          apiBaseUrl: API_BASE_URL
        })

        // Backend disconnected - no health check (new backend in progress)
      }
      // Handle timeout errors
      else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = "Request timed out. The server is taking too long to respond. Please try again."
      }
      // Handle other axios errors
      else if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`
      }
      // Handle other errors
      else if (error.message) {
        errorMessage = error.message
      }

      alert(errorMessage)
      setIsPlacingOrder(false)
    }
  }

  const handleGoToOrders = () => {

    navigate(`/food/orders/${encodeURIComponent(String(placedOrderId))}?confirmed=true`)
  }

  // Empty cart state - but don't show if order success or placing order modal is active
  if (cart.length === 0 && !showOrderSuccess && !showPlacingOrder) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="bg-white dark:bg-[#1a1a1a] border-b dark:border-gray-800 sticky top-0 z-10">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-gray-800 dark:text-white">Cart</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Utensils className="h-10 w-10 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Your cart is empty</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">Add items from a shop to start a new order</p>
          <Link to="/user">
            <Button className={`${BRAND_THEME.tokens.cart.primaryButton}`}>Browse Shops</Button>
          </Link>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#0a0a0a]">
      {/* Header - Sticky at top */}
      <div className="bg-white dark:bg-[#1a1a1a] border-b dark:border-gray-800 sticky top-0 z-20 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{shopName}</p>
                <p className="text-sm md:text-base font-medium text-gray-800 dark:text-white truncate">
                  {shopData?.estimatedDeliveryTime || "10-15 mins"} to <span className="font-semibold">Location</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-1 text-xs md:text-sm">{defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || defaultAddress?.city || "Select address") : "Select address"}</span>
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-44 md:pb-52">
        {/* Savings Banner */}
        {savings > 0 && (
          <div className="bg-brand-100 dark:bg-brand-900/20 px-4 md:px-6 py-2 md:py-3 flex-shrink-0">
            <div className="max-w-7xl mx-auto">
              <p className="text-sm md:text-base font-medium text-brand-800 dark:text-brand-200">
                Saved {RUPEE_SYMBOL}{savings} on this order
              </p>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="max-w-3xl mx-auto">
            {/* Main Cart Content */}
            <div className="space-y-2 md:space-y-4">
              {bulkOrderMode && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">Bulk order mode is active</p>
                      <p className="mt-1 text-xs font-medium">
                        Scheduled delivery is required and Cash on Delivery is disabled for this checkout.
                      </p>
                      <p className="mt-2 text-xs font-semibold text-emerald-700">
                        Bulk order approved for {bulkEligibleItemsCount} item{bulkEligibleItemsCount > 1 ? "s" : ""} and {bulkEligibleUnitsCount} unit{bulkEligibleUnitsCount > 1 ? "s" : ""}.
                      </p>
                      <p className="mt-1 text-xs font-semibold text-amber-900">
                        Bulk total payable: {RUPEE_SYMBOL}{totalPayable.toFixed(0)}
                      </p>
                      {bulkModeHasIssues && (
                        <p className="mt-2 text-xs font-semibold text-red-600">
                          Some items need higher quantity before this bulk order can be placed.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleDeactivateBulkMode}
                      className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-amber-100"
                    >
                      Turn off
                    </button>
                  </div>
                </div>
              )}

              {/* Cart Items */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-4 md:py-5 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 dark:border-gray-800">
                <div className="space-y-3 md:space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 md:gap-4">
                      {(() => {
                        const bulkState = cartBulkOrderMap.get(item.id)
                        const displayUnitPrice =
                          bulkOrderMode && bulkState?.isEligible
                            ? Number(bulkState.bulkOrderPricing.bulkPrice || item.price || 0)
                            : Number(item.price || 0)
                        const lineTotal = displayUnitPrice * Number(item.quantity || 1)
                        return (
                          <>
                      {/* Veg/Non-veg indicator */}
                      <div className={`w-4 h-4 md:w-5 md:h-5 border-2 ${isItemVeg(item) ? 'border-green-600' : 'border-red-600'} flex items-center justify-center mt-1 flex-shrink-0`}>
                        <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${isItemVeg(item) ? 'bg-green-600' : 'bg-red-600'}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200 leading-tight">{item.name}</p>
                        {item.variantName ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.variantName}</p>
                        ) : null}
                        {(() => {
                          if (!bulkState?.bulkOrderPricing?.enabled || !bulkOrderMode) return null

                          return (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700"
                              >
                                Bulk Mode Active
                              </span>
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                {bulkState.isEligible
                                  ? `${RUPEE_SYMBOL}${bulkState.bulkOrderPricing.bulkPrice} each, min ${bulkState.bulkOrderPricing.minQuantity}`
                                  : `Add ${Math.max(0, (bulkState.bulkOrderPricing.minQuantity || 0) - bulkState.quantity)} more for bulk price ${RUPEE_SYMBOL}${bulkState.bulkOrderPricing.bulkPrice}`}
                              </span>
                            </div>
                          )
                        })()}
                      </div>

                      <div className="flex items-center gap-3 md:gap-4">
                        {/* Quantity controls */}
                        <div
                          className="flex items-center rounded border"
                          style={{ borderColor: `${BRAND_THEME.colors.brand.primary}80` }}
                        >
                          <button
                            className="px-2 md:px-3 py-1 hover:bg-brand-50"
                            style={{ color: BRAND_THEME.colors.brand.primary, backgroundColor: 'transparent' }}
                            onClick={() => handleCartItemQuantityChange(item, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                          <span
                            className="px-2 md:px-3 text-sm md:text-base font-semibold min-w-[20px] md:min-w-[24px] text-center"
                            style={{ color: BRAND_THEME.colors.brand.primary }}
                          >
                            {item.quantity}
                          </span>
                          <button
                            className="px-2 md:px-3 py-1 hover:bg-brand-50"
                            style={{ color: BRAND_THEME.colors.brand.primary, backgroundColor: 'transparent' }}
                            onClick={() => handleCartItemQuantityChange(item, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                        </div>

                        <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200 min-w-[50px] md:min-w-[70px] text-right">
                          {RUPEE_SYMBOL}{lineTotal.toFixed(0)}
                        </p>
                      </div>
                          </>
                        )
                      })()}
                    </div>
                  ))}
                </div>

                {/* Add more items */}
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 mt-4 md:mt-6"
                  style={{ color: BRAND_THEME.colors.brand.primary }}
                >
                  <Plus className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="text-sm md:text-base font-medium">Add more items</span>
                </button>

                {!bulkOrderMode && bulkCapableItemsCount > 0 && (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleActivateBulkMode}
                      className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition-all hover:bg-brand-700"
                    >
                      Bulk Order
                    </button>
                  </div>
                )}
              </div>


              {/* Note & Cutlery */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-4 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowNoteInput(!showNoteInput)}
                  className="flex-1 flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl text-sm md:text-base text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <FileText className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="truncate">
                    {shopNote || "Add shop note"}
                  </span>
                </button>
                <button
                  onClick={() => setSendCutlery(!sendCutlery)}
                  className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border rounded-lg md:rounded-xl text-sm md:text-base ${sendCutlery ? 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300' : ''}`}
                  style={
                    sendCutlery
                      ? undefined
                      : {
                          borderColor: `${BRAND_THEME.colors.brand.primary}80`,
                          backgroundColor: `${BRAND_THEME.colors.brand.primary}14`,
                          color: BRAND_THEME.colors.brand.primary
                        }
                  }
                >
                  <Utensils className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="whitespace-nowrap">
                    {sendCutlery ? "Send cutlery" : "Don't send cutlery"}
                  </span>
                </button>
              </div>

              {/* Note Input */}
              {showNoteInput && (
                <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl border border-slate-100 dark:border-gray-800">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Note for shop
                  </p>
                  <textarea
                    value={shopNote}
                    onChange={(e) => setShopNote(e.target.value)}
                    placeholder="Eg. Less spicy, no onion, pack gravy separately"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl p-3 md:p-4 text-sm md:text-base resize-none h-20 md:h-24 focus:outline-none bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100"
                    style={{ borderColor: `${BRAND_THEME.colors.brand.primary}33`, outlineColor: BRAND_THEME.colors.brand.primary }}
                    maxLength={240}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Ye note shop ko order receive hote hi first popup me dikhaya jayega.
                    </p>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {shopNote.length}/240
                    </span>
                  </div>
                </div>
              )}

              {/* Complete your meal section - Approved Addons */}
              {addons.length > 0 && (
                <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                      <Sparkles
                        className="h-4 w-4 md:h-5 md:w-5"
                        style={{ color: BRAND_THEME.colors.brand.primary }}
                      />
                    </div>
                    <span className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">Complete your meal with</span>
                  </div>
                  {loadingAddons ? (
                    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex-shrink-0 w-28 md:w-36 animate-pulse">
                          <div className="w-full h-28 md:h-36 bg-gray-200 dark:bg-gray-700 rounded-lg md:rounded-xl" />
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mt-1 w-2/3" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                      {addons.map((addon) => (
                        <div key={addon.id} className="flex-shrink-0 w-28 md:w-36">
                          <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg md:rounded-xl overflow-hidden">
                            <img
                              src={addon.image || (addon.images && addon.images[0]) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"}
                              alt={addon.name}
                              className="w-full h-28 md:h-36 object-cover rounded-lg md:rounded-xl"
                              onError={(e) => {
                                e.target.onerror = null
                                e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"
                              }}
                            />
                            <div className="absolute top-1 md:top-2 left-1 md:left-2">
                              <div className="w-3.5 h-3.5 md:w-4 md:h-4 bg-white border border-green-600 flex items-center justify-center rounded">
                                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-600" />
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                // Use shop info from existing cart items to ensure format consistency
                                const cartShopId = cart[0]?.shopId || shopId;
                                const cartShopName = cart[0]?.shop || shopName;

                                if (!cartShopId || !cartShopName) {
                                  debugError('? Cannot add addon: Missing shop information', {
                                    cartShopId,
                                    cartShopName,
                                    shopId,
                                    shopName,
                                    cartItem: cart[0]
                                  });
                                  toast.error('Shop information is missing. Please refresh the page.');
                                  return;
                                }

                                const result = addToCart({
                                  id: addon.id,
                                  name: addon.name,
                                  price: addon.price,
                                  image: addon.image || (addon.images && addon.images[0]) || "",
                                  description: addon.description || "",
                                  isVeg: true,
                                  shop: cartShopName,
                                  shopId: cartShopId
                                });
                                if (!result?.ok && result?.error) {
                                  toast.error(result.error);
                                }
                              }}
                              className="absolute bottom-1 md:bottom-2 right-1 md:right-2 w-6 h-6 md:w-7 md:h-7 bg-white rounded flex items-center justify-center shadow-sm transition-colors"
                              style={{ borderColor: BRAND_THEME.colors.brand.primary }}
                            >
                              <Plus
                                className="h-3.5 w-3.5 md:h-4 md:w-4"
                                style={{ color: BRAND_THEME.colors.brand.primary }}
                              />
                            </button>
                          </div>
                          <p className="text-xs md:text-sm font-medium text-gray-800 dark:text-gray-200 mt-1.5 md:mt-2 line-clamp-2 leading-tight">{addon.name}</p>
                          {addon.description && (
                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{addon.description}</p>
                          )}
                          <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 font-semibold mt-0.5">{RUPEE_SYMBOL}{addon.price}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Coupon Section */}
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden border border-slate-100 dark:border-gray-800 shadow-sm flex flex-col">
                {deliveryFee === 0 && (
                  <div className="px-4 py-3 md:px-6 md:py-4 border-b border-dashed border-gray-200 dark:border-gray-800 flex items-center gap-3 bg-[#f4fcf7] dark:bg-green-900/10">
                    <CheckCircle2 className="h-5 w-5 text-green-600 fill-green-600/20" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">You saved {RUPEE_SYMBOL}{feeSettings.deliveryFee || 25} on delivery</span>
                  </div>
                )}

                {displayedShopOffer ? (
                  <div className="px-4 py-3 md:px-6 md:py-4 flex items-center justify-between border-b border-dashed border-gray-200 dark:border-gray-800">
                    <div className="flex items-start gap-3 flex-1">
                      <Percent className="h-5 w-5 mt-0.5" style={{ color: BRAND_THEME.colors.brand.primary }} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {displayedAppliedCoupon 
                            ? `'${displayedShopOffer.title || "Offer"}' available`
                            : `'${displayedShopOffer.title || "Offer"}' auto-applied`}
                        </p>
                        <p className="text-xs font-medium mt-0.5" style={{ color: BRAND_THEME.colors.brand.primary }}>
                          {displayedAppliedCoupon 
                            ? `Apply to save ${RUPEE_SYMBOL}${displayedShopOffer.discount || displayedShopOffer.amount || 0}`
                            : `You saved ${RUPEE_SYMBOL}${autoOfferDiscount}`}
                        </p>
                      </div>
                    </div>
                    {displayedAppliedCoupon && (
                      <button
                        onClick={handleRemoveCoupon}
                        className="border rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider shadow-sm ml-2"
                        style={{ borderColor: BRAND_THEME.colors.brand.primary, color: BRAND_THEME.colors.brand.primary }}
                      >
                        APPLY
                      </button>
                    )}
                  </div>
                ) : null}

                {displayedAppliedCoupon ? (
                  <div className="px-4 py-3 md:px-6 md:py-4 flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <Percent className="h-5 w-5 mt-0.5" style={{ color: BRAND_THEME.colors.brand.primary }} />
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          '{displayedAppliedCoupon.code}' applied
                        </p>
                        <p className="text-xs font-medium mt-0.5" style={{ color: BRAND_THEME.colors.brand.primary }}>
                          You saved {RUPEE_SYMBOL}{couponDiscount}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-xs font-semibold px-2 hover:underline"
                      style={{ color: BRAND_THEME.colors.brand.primary }}
                    >
                      REMOVE
                    </button>
                  </div>
                ) : null}

                {/* Available / Input View */}
                {!displayedAppliedCoupon && (
                  <div className="px-4 py-3 md:px-6 md:py-4 flex flex-col gap-3">
                    {loadingCoupons ? (
                      <p className="text-sm text-gray-500">Loading offers...</p>
                    ) : availableCoupons.length > 0 ? (
                      <div className="flex items-start justify-between w-full">
                          <div className="flex items-start gap-3 flex-1">
                            <Percent className="h-5 w-5 text-gray-700 dark:text-gray-300 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight mb-0.5">
                                {availableCoupons[0].discountDisplay || `Save ${RUPEE_SYMBOL}${availableCoupons[0].discount}`} with '{availableCoupons[0].code}'
                              </p>
                            {isFirstTimeCoupon(availableCoupons[0]) ? (
                              <p className="text-[11px] mb-1" style={{ color: BRAND_THEME.colors.brand.primary }}>First-time users only</p>
                            ) : subtotal < availableCoupons[0].minOrder ? (
                              <p className="text-xs font-medium mb-1" style={{ color: BRAND_THEME.colors.brand.primaryDark }}>Add items worth {RUPEE_SYMBOL}{(availableCoupons[0].minOrder - subtotal).toFixed(0)} more to unlock</p>
                            ) : null}

                            {availableCoupons.length > 1 && (
                              <button
                                onClick={() => setShowCoupons(!showCoupons)}
                                className="text-[11px] hover:underline flex items-center mt-1"
                                style={{ color: BRAND_THEME.colors.brand.primary }}
                              >
                                View all coupons <ChevronRight className="h-3 w-3 ml-0.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <button
                          className="border rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed ml-2 shadow-sm"
                          style={{ borderColor: BRAND_THEME.colors.brand.primary, color: BRAND_THEME.colors.brand.primary }}
                          onClick={() => handleApplyCoupon(availableCoupons[0])}
                          disabled={subtotal < availableCoupons[0].minOrder || (isFirstTimeCoupon(availableCoupons[0]) && userOrderCount > 0)}
                        >
                          APPLY
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Percent className="h-5 w-5 text-gray-400" />
                        <p className="text-sm text-gray-500">No offers available</p>
                      </div>
                    )}

                    {/* Show All Coupons List */}
                    {showCoupons && !displayedAppliedCoupon && availableCoupons.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-800 space-y-4">
                        {/* Input for manual code */}
                        <div className="flex flex-col sm:flex-row gap-2 mb-4">
                          <input
                            type="text"
                            value={manualCouponCode}
                            onChange={(e) => setManualCouponCode(e.target.value.toUpperCase())}
                            placeholder="Enter coupon code"
                            className="flex-1 h-9 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0a0a0a] px-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none"
                            style={{ borderColor: `${BRAND_THEME.colors.brand.primary}33`, outlineColor: BRAND_THEME.colors.brand.primary }}
                          />
                          <button
                            className="bg-white dark:bg-[#1a1a1a] border rounded px-4 h-9 text-xs font-semibold uppercase hover:bg-brand-50 dark:hover:bg-brand-900/10"
                            style={{ borderColor: BRAND_THEME.colors.brand.primary, color: BRAND_THEME.colors.brand.primary }}
                            onClick={handleApplyCouponCode}
                          >
                            APPLY
                          </button>
                        </div>
                        {availableCoupons.slice(1).map((coupon) => (
                          <div key={coupon.code} className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <Percent className="h-5 w-5 text-gray-700 dark:text-gray-300 mt-0.5 opacity-50" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight mb-0.5">
                                  {coupon.discountDisplay || `Save ${RUPEE_SYMBOL}${coupon.discount}`} with '{coupon.code}'
                                </p>
                                {isFirstTimeCoupon(coupon) ? (
                                  <p className="text-[11px] mb-1" style={{ color: BRAND_THEME.colors.brand.primary }}>First-time users only</p>
                                ) : subtotal < coupon.minOrder ? (
                                  <p className="text-xs font-medium mb-1 line-clamp-1" style={{ color: BRAND_THEME.colors.brand.primaryDark }}>Add items worth {RUPEE_SYMBOL}{(coupon.minOrder - subtotal).toFixed(0)} more to unlock</p>
                                ) : (
                                  <p className="text-xs text-gray-500 mb-1 line-clamp-1">{coupon.description}</p>
                                )}
                              </div>
                            </div>
                            <button
                              className="border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400 rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed ml-2"
                              onClick={() => handleApplyCoupon(coupon)}
                              disabled={subtotal < coupon.minOrder || (isFirstTimeCoupon(coupon) && userOrderCount > 0)}
                            >
                              APPLY
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fulfillment And Timing */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-green-600 fill-green-600/20" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Order Options</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">When do you want it?</span>
                      <div className={`grid gap-3 ${bulkOrderMode ? "grid-cols-1" : "grid-cols-2"}`}>
                        {!bulkOrderMode && (
                          <button
                            type="button"
                            onClick={() => setIsScheduled(false)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                              !isScheduled
                                ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10 text-brand-700 font-bold'
                                : 'border-slate-200 dark:border-gray-800 text-slate-600 hover:bg-slate-50'
                            }`}
                            style={!isScheduled ? { borderColor: BRAND_THEME.colors.brand.primary, color: BRAND_THEME.colors.brand.primary } : undefined}
                          >
                            <Zap className="h-4 w-4 mb-1" />
                            <span className="text-xs">Immediate</span>
                            <span className="text-[10px] opacity-80 mt-0.5">
                              {isTakeaway ? "Pickup soon" : (shopData?.estimatedDeliveryTime || "15-20 mins")}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsScheduled(true)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                            isScheduled
                              ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10 text-brand-700 font-bold'
                              : 'border-slate-200 dark:border-gray-800 text-slate-600 hover:bg-slate-50'
                          }`}
                          style={isScheduled ? { borderColor: BRAND_THEME.colors.brand.primary, color: BRAND_THEME.colors.brand.primary } : undefined}
                        >
                          <Clock className="h-4 w-4 mb-1" />
                          <span className="text-xs">Schedule</span>
                          <span className="text-[10px] opacity-80 mt-0.5">Select Date/Time</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">How should we fulfill it?</span>
                      <div className={`grid gap-3 ${bulkOrderMode ? "grid-cols-1" : "grid-cols-2"}`}>
                        <button
                          type="button"
                          onClick={() => setFulfillmentType("delivery")}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                            fulfillmentType === "delivery"
                              ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10 text-brand-700 font-bold'
                              : 'border-slate-200 dark:border-gray-800 text-slate-600 hover:bg-slate-50'
                          }`}
                          style={fulfillmentType === "delivery" ? { borderColor: BRAND_THEME.colors.brand.primary, color: BRAND_THEME.colors.brand.primary } : undefined}
                        >
                          <MapPin className="h-4 w-4 mb-1" />
                          <span className="text-xs">Delivery</span>
                          <span className="text-[10px] opacity-80 mt-0.5">Bring it to me</span>
                        </button>

                        {!bulkOrderMode && (
                          <button
                            type="button"
                            onClick={() => takeawayEnabled && setFulfillmentType("takeaway")}
                            disabled={!takeawayEnabled}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                              isTakeaway
                                ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10 text-brand-700 font-bold'
                                : 'border-slate-200 dark:border-gray-800 text-slate-600 hover:bg-slate-50'
                            }`}
                            style={isTakeaway ? { borderColor: BRAND_THEME.colors.brand.primary, color: BRAND_THEME.colors.brand.primary } : undefined}
                          >
                            <Building2 className="h-4 w-4 mb-1" />
                            <span className="text-xs">Takeaway</span>
                            <span className="text-[10px] opacity-80 mt-0.5">
                              {takeawayEnabled ? "Pickup at shop" : "Not available"}
                            </span>
                          </button>
                        )}
                      </div>
                      {!takeawayEnabled && (
                        <p className="text-[11px] text-amber-600 font-medium">
                          This shop is not accepting takeaway orders right now.
                        </p>
                      )}
                      {bulkOrderMode && (
                        <p className="text-[11px] text-amber-600 font-medium">
                          Bulk orders are available only for scheduled delivery.
                        </p>
                      )}
                    </div>
                  </div>

                  {isScheduled && (
                    <div className="mt-2 space-y-3 pt-3 border-t border-slate-100 dark:border-gray-800">
                      {loadingTimings ? (
                        <div className="text-center py-2 text-xs text-gray-500 animate-pulse">Loading timings...</div>
                      ) : !shopTimings ? (
                        <div className="text-center py-2 text-xs text-red-500">Could not load shop timings</div>
                      ) : (
                        <>
                          {/* Date Selector */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                              Select {isTakeaway ? "Pickup" : "Delivery"} Date
                            </label>
                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                              {dateOptions.map((opt) => {
                                const isSel = opt.dateStr === selectedDate;
                                return (
                                  <button
                                    key={opt.dateStr}
                                    type="button"
                                    onClick={() => setSelectedDate(opt.dateStr)}
                                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                      isSel
                                        ? 'text-white border-transparent'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 hover:bg-slate-100'
                                    }`}
                                    style={isSel ? { backgroundColor: BRAND_THEME.colors.brand.primary } : undefined}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Time Slots Selector */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                              Select {isTakeaway ? "Pickup" : "Delivery"} Time Slot
                            </label>
                            {timeSlots.length === 0 ? (
                              <div className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/20 px-3 py-2 rounded-lg">
                                No available slots for this day. The shop might be closed.
                              </div>
                            ) : (
                              <div className="relative">
                                <select
                                  value={selectedTimeSlot}
                                  onChange={(e) => setSelectedTimeSlot(e.target.value)}
                                  className="w-full text-xs bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                >
                                  {timeSlots.map((slot) => (
                                    <option key={slot.value} value={slot.value}>
                                      {slot.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Address */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
                <div className="flex items-start justify-between w-full text-left">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="bg-brand-50 dark:bg-brand-900/20 p-2 rounded-xl mt-0.5">
                      {isTakeaway ? (
                        <Building2 className="h-5 w-5" style={{ color: BRAND_THEME.colors.brand.primary }} />
                      ) : (
                        <MapPin className="h-5 w-5" style={{ color: BRAND_THEME.colors.brand.primary }} />
                      )}
                    </div>
                    <div className="flex-1">
                      {isTakeaway ? (
                        <div className="flex flex-col">
                          <p className="text-sm md:text-base text-gray-800 dark:text-gray-200">
                            Pickup from{" "}
                            <span className="font-semibold">{shopName}</span>
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 pr-4">
                            {shopData?.address ||
                              shopData?.location?.formattedAddress ||
                              shopData?.area ||
                              "Collect your order directly from the shop"}
                          </p>
                        </div>
                      ) : (
                        <>
                        <div className="flex flex-col">
                          <p className="text-sm md:text-base text-gray-800 dark:text-gray-200">
                            Delivery at{" "}
                            <span className="font-semibold">
                              {deliveryAddressMode === "current" ? "Current location" : "Location"}
                            </span>
                          </p>
                          {deliveryAddressMode === "current" ? (
                            <div className="mt-1">
                              {currentLocationLoading || !currentLocationAddress ? (
                                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                                  Finding your current address...
                                </p>
                              ) : (
                                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                  {formatFullAddress(currentLocationAddress) ||
                                    currentLocationAddress?.formattedAddress ||
                                    currentLocationAddress?.address ||
                                    "Add delivery address"}
                                </p>
                              )}
                              <div className="mt-1 flex items-center gap-2">
                                <span
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] md:text-[11px] font-semibold"
                                  style={{
                                    backgroundColor: BRAND_THEME.colors.brand.primarySoft,
                                    color: BRAND_THEME.colors.brand.primary,
                                    borderColor: `${BRAND_THEME.colors.brand.primary}4D`
                                  }}>
                                  GPS enabled
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 pr-4">
                              {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Add delivery address") : "Add delivery address"}
                            </p>
                          )}
                        </div>
                        {!hasSavedAddress && (
                          <p className="text-sm mt-2 font-medium" style={{ color: BRAND_THEME.colors.brand.primary }}>
                            Select a delivery location to continue
                          </p>
                        )}
                        {/* Address Selection Buttons */}
                        {deliveryAddressMode === "current" && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {["Home", "Work", "Other"].map((label) => {
                              const normalizedLabel = normalizeAddressLabel(label)
                              const isSelectedLabel = normalizeAddressLabel(currentLocationLabel) === normalizedLabel
                              return (
                                <button
                                  key={label}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setCurrentLocationLabel(label)
                                  }}
                                  className={`text-xs px-4 py-1.5 rounded-full font-semibold transition-all ${isSelectedLabel
                                    ? 'text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300'
                                    }`}
                                  style={isSelectedLabel ? { backgroundColor: BRAND_THEME.colors.brand.primary } : undefined}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        {addresses.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {addresses.map((address) => {
                              const addressId = getAddressId(address)
                              const isSelected = addressId && addressId === selectedAddressId
                              return (
                                <button
                                  key={addressId || `${address.label}-${address.street}-${address.city}`}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleSelectSavedAddress(address)
                                  }}
                                  className={`w-full text-left rounded-xl border-2 p-3 transition-colors ${isSelected
                                    ? "border-transparent"
                                    : "border-slate-100 dark:border-gray-800 hover:border-slate-200"
                                    }`}
                                  style={isSelected ? { borderColor: BRAND_THEME.colors.brand.primary, backgroundColor: `${BRAND_THEME.colors.brand.primary}14` } : undefined}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                        {getDisplayAddressLabel(address.label)}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                                        {formatFullAddress(address) || address.address || "Address details"}
                                      </p>
                                    </div>
                                    {isSelected && (
                                      <span
                                        className="text-[10px] text-white px-2 py-0.5 rounded uppercase font-bold tracking-wider whitespace-nowrap"
                                        style={{ backgroundColor: BRAND_THEME.colors.brand.primary }}
                                      >
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                        </>
                      )}
                    </div>
                  </div>
                  {!isTakeaway && (
                    <button
                      type="button"
                      onClick={openLocationSelector}
                      className="p-2 bg-brand-50 rounded-full hover:bg-brand-100 transition-colors dark:bg-brand-900/20 dark:hover:bg-brand-900/40"
                      style={{ color: BRAND_THEME.colors.brand.primary }}
                      aria-label="Open location selector"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Contact */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-4 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                    <Phone className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm md:text-base text-gray-800 dark:text-gray-200 font-medium">
                        {recipientName}, <span className="font-semibold">{recipientPhone || "+91-XXXXXXXXXX"}</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Order recipient details
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingRecipient) {
                        const cleanName = sanitizeRecipientName(recipientDetails.name || "")
                        const cleanPhone = sanitizeRecipientPhone(recipientDetails.phone || "")

                        if (cleanName && !isValidRecipientName(cleanName)) {
                          toast.error("Recipient name should contain letters only")
                          return
                        }

                        if (cleanPhone && !isValidRecipientPhone(cleanPhone)) {
                          toast.error("Phone number must be a valid 10-digit mobile number")
                          return
                        }

                        setRecipientDetails((prev) => ({
                          ...prev,
                          name: cleanName,
                          phone: cleanPhone,
                        }))
                      }

                      setIsEditingRecipient((prev) => !prev)
                    }}
                    className="text-xs md:text-sm font-semibold whitespace-nowrap"
                    style={{ color: BRAND_THEME.colors.brand.primary }}
                  >
                    {isEditingRecipient ? "Done" : "Change"}
                  </button>
                </div>

                {isEditingRecipient && (
                  <div className="mt-4 pt-4 border-t border-dashed border-gray-200 dark:border-gray-800 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        Name
                      </label>
                      <input
                        type="text"
                        value={recipientDetails.name}
                        onChange={(e) =>
                          setRecipientDetails((prev) => ({
                            ...prev,
                            name: sanitizeRecipientName(e.target.value),
                          }))
                        }
                        placeholder="Enter recipient name"
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111111] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
                        style={{ borderColor: `${BRAND_THEME.colors.brand.primary}33`, outlineColor: BRAND_THEME.colors.brand.primary }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={recipientDetails.phone}
                        maxLength={10}
                        onChange={(e) =>
                          setRecipientDetails((prev) => ({
                            ...prev,
                            phone: sanitizeRecipientPhone(e.target.value),
                          }))
                        }
                        onKeyDown={(e) => {
                          const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"]
                          if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault()
                          if (/^\d$/.test(e.key) && (recipientDetails.phone || "").length >= 10) e.preventDefault()
                        }}
                        placeholder="Enter recipient phone"
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111111] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
                        style={{ borderColor: `${BRAND_THEME.colors.brand.primary}33`, outlineColor: BRAND_THEME.colors.brand.primary }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      If you are ordering for someone else, save their name and phone number here.
                    </p>
                  </div>
                )}
              </div>
{/* Bill Details */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
                <button
                  onClick={() => setShowBillDetails(!showBillDetails)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <div className="text-left">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-base text-gray-800 dark:text-gray-200 font-semibold tracking-wide">Total Bill</span>
                        {savings > 0 ? (
                          <>
                            <span className="text-base text-gray-400 dark:text-gray-500 line-through font-medium">{RUPEE_SYMBOL}{totalBeforeDiscount.toFixed(2)}</span>
                            <span className="text-base font-bold text-gray-900 dark:text-white">{RUPEE_SYMBOL}{totalPayable.toFixed(2)}</span>
                            <span className="text-[11px] bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded text-center ml-1 font-semibold border border-brand-200 dark:border-brand-800">
                              You saved {RUPEE_SYMBOL}{savings.toFixed(0)}
                            </span>
                          </>
                        ) : (
                          <span className="text-base font-bold text-gray-900 dark:text-white">{RUPEE_SYMBOL}{totalPayable.toFixed(2)}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Incl. taxes and charges</p>
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${showBillDetails ? 'rotate-90' : ''}`} />
                </button>

                {showBillDetails && (
                  <div className="mt-4 pt-4 border-t border-dashed border-gray-200 dark:border-gray-800 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Item Total</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{RUPEE_SYMBOL}{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Delivery Fee</span>
                      <span
                        className={deliveryFee === 0 ? "font-medium" : "text-gray-800 dark:text-gray-200 font-medium"}
                        style={deliveryFee === 0 ? { color: BRAND_THEME.colors.brand.primary } : undefined}
                      >
                        {deliveryFee === 0 ? "FREE" : `${RUPEE_SYMBOL}${deliveryFee.toFixed(2)}`}
                      </span>
                    </div>
                    {deliveryFeeBreakdownText && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 -mt-1.5 ml-1 border-l-2 border-gray-100 pl-2">
                        {deliveryFeeBreakdownText}
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{RUPEE_SYMBOL}{platformFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">GST and Shop Charges</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{RUPEE_SYMBOL}{gstCharges.toFixed(2)}</span>
                    </div>
                    {autoOfferDiscount > 0 && (
                      <div className="flex justify-between text-sm font-medium" style={{ color: BRAND_THEME.colors.brand.primary }}>
                        <span>Offer Discount</span>
                        <span>-{RUPEE_SYMBOL}{autoOfferDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-sm font-medium" style={{ color: BRAND_THEME.colors.brand.primary }}>
                        <span>Coupon Discount</span>
                        <span>-{RUPEE_SYMBOL}{couponDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {previousDue > 0 && (
                      <div className="flex justify-between text-sm font-semibold text-amber-700">
                        <span>Previous Due</span>
                        <span>{RUPEE_SYMBOL}{previousDue.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold pt-3 mt-1 border-t border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white">
                      <span>To Pay</span>
                      <span>{RUPEE_SYMBOL}{totalPayable.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky - Place Order */}
      <div
        className="bg-white dark:bg-[#1a1a1a] border-t dark:border-gray-800 shadow-lg z-30 flex-shrink-0 fixed bottom-0 left-0 right-0"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="w-full max-w-lg mx-auto space-y-3">
            {/* Pay Using - Slim Pro UI */}
            <div
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#222222] rounded-xl border border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#282828] active:scale-[0.98] transition-all duration-200 shadow-sm"
              onClick={() => setShowPaymentSheet(true)}
            >
              <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-100/80 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
                  {selectedPaymentMethod === "wallet" ? (
                    <Wallet className="h-5 w-5" style={{ color: BRAND_THEME.colors.brand.primary }} />
                  ) : selectedPaymentMethod === "razorpay" ? (
                    <Zap className="h-5 w-5" style={{ color: BRAND_THEME.colors.brand.primary }} />
                  ) : (
                    <Banknote className="h-5 w-5" style={{ color: BRAND_THEME.colors.brand.primary }} />
                  )}
            </div>
                <div className="leading-tight">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold opacity-80">
                    PAYING WITH
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {selectedPaymentLabel}
                    </p>
                    {selectedPaymentMethod === "wallet" && (
                      <p className="text-[10px] text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 px-1 rounded">
                        {RUPEE_SYMBOL}{walletBalance.toFixed(0)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-0.5 font-bold text-[11px] uppercase tracking-widest bg-brand-50 dark:bg-brand-900/20 px-2.5 py-1 rounded-lg" style={{ color: BRAND_THEME.tokens.cart.primaryText }}>
                CHANGE <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Place Order Button */}
            <button
              onClick={handlePlaceOrder}
              disabled={isPlacingOrder || (selectedPaymentMethod === "wallet" && walletBalance < totalPayable)}
              className="w-full text-white px-6 h-12 md:h-14 rounded-2xl font-bold shadow-lg shadow-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between transition-transform active:scale-[0.98]"
              style={{ backgroundImage: BRAND_THEME.tokens.orders.primaryGradient }}
            >
              {(selectedPaymentMethod === "razorpay" || selectedPaymentMethod === "wallet" || selectedPaymentMethod === "cash") && (
                <div className="text-left flex flex-col justify-center border-r-[1.5px] border-white/20 pr-4">
                  <span className="text-xs md:text-sm font-semibold text-white/90">{RUPEE_SYMBOL}{totalPayable.toFixed(2)}</span>
                  <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-wider text-white/80 mt-[-2px]">Total</span>
                </div>
              )}
              <div className="flex items-center gap-1 mx-auto text-sm md:text-lg tracking-wide">
                {isPlacingOrder
                  ? "Processing..."
                  : !isTakeaway && !hasSavedAddress
                    ? "Select Address"
                    : "Place Order"}
                <div className="flex align-center h-full">
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

          {/* Placing Order Modal */}
          {showPlacingOrder && (
            <div className="fixed inset-0 z-[60] h-screen w-screen overflow-hidden">
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

              {/* Modal Sheet */}
              <div
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl overflow-hidden"
                style={{ animation: 'slideUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
              >
                <div className="px-6 py-8">
                  {/* Title */}
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Placing your order</h2>

                  {/* Payment Info */}
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center bg-white shadow-sm">
                      <CreditCard className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedPaymentMethod === "razorpay"
                          ? `Pay ${RUPEE_SYMBOL}${totalPayable.toFixed(2)} online (Razorpay)`
                          : selectedPaymentMethod === "wallet"
                            ? `Pay ${RUPEE_SYMBOL}${totalPayable.toFixed(2)} from Wallet`
                            : `Pay on delivery (COD)`}
                      </p>
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center bg-gray-50">
                      <svg className="w-7 h-7 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path d="M9 22V12h6v10" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">Delivering to Location</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Address") : "Add address"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {defaultAddress ? (formatFullAddress(defaultAddress) || "Address") : "Address"}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative mb-6">
                    <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-100 ease-linear"
                        style={{
                          width: `${orderProgress}%`,
                          boxShadow: '0 0 10px rgba(41, 121, 251, 0.5)',
                          backgroundImage: BRAND_THEME.tokens.cart.progressGradient
                        }}
                      />
                    </div>
                    {/* Animated shimmer effect */}
                    <div
                      className="absolute inset-0 h-2.5 rounded-full overflow-hidden pointer-events-none"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                        animation: 'shimmer 1.5s infinite',
                        width: `${orderProgress}%`
                      }}
                    />
                  </div>

                  {/* Cancel Button */}
                  <button
                    onClick={() => {
                      setShowPlacingOrder(false)
                      setIsPlacingOrder(false)
                    }}
                    className="w-full text-right"
                  >
                    <span className="font-semibold text-base hover:text-brand-700 transition-colors" style={{ color: BRAND_THEME.tokens.cart.primaryText }}>
                      CANCEL
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Order Success Celebration Page */}
          {showOrderSuccess && (
            <div
              className="fixed inset-0 z-[70] bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-center h-screen w-screen overflow-hidden"
              style={{ animation: 'fadeIn 0.3s ease-out' }}
            >
              {/* Confetti Background */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Animated confetti pieces */}
                {[...Array(50)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-3 h-3 rounded-sm"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `-10%`,
                      backgroundColor: [
                        BRAND_THEME.colors.brand.primary,
                        BRAND_THEME.colors.brand.primaryDark,
                        '#60a5fa',
                        '#ef4444',
                        BRAND_THEME.colors.brand.primaryDark,
                        '#ec4899'
                      ][Math.floor(Math.random() * 6)],
                      animation: `confettiFall ${2 + Math.random() * 2}s linear ${Math.random() * 2}s infinite`,
                      transform: `rotate(${Math.random() * 360}deg)`,
                    }}
                  />
                ))}
              </div>

              {/* Success Content */}
              <div className="relative z-10 flex flex-col items-center px-6">
                {/* Success Tick Circle */}
                <div
                  className="relative mb-8"
                  style={{ animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both' }}
                >
                  {/* Outer ring animation */}
                  <div
                    className="absolute inset-0 w-32 h-32 rounded-full border-4 border-green-500 dark:border-green-400"
                    style={{
                      animation: 'ringPulse 1.5s ease-out infinite',
                      opacity: 0.3
                    }}
                  />
                  {/* Main circle */}
                  <div className="w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 dark:from-green-500 dark:to-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-200/60 dark:shadow-green-900/40">
                    <svg
                      className="w-16 h-16 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ animation: 'checkDraw 0.5s ease-out 0.5s both' }}
                    >
                      <path d="M5 12l5 5L19 7" className="check-path" />
                    </svg>
                  </div>
                  {/* Sparkles */}
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 bg-yellow-400 dark:bg-yellow-300 rounded-full"
                      style={{
                        top: '50%',
                        left: '50%',
                        animation: `sparkle 0.6s ease-out ${0.3 + i * 0.1}s both`,
                        transform: `rotate(${i * 60}deg) translateY(-80px)`,
                      }}
                    />
                  ))}
                </div>

                {/* Location Info */}
                <div
                  className="text-center"
                  style={{ animation: 'slideUp 0.5s ease-out 0.6s both' }}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-5 h-5 text-red-500 dark:text-red-400">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {defaultAddress?.city || "Your Location"}
                    </h2>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-base">
                    {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Delivery Address") : "Delivery Address"}
                  </p>
                </div>

                {/* Order Placed Message */}
                <div
                  className="mt-12 text-center"
                  style={{ animation: 'slideUp 0.5s ease-out 0.8s both' }}
                >
                  <h3 className="text-3xl font-bold mb-2" style={{ color: BRAND_THEME.tokens.cart.primaryText }}>Order Placed!</h3>
                  <p className="text-gray-600 dark:text-gray-300">Your delicious food is on its way</p>
                </div>

                {/* Action Button */}
                <button
                  onClick={handleGoToOrders}
                  className={`mt-10 ${BRAND_THEME.tokens.cart.primaryButton} font-semibold py-4 px-12 rounded-xl shadow-lg ${BRAND_THEME.tokens.cart.successShadow} transition-all hover:shadow-xl hover:scale-105`}
                  style={{ animation: 'slideUp 0.5s ease-out 1s both' }}
                >
                  Track Your Order
                </button>
              </div>
            </div>
          )}

          {/* Payment Selection Bottom Sheet */}
          <AnimatePresence>
            {showPaymentSheet && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowPaymentSheet(false)}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                />
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 350 }}
                  className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-[2rem] z-[101] shadow-2xl overflow-hidden max-h-[82vh] md:max-h-[60vh] flex flex-col"
                  style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
                >
                  <div className="p-5 md:p-6 flex flex-col h-full min-h-0">
                    {/* Compact Drag handle */}
                    <div className="w-10 h-1 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto mb-5" />

                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white leading-none">Payment Method</h2>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter mt-1">Select how you want to pay</p>
                      </div>
                      <button
                        onClick={() => setShowPaymentSheet(false)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>

                    <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar pb-4 flex-1 min-h-0">
                      {[
                        {
                          id: 'wallet',
                          name: `${companyName} Money`,
                          description: 'Pay using your digital wallet balance',
                          icon: <Wallet className="w-5 h-5" />,
                          color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
                          selectedColor: 'bg-amber-500 text-white',
                          subInfo: `Available: ${RUPEE_SYMBOL}${walletBalance.toFixed(0)}`,
                          disabled: walletBalance < totalPayable,
                          disabledText: 'INSUFFICIENT BALANCE'
                        },
                        {
                          id: 'razorpay',
                          name: 'Online Payment',
                          description: 'UPI, Cards, Netbanking',
                          icon: <Zap className="w-5 h-5" />,
                          color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
                          selectedColor: 'bg-emerald-500 text-white',
                          badge: 'SECURE'
                        },
                        {
                          id: 'cash',
                          name: 'Cash on Delivery',
                          description: 'Pay when order arrives',
                          icon: <Banknote className="w-5 h-5" />,
                          color: 'bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400',
                          selectedColor: 'bg-brand-500 text-white',
                          disabled: isTakeawayCashBlocked || bulkOrderMode,
                          disabledText: bulkOrderMode
                            ? 'NOT AVAILABLE FOR BULK ORDERS'
                            : takeawayCashOption.reason || 'COD UNAVAILABLE'
                        }
                      ]
                        .filter((option) => !(bulkOrderMode && option.id === "cash"))
                        .map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            if (!option.disabled) {
                              setSelectedPaymentMethod(option.id)
                              setShowPaymentSheet(false)
                            }
                          }}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 group ${selectedPaymentMethod === option.id
                              ? BRAND_THEME.tokens.cart.paymentSelected
                              : `border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#222222] ${BRAND_THEME.tokens.cart.paymentHover} shadow-sm`
                            } ${option.disabled ? 'opacity-40 grayscale-[0.8] cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${selectedPaymentMethod === option.id
                                ? 'bg-white/20 text-white'
                                : option.color
                              }`}>
                              {option.icon}
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-black tracking-tight leading-none transition-colors ${selectedPaymentMethod === option.id ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                                  }`}>
                                  {option.name}
                                </span>
                                {option.badge && (
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm tracking-wider ${selectedPaymentMethod === option.id
                                      ? 'bg-white/20 text-white'
                                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    }`}>
                                    {option.badge}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <p className={`text-[11px] font-bold transition-colors ${selectedPaymentMethod === option.id ? 'text-white/80' : 'text-gray-400'
                                  }`}>
                                  {option.description}
                                </p>
                                {option.subInfo && !option.disabled && (
                                  <>
                                    <span className={`w-1 h-1 rounded-full ${selectedPaymentMethod === option.id ? 'bg-white/40' : 'bg-brand-300 dark:bg-brand-700'
                                      }`} />
                                    <p className={`text-[10px] font-black uppercase tracking-tighter transition-colors ${selectedPaymentMethod === option.id ? 'text-white' : 'text-green-600 dark:text-green-500'
                                      }`}>
                                      {option.subInfo}
                                    </p>
                                  </>
                                )}
                              </div>
                              {option.disabled && (
                                <p className="text-[9px] font-black text-red-500 mt-1 uppercase tracking-wide">
                                  {option.disabledText}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${selectedPaymentMethod === option.id
                              ? 'bg-white border-white'
                              : 'border-gray-200 dark:border-gray-700'
                            }`}>
                            {selectedPaymentMethod === option.id && <Check className="w-3.5 h-3.5" style={{ color: BRAND_THEME.tokens.cart.primaryText }} strokeWidth={4} />}
                          </div>
                        </button>
                      ))}
                    </div>

                    {isTakeawayCashBlocked && (
                      <p className="mt-1 text-[11px] font-medium text-amber-600">
                        {takeawayCashOption.reason}
                      </p>
                    )}

                    <div
                      className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4 bg-white dark:bg-[#1a1a1a]"
                      style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom, 0px))" }}
                    >
                      <div className="flex-shrink-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total Pay</p>
                        <p className="text-xl font-black tabular-nums" style={{ color: BRAND_THEME.tokens.cart.primaryText }}>{RUPEE_SYMBOL}{totalPayable.toFixed(0)}</p>
                      </div>
                      <Button
                        onClick={() => setShowPaymentSheet(false)}
                        className={`flex-1 ${BRAND_THEME.tokens.cart.primaryButton} h-11 rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 transition-all active:scale-[0.98]`}
                      >
                        Confirm Order
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Animation Styles */}
          <style>{`
        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUpBannerSmooth {
          from { transform: translateY(100%) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes slideUpBanner {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes shimmerBanner {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes scaleInBounce {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes checkMarkDraw {
          0% { stroke-dasharray: 100; stroke-dashoffset: 100; opacity: 0; }
          50% { opacity: 1; }
          100% { stroke-dasharray: 100; stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes slideUpFull {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideUpModal {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes checkDraw {
          0% { stroke-dasharray: 100; stroke-dashoffset: 100; }
          100% { stroke-dasharray: 100; stroke-dashoffset: 0; }
        }
        @keyframes ringPulse {
          0% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.3); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes sparkle {
          0% { transform: rotate(var(--rotation, 0deg)) translateY(0) scale(0); opacity: 1; }
          100% { transform: rotate(var(--rotation, 0deg)) translateY(-80px) scale(1); opacity: 0; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .animate-slideUpFull {
          animation: slideUpFull 0.3s ease-out;
        }
        .check-path {
          stroke-dasharray: 100;
          stroke-dashoffset: 0;
        }
      `}</style>

      {/* Share Modal */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showShareModal && sharePayload && (
              <>
                <motion.div
                  className="fixed inset-0 bg-black/50 z-[10020]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowShareModal(false)}
                />
                <motion.div
                  className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10021] w-[92vw] max-w-md bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.16 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-5 pt-5 pb-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">Share</h3>
                    <button
                      className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => setShowShareModal(false)}
                      aria-label="Close share modal"
                    >
                      <X className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </button>
                  </div>

                  <div className="px-5 py-4 space-y-2">
                    {typeof navigator !== "undefined" && navigator.share && (
                      <button
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                        onClick={handleSystemShareFromModal}
                      >
                        <Share2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Share via system apps</span>
                      </button>
                    )}
                    <button
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                      onClick={() => openShareTarget("whatsapp")}
                    >
                      <MessageCircle className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">WhatsApp</span>
                    </button>
                    <button
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                      onClick={() => openShareTarget("telegram")}
                    >
                      <Send className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Telegram</span>
                    </button>
                    <button
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                      onClick={() => openShareTarget("email")}
                    >
                      <Mail className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Email</span>
                    </button>
                    <button
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                      onClick={copyShareLink}
                    >
                      <Copy className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Copy link</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}      

