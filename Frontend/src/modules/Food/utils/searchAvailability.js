import { shopAPI } from "@food/api"

export const normalizeSearchAvailabilityShop = (shop = {}) => {
  const shopId =
    shop.shopId ||
    shop.mongoId ||
    shop._id ||
    shop.id ||
    null

  return {
    ...shop,
    id: shop.id || shopId,
    _id: shop._id || shopId,
    mongoId: shop.mongoId || shop._id || shopId,
    shopId,
    name: shop.name || shop.shopName || "Shop",
    shopName: shop.shopName || shop.name || "Shop",
    pureVegShop: shop.pureVegShop === true || shop.pureVegShop === "true",
    isActive: shop.isActive !== false,
    isAcceptingOrders: shop.isAcceptingOrders !== false,
    availabilityStatus: shop.availabilityStatus ?? null,
    availability: shop.availability ?? null,
    isOnline: shop.isOnline,
    currentStatus: shop.currentStatus ?? null,
    isOpen: shop.isOpen,
    openNow: shop.openNow,
    isOpenNow: shop.isOpenNow,
    isShopOpen: shop.isShopOpen,
    todayOpen: shop.todayOpen,
    isOpenToday: shop.isOpenToday,
    closedToday: shop.closedToday,
    isClosedToday: shop.isClosedToday,
    dayOff: shop.dayOff,
    isDayOff: shop.isDayOff,
    offToday: shop.offToday,
    openDays: Array.isArray(shop.openDays) ? shop.openDays : [],
    deliveryTimings: shop.deliveryTimings ?? null,
    outletTimings: shop.outletTimings ?? null,
    openingTime: shop.openingTime ?? null,
    closingTime: shop.closingTime ?? null,
  }
}

export const isPureVegShop = (shop = {}) =>
  shop?.pureVegShop === true || shop?.pureVegShop === "true"

export const isVegCompatibleCategory = (category = {}) => {
  const normalizedScope = String(
    category?.foodTypeScope ||
    category?.foodType ||
    category?.dietType ||
    "",
  ).trim().toLowerCase()

  return (
    !normalizedScope ||
    normalizedScope === "veg" ||
    normalizedScope === "vegetarian" ||
    normalizedScope === "both" ||
    normalizedScope === "all"
  )
}

export const enrichSearchShopsWithOutletTimings = async (shops = []) => {
  const normalizedShops = shops.map(normalizeSearchAvailabilityShop)

  return Promise.all(
    normalizedShops.map(async (shop) => {
      if (!shop.mongoId || shop.outletTimings) return shop

      try {
        const outletResponse = await shopAPI.getOutletTimingsByShopId(
          shop.mongoId,
          { noCache: true },
        )
        const outletTimings =
          outletResponse?.data?.data?.outletTimings ||
          outletResponse?.data?.outletTimings ||
          null

        return outletTimings ? { ...shop, outletTimings } : shop
      } catch (_) {
        return shop
      }
    }),
  )
}
