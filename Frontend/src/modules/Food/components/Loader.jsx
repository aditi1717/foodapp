import {
  AppShellSkeleton,
  AdminAuthSkeleton,
  AdminShellSkeleton,
  ShopAuthSkeleton,
  ShopShellSkeleton,
  DeliveryAuthSkeleton,
  DeliveryShellSkeleton
} from "@food/components/ui/loading-skeletons"

export default function Loader({ type }) {
  if (type === "admin-auth") return <AdminAuthSkeleton />
  if (type === "admin") return <AdminShellSkeleton />
  if (type === "shop-auth") return <ShopAuthSkeleton />
  if (type === "shop") return <ShopShellSkeleton />
  if (type === "delivery-auth") return <DeliveryAuthSkeleton />
  if (type === "delivery") return <DeliveryShellSkeleton />

  let pathname = ""
  if (typeof window !== "undefined") {
    pathname = (window.location?.pathname || "").toLowerCase()

    // If native shell or root URL, check native_last_route to determine module
    if (!pathname || pathname === "/" || pathname === "/food") {
      const nativeLastRoute = (localStorage.getItem("native_last_route") || "").toLowerCase()
      if (nativeLastRoute.includes("/delivery")) {
        pathname = nativeLastRoute
      } else if (nativeLastRoute.includes("/shop")) {
        pathname = nativeLastRoute
      } else if (nativeLastRoute.includes("/admin")) {
        pathname = nativeLastRoute
      }
    }
  }

  if (
    pathname.includes("/admin/login") ||
    pathname.includes("/admin/signup") ||
    pathname.includes("/admin/forgot-password")
  ) {
    return <AdminAuthSkeleton />
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return <AdminShellSkeleton />
  }

  if (
    pathname.includes("/food/shop/login") ||
    pathname.includes("/food/shop/signup") ||
    pathname.includes("/food/shop/welcome") ||
    pathname.includes("/shop/login") ||
    pathname.includes("/shop/signup")
  ) {
    return <ShopAuthSkeleton />
  }

  if (
    pathname.startsWith("/food/shop") ||
    pathname.startsWith("/shop")
  ) {
    return <ShopShellSkeleton />
  }

  if (
    pathname.includes("/food/delivery/welcome") ||
    pathname.includes("/food/delivery/login") ||
    pathname.includes("/food/delivery/signup") ||
    pathname.includes("/food/delivery/otp") ||
    pathname.includes("/delivery/welcome") ||
    pathname.includes("/delivery/login") ||
    pathname.includes("/delivery/signup") ||
    pathname.includes("/delivery/otp")
  ) {
    return <DeliveryAuthSkeleton />
  }

  if (
    pathname.startsWith("/delivery") ||
    pathname.startsWith("/food/delivery")
  ) {
    return <DeliveryShellSkeleton />
  }

  return <AppShellSkeleton />
}


