import { api, shopAPI } from "@food/api"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const getOnboardingStorageKey = () => {
    try {
      const userStr = localStorage.getItem("shop_user") || localStorage.getItem("shop_user")
      if (userStr) {
        const user = JSON.parse(userStr)
        const userId = user._id || user.id
        if (userId) return `shop_onboarding_data_${userId}`
      }
    } catch (e) {}
    return "shop_onboarding_data"
}
const ONBOARDING_STORAGE_KEY = getOnboardingStorageKey()

// Helper function to check if a step is complete
const isStepComplete = (stepData, stepNumber) => {
  if (!stepData) return false

  if (stepNumber === 1) {
    return (
      (stepData.shopName || stepData.shopName) &&
      typeof stepData.pureVegShop === "boolean" &&
      stepData.ownerName &&
      stepData.ownerEmail &&
      stepData.ownerPhone &&
      stepData.primaryContactNumber &&
      stepData.location?.area &&
      stepData.location?.city
    )
  }

  if (stepNumber === 2) {
    return (
      Array.isArray(stepData.cuisines) &&
      stepData.cuisines.length > 0 &&
      stepData.deliveryTimings?.openingTime &&
      stepData.deliveryTimings?.closingTime &&
      Array.isArray(stepData.openDays) &&
      stepData.openDays.length > 0 &&
      // Check for menu images (must have at least one)
      Array.isArray(stepData.menuImageUrls) &&
      stepData.menuImageUrls.length > 0 &&
      // Check for profile image
      stepData.profileImageUrl &&
      (stepData.profileImageUrl.url || typeof stepData.profileImageUrl === 'string')
    )
  }

  if (stepNumber === 3) {
    const hasPanImage = stepData.pan?.image && 
      (stepData.pan.image.url || typeof stepData.pan.image === 'string')
    const hasFssaiImage = stepData.fssai?.image && 
      (stepData.fssai.image.url || typeof stepData.fssai.image === 'string')
    // GST image is required only if GST is registered
    const hasGstImage = !stepData.gst?.isRegistered || 
      (stepData.gst?.image && (stepData.gst.image.url || typeof stepData.gst.image === 'string'))
    
    return (
      stepData.pan?.panNumber &&
      stepData.pan?.nameOnPan &&
      hasPanImage &&
      stepData.fssai?.registrationNumber &&
      hasFssaiImage &&
      hasGstImage &&
      stepData.bank?.accountNumber &&
      stepData.bank?.ifscCode &&
      stepData.bank?.accountHolderName &&
      stepData.bank?.accountType
    )
  }

  return false
}

const buildOnboardingLikeDataFromShop = (shop) => {
  const onboarding = shop?.onboarding || {}

  const openingTime =
    shop?.openingTime ||
    shop?.deliveryTimings?.openingTime ||
    onboarding?.step2?.deliveryTimings?.openingTime
  const closingTime =
    shop?.closingTime ||
    shop?.deliveryTimings?.closingTime ||
    onboarding?.step2?.deliveryTimings?.closingTime

  return {
    completedSteps: onboarding.completedSteps,
    step1: onboarding.step1 || {
      shopName: shop?.shopName || shop?.name,
      pureVegShop:
        typeof shop?.pureVegShop === "boolean"
          ? shop.pureVegShop
          : null,
      ownerName: shop?.ownerName,
      ownerEmail: shop?.ownerEmail || shop?.email,
      ownerPhone: shop?.ownerPhone || shop?.phone,
      primaryContactNumber: shop?.primaryContactNumber,
      location:
        shop?.location ||
        (shop?.area || shop?.city || shop?.addressLine1
          ? {
               addressLine1: shop?.addressLine1,
               addressLine2: shop?.addressLine2,
               area: shop?.area,
               city: shop?.city,
               landmark: shop?.landmark,
             }
          : null),
    },
    step2: onboarding.step2 || {
      cuisines: shop?.cuisines,
      deliveryTimings:
        shop?.deliveryTimings ||
        (openingTime || closingTime ? { openingTime, closingTime } : null),
      openDays: shop?.openDays,
      menuImageUrls: shop?.menuImages,
      profileImageUrl: shop?.profileImage,
    },
    step3:
      onboarding.step3 ||
      (shop?.panNumber ||
      shop?.fssaiNumber ||
      shop?.accountNumber ||
      shop?.ifscCode
        ? {
            pan: {
              panNumber: shop?.panNumber,
              nameOnPan: shop?.nameOnPan,
              image: shop?.panImage,
            },
            gst: {
              isRegistered: Boolean(shop?.gstRegistered),
              gstNumber: shop?.gstNumber,
              legalName: shop?.gstLegalName,
              address: shop?.gstAddress,
              image: shop?.gstImage,
            },
            fssai: {
              registrationNumber: shop?.fssaiNumber,
              expiryDate: shop?.fssaiExpiry,
              image: shop?.fssaiImage,
            },
            bank: {
              accountNumber: shop?.accountNumber,
              ifscCode: shop?.ifscCode,
              accountHolderName: shop?.accountHolderName,
              accountType: shop?.accountType,
            },
          }
        : null),
  }
}

export const isShopOnboardingComplete = (shop) => {
  if (!shop) return false

  // Approved shops should never be forced into onboarding again.
  if (shop?.status === "approved") {
    return true
  }

  if (shop?.isActive === true) {
    return true
  }

  const onboardingLikeData = buildOnboardingLikeDataFromShop(shop)
  if (onboardingLikeData.completedSteps === 4) {
    return true
  }

  const step1Complete = isStepComplete(onboardingLikeData.step1, 1)
  const step2Complete = isStepComplete(onboardingLikeData.step2, 2)
  const step3Complete = isStepComplete(onboardingLikeData.step3, 3)

  if (step1Complete && step2Complete && step3Complete) {
    return true
  }

  // Some older or migrated shop accounts have complete live profile data
  // without a reliable onboarding.completedSteps value.
  const hasOperationalProfile =
    Boolean(String(shop?.name || "").trim()) &&
    Boolean(String(shop?.shopId || "").trim()) &&
    Boolean(String(shop?.slug || "").trim()) &&
    step1Complete &&
    step2Complete &&
    (shop?.approvedAt || shop?.rejectedAt || shop?.rejectionReason || shop?.isActive === false)

  if (hasOperationalProfile) {
    return true
  }

  return false
}

// Determine which step to show based on completeness
export const determineStepToShow = (data) => {
  if (!data) return 1

  // If completedSteps is 4, onboarding is complete (admin-created shops)
  if (data.completedSteps === 4) {
    return null
  }

  // Check step 1
  if (!isStepComplete(data.step1, 1)) {
    return 1
  }

  // Check step 2
  if (!isStepComplete(data.step2, 2)) {
    return 2
  }

  // Check step 3
  if (!isStepComplete(data.step3, 3)) {
    return 3
  }

  // All steps complete
  return null
}

// Check onboarding status from API and return the step to navigate to
export const checkOnboardingStatus = async () => {
  try {
    const shopResponse = await shopAPI.getMe()
    const shop =
      shopResponse?.data?.data?.user ||
      shopResponse?.data?.data?.shop ||
      shopResponse?.data?.shop ||
      shopResponse?.data?.user ||
      null

    if (shop && isShopOnboardingComplete(shop)) {
      return null
    }

    const res = await api.get("/shop/onboarding")
    const data = res?.data?.data?.onboarding
    if (data) {
      const stepToShow = determineStepToShow(data)
      return stepToShow
    }
    // No onboarding data, start from step 1
    return 1
  } catch (err) {
    // If API call fails, check localStorage
    try {
      const localData = localStorage.getItem(getOnboardingStorageKey())
      if (localData) {
        const parsed = JSON.parse(localData)
        return parsed.currentStep || 1
      }
    } catch (localErr) {
      debugError("Failed to check localStorage:", localErr)
    }
    // Default to step 1 if everything fails
    return 1
  }
}
