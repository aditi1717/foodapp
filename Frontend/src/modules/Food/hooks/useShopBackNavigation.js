import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"

const toShopPath = (value) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()

  if (!trimmed) return null
  if (trimmed.startsWith("/food/shop")) return trimmed
  if (trimmed === "/shop") return "/food/shop"
  if (trimmed.startsWith("/shop/")) return `/food${trimmed}`

  return null
}

const getNormalizedShopPath = (pathname) => {
  if (pathname.startsWith("/food/shop")) {
    return pathname.slice("/food/shop".length) || "/"
  }
  if (pathname.startsWith("/shop")) {
    return pathname.slice("/shop".length) || "/"
  }

  return pathname || "/"
}

const resolveShopBackPath = ({ pathname, state }) => {
  const normalizedPath = getNormalizedShopPath(pathname)
  const explicitBackPath = toShopPath(state?.backTo) || toShopPath(state?.from)

  if (
    normalizedPath === "/orders/all" ||
    /^\/orders\/[^/]+$/.test(normalizedPath)
  ) {
    return explicitBackPath || "__history_back_orders__"
  }

  if (
    normalizedPath === "/food/all" ||
    /^\/food\/[^/]+$/.test(normalizedPath) ||
    /^\/food\/[^/]+\/edit$/.test(normalizedPath)
  ) {
    return explicitBackPath || "/food/shop/food/all"
  }

  if (
    normalizedPath === "/advertisements/new" ||
    /^\/advertisements\/[^/]+$/.test(normalizedPath) ||
    /^\/advertisements\/[^/]+\/edit$/.test(normalizedPath)
  ) {
    return explicitBackPath || "/food/shop/advertisements"
  }

  if (
    normalizedPath === "/coupon/new" ||
    /^\/coupon\/[^/]+\/edit$/.test(normalizedPath)
  ) {
    return explicitBackPath || "/food/shop/coupon"
  }

  if (
    normalizedPath === "/menu-categories/new" ||
    /^\/menu-categories\/[^/]+\/edit$/.test(normalizedPath)
  ) {
    return explicitBackPath || "/food/shop/menu-categories"
  }

  if (
    normalizedPath === "/edit" ||
    normalizedPath === "/edit-owner" ||
    normalizedPath === "/edit-cuisines" ||
    normalizedPath === "/edit-address" ||
    normalizedPath === "/phone" ||
    normalizedPath === "/manage-outlets" ||
    normalizedPath === "/update-bank-details" ||
    normalizedPath === "/fssai" ||
    normalizedPath === "/fssai/update" ||
    normalizedPath === "/outlet-info" ||
    normalizedPath === "/outlet-timings" ||
    /^\/outlet-timings\/[^/]+$/.test(normalizedPath) ||
    normalizedPath === "/zone-setup"
  ) {
    return explicitBackPath || "/food/shop/details"
  }

  if (
    normalizedPath === "/settings" ||
    normalizedPath === "/delivery-settings" ||
    normalizedPath === "/rush-hour" ||
    normalizedPath === "/status" ||
    normalizedPath === "/business-plan" ||
    normalizedPath === "/config" ||
    normalizedPath === "/categories" ||
    normalizedPath === "/menu-categories" ||
    normalizedPath === "/privacy" ||
    normalizedPath === "/terms"
  ) {
    return explicitBackPath || "/food/shop"
  }

  if (
    normalizedPath === "/reviews" ||
    /^\/reviews\/[^/]+\/reply$/.test(normalizedPath) ||
    normalizedPath === "/ratings-reviews" ||
    normalizedPath === "/dish-ratings"
  ) {
    return explicitBackPath || "/food/shop/reviews"
  }

  if (
    normalizedPath === "/help-centre/support" ||
    normalizedPath === "/share-feedback"
  ) {
    return explicitBackPath || "/food/shop/feedback"
  }

  if (
    normalizedPath === "/finance-details" ||
    normalizedPath === "/download-report"
  ) {
    return explicitBackPath || "/food/shop/hub-finance"
  }

  if (/^\/hub-menu\/item\/[^/]+$/.test(normalizedPath)) {
    return explicitBackPath || "/food/shop/explore"
  }

  if (explicitBackPath && explicitBackPath !== pathname) {
    return explicitBackPath
  }

  return "/food/shop"
}

export default function useShopBackNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(() => {
    const target = resolveShopBackPath(location)
    if (target === "__history_back_orders__") {
      if (window.history.length > 1) {
        navigate(-1)
      } else {
        navigate("/food/shop/orders")
      }
      return
    }
    navigate(target)
  }, [location, navigate])
}
