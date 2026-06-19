import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useEffect, Suspense, lazy } from "react"
import ProtectedRoute from "@food/components/ProtectedRoute"
import AuthRedirect from "@food/components/AuthRedirect"
import Loader from "@food/components/Loader"
import PushSoundEnableButton from "@food/components/PushSoundEnableButton"
import AppMaintenanceOverlay from "@food/components/common/AppMaintenanceOverlay"
import { registerWebPushForCurrentModule } from "@food/utils/firebaseMessaging"

// Lazy Loading Components
const UserRouter = lazy(() => import("@food/components/user/UserRouter"))

// Shop Module
const ShopRouter = lazy(() => import("@food/components/shop/ShopRouter"))

// Admin Module
const AdminRouter = lazy(() => import("@food/components/admin/AdminRouter"))
const AdminLogin = lazy(() => import("@food/pages/admin/auth/AdminLogin"))
const AdminSignup = lazy(() => import("@food/pages/admin/auth/AdminSignup"))
const AdminForgotPassword = lazy(() => import("@food/pages/admin/auth/AdminForgotPassword"))

// Delivery Module
const DeliveryRouter = lazy(() => import("../DeliveryV2"))

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NavigateToShop() {
  const location = useLocation();
  const nextPath = location.pathname.replace(/\/restaurant/g, '/shop');
  return <Navigate to={`${nextPath}${location.search || ''}`} replace />;
}

export default function App() {
  const location = useLocation()

  useEffect(() => {
    registerWebPushForCurrentModule(location.pathname)
  }, [location.pathname])

  return (
    <>
      <ScrollToTop />
      <PushSoundEnableButton />
      <AppMaintenanceOverlay />
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Shop Module */}
          <Route
            path="shop/*"
            element={<ShopRouter />}
          />
          {/* Redirect legacy restaurant routes */}
          <Route
            path="restaurant/*"
            element={<NavigateToShop />}
          />

          {/* Delivery Module */}
          <Route
            path="delivery/*"
            element={<DeliveryRouter />}
          />

          {/* User Module - Handles all other paths like /, orders/:id, address-selector etc */}
          <Route path="/*" element={<UserRouter />} />
        </Routes>
      </Suspense>
    </>
  )
}
