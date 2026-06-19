import { Suspense, lazy } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import ProtectedRoute from "@food/components/ProtectedRoute"
import Loader from "@food/components/Loader"

// Lazy Loading Components
const ShopOrdersPage = lazy(() => import("@food/pages/shop/OrdersPage"))
const AllOrdersPage = lazy(() => import("@food/pages/shop/AllOrdersPage"))
const ShopDetailsPage = lazy(() => import("@food/pages/shop/ShopDetailsPage"))
const EditShopPage = lazy(() => import("@food/pages/shop/EditShopPage"))
const FoodDetailsPage = lazy(() => import("@food/pages/shop/FoodDetailsPage"))
const EditFoodPage = lazy(() => import("@food/pages/shop/EditFoodPage"))
const AllFoodPage = lazy(() => import("@food/pages/shop/AllFoodPage"))
const WalletPage = lazy(() => import("@food/pages/shop/WalletPage"))
const ShopNotifications = lazy(() => import("@food/pages/shop/Notifications"))
const OrderDetails = lazy(() => import("@food/pages/shop/OrderDetails"))
const OrdersMain = lazy(() => import("@food/pages/shop/OrdersMain"))
const ShopOnboarding = lazy(() => import("@food/pages/shop/Onboarding"))
const AdvertisementsPage = lazy(() => import("@food/pages/shop/AdvertisementsPage"))
const AdDetailsPage = lazy(() => import("@food/pages/shop/AdDetailsPage"))
const NewAdvertisementPage = lazy(() => import("@food/pages/shop/NewAdvertisementPage"))
const EditAdvertisementPage = lazy(() => import("@food/pages/shop/EditAdvertisementPage"))
const CouponListPage = lazy(() => import("@food/pages/shop/CouponListPage"))
const AddCouponPage = lazy(() => import("@food/pages/shop/AddCouponPage"))
const EditCouponPage = lazy(() => import("@food/pages/shop/EditCouponPage"))
const ShopOffersPage = lazy(() => import("@food/pages/shop/OffersPage"))
const AddOfferPage = lazy(() => import("@food/pages/shop/AddOfferPage"))
const ReviewsPage = lazy(() => import("@food/pages/shop/ReviewsPage"))
const UpdateReplyPage = lazy(() => import("@food/pages/shop/UpdateReplyPage"))
const SettingsPage = lazy(() => import("@food/pages/shop/SettingsPage"))
const PrivacyPolicyPage = lazy(() => import("@food/pages/shop/PrivacyPolicyPage"))
const TermsAndConditionsPage = lazy(() => import("@food/pages/shop/TermsAndConditionsPage"))
const ShopConfigPage = lazy(() => import("@food/pages/shop/ShopConfigPage"))
const MenuCategoriesPage = lazy(() => import("@food/pages/shop/MenuCategoriesPage"))
const EditCategoryPage = lazy(() => import("@food/pages/shared/EditCategoryPage"))
const ShopProfile = lazy(() => import("@food/pages/shop/ShopProfile"))
const ShopSubscriptions = lazy(() => import("@food/pages/shop/Subscriptions"))
const ShopMySubscription = lazy(() => import("@food/pages/shop/MySubscription"))
const ConversationListPage = lazy(() => import("@food/pages/shop/ConversationListPage"))
const ChatDetailPage = lazy(() => import("@food/pages/shop/ChatDetailPage"))
const ShopStatus = lazy(() => import("@food/pages/shop/ShopStatus"))
const ExploreMore = lazy(() => import("@food/pages/shop/ExploreMore"))
const DeliverySettings = lazy(() => import("@food/pages/shop/DeliverySettings"))
const RushHour = lazy(() => import("@food/pages/shop/RushHour"))
const OutletTimings = lazy(() => import("@food/pages/shop/OutletTimings"))
const OutletInfo = lazy(() => import("@food/pages/shop/OutletInfo"))
const RatingsReviews = lazy(() => import("@food/pages/shop/RatingsReviews"))
const EditOwner = lazy(() => import("@food/pages/shop/EditOwner"))
const EditCuisines = lazy(() => import("@food/pages/shop/EditCuisines"))
const EditShopAddress = lazy(() => import("@food/pages/shop/EditShopAddress"))
const Inventory = lazy(() => import("@food/pages/shop/Inventory"))
const Feedback = lazy(() => import("@food/pages/shop/Feedback"))
const ShareFeedback = lazy(() => import("@food/pages/shop/ShareFeedback"))
const DishRatings = lazy(() => import("@food/pages/shop/DishRatings"))
const ShopSupport = lazy(() => import("@food/pages/shop/ShopSupport"))
const FssaiDetails = lazy(() => import("@food/pages/shop/FssaiDetails"))
const FssaiUpdate = lazy(() => import("@food/pages/shop/FssaiUpdate"))
const Hyperpure = lazy(() => import("@food/pages/shop/Hyperpure"))
const ItemDetailsPage = lazy(() => import("@food/pages/shop/ItemDetailsPage"))
const HubFinance = lazy(() => import("@food/pages/shop/HubFinance"))
const FinanceDetailsPage = lazy(() => import("@food/pages/shop/FinanceDetailsPage"))
const PhoneNumbersPage = lazy(() => import("@food/pages/shop/PhoneNumbersPage"))
const DownloadReport = lazy(() => import("@food/pages/shop/DownloadReport"))
const DeliveryPartnersPage = lazy(() => import("@food/pages/shop/DeliveryPartnersPage"))

const ManageOutlets = lazy(() => import("@food/pages/shop/ManageOutlets"))
const UpdateBankDetails = lazy(() => import("@food/pages/shop/UpdateBankDetails"))
const ZoneSetup = lazy(() => import("@food/pages/shop/ZoneSetup"))
const Welcome = lazy(() => import("@food/pages/shop/auth/Welcome"))
const Login = lazy(() => import("@food/pages/shop/auth/Login"))
const OTP = lazy(() => import("@food/pages/shop/auth/OTP"))
const Signup = lazy(() => import("@food/pages/shop/auth/Signup"))
const ForgotPassword = lazy(() => import("@food/pages/shop/auth/ForgotPassword"))
const VerificationPending = lazy(() => import("@food/pages/shop/auth/VerificationPending"))

export default function ShopRouter() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Auth Routes */}
        <Route path="welcome" element={<Welcome />} />
        <Route path="login" element={<Login />} />
        <Route path="otp" element={<OTP />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="pending-verification" element={<VerificationPending />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><OrdersMain /></ProtectedRoute>} path="" />
        <Route path="onboarding" element={<ShopOnboarding />} />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ShopNotifications /></ProtectedRoute>} path="notifications" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ShopOrdersPage /></ProtectedRoute>} path="orders" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><AllOrdersPage /></ProtectedRoute>} path="orders/all" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><OrderDetails /></ProtectedRoute>} path="orders/:orderId" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ShopDetailsPage /></ProtectedRoute>} path="details" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><EditShopPage /></ProtectedRoute>} path="edit" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><AllFoodPage /></ProtectedRoute>} path="food/all" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><FoodDetailsPage /></ProtectedRoute>} path="food/:id" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><EditFoodPage /></ProtectedRoute>} path="food/:id/edit" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><EditFoodPage /></ProtectedRoute>} path="food/new" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><WalletPage /></ProtectedRoute>} path="wallet" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><AdvertisementsPage /></ProtectedRoute>} path="advertisements" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><NewAdvertisementPage /></ProtectedRoute>} path="advertisements/new" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><AdDetailsPage /></ProtectedRoute>} path="advertisements/:id" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><EditAdvertisementPage /></ProtectedRoute>} path="advertisements/:id/edit" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><CouponListPage /></ProtectedRoute>} path="coupon" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><AddCouponPage /></ProtectedRoute>} path="coupon/new" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><EditCouponPage /></ProtectedRoute>} path="coupon/:id/edit" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ShopOffersPage /></ProtectedRoute>} path="offers" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><AddOfferPage /></ProtectedRoute>} path="offers/new" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><AddOfferPage /></ProtectedRoute>} path="offers/:id/edit" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ReviewsPage /></ProtectedRoute>} path="reviews" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><UpdateReplyPage /></ProtectedRoute>} path="reviews/:id/reply" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><SettingsPage /></ProtectedRoute>} path="settings" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><DeliverySettings /></ProtectedRoute>} path="delivery-settings" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><RushHour /></ProtectedRoute>} path="rush-hour" />
        <Route path="privacy" element={<PrivacyPolicyPage />} />
        <Route path="terms" element={<TermsAndConditionsPage />} />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ShopConfigPage /></ProtectedRoute>} path="config" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><MenuCategoriesPage /></ProtectedRoute>} path="menu-categories" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><EditCategoryPage /></ProtectedRoute>} path="menu-categories/new" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><EditCategoryPage /></ProtectedRoute>} path="menu-categories/:id/edit" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ShopProfile /></ProtectedRoute>} path="profile" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ShopSubscriptions /></ProtectedRoute>} path="subscriptions" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ShopMySubscription /></ProtectedRoute>} path="my-subscription" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ShopMySubscription /></ProtectedRoute>} path="my-subscriptions" />
        <Route path="business-plan" element={<Navigate to="/food/shop/subscriptions" replace />} />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ConversationListPage /></ProtectedRoute>} path="conversation" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ChatDetailPage /></ProtectedRoute>} path="conversation/:conversationId" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ShopStatus /></ProtectedRoute>} path="status" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ExploreMore /></ProtectedRoute>} path="explore" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><OutletTimings /></ProtectedRoute>} path="outlet-timings" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><OutletInfo /></ProtectedRoute>} path="outlet-info" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><RatingsReviews /></ProtectedRoute>} path="ratings-reviews" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><EditOwner /></ProtectedRoute>} path="edit-owner" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><EditCuisines /></ProtectedRoute>} path="edit-cuisines" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><EditShopAddress /></ProtectedRoute>} path="edit-address" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><Inventory /></ProtectedRoute>} path="inventory" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><Feedback /></ProtectedRoute>} path="feedback" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ShareFeedback /></ProtectedRoute>} path="share-feedback" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><DishRatings /></ProtectedRoute>} path="dish-ratings" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ShopSupport /></ProtectedRoute>} path="help-centre/support" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><FssaiDetails /></ProtectedRoute>} path="fssai" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><FssaiUpdate /></ProtectedRoute>} path="fssai/update" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><Hyperpure /></ProtectedRoute>} path="hyperpure" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ItemDetailsPage /></ProtectedRoute>} path="hub-menu/item/:id" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><HubFinance /></ProtectedRoute>} path="hub-finance" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><FinanceDetailsPage /></ProtectedRoute>} path="finance-details" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><PhoneNumbersPage /></ProtectedRoute>} path="phone" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><DownloadReport /></ProtectedRoute>} path="download-report" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ManageOutlets /></ProtectedRoute>} path="manage-outlets" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><UpdateBankDetails /></ProtectedRoute>} path="update-bank-details" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><ZoneSetup /></ProtectedRoute>} path="zone-setup" />
        <Route element={<ProtectedRoute requiredRole="restaurant" loginPath="/food/shop/login"><DeliveryPartnersPage /></ProtectedRoute>} path="delivery-partners" />
      </Routes>
    </Suspense>
  )
}

