/**
 * API layer - auth connected to new backend; rest stubbed for UI compatibility.
 */

import apiClient from "./axios.js";
import { API_ENDPOINTS } from "./config.js";
import * as authService from "./auth.js";

const stub = () =>
  Promise.resolve({
    data: { success: false, message: "Backend not connected", data: null },
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  });

/** Search API - unified search for user app */
export const searchAPI = {
  unifiedSearch: (params = {}) =>
    apiClient.get("/food/search/unified", { params }),
  getAdminCategories: (params = {}) =>
    apiClient.get("/food/search/categories/admin", { params }),
};

const createStubAPI = () =>
  new Proxy(
    {},
    {
      get(_, prop) {
        return () => stub();
      },
    },
  );

export default apiClient;
export { API_ENDPOINTS };

// Stub for non-auth endpoints so we don't hit backend for unimplemented routes (avoids 404s and extra calls).
// Auth is done via authAPI/authService which use apiClient directly.
const emptyDataStub = () =>
  Promise.resolve({
    data: { success: false, data: null },
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  });

export const api = {
  get: (_url, _config) => emptyDataStub(),
  post: (_url, _data, _config) => emptyDataStub(),
  put: (_url, _data, _config) => emptyDataStub(),
  patch: (_url, _data, _config) => emptyDataStub(),
  delete: (_url, _config) => emptyDataStub(),
};

/** Single in-flight + short cache for user /auth/me - avoids duplicate calls. */
let userMeInFlight = null;
let userMeCached = null;
let userMeCacheTime = 0;
let userMeCacheToken = null;
const USER_ME_CACHE_MS = 3000;

const getUserMeOnce = () => {
  const now = Date.now();
  const currentToken = typeof window !== "undefined" ? localStorage.getItem("user_accessToken") || localStorage.getItem("accessToken") : null;

  if (userMeCached && userMeCacheToken === currentToken && now - userMeCacheTime < USER_ME_CACHE_MS) {
    return Promise.resolve(userMeCached);
  }
  
  // Invalidate in-flight if token changed
  if (userMeInFlight && userMeCacheToken !== currentToken) {
    userMeInFlight = null;
  }

  if (!userMeInFlight) {
    const requestToken = currentToken;
    userMeCacheToken = requestToken;
    
    userMeInFlight = authService
      .getMe("user")
      .then((res) => {
        userMeCached = res;
        userMeCacheTime = Date.now();
        userMeCacheToken = requestToken; // Update token along with cache
        return res;
      })
      .finally(() => {
        userMeInFlight = null;
      });
  }
  return userMeInFlight;
};

/** Auth API - user OTP + admin login via new backend */
export const authAPI = {
  sendOTP: (phone, _purpose = "login", _email = null) => {
    if (!phone) return Promise.reject(new Error("Phone is required"));
    return authService.requestUserOtp(phone);
  },
  verifyOTP: (
    phone,
    otp,
    _purpose,
    _name,
    _email,
    _role,
    _password,
    _referralCode,
    fcmToken = null,
    platform = "web",
  ) => {
    if (!phone || !otp)
      return Promise.reject(new Error("Phone and OTP are required"));
    return authService.verifyUserOtp(
      phone,
      otp,
      _referralCode,
      _name,
      fcmToken,
      platform,
    );
  },
  getCurrentUser: () => getUserMeOnce(),
  refreshToken: (token) => authService.refreshToken(token),
  logout: (refreshToken, fcmToken = null, platform = "web") => {
    const token =
      refreshToken ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("user_refreshToken")
        : null);
    return authService.logout(token, fcmToken, platform);
  },
};

export const supportAPI = {
  createTicket: (body) =>
    apiClient.post("/food/user/support/ticket", body ?? {}, {
      contextModule: "user",
    }),
  getMyTickets: (params = {}) =>
    apiClient.get("/food/user/support/my-tickets", {
      params,
      contextModule: "user",
    }),
  getSupportTicketsAdmin: (params = {}) =>
    apiClient.get("/food/admin/support-tickets", {
      params,
      contextModule: "admin",
    }),
  updateSupportTicketAdmin: (id, body = {}) =>
    apiClient.patch(`/food/admin/support-tickets/${String(id)}`, body ?? {}, {
      contextModule: "admin",
    }),
};

export const notificationAPI = {
  getInbox: (params = {}, config = {}) =>
    apiClient.get("/food/notifications/inbox", {
      params,
      ...config,
    }),
  markAsRead: (id, config = {}) =>
    apiClient.patch(`/food/notifications/${String(id)}/read`, {}, config),
  dismiss: (id, config = {}) =>
    apiClient.delete(`/food/notifications/${String(id)}`, config),
  dismissAll: (config = {}) =>
    apiClient.delete("/food/notifications/inbox/all", config),
};

/** Admin API - new backend only (GET /auth/me, PATCH /auth/admin/profile, POST /auth/admin/change-password) */
export const adminAPI = {
  getManagedAdmins: (params = {}) =>
    apiClient.get("/food/admin/admins", { params, contextModule: "admin" }),
  createManagedAdmin: (body = {}) =>
    apiClient.post("/food/admin/admins", body ?? {}, { contextModule: "admin" }),
  updateManagedAdmin: (id, body = {}) =>
    apiClient.patch(`/food/admin/admins/${String(id)}`, body ?? {}, { contextModule: "admin" }),
  updateManagedAdminStatus: (id, isActive) =>
    apiClient.patch(`/food/admin/admins/${String(id)}/status`, { isActive: isActive !== false }, { contextModule: "admin" }),
  deleteManagedAdmin: (id) =>
    apiClient.delete(`/food/admin/admins/${String(id)}`, { contextModule: "admin" }),
  getStoreOrdersAdmin: (params = {}) =>
    apiClient.get("/food/admin/store/orders", { params, contextModule: "admin" }),
  updateStoreOrderStatusAdmin: (orderId, body) =>
    apiClient.put(`/food/admin/store/orders/${orderId}/status`, body, { contextModule: "admin" }),
  getSidebarBadges: () =>
    apiClient.get("/food/admin/sidebar-badges", { contextModule: "admin" }),
  login: (email, password) => authService.adminLogin(email, password),
  /** POST /auth/admin/forgot-password/request-otp – only accepts registered admin email */
  requestForgotPasswordOtp: (email) =>
    apiClient.post("/auth/admin/forgot-password/request-otp", {
      email: String(email || "")
        .trim()
        .toLowerCase(),
    }),
  /** POST /auth/admin/forgot-password/reset – verify OTP and set new password in one call */
  resetPasswordWithOtp: (email, otp, newPassword) =>
    apiClient.post("/auth/admin/forgot-password/reset", {
      email: String(email || "")
        .trim()
        .toLowerCase(),
      otp: String(otp || "").replace(/\D/g, ""),
      newPassword: String(newPassword || ""),
    }),
  /** Raw /auth/me for admin (e.g. navbar). For Profile & Settings use getAdminProfile. */
  getCurrentAdmin: () => authService.getMe("admin"),
  /** Single API for admin profile: GET /auth/me, returns { data: { admin } }. Use on Profile & Settings only. */
  getAdminProfile: () =>
    authService.getMe("admin").then((res) => {
      const user =
        res?.data?.data?.user ??
        res?.data?.user ??
        res?.data?.data ??
        res?.data;
      return { data: { data: { admin: user }, admin: user } };
    }),
  /** PATCH /auth/admin/profile. Body: name?, phone?, profileImage? */
  updateAdminProfile: (body) =>
    apiClient.patch("/auth/admin/profile", body ?? {}, {
      contextModule: "admin",
    }),
  /** POST /auth/admin/change-password */
  changePassword: (currentPassword, newPassword) =>
    apiClient.post(
      "/auth/admin/change-password",
      { currentPassword, newPassword },
      { contextModule: "admin" },
    ),
  logout: (refreshToken) => {
    const token =
      refreshToken ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("admin_refreshToken")
        : null);
    const fcmToken = typeof localStorage !== "undefined" ? localStorage.getItem("fcm_web_registered_token_admin") : null;
    return authService.logout(token, fcmToken, "web");
  },
  // Shop approvals and join requests
  getPendingShops: () =>
    apiClient.get("/food/admin/shops/pending", {
      contextModule: "admin",
    }),
  /** List shop complaints (admin). */
  getShopComplaints: (params = {}) =>
    apiClient.get("/food/admin/shops/complaints", {
      params,
      contextModule: "admin",
    }),
  updateShopComplaint: (id, body) =>
    apiClient.patch(`/food/admin/shops/complaints/${id}`, body, {
      contextModule: "admin",
    }),
  /** Global universal search (admin). */
  globalSearch: (query) =>
    apiClient.get("/food/admin/global-search", {
      params: { query },
      contextModule: "admin",
    }),
  approveShop: (id) =>
    apiClient.patch(
      `/food/admin/shops/${id}/approve`,
      {},
      {
        contextModule: "admin",
      },
    ),
  rejectShop: (id, reason) =>
    apiClient.patch(
      `/food/admin/shops/${id}/reject`,
      { reason },
      { contextModule: "admin" },
    ),
  /** Delivery partner join requests - uses /food/admin/delivery/* (new backend API) */
  getDeliveryPartnerJoinRequests: (params) =>
    apiClient.get("/food/admin/delivery/join-requests", {
      params,
      contextModule: "admin",
    }),
  /** List approved delivery partners (Deliveryman List page) */
  getDeliveryPartners: (params) =>
    apiClient.get("/food/admin/delivery/partners", {
      params,
      contextModule: "admin",
    }),
  getDeliverymanReviews: (params = {}) =>
    apiClient.get("/food/admin/delivery/reviews", {
      params,
      contextModule: "admin",
    }),
  getContactMessages: (params = {}) =>
    apiClient.get("/food/admin/contact-messages", {
      params,
      contextModule: "admin",
    }),
  getDashboardStats: (params = {}) =>
    apiClient.get("/food/admin/dashboard-stats", {
      params,
      contextModule: "admin",
    }),
  /** List delivery withdrawal requests (admin). */
  getDeliveryWithdrawals: (params = {}) =>
    apiClient.get("/food/admin/delivery/withdrawals", {
      params,
      contextModule: "admin",
    }),
  /** Update status of a delivery withdrawal request. */
  updateDeliveryWithdrawalStatus: (id, body) =>
    apiClient.patch(`/food/admin/delivery/withdrawals/${id}`, body, {
      contextModule: "admin",
    }),
  /** List shop withdrawal requests (admin). */
  getShopWithdrawals: (params = {}) =>
    apiClient.get("/food/admin/shop/withdrawals", {
      params,
      contextModule: "admin",
    }),
  /** Update status of a shop withdrawal request. */
  updateShopWithdrawalStatus: (id, body) =>
    apiClient.patch(`/food/admin/shop/withdrawals/${id}`, body, {
      contextModule: "admin",
    }),
  /** Delivery withdrawal aliases */
  getDeliveryWithdrawalRequests: (params) => adminAPI.getDeliveryWithdrawals(params),
  approveDeliveryWithdrawal: (id) => adminAPI.updateDeliveryWithdrawalStatus(id, { status: "approved" }),
  rejectDeliveryWithdrawal: (id, reason) => adminAPI.updateDeliveryWithdrawalStatus(id, { status: "rejected", rejectionReason: reason }),
  /** Delivery boy wallets (stub until backend implements - returns empty so list still loads) */
  getDeliveryBoyWallets: (params) =>
    apiClient.get("/food/admin/delivery/wallets", {
      params,
      contextModule: "admin",
    }),
  getDeliveryPartnerById: (id) =>
    apiClient.get(`/food/admin/delivery/${id}`, { contextModule: "admin" }),
  updateDeliveryPartnerZone: (id, zoneId) =>
    apiClient.patch(
      `/food/admin/delivery/${String(id)}/zone`,
      { zoneId: String(zoneId || "").trim() },
      { contextModule: "admin" },
    ),
  approveDeliveryPartner: (id) =>
    apiClient.patch(
      `/food/admin/delivery/${String(id)}/approve`,
      {},
      {
        contextModule: "admin",
      },
    ),
  rejectDeliveryPartner: (id, reason) =>
    apiClient.patch(
      `/food/admin/delivery/${String(id)}/reject`,
      { reason: String(reason || "").trim() },
      {
        contextModule: "admin",
      },
    ),
  /** GET /food/admin/delivery/support-tickets - list all delivery support tickets (query: status, priority, search, page, limit). */
  getDeliverySupportTickets: (params) =>
    apiClient.get("/food/admin/delivery/support-tickets", {
      params,
      contextModule: "admin",
    }),
  getExpiredFssaiNotifications: (params = {}) =>
    apiClient.get("/food/admin/notifications/fssai-expired", {
      params,
      contextModule: "admin",
    }),
  /** GET /food/admin/delivery/support-tickets/stats - counts by status. */
  getDeliverySupportTicketStats: () =>
    apiClient.get("/food/admin/delivery/support-tickets/stats", {
      contextModule: "admin",
    }),
  /** PATCH /food/admin/delivery/support-tickets/:id - update adminResponse, status. */
  updateDeliverySupportTicket: (id, body) =>
    apiClient.patch(`/food/admin/delivery/support-tickets/${id}`, body ?? {}, {
      contextModule: "admin",
    }),
  createBroadcastNotification: (body = {}) =>
    apiClient.post("/food/admin/notifications/broadcast", body ?? {}, {
      contextModule: "admin",
    }),
  getBroadcastNotifications: (params = {}) =>
    apiClient.get("/food/admin/notifications/broadcast", {
      params,
      contextModule: "admin",
    }),
  deleteBroadcastNotification: (id) =>
    apiClient.delete(`/food/admin/notifications/broadcast/${String(id)}`, {
      contextModule: "admin",
    }),
  /** List shops for admin. Requires admin auth. */
  getShops: (params = {}, config = {}) =>
    apiClient.get("/food/admin/shops", {
      params: { limit: 1000, ...params },
      contextModule: "admin",
      ...config,
    }),
  getShopReviews: (params = {}) =>
    apiClient.get("/food/admin/shops/reviews", {
      params: { page: 1, limit: 1000, ...params },
      contextModule: "admin",
    }),
  /** Categories (admin) */
  getCategories: (params = {}) =>
    apiClient.get("/food/admin/categories", { params, contextModule: "admin" }),
  createCategory: (body) =>
    apiClient.post("/food/admin/categories", body ?? {}, {
      contextModule: "admin",
    }),
  updateCategory: (id, body) =>
    apiClient.patch(`/food/admin/categories/${id}`, body ?? {}, {
      contextModule: "admin",
    }),
  deleteCategory: (id) =>
    apiClient.delete(`/food/admin/categories/${id}`, {
      contextModule: "admin",
    }),
  approveCategory: (id) =>
    apiClient.patch(
      `/food/admin/categories/${String(id)}/approve`,
      {},
      { contextModule: "admin" },
    ),
  rejectCategory: (id, reason) =>
    apiClient.patch(
      `/food/admin/categories/${String(id)}/reject`,
      { reason: String(reason || "").trim() },
      { contextModule: "admin" },
    ),
  makeCategoryGlobal: (id) =>
    apiClient.patch(
      `/food/admin/categories/${String(id)}/make-global`,
      {},
      { contextModule: "admin" },
    ),
  toggleCategoryStatus: (id) =>
    apiClient.patch(
      `/food/admin/categories/${id}/toggle`,
      {},
      { contextModule: "admin" },
    ),
  /** Subcategories (admin) */
  getSubcategories: (params = {}) =>
    apiClient.get("/food/admin/subcategories", { params, contextModule: "admin" }),
  createSubcategory: (body) =>
    apiClient.post("/food/admin/subcategories", body ?? {}, {
      contextModule: "admin",
    }),
  updateSubcategory: (id, body) =>
    apiClient.patch(`/food/admin/subcategories/${id}`, body ?? {}, {
      contextModule: "admin",
    }),
  deleteSubcategory: (id) =>
    apiClient.delete(`/food/admin/subcategories/${id}`, {
      contextModule: "admin",
    }),
  approveSubcategory: (id) =>
    apiClient.patch(
      `/food/admin/subcategories/${String(id)}/approve`,
      {},
      { contextModule: "admin" },
    ),
  rejectSubcategory: (id, reason) =>
    apiClient.patch(
      `/food/admin/subcategories/${String(id)}/reject`,
      { reason: String(reason || "").trim() },
      { contextModule: "admin" },
    ),
  toggleSubcategoryStatus: (id) =>
    apiClient.patch(
      `/food/admin/subcategories/${id}/toggle`,
      {},
      { contextModule: "admin" },
    ),
  /** Get single shop by id (full details for View Details modal). */
  getShopById: (id) =>
    apiClient.get(`/food/admin/shops/${id}`, { contextModule: "admin" }),
  /** Get/set shop outlet timings (admin) - linked with shop app outlet timings. */
  getShopOutletTimings: (id) =>
    apiClient.get(`/food/admin/shops/${String(id)}/outlet-timings`, {
      contextModule: "admin",
    }),
  saveShopOutletTimings: (id, outletTimings) =>
    apiClient.put(
      `/food/admin/shops/${String(id)}/outlet-timings`,
      { outletTimings: outletTimings || {} },
      { contextModule: "admin" },
    ),
  /** Get shop analytics for POS. */
  getShopAnalytics: (id) =>
    apiClient.get(`/food/admin/shops/${id}/analytics`, {
      contextModule: "admin",
    }),
  /** Update shop basic details (admin). */
  updateShop: (id, body) =>
    apiClient.patch(`/food/admin/shops/${String(id)}`, body ?? {}, {
      contextModule: "admin",
    }),
  /** Update shop status (admin). Body: { status: boolean } */
  updateShopStatus: (id, status) =>
    apiClient.patch(
      `/food/admin/shops/${String(id)}/status`,
      { status: status !== false },
      { contextModule: "admin" },
    ),
  /** Update shop location (admin). Body includes lat/lng + address fields. */
  updateShopLocation: (id, body) =>
    apiClient.patch(
      `/food/admin/shops/${String(id)}/location`,
      body ?? {},
      { contextModule: "admin" },
    ),
  deleteShop: (id) =>
    apiClient.delete(`/food/admin/shops/${String(id)}`, {
      contextModule: "admin",
    }),
  /** Shop menu (admin) */
  getShopMenuById: (id, config = {}) =>
    apiClient.get(`/food/admin/shops/${id}/menu`, {
      contextModule: "admin",
      ...config,
    }),
  updateShopMenuById: (id, body) =>
    apiClient.patch(`/food/admin/shops/${id}/menu`, body ?? {}, {
      contextModule: "admin",
    }),
  /** Foods (admin) - separate collection */
  getFoods: (params = {}) =>
    apiClient.get("/food/admin/foods", { params, contextModule: "admin" }),
  createFood: (body) =>
    apiClient.post("/food/admin/foods", body ?? {}, { contextModule: "admin" }),
  updateFood: (id, body) =>
    apiClient.patch(`/food/admin/foods/${id}`, body ?? {}, {
      contextModule: "admin",
    }),
  deleteFood: (id) =>
    apiClient.delete(`/food/admin/foods/${id}`, { contextModule: "admin" }),
  /** Food approvals (admin) - pending items created by shops */
  getPendingFoodApprovals: (params = {}) =>
    apiClient.get("/food/admin/foods/pending-approvals", {
      params,
      contextModule: "admin",
    }),
  approveFoodItem: (id) =>
    apiClient.patch(
      `/food/admin/foods/${String(id)}/approve`,
      {},
      { contextModule: "admin" },
    ),
  rejectFoodItem: (id, reason) =>
    apiClient.patch(
      `/food/admin/foods/${String(id)}/reject`,
      { reason: String(reason || "").trim() },
      { contextModule: "admin" },
    ),
  /** Customers (admin) */
  getCustomers: (params = {}) =>
    apiClient.get("/food/admin/customers", { params, contextModule: "admin" }),
  getCustomerById: (id) =>
    apiClient.get(`/food/admin/customers/${String(id)}`, {
      contextModule: "admin",
    }),
  updateCustomerStatus: (id, isActive) =>
    apiClient.patch(
      `/food/admin/customers/${String(id)}/status`,
      { isActive: isActive !== false },
      { contextModule: "admin" },
    ),
  /** Orders (admin) – list, get by id, assign delivery partner */
  getOrders: (params = {}) =>
    apiClient.get("/food/admin/orders", {
      params: { limit: 50, page: 1, ...params },
      contextModule: "admin",
    }),
  getOrderById: (orderId) =>
    apiClient.get(`/food/admin/orders/${String(orderId)}`, {
      contextModule: "admin",
    }),
  assignDeliveryPartner: (orderId, deliveryPartnerId) =>
    apiClient.post(
      `/food/admin/orders/${String(orderId)}/assign-delivery`,
      { deliveryPartnerId: String(deliveryPartnerId) },
      { contextModule: "admin" },
    ),
  resendDeliveryPartnerNotification: (orderId) =>
    apiClient.post(
      `/food/admin/orders/${String(orderId)}/resend-delivery-notification`,
      {},
      { contextModule: "admin" },
    ),
  deleteOrder: (orderId) =>
    apiClient.delete(`/food/admin/orders/${String(orderId)}`, {
      contextModule: "admin",
    }),
  /** Update food order status as admin (accept/reject from admin orders screen). */
  updateOrderStatus: (orderId, body = {}) =>
    apiClient.patch(`/food/admin/orders/${String(orderId)}/status`, body ?? {}, {
      contextModule: "admin",
    }),
  acceptOrder: (orderId) =>
    adminAPI.updateOrderStatus(orderId, { orderStatus: "confirmed" }),
  rejectOrder: (orderId, reason = "") =>
    adminAPI.updateOrderStatus(orderId, {
      orderStatus: "cancelled_by_admin",
      reason: String(reason || "").trim(),
    }),
  approveUserUnavailableOrder: (orderId, reason = "") =>
    adminAPI.updateOrderStatus(orderId, {
      orderStatus: "cancelled_by_user_unavailable",
      reason: String(reason || "").trim(),
    }),
  rejectUserUnavailableOrder: (orderId, reason = "") =>
    adminAPI.updateOrderStatus(orderId, {
      orderStatus: "cancelled_by_admin",
      reason: String(reason || "").trim(),
    }),
  /** Dispatch settings – auto vs manual assign (global) */
  /** Create shop (admin). Single API: POST /food/admin/shops. Body: JSON with image URLs. */
  createShop: (body) =>
    apiClient.post("/food/admin/shops", body ?? {}, {
      contextModule: "admin",
    }),
  /** List delivery zones. Query: limit, page, isActive, search */
  getZones: (params = {}) =>
    apiClient.get("/food/admin/zones", {
      params: { limit: 1000, ...params },
      contextModule: "admin",
    }),
  /** Shop report (admin). */
  getShopReport: (params = {}) =>
    apiClient.get("/food/admin/reports/shops", {
      params: { page: 1, limit: 1000, ...params },
      contextModule: "admin",
    }),
  getTransactionReport: (params = {}) =>
    apiClient.get("/food/admin/reports/transactions", {
      params: { page: 1, limit: 1000, ...params },
      contextModule: "admin",
    }),
  getTaxReport: (params = {}) =>
    apiClient.get("/food/admin/reports/tax", {
      params: { page: 1, limit: 1000, ...params },
      contextModule: "admin",
    }),
  getTaxReportDetail: (id, params = {}) =>
    apiClient.get(`/food/admin/reports/tax/${id}`, {
      params,
      contextModule: "admin",
    }),
  /** Get single zone by id */
  getZoneById: (id) =>
    apiClient.get(`/food/admin/zones/${id}`, { contextModule: "admin" }),
  /** Create zone. Body: name, zoneName?, country?, unit?, coordinates, isActive? */
  createZone: (body) =>
    apiClient.post("/food/admin/zones", body ?? {}, { contextModule: "admin" }),
  /** Update zone. Body: name?, zoneName?, country?, unit?, coordinates?, isActive? */
  updateZone: (id, body) =>
    apiClient.patch(`/food/admin/zones/${id}`, body ?? {}, {
      contextModule: "admin",
    }),
  /** Delete zone */
  deleteZone: (id) =>
    apiClient.delete(`/food/admin/zones/${id}`, { contextModule: "admin" }),

  /** Feedback Experience (admin) */
  getFeedbackExperiences: (params = {}) =>
    apiClient.get(API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE, {
      params,
      contextModule: "admin",
    }),
  deleteFeedbackExperience: (id) =>
    apiClient.delete(`${API_ENDPOINTS.ADMIN.FEEDBACK_EXPERIENCE}/${id}`, {
      contextModule: "admin",
    }),

  /** Public env variables (safe subset). Used for runtime keys like Google Maps. */
  // getPublicEnvVariables removed: rely on import.meta.env instead.

  /** Public categories (user app) - zone-aware */
  getPublicCategories: (params = {}, config = {}) =>
    apiClient.get("/food/shop/categories/public", {
      params: params ?? {},
      ...config,
    }),

  /** Offers & Coupons (admin) */
  getAllOffers: (params = {}) =>
    apiClient.get("/food/admin/offers", { params, contextModule: "admin" }),
  getPendingShopOffers: (params = {}) =>
    apiClient.get("/food/admin/offers/pending", { params, contextModule: "admin" }),
  getPendingShopProductOffers: (params = {}) =>
    apiClient.get("/food/admin/offers/shop/pending", { params, contextModule: "admin" }),
  createAdminOffer: (body) =>
    apiClient.post("/food/admin/offers", body ?? {}, {
      contextModule: "admin",
    }),
  updateAdminOfferCartVisibility: (offerId, itemId, showInCart) =>
    apiClient.patch(
      `/food/admin/offers/${String(offerId)}/cart-visibility`,
      { itemId: String(itemId), showInCart: Boolean(showInCart) },
      { contextModule: "admin" },
    ),
  updateAdminOffer: (offerId, body) =>
    apiClient.patch(`/food/admin/offers/${String(offerId)}`, body ?? {}, {
      contextModule: "admin",
    }),
  deleteAdminOffer: (offerId) =>
    apiClient.delete(`/food/admin/offers/${String(offerId)}`, {
      contextModule: "admin",
    }),
  approveShopOffer: (offerId) =>
    apiClient.patch(`/food/admin/offers/${String(offerId)}/approve`, {}, { contextModule: "admin" }),
  rejectShopOffer: (offerId, reason = "") =>
    apiClient.patch(`/food/admin/offers/${String(offerId)}/reject`, { reason: String(reason || "") }, { contextModule: "admin" }),
  approveShopProductOffer: (offerId) =>
    apiClient.patch(`/food/admin/offers/shop/${String(offerId)}/approve`, {}, { contextModule: "admin" }),
  rejectShopProductOffer: (offerId, reason = "") =>
    apiClient.patch(`/food/admin/offers/shop/${String(offerId)}/reject`, { reason: String(reason || "") }, { contextModule: "admin" }),

  /** Delivery Partner Bonus (admin) */
  getDeliveryPartnerBonusTransactions: (params = {}) =>
    apiClient.get("/food/admin/delivery/bonus-transactions", {
      params,
      contextModule: "admin",
    }),
  /** Delivery Earnings (admin) */
  getDeliveryEarnings: (params = {}) =>
    apiClient.get("/food/admin/delivery/earnings", {
      params,
      contextModule: "admin",
    }),
  addDeliveryPartnerBonus: (deliveryPartnerId, amount, reference = "") =>
    apiClient.post(
      "/food/admin/delivery/bonus",
      {
        deliveryPartnerId: String(deliveryPartnerId),
        amount: Number(amount),
        reference: String(reference || ""),
      },
      { contextModule: "admin" },
    ),

  /** Earning Addon Offers (admin) */
  getEarningAddons: (params = {}) =>
    apiClient.get("/food/admin/delivery/earning-addons", {
      params,
      contextModule: "admin",
    }),
  createEarningAddon: (body) =>
    apiClient.post("/food/admin/delivery/earning-addons", body ?? {}, {
      contextModule: "admin",
    }),
  updateEarningAddon: (id, body) =>
    apiClient.patch(
      `/food/admin/delivery/earning-addons/${String(id)}`,
      body ?? {},
      { contextModule: "admin" },
    ),
  deleteEarningAddon: (id) =>
    apiClient.delete(`/food/admin/delivery/earning-addons/${String(id)}`, {
      contextModule: "admin",
    }),
  toggleEarningAddonStatus: (id, status) =>
    apiClient.patch(
      `/food/admin/delivery/earning-addons/${String(id)}/status`,
      { status: String(status) },
      { contextModule: "admin" },
    ),

  /** Earning Addon History (admin) */
  getEarningAddonHistory: (params = {}) =>
    apiClient.get("/food/admin/delivery/earning-addon-history", {
      params,
      contextModule: "admin",
    }),
  creditEarningToWallet: (historyId, notes = "") =>
    apiClient.post(
      `/food/admin/delivery/earning-addon-history/${String(historyId)}/credit`,
      { notes: String(notes || "") },
      { contextModule: "admin" },
    ),
  cancelEarningAddonHistory: (historyId, reason = "") =>
    apiClient.post(
      `/food/admin/delivery/earning-addon-history/${String(historyId)}/cancel`,
      { reason: String(reason || "") },
      { contextModule: "admin" },
    ),
  checkEarningAddonCompletions: (deliveryPartnerId, force = false) =>
    apiClient.post(
      "/food/admin/delivery/earning-addon-completions/check",
      { deliveryPartnerId: String(deliveryPartnerId), force: Boolean(force) },
      { contextModule: "admin" },
    ),
  getDeliveryWallets: (params = {}) =>
    apiClient.get("/food/admin/delivery/wallets", {
      params,
      contextModule: "admin",
    }),
  getDeliveryWithdrawals: (params = {}) =>
    apiClient.get("/food/admin/delivery/withdrawals", {
      params,
      contextModule: "admin",
    }),
  updateDeliveryWithdrawalStatus: (id, body) =>
    apiClient.patch(`/food/admin/delivery/withdrawals/${String(id)}`, body, {
      contextModule: "admin",
    }),
  getCashLimitSettlements: (params = {}) =>
    apiClient.get("/food/admin/delivery/cash-limit-settlements", {
      params,
      contextModule: "admin",
    }),
  getPayoutSettlementPreview: (params = {}) =>
    apiClient.get("/food/admin/payout-settlements/preview", {
      params,
      contextModule: "admin",
    }),
  getPayoutSettlementHistory: (params = {}) =>
    apiClient.get("/food/admin/payout-settlements/history", {
      params,
      contextModule: "admin",
    }),
  getPayoutSettlementHistoryBatchDetails: (batchId, params = {}) =>
    apiClient.get(`/food/admin/payout-settlements/history/${String(batchId)}`, {
      params,
      contextModule: "admin",
    }),
  markAllPayoutSettlementsPaid: (body = {}) =>
    apiClient.post("/food/admin/payout-settlements/mark-all-paid", body ?? {}, {
      contextModule: "admin",
    }),

  /** Shop Commission (admin) */
  getShopCommissionBootstrap: () =>
    apiClient.get("/food/admin/shop-commissions/bootstrap", {
      contextModule: "admin",
    }),
  getShopCommissions: (params = {}) =>
    apiClient.get("/food/admin/shop-commissions", {
      params,
      contextModule: "admin",
    }),
  getShopCommissionById: (id) =>
    apiClient.get(`/food/admin/shop-commissions/${String(id)}`, {
      contextModule: "admin",
    }),
  createShopCommission: (body) =>
    apiClient.post("/food/admin/shop-commissions", body ?? {}, {
      contextModule: "admin",
    }),
  updateShopCommission: (id, body) =>
    apiClient.patch(
      `/food/admin/shop-commissions/${String(id)}`,
      body ?? {},
      { contextModule: "admin" },
    ),
  deleteShopCommission: (id) =>
    apiClient.delete(`/food/admin/shop-commissions/${String(id)}`, {
      contextModule: "admin",
    }),
  toggleShopCommissionStatus: (id) =>
    apiClient.patch(
      `/food/admin/shop-commissions/${String(id)}/toggle`,
      {},
      { contextModule: "admin" },
    ),
  /** Backward-compatible alias used in UI */
  getApprovedShops: (params = {}) =>
    apiClient.get("/food/admin/shops", {
      params: { status: "approved", limit: 1000, ...params },
      contextModule: "admin",
    }),

  /** Delivery Boy Commission Rules (admin) */
  getCommissionRules: () =>
    apiClient.get("/food/admin/delivery/commission-rules", {
      contextModule: "admin",
    }),
  createCommissionRule: (body) =>
    apiClient.post("/food/admin/delivery/commission-rules", body ?? {}, {
      contextModule: "admin",
    }),
  updateCommissionRule: (id, body) =>
    apiClient.patch(
      `/food/admin/delivery/commission-rules/${String(id)}`,
      body ?? {},
      { contextModule: "admin" },
    ),
  deleteCommissionRule: (id) =>
    apiClient.delete(`/food/admin/delivery/commission-rules/${String(id)}`, {
      contextModule: "admin",
    }),
  toggleCommissionRuleStatus: (id, status) =>
    apiClient.patch(
      `/food/admin/delivery/commission-rules/${String(id)}/status`,
      { status: Boolean(status) },
      { contextModule: "admin" },
    ),

  /** Fee Settings (admin) */
  getFeeSettings: () =>
    apiClient.get("/food/admin/fee-settings", { contextModule: "admin" }),
  createOrUpdateFeeSettings: (body) =>
    apiClient.put("/food/admin/fee-settings", body ?? {}, {
      contextModule: "admin",
    }),

  /** Safety / Emergency Reports (admin) */
  getSafetyEmergencyReports: (params) =>
    apiClient.get("/food/admin/safety-emergency-reports", {
      params: params ?? {},
      contextModule: "admin",
    }),
  updateSafetyEmergencyStatus: (id, status) =>
    apiClient.put(
      `/food/admin/safety-emergency-reports/${String(id)}/status`,
      { status: String(status) },
      { contextModule: "admin" },
    ),
  updateSafetyEmergencyPriority: (id, priority) =>
    apiClient.put(
      `/food/admin/safety-emergency-reports/${String(id)}/priority`,
      { priority: String(priority) },
      { contextModule: "admin" },
    ),
  deleteSafetyEmergencyReport: (id) =>
    apiClient.delete(`/food/admin/safety-emergency-reports/${String(id)}`, {
      contextModule: "admin",
    }),

  /** Delivery Cash Limit (admin) */
  getDeliveryCashLimit: () =>
    apiClient.get("/food/admin/delivery-cash-limit", {
      contextModule: "admin",
    }),
  updateDeliveryCashLimit: (body) =>
    apiClient.patch("/food/admin/delivery-cash-limit", body ?? {}, {
      contextModule: "admin",
    }),

  /** Delivery Emergency Help (admin) */
  getEmergencyHelp: () =>
    apiClient.get("/food/admin/delivery-emergency-help", {
      contextModule: "admin",
    }),
  createOrUpdateEmergencyHelp: (body) =>
    apiClient.put("/food/admin/delivery-emergency-help", body ?? {}, {
      contextModule: "admin",
    }),
  /** Refer & Earn settings (admin) */
  getReferralSettings: () =>
    apiClient.get("/food/admin/referral-settings", {
      contextModule: "admin",
    }),
  updateReferralSettings: (body) =>
    apiClient.put("/food/admin/referral-settings", body ?? {}, {
      contextModule: "admin",
    }),

  /** Shop add-ons approval (admin) */
  getShopAddons: (params = {}) =>
    apiClient.get("/food/admin/addons", {
      params: params ?? {},
      contextModule: "admin",
    }),
  updateShopAddon: (id, body) =>
    apiClient.patch(
      `/food/admin/addons/${String(id)}`,
      body ?? {},
      { contextModule: "admin" },
    ),
  approveShopAddon: (id) =>
    apiClient.patch(
      `/food/admin/addons/${String(id)}/approve`,
      {},
      { contextModule: "admin" },
    ),
  rejectShopAddon: (id, reason) =>
    apiClient.patch(
      `/food/admin/addons/${String(id)}/reject`,
      { reason: String(reason || "").trim() },
      { contextModule: "admin" },
    ),
  /** Business Settings (admin) */
  getBusinessSettings: () =>
    apiClient.get(API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS, {
      contextModule: "admin",
    }),
  updateBusinessSettings: (data, files = {}) => {
    const formData = new FormData();
    // Add JSON data
    formData.append("data", JSON.stringify(data));
    // Add files
    if (files.logo) formData.append("logo", files.logo);
    if (files.favicon) formData.append("favicon", files.favicon);

    return apiClient.patch(API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      contextModule: "admin",
    });
  },
  /** Store Products (Admin sells to Delivery Boys) */
  getStoreProducts: (params = {}) =>
    apiClient.get('/food/admin/store/products', { params, contextModule: 'admin' }),
  createStoreProduct: (body) =>
    apiClient.post('/food/admin/store/products', body ?? {}, { contextModule: 'admin' }),
  updateStoreProduct: (id, body) =>
    apiClient.patch(`/food/admin/store/products/${String(id)}`, body ?? {}, { contextModule: 'admin' }),
  deleteStoreProduct: (id) =>
    apiClient.delete(`/food/admin/store/products/${String(id)}`, { contextModule: 'admin' }),
  updateStoreProductStock: (id, variantId, stockDelta) =>
    apiClient.patch(`/food/admin/store/products/${String(id)}/stock`, { variantId: String(variantId), stockDelta: Number(stockDelta) }, { contextModule: 'admin' }),

  /** Store Orders (admin view of delivery boy purchases) */
  getStoreOrders: (params = {}) =>
    apiClient.get('/food/admin/store/orders', { params, contextModule: 'admin' }),
  getSubscriptionPackages: (params = {}) =>
    apiClient.get("/food/admin/subscription-packages", {
      params,
      contextModule: "admin",
    }),
  getSubscriptionSubscribers: (params = {}) =>
    apiClient.get("/food/admin/subscription-subscribers", {
      params,
      contextModule: "admin",
    }),
  createSubscriptionPackage: (body = {}) =>
    apiClient.post("/food/admin/subscription-packages", body ?? {}, {
      contextModule: "admin",
    }),
  updateSubscriptionPackage: (id, body = {}) =>
    apiClient.patch(`/food/admin/subscription-packages/${String(id)}`, body ?? {}, {
      contextModule: "admin",
    }),
  updateSubscriptionPackageStatus: (id, active) =>
    apiClient.patch(
      `/food/admin/subscription-packages/${String(id)}/status`,
      { active: active !== false },
      { contextModule: "admin" },
    ),
  deleteSubscriptionPackage: (id) =>
    apiClient.delete(`/food/admin/subscription-packages/${String(id)}`, {
      contextModule: "admin",
    }),
};

  /** Shop API - OTP login via new backend; no email/password. */
  export const shopAPI = {
  sendOTP: (phone, _purpose = "login") => {
    if (!phone) return Promise.reject(new Error("Phone is required"));
    return authService.requestShopOtp(phone);
  },
  verifyOTP: (phone, otp, _purpose, _name, _email, fcmToken = null, platform = "web") => {
    if (!phone || !otp)
      return Promise.reject(new Error("Phone and OTP are required"));
    return authService.verifyShopOtp(phone, otp, fcmToken, platform);
  },
  getMe: () => authService.getMe("shop"),
  /** Shop dashboard: fetch current shop profile (deduped + short-cached). */
  getCurrentShop: () => getShopCurrentOnce(),
  getCurrentShop: () => getShopCurrentOnce(),
  /** Finance dashboard for `hub-finance`. */
  getFinance: (params = {}) =>
    apiClient.get("/food/shop/finance", {
      contextModule: "shop",
      params: params || {},
    }),
  getWallet: (params = {}) =>
    apiClient.get("/food/shop/wallet", {
      contextModule: "shop",
      params: params || {},
    }),
  createWalletTopupOrder: (amount) =>
    apiClient.post("/food/shop/wallet/deposit/order", { amount }, {
      contextModule: "shop",
    }),
  verifyWalletTopupPayment: (body) =>
    apiClient.post("/food/shop/wallet/deposit/verify", body ?? {}, {
      contextModule: "shop",
    }),
  withdrawFromWallet: (amount) =>
    apiClient.post("/food/shop/wallet/withdraw", { amount }, {
      contextModule: "shop",
    }),
  getSubscriptionPackages: () =>
    apiClient.get("/food/shop/subscription-packages", {
      contextModule: "shop",
    }),
  getCurrentSubscription: () =>
    apiClient.get("/food/shop/subscription", {
      contextModule: "shop",
    }),
  getSubscriptions: () =>
    apiClient.get("/food/shop/subscriptions", {
      contextModule: "shop",
    }),
  createSubscriptionRazorpayOrder: (body = {}) =>
    apiClient.post("/food/shop/subscription/razorpay/order", body ?? {}, {
      contextModule: "shop",
    }),
  verifySubscriptionRazorpayPayment: (body = {}) =>
    apiClient.post("/food/shop/subscription/razorpay/verify", body ?? {}, {
      contextModule: "shop",
    }),
  activateSubscription: (body = {}) =>
    apiClient.post("/food/shop/subscription", body ?? {}, {
      contextModule: "shop",
    }),
  /** Fetch shop by owner (stub for missing backend endpoint). */
  getShopByOwner: () =>
    Promise.resolve({
      data: {
        success: true,
        data: {
          shop: {
            name: "Your Shop",
            shopId: "REST000001",
            address: "Your address",
          },
          shop: {
            name: "Your Shop",
            shopId: "REST000001",
            address: "Your address",
          },
        },
      },
    }),
  /** Update shop profile fields (name/cuisines/location/menuImages). */
  updateProfile: (body) =>
    apiClient
      .patch("/food/shop/profile", body ?? {}, {
        contextModule: "shop",
      })
      .then((res) => {
        // Keep cache coherent to avoid an immediate refetch storm.
        shopCurrentCached = res;
        shopCurrentCacheTime = Date.now();
        return res;
      }),
  /** PATCH /food/shop/availability. Body: { isAcceptingOrders: boolean } */
  updateAcceptingOrders: (isAcceptingOrders) =>
    apiClient
      .patch(
        "/food/shop/availability",
        { isAcceptingOrders: Boolean(isAcceptingOrders) },
        { contextModule: "shop" },
      )
      .then((res) => {
        // Keep cache coherent to avoid an immediate refetch storm.
        shopCurrentCached = res;
        shopCurrentCacheTime = Date.now();
        return res;
      }),
  /** Upload and set shop profile image (multipart). Field name: file */
  uploadProfileImage: (file) => {
    if (!file) return Promise.reject(new Error("File is required"));
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/food/shop/profile/profile-image", formData, {
      contextModule: "shop",
    });
  },
  /** Upload a menu/cover image (multipart). Does not auto-attach; use updateProfile(menuImages) after. */
  uploadMenuImage: (file) => {
    if (!file) return Promise.reject(new Error("File is required"));
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/food/shop/profile/menu-image", formData, {
      contextModule: "shop",
    });
  },
  uploadCoverImages: (files = []) => {
    const normalizedFiles = Array.from(files || []).filter(Boolean);
    if (normalizedFiles.length === 0) {
      return Promise.reject(new Error("At least one file is required"));
    }
    const formData = new FormData();
    normalizedFiles.forEach((file) => formData.append("files", file));
    return apiClient.post("/food/shop/profile/cover-images", formData, {
      contextModule: "shop",
    });
  },
  uploadMenuImages: (files = []) => {
    const normalizedFiles = Array.from(files || []).filter(Boolean);
    if (normalizedFiles.length === 0) {
      return Promise.reject(new Error("At least one file is required"));
    }
    const formData = new FormData();
    normalizedFiles.forEach((file) => formData.append("files", file));
    return apiClient.post("/food/shop/profile/menu-images", formData, {
      contextModule: "shop",
    });
  },
  /** Public Offers for users (global/selected shop) */
  // Public shop offers; if shopId provided, hits public route
  getPublicOffers: (shopId) =>
    shopId
      ? apiClient.get(`/food/shop/public/shops/${shopId}/offers`, {
          contextModule: "user",
        })
      : apiClient.get("/food/shop/offers", {
          contextModule: "user",
        }),
  /** Shop-created coupons (pending admin approval) */
  createCoupon: (body = {}) =>
    apiClient.post("/food/shop/coupons", body ?? {}, { contextModule: "shop" }),
  getCoupons: () =>
    apiClient.get("/food/shop/coupons", { contextModule: "shop" }),
  updateCoupon: (id, body = {}) =>
    apiClient.patch(`/food/shop/coupons/${String(id)}`, body ?? {}, { contextModule: "shop" }),
  deleteCoupon: (id) =>
    apiClient.delete(`/food/shop/coupons/${String(id)}`, { contextModule: "shop" }),
  // Shop product offers (no coupon code)
  createShopOffer: (body = {}) =>
    apiClient.post("/food/shop/offers/shop", body ?? {}, { contextModule: "shop" }),
  createShopOffer: (body = {}) =>
    apiClient.post("/food/shop/offers/shop", body ?? {}, { contextModule: "shop" }),
  getShopOffers: () =>
    apiClient.get("/food/shop/offers/shop", { contextModule: "shop" }),
  getShopOffers: () =>
    apiClient.get("/food/shop/offers/shop", { contextModule: "shop" }),
  deleteShopOffer: (id) =>
    apiClient.delete(`/food/shop/offers/shop/${String(id)}`, { contextModule: "shop" }),
  deleteShopOffer: (id) =>
    apiClient.delete(`/food/shop/offers/shop/${String(id)}`, { contextModule: "shop" }),
  updateShopOffer: (id, body = {}) =>
    apiClient.patch(`/food/shop/offers/shop/${String(id)}`, body ?? {}, { contextModule: "shop" }),
  updateShopOffer: (id, body = {}) =>
    apiClient.patch(`/food/shop/offers/shop/${String(id)}`, body ?? {}, { contextModule: "shop" }),
  /** Backward-compat helper used by Cart: returns coupons array for an item by adapting public offers */
  getCouponsByItemIdPublic: (shopId, _itemId) =>
    apiClient.get("/food/shop/offers", {
      contextModule: "user",
      params: shopId ? { shopId: String(shopId) } : undefined,
    }).then((res) => {
      const list = res?.data?.data?.allOffers || res?.data?.allOffers || [];
      const now = Date.now();
      const coupons = list
        .filter((o) => {
          // Guard: respect selected shop scope
          if (String(o?.shopScope) === "selected") {
            if (!shopId) return false;
            return String(o.shopId?._id || o.shopId || "") === String(shopId || "");
          }
          return true;
        })
        .map((o) => {
          const rawDiscountType = String(o.discountType || "").toLowerCase();
          const isPct = rawDiscountType === "percentage" || rawDiscountType === "percent";
          const normalizedDiscountType = isPct ? "percentage" : "flat-price";
          const discountValue = Number(o.discountValue ?? o.discountAmount ?? 0);
          return {
            couponCode: o.couponCode,
            discountType: normalizedDiscountType,
            discountValue,
            discountPercentage: isPct ? discountValue : 0,
            originalPrice: 0,
            discountedPrice: 0,
            minOrderValue: Number(o.minOrderValue || 0),
            minOrder: Number(o.minOrderValue || 0),
            maxDiscount: o.maxDiscount != null ? Number(o.maxDiscount) : null,
            customerGroup: o.customerScope || "all",
            isGlobalCoupon: true,
            endDate: o.endDate || null,
            showInCart: o.showInCart !== false,
            _ts: now,
          };
        });
      return { data: { success: true, data: { coupons } } };
    }),
  /** Categories (shop dashboard) */
  getCategories: (params = {}) =>
    // Compact payload for item creation forms (id + name only).
    apiClient.get("/food/shop/categories", {
      params: { compact: true, limit: 1000, ...params },
      contextModule: "shop",
    }),
  getSubcategories: (params = {}) =>
    apiClient.get("/food/shop/subcategories", {
      params: { limit: 1000, ...params },
      contextModule: "shop",
    }),
  // For MenuCategoriesPage compatibility
  getAllCategories: (params = {}) =>
    apiClient.get("/food/shop/categories", {
      params: {
        includeInactive: true,
        withCounts: true,
        limit: 1000,
        ...params,
      },
      contextModule: "shop",
    }),
  createCategory: (body) =>
    apiClient.post("/food/shop/categories", body ?? {}, {
      contextModule: "shop",
    }),
  updateCategory: (id, body) =>
    apiClient.patch(`/food/shop/categories/${String(id)}`, body ?? {}, {
      contextModule: "shop",
    }),
  deleteCategory: (id) =>
    apiClient.delete(`/food/shop/categories/${String(id)}`, {
      contextModule: "shop",
    }),
  /** Menu (shop dashboard) */
  getMenu: (params = {}) =>
    apiClient.get("/food/shop/menu", {
      params,
      contextModule: "shop",
    }),
  /** Orders (shop dashboard) */

  updateMenu: (body) =>
    apiClient.patch("/food/shop/menu", body ?? {}, {
      contextModule: "shop",
    }),
  saveFcmToken: (token, platform = "web") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const path =
      platform === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save";
    return apiClient.post(
      path,
      { token: String(token), platform },
      { contextModule: "shop" },
    );
  },
  removeFcmToken: (token, platform = "web") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    return apiClient.delete(
      `/fcm-tokens/remove/${encodeURIComponent(String(token))}`,
      {
        data: { token: String(token), platform },
        contextModule: "shop",
      },
    );
  },
  /** Outlet timings (shop dashboard) */
  getOutletTimings: () =>
    apiClient.get("/food/shop/outlet-timings", {
      contextModule: "shop",
    }),
  saveOutletTimings: (outletTimings) =>
    apiClient.put(
      "/food/shop/outlet-timings",
      { outletTimings: outletTimings || {} },
      { contextModule: "shop" },
    ),
  /** Foods (shop) - stored in food_items collection */
  createFood: (body) =>
    apiClient.post("/food/shop/foods", body ?? {}, {
      contextModule: "shop",
    }),
  updateFood: (id, body) =>
    apiClient.patch(`/food/shop/foods/${String(id)}`, body ?? {}, {
      contextModule: "shop",
    }),
  /** Orders (shop dashboard) */
  getOrders: (() => {
    // Single-flight de-dupe to avoid duplicate GETs in React StrictMode / double-mount.
    let inFlight = null;
    let inFlightKey = "";
    let cache = null;
    let cacheKey = "";
    let cacheAt = 0;
    const CACHE_MS = 800;

    const buildKey = (p = {}) => JSON.stringify({ limit: 50, page: 1, ...p });

    return (params = {}) => {
      const key = buildKey(params);
      const now = Date.now();

      if (cache && cacheKey === key && now - cacheAt < CACHE_MS) {
        return Promise.resolve(cache);
      }

      if (inFlight && inFlightKey === key) return inFlight;

      inFlightKey = key;
      inFlight = apiClient
        .get("/food/shop/orders", {
          params: { limit: 50, page: 1, ...params },
          contextModule: "shop",
        })
        .then((res) => {
          // Backend paginated shape: { data: { data: [...], meta: {...} } }
          // Normalize to { data: { data: { orders: [...], meta } } } for shop UI pages.
          const payload = res?.data?.data || {};
          const rowsRaw = Array.isArray(payload.data) ? payload.data : [];

          // Normalize backend order fields to match existing shop UI expectations.
          // UI historically uses: order.status, order.address, order.total, order.paymentMethod
          const normalizeStatus = (s) => {
            const v = String(s || "").toLowerCase();
            // Keep "created" as-is so it does not look accepted before action.
            if (v === "created") return "created";
            // Backend: ready_for_pickup -> ready
            if (v === "ready_for_pickup") return "ready";
            // Backend: picked_up -> out_for_delivery (shop handed over)
            if (v === "picked_up") return "out_for_delivery";
            if (v.includes("cancel")) return "cancelled";
            return v || "created";
          };

          const rows = rowsRaw.map((o) => {
            const status = normalizeStatus(o.orderStatus || o.status);
            const address = o.deliveryAddress || o.address;
            const total = o.pricing?.total ?? o.total ?? 0;
            const paymentMethod = o.payment?.method || o.paymentMethod || null;
            return { ...o, status, address, total, paymentMethod };
          });
          const meta = payload.meta || {};
          const normalized = {
            ...res,
            data: {
              ...res.data,
              data: { orders: rows, meta },
            },
          };

          cache = normalized;
          cacheKey = key;
          cacheAt = Date.now();
          return normalized;
        })
        .finally(() => {
          inFlight = null;
          inFlightKey = "";
        });

      return inFlight;
    };
  })(),
  updateOrderStatus: (orderId, body) => {
    const raw = body ?? {};
    const outgoing = { ...raw };

    // Translate UI-friendly statuses to backend enum values.
    const normalizeOutgoingStatus = (s) => {
      const v = String(s || "")
        .toLowerCase()
        .trim();
      if (!v) return v;
      if (v === "ready") return "ready_for_pickup";
      if (v === "out_for_delivery") return "picked_up";
      if (v === "cancelled") return "cancelled_by_shop";
      return v;
    };

    if (outgoing.orderStatus) {
      outgoing.orderStatus = normalizeOutgoingStatus(outgoing.orderStatus);
    }

    return apiClient.patch(
      `/food/shop/orders/${String(orderId)}/status`,
      outgoing,
      { contextModule: "shop" },
    );
  },
  /**
   * Accept an incoming order (shop).
   * UI expects this to move order into "preparing" bucket.
   * Backend supports PATCH /food/shop/orders/:orderId/status with { orderStatus }.
   */
  acceptOrder: (orderId, prepTimeMins = null) =>
    shopAPI.updateOrderStatus(orderId, {
      orderStatus: "preparing",
      preparationTimeMinutes:
        Number.isFinite(Number(prepTimeMins)) && Number(prepTimeMins) > 0
          ? Math.round(Number(prepTimeMins))
          : undefined,
    }),
  startPreparingOrder: (orderId) =>
    shopAPI.updateOrderStatus(orderId, {
      orderStatus: "preparing",
      manualStartPreparing: true,
    }),
  /**
   * Reject/cancel order by shop.
   * Backend orderStatus enum: cancelled_by_shop.
   */
  rejectOrder: (orderId, reason = "") =>
    shopAPI.updateOrderStatus(orderId, {
      orderStatus: "cancelled_by_shop",
      reason: String(reason || "").trim(),
    }),
  /** Mark order ready (shop handoff). */
  markOrderReady: (orderId) =>
    shopAPI.updateOrderStatus(orderId, {
      orderStatus: "ready_for_pickup",
    }),
  /** Mark takeaway order delivered/picked up by customer. */
  markOrderDelivered: (orderId) =>
    shopAPI.updateOrderStatus(orderId, {
      orderStatus: "delivered",
    }),
  /**
   * Get a single order by id for shop screens.
   * Prefer direct endpoint; fallback to list+filter for backward compatibility.
   */
  getOrderById: async (orderId) => {
    return await apiClient.get(`/food/shop/orders/${String(orderId)}`, {
      contextModule: "shop",
    });
  },
  /** Add-ons (shop) - approval handled by admin */
  getAddons: (params = {}) =>
    apiClient.get("/food/shop/addons", {
      // Backend validator enforces limit <= 100
      params: { limit: 100, page: 1, ...params },
      contextModule: "shop",
    }),
  addAddon: (body) =>
    apiClient.post("/food/shop/addons", body ?? {}, {
      contextModule: "shop",
    }),
  updateAddon: (id, body) =>
    apiClient.patch(`/food/shop/addons/${String(id)}`, body ?? {}, {
      contextModule: "shop",
    }),
  deleteAddon: (id) =>
    apiClient.delete(`/food/shop/addons/${String(id)}`, {
      contextModule: "shop",
    }),
  logout: (refreshToken) => {
    shopCurrentInFlight = null;
    shopCurrentCached = null;
    shopCurrentCacheTime = 0;
    const token =
      refreshToken ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("shop_refreshToken")
        : null);
    const fcmToken = typeof localStorage !== "undefined" ? localStorage.getItem("fcm_web_registered_token_shop") : null;
    return authService.logout(token, fcmToken, "web");
  },
  /** Backend has no email/password login; use phone OTP only. */
  login: (_email, _password) =>
    Promise.reject(new Error("Please use phone number and OTP to sign in.")),
  /**
   * Register a shop (multipart FormData).
   * Backend: POST /v1/food/shop/register (path relative to baseURL /api/v1)
   */
  register: (formData) => {
    if (!formData || !(formData instanceof FormData)) {
      return Promise.reject(new Error("FormData is required"));
    }
    return apiClient.post("/food/shop/register", formData);
  },
  /** Public: list approved shops for user app */
  getShops: (params = {}, config = {}) =>
    getPublicShopsOnce(params, config),
  getShops: (params = {}, config = {}) =>
    getPublicShopsOnce(params, config),
  /** Public: get single approved shop by id or slug */
  getShopById: (id, config = {}) =>
    apiClient.get(`/food/shop/shops/${String(id)}`, { ...config }),
  getShopById: (id, config = {}) =>
    apiClient.get(`/food/shop/shops/${String(id)}`, { ...config }),
  /** Public: get approved menu by shop id or slug */
  getMenuByShopId: (id, config = {}) =>
    getPublicShopMenuOnce(id, config),
  getShopMenuById: (id, config = {}) =>
    getPublicShopMenuOnce(id, config),
  /** Public: get outlet timings by shop id */
  getOutletTimingsByShopId: (id, config = {}) =>
    getPublicShopOutletTimingsOnce(id, config),
  getShopOutletTimingsById: (id, config = {}) =>
    getPublicShopOutletTimingsOnce(id, config),
  /** Public (user app): approved add-ons by shop id/slug */
  getAddonsByShopId: (id, config = {}) =>
    apiClient.get(`/food/shop/shops/${String(id)}/addons`, {
      ...config,
    }),
  getAddonsByShopId: (id, config = {}) =>
    apiClient.get(`/food/shop/shops/${String(id)}/addons`, {
      ...config,
    }),
  getPublicOffers: (shopIdOrParams = {}, config = {}) => {
    if (typeof shopIdOrParams === "string" && shopIdOrParams.trim()) {
      return apiClient.get(
        `/food/shop/public/shops/${String(shopIdOrParams).trim()}/offers`,
        { contextModule: "user", ...config },
      )
    }
    return apiClient.get("/food/shop/offers", {
      params: shopIdOrParams || {},
      contextModule: "user",
      ...config,
    })
  },
  getInventoryByShopId: (id, config = {}) =>
    apiClient.get(`/food/shop/shops/${String(id)}/inventory`, {
      ...config,
    }),
  getInventoryByShopId: (id, config = {}) =>
    apiClient.get(`/food/shop/shops/${String(id)}/inventory`, {
      ...config,
    }),
  /** Resend delivery notification (shop dashboard) */
  resendDeliveryNotification: (orderId) =>
    apiClient.post(`/food/shop/orders/${String(orderId)}/resend-notification`, {}, {
      contextModule: "shop",
    }),
  /** Shop: manually assign delivery partner */
  assignDeliveryPartner: (orderId, deliveryPartnerId) =>
    apiClient.post(
      `/food/shop/orders/${String(orderId)}/assign-delivery`,
      { deliveryPartnerId },
      { contextModule: "shop" },
    ),
  /** Shop: auto assign nearest rider */
  autoAssignDeliveryPartner: (orderId) =>
    apiClient.post(
      `/food/shop/orders/${String(orderId)}/auto-assign-delivery`,
      {},
      { contextModule: "shop" },
    ),
  /** List shop complaints (for current shop dashboard) */
  getComplaints: (params = {}) =>
    apiClient.get("/food/shop/complaints", {
      params,
      contextModule: "shop",
    }),
  /** Shop support tickets */
  createSupportTicket: (body = {}) =>
    apiClient.post("/food/shop/support/tickets", body ?? {}, {
      contextModule: "shop",
    }),
  getSupportTickets: (params = {}) =>
    apiClient.get("/food/shop/support/tickets", {
      params,
      contextModule: "shop",
    }),
  /** Search delivery partner by phone */
  searchDeliveryPartner: (phone) =>
    apiClient.get("/food/shop/delivery-partners/search", {
      params: { phone },
      contextModule: "shop",
    }),
  /** Send exclusivity invitation */
  sendExclusivityInvite: (phone) =>
    apiClient.post(
      "/food/shop/delivery-partners/invite",
      { phone },
      { contextModule: "shop" },
    ),
  /** Cancel pending invitation */
  cancelExclusivityInvite: (phone) =>
    apiClient.post(
      "/food/shop/delivery-partners/cancel",
      { phone },
      { contextModule: "shop" },
    ),
  /** Remove associated rider */
  removeExclusivityRider: (phone) =>
    apiClient.post(
      "/food/shop/delivery-partners/remove",
      { phone },
      { contextModule: "shop" },
    ),
  /** List exclusive delivery partners */
  listExclusivityPartners: (orderId) =>
    apiClient.get(
      `/food/shop/delivery-partners${orderId ? `?orderId=${String(orderId)}` : ""}`,
      { contextModule: "shop" },
    ),
};

function stableStringify(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function createInFlightCache({ ttlMs }) {
  const inFlight = new Map();
  const cached = new Map(); // key -> { t, v }

  const getCached = (key) => {
    const hit = cached.get(key);
    if (!hit) return null;
    if (Date.now() - hit.t > ttlMs) {
      cached.delete(key);
      return null;
    }
    return hit.v;
  };

  const getOrCreate = (key, factory) => {
    const cachedValue = getCached(key);
    if (cachedValue) return Promise.resolve(cachedValue);
    if (inFlight.has(key)) return inFlight.get(key);
    const p = Promise.resolve()
      .then(factory)
      .then((res) => {
        cached.set(key, { t: Date.now(), v: res });
        return res;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, p);
    return p;
  };

  return { getOrCreate };
}

// Public user-app endpoints can be called by multiple components/effects on refresh (and React StrictMode in dev).
// A small in-flight + short TTL cache collapses duplicate requests without changing functionality.
const publicShopsCache = createInFlightCache({ ttlMs: 3000 });
const publicShopMenuCache = createInFlightCache({ ttlMs: 3000 });
const publicShopOutletTimingsCache = createInFlightCache({ ttlMs: 3000 });
const publicGenericGetCache = createInFlightCache({ ttlMs: 3000 });

export const publicGetOnce = (url, config = {}) => {
  const safeUrl = typeof url === "string" ? url.trim() : "";
  const { noCache, params, ...axiosConfig } = config || {};
  if (!safeUrl) return Promise.reject(new Error("url is required"));

  if (noCache) {
    return apiClient.get(safeUrl, { params, ...axiosConfig });
  }

  const keyParams =
    params && typeof params === "object" ? { ...params } : params;
  if (keyParams && typeof keyParams === "object") {
    // `_ts` is used as a cache-buster in some call sites; ignore it for dedupe purposes.
    delete keyParams._ts;
  }

  const key = `GET:${safeUrl}:${stableStringify(keyParams)}`;
  return publicGenericGetCache.getOrCreate(key, () =>
    apiClient.get(safeUrl, { params, ...axiosConfig }),
  );
};

const getPublicShopsOnce = (params = {}, config = {}) => {
  const { noCache, ...axiosConfig } = config || {};
  const normalizedParams = { ...(params || {}) };
  const defaultLimit = 20;
  if (!normalizedParams.zoneId && typeof window !== "undefined") {
    const storedZoneId = window.localStorage?.getItem("userZoneId");
    if (storedZoneId) {
      normalizedParams.zoneId = storedZoneId;
    }
  }
  if (noCache) {
    return apiClient.get("/food/shop/shops", {
      params: { limit: defaultLimit, ...normalizedParams, _ts: Date.now() },
      ...axiosConfig,
    });
  }
  const keyParams = { limit: defaultLimit, ...normalizedParams };
  // `_ts` is an explicit cache-buster in many call sites; ignore it for dedupe purposes.
  if (keyParams && typeof keyParams === "object") {
    delete keyParams._ts;
  }
  const key = `shops:${stableStringify(keyParams)}`;
  return publicShopsCache.getOrCreate(key, () =>
    apiClient.get("/food/shop/shops", {
      params: { limit: defaultLimit, ...normalizedParams },
      ...axiosConfig,
    }),
  );
};

const getPublicShopMenuOnce = (id, config = {}) => {
  const safeId = String(id || "").trim();
  const { noCache, ...axiosConfig } = config || {};
  if (!safeId) {
    return Promise.resolve({
      data: { success: false, data: null },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    });
  }
  if (noCache) {
    return apiClient.get(`/food/shop/shops/${safeId}/menu`, {
      ...axiosConfig,
    });
  }
  const key = `menu:${safeId}`;
  return publicShopMenuCache.getOrCreate(key, () =>
    apiClient.get(`/food/shop/shops/${safeId}/menu`, {
      ...axiosConfig,
    }),
  );
};

const getPublicShopOutletTimingsOnce = (id, config = {}) => {
  const safeId = String(id || "").trim();
  const { noCache, ...axiosConfig } = config || {};
  if (!safeId) {
    return Promise.resolve({
      data: { success: false, data: null },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    });
  }
  if (noCache) {
    return apiClient.get(
      `/food/shop/shops/${safeId}/outlet-timings`,
      { ...axiosConfig },
    );
  }
  const key = `outletTimings:${safeId}`;
  return publicShopOutletTimingsCache.getOrCreate(key, () =>
    apiClient.get(`/food/shop/shops/${safeId}/outlet-timings`, {
      ...axiosConfig,
    }),
  );
};

/** Single in-flight + short cache for shop /food/shop/current - prevents request storms. */
let shopCurrentInFlight = null;
let shopCurrentCached = null;
let shopCurrentCacheTime = 0;
const SHOP_CURRENT_CACHE_MS = 3000;

const getShopCurrentOnce = () => {
  const now = Date.now();
  if (
    shopCurrentCached &&
    now - shopCurrentCacheTime < SHOP_CURRENT_CACHE_MS
  ) {
    return Promise.resolve(shopCurrentCached);
  }
  if (!shopCurrentInFlight) {
    shopCurrentInFlight = apiClient
      .get("/food/shop/current", { contextModule: "shop" })
      .then((res) => {
        shopCurrentCached = res;
        shopCurrentCacheTime = Date.now();
        return res;
      })
      .finally(() => {
        shopCurrentInFlight = null;
      });
  }
  return shopCurrentInFlight;
};

/** Single in-flight + short cache for delivery /auth/me - one call per page load / refresh. */
let deliveryMeInFlight = null;
let deliveryMeCached = null;
let deliveryMeCacheTime = 0;
const DELIVERY_ME_CACHE_MS = 3000;

const getDeliveryMeOnce = () => {
  const now = Date.now();
  if (deliveryMeCached && now - deliveryMeCacheTime < DELIVERY_ME_CACHE_MS) {
    return Promise.resolve(deliveryMeCached);
  }
  if (!deliveryMeInFlight) {
    deliveryMeInFlight = authService
      .getMe("delivery")
      .then((res) => {
        deliveryMeCached = res;
        deliveryMeCacheTime = Date.now();
        return res;
      })
      .finally(() => {
        deliveryMeInFlight = null;
      });
  }
  return deliveryMeInFlight;
};

/** Delivery API - OTP login + registration via new backend. */
export const deliveryAPI = {
  invalidateProfileCache: () => {
    deliveryMeCached = null;
    deliveryMeCacheTime = 0;
    deliveryMeInFlight = null;
  },
  sendOTP: (phone, _purpose = "login") => {
    if (!phone) return Promise.reject(new Error("Phone is required"));
    return authService.requestDeliveryOtp(phone);
  },
  verifyOTP: (phone, otp, _purpose, _name, fcmToken = null, platform = "web") => {
    if (!phone || !otp)
      return Promise.reject(new Error("Phone and OTP are required"));
    return authService.verifyDeliveryOtp(phone, otp, fcmToken, platform);
  },
  getMe: () => getDeliveryMeOnce(),
  /** Get delivery profile (same as getMe under the hood; maps response to profile shape). */
  getProfile: () =>
    getDeliveryMeOnce().then((res) => ({
      ...res,
      data: {
        ...res.data,
        data: { profile: res.data?.data?.user ?? res.data?.data },
      },
    })),
  getReferralStats: () =>
    apiClient.get("/food/delivery/referrals/stats", {
      contextModule: "delivery",
    }),
  logout: (refreshToken) => {
    deliveryMeCached = null;
    deliveryMeCacheTime = 0;
    try {
      localStorage.removeItem("app:isOnline");
    } catch (_) {}
    const token =
      refreshToken ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("delivery_refreshToken")
        : null);
    const fcmToken = typeof localStorage !== "undefined" ? localStorage.getItem("fcm_web_registered_token_delivery") : null;
    return authService.logout(token, fcmToken, "web");
  },
  /** POST /food/delivery/register - multipart FormData (new partner, no token). */
  register: (formData) => {
    if (!formData || !(formData instanceof FormData)) {
      return Promise.reject(
        new Error("FormData with details and document files is required"),
      );
    }
    return apiClient.post("/food/delivery/register", formData);
  },
  /** PATCH /food/delivery/profile - complete profile after OTP (Bearer token required). */
  completeProfile: (formData) => {
    if (!formData || !(formData instanceof FormData)) {
      return Promise.reject(
        new Error("FormData with details and document files is required"),
      );
    }
    return apiClient.patch("/food/delivery/profile", formData, {
      contextModule: "delivery",
    });
  },
  /** PATCH /food/delivery/profile/details - JSON updates (vehicle number, etc). */
  updateProfileDetails: (payload) =>
    apiClient.patch("/food/delivery/profile/details", payload ?? {}, {
      contextModule: "delivery",
    }),
  /** PATCH /food/delivery/profile - multipart updates for photos/documents (uses same endpoint). */
  updateProfileMultipart: (formData) => {
    if (!formData || !(formData instanceof FormData)) {
      return Promise.reject(new Error("FormData is required"));
    }
    return apiClient.patch("/food/delivery/profile", formData, {
      contextModule: "delivery",
    });
  },
  /** POST /food/delivery/profile/photo-base64 - Flutter in-app camera base64 upload. */
  updateProfilePhotoBase64: (payload) =>
    apiClient.post("/food/delivery/profile/photo-base64", payload ?? {}, {
      contextModule: "delivery",
    }),
  /** PATCH /food/delivery/profile/bank-details - update bank details + PAN (JSON, Bearer required). */
  updateProfile: (payload) =>
    apiClient.patch("/food/delivery/profile/bank-details", payload ?? {}, {
      contextModule: "delivery",
    }),
  /** PATCH /food/delivery/profile/bank-details - multipart updates for bank details + UPI QR (FormData required). */
  updateBankDetailsMultipart: (formData) => {
    if (!formData || !(formData instanceof FormData)) {
      return Promise.reject(new Error("FormData is required"));
    }
    return apiClient.patch("/food/delivery/profile/bank-details", formData, {
      contextModule: "delivery",
    });
  },
  saveFcmToken: (token, platform = "web") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const path =
      platform === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save";
    return apiClient.post(
      path,
      { token: String(token), platform },
      { contextModule: "delivery" },
    );
  },
  removeFcmToken: (token, platform = "web") => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    return apiClient.delete(
      `/fcm-tokens/remove/${encodeURIComponent(String(token))}`,
      {
        data: { token: String(token), platform },
        contextModule: "delivery",
      },
    );
  },
  /** GET /food/delivery/support-tickets - list tickets for logged-in delivery partner. */
  getSupportTickets: () =>
    apiClient.get("/food/delivery/support-tickets", {
      contextModule: "delivery",
    }),
  /** POST /food/delivery/support-tickets - create ticket (body: subject, description, category?, priority?). */
  createSupportTicket: (body) =>
    apiClient.post("/food/delivery/support-tickets", body ?? {}, {
      contextModule: "delivery",
    }),
  /** GET /food/delivery/support-tickets/:id - get one ticket (own only). */
  getSupportTicketById: (id) =>
    apiClient.get(`/food/delivery/support-tickets/${id}`, {
      contextModule: "delivery",
    }),
  /** GET /food/delivery/reviews - list reviews for logged-in delivery partner. */
  getReviews: (params = {}) =>
    apiClient.get("/food/delivery/reviews", {
      params,
      contextModule: "delivery",
    }),
  /** PATCH /food/delivery/availability - set online/offline (and optional lat/lng). */
  updateOnlineStatus: (isOnline) =>
    apiClient.patch(
      "/food/delivery/availability",
      { status: isOnline ? "online" : "offline" },
      { contextModule: "delivery" },
    ),
  updateLocation: (latitude, longitude, isOnline, extras = {}) =>
    apiClient.patch(
      "/food/delivery/availability",
      { status: isOnline ? "online" : "offline", latitude, longitude, ...extras },
      { contextModule: "delivery" },
    ),
  /** Orders */
  getOrders: (() => {
    // Collapse duplicate list fetches triggered by multiple effects + StrictMode.
    let inFlight = new Map(); // key -> Promise
    let cache = new Map(); // key -> { at, res }
    const CACHE_MS = 2500;

    const stableKey = (p = {}) => {
      const safe = p && typeof p === "object" ? { ...p } : {};
      // Ensure stable ordering + defaults.
      const normalized = { limit: 50, page: 1, ...safe };
      // Remove cache-busters if any.
      delete normalized._ts;
      return JSON.stringify(
        Object.keys(normalized)
          .sort()
          .reduce((acc, k) => {
            acc[k] = normalized[k];
            return acc;
          }, {}),
      );
    };

    return (params = {}) => {
      const key = stableKey(params);
      const now = Date.now();
      const cached = cache.get(key);
      if (cached && now - cached.at < CACHE_MS)
        return Promise.resolve(cached.res);

      const existing = inFlight.get(key);
      if (existing) return existing;

      const p = apiClient
        .get("/food/delivery/orders/available", {
          params: { limit: 50, page: 1, ...params },
          contextModule: "delivery",
        })
        .then((res) => {
          cache.set(key, { at: Date.now(), res });
          return res;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, p);
      return p;
    };
  })(),
  getOrderDetails: (() => {
    // Collapse duplicate calls coming from multiple effects (and React StrictMode in dev).
    let inFlight = new Map(); // key -> Promise
    let cache = new Map(); // key -> { at, res }
    const CACHE_MS = 1200;

    const isProbablyOrderIdentity = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return false;
      // Mongo ObjectId
      return /^[a-f0-9]{24}$/i.test(raw);
    };

    return (orderId) => {
      const key = String(orderId || "").trim();
      if (!isProbablyOrderIdentity(key)) {
        return Promise.resolve({
          data: { success: false, message: "Invalid order id", data: null },
          status: 200,
          statusText: "OK",
          headers: {},
          config: {},
        });
      }

      const now = Date.now();
      const cached = cache.get(key);
      if (cached && now - cached.at < CACHE_MS)
        return Promise.resolve(cached.res);

      const existing = inFlight.get(key);
      if (existing) return existing;

      const p = apiClient
        .get(`/food/delivery/orders/${key}`, { contextModule: "delivery" })
        .then((res) => {
          cache.set(key, { at: Date.now(), res });
          return res;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, p);
      return p;
    };
  })(),
  /** GET /food/delivery/current - fallback for some UI hooks */
  getCurrentDelivery: () => apiClient.get("/food/delivery/orders/current", { contextModule: "delivery" }),
  getOrderQueue: () =>
    apiClient.get("/food/delivery/orders/queue", {
      contextModule: "delivery",
    }),
  acceptOrder: (orderId, body = {}) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/accept`,
      body ?? {},
      {
        contextModule: "delivery",
      },
    ),
  rejectOrder: (orderId, body = {}) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/reject`,
      body ?? {},
      {
        contextModule: "delivery",
      },
    ),
  /**
   * PATCH /food/delivery/orders/:orderId/reached-pickup
   * Marks "reached pickup" (arrival at shop) in backend order deliveryState.
   */
  confirmReachedPickup: (orderId) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/reached-pickup`,
      {},
      { contextModule: "delivery" },
    ),
  /**
   * Confirm order ID and upload bill image (Picked Up slide).
   * Backend endpoint: PATCH /food/delivery/orders/:id/confirm-pickup
   */
  confirmOrderId: (orderId, confirmedOrderId, location = {}, data = {}) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/confirm-pickup`,
      {
        confirmedOrderId,
        latitude: location.lat,
        longitude: location.lng,
        billImageUrl: data.billImageUrl,
      },
      {
        contextModule: "delivery",
      },
    ),
  confirmReachedDrop: (orderId) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/reached-drop`,
      {},
      {
        contextModule: "delivery",
      },
    ),
  verifyDropOtp: (orderId, otp) =>
    apiClient.post(
      `/food/delivery/orders/${String(orderId)}/verify-drop-otp`,
      { otp: String(otp) },
      {
        contextModule: "delivery",
      },
    ),
  /** POST /food/delivery/orders/:orderId/collect/qr - create Razorpay payment link (COD collection) */
  createCollectQr: (orderId, body = {}) =>
    apiClient.post(
      `/food/delivery/orders/${String(orderId)}/collect/qr`,
      body ?? {},
      {
        contextModule: "delivery",
      },
    ),
  /** GET /food/delivery/orders/:orderId/payment-status - check COD/QR payment status */
  getPaymentStatus: (orderId) =>
    apiClient.get(`/food/delivery/orders/${String(orderId)}/payment-status`, {
      contextModule: "delivery",
    }),
  completeDelivery: (orderId, body = {}) => {
    // Backward-compatible: older UI calls completeDelivery(orderId, rating, review)
    // where rating is a number (sent as raw JSON like "3"). Normalize to an object.
    let payload = body ?? {};
    if (
      typeof payload === "number" ||
      typeof payload === "string" ||
      payload == null
    ) {
      payload = { rating: payload == null ? null : Number(payload) };
    }
    return apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/complete`,
      payload,
      {
        contextModule: "delivery",
      },
    );
  },
  updateOrderStatus: (orderId, body = {}) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/status`,
      body ?? {},
      {
        contextModule: "delivery",
      },
    ),
  reportUserUnavailable: (orderId, body = {}) =>
    apiClient.patch(
      `/food/delivery/orders/${String(orderId)}/status`,
      {
        ...(body ?? {}),
        orderStatus: "cancelled_by_user_unavailable",
        reasonType: "user_unavailable",
      },
      {
        contextModule: "delivery",
      },
    ),
  /** Registration Re-verification */
  reverify: () =>
    apiClient.post(
      "/food/delivery/reverify",
      {},
      { contextModule: "delivery" },
    ),
  /** GET /food/delivery/wallet - wallet for Pocket/requests page (backend) */
  getWallet: () =>
    apiClient.get("/food/delivery/wallet", { contextModule: "delivery" }),
  /** GET /food/delivery/earnings - earnings summary for Pocket/requests page */
  getEarnings: (params) =>
    apiClient.get("/food/delivery/earnings", {
      params: params ?? {},
      contextModule: "delivery",
    }),
  /** Earning Addons (Hotspots/Bonus) */
  getActiveEarningAddons: () =>
    apiClient.get("/food/delivery/earning-addons/active", {
      contextModule: "delivery",
    }),
  /** GET /food/delivery/trip-history - completed/cancelled/pending trips for delivery partner */
  getTripHistory: (params) =>
    apiClient.get("/food/delivery/trip-history", {
      params: params ?? {},
      contextModule: "delivery",
    }),
  /** GET /food/delivery/pocket-details - single-call week details (trips + transactions) */
  getPocketDetails: (params) =>
    apiClient.get("/food/delivery/pocket-details", {
      params: params ?? {},
      contextModule: "delivery",
    }),
  /** GET /food/delivery/emergency-help - admin-set emergency numbers for delivery partner */
  getEmergencyHelp: () =>
    apiClient.get("/food/delivery/emergency-help", {
      contextModule: "delivery",
    }),
  /** GET /food/delivery/cash-limit - admin-set cash limit for delivery partner */
  getCashLimit: () =>
    apiClient.get("/food/delivery/cash-limit", {
      contextModule: "delivery",
    }),
  createWithdrawalRequest: (body) =>
    apiClient.post("/food/delivery/wallet/withdraw", body ?? {}, {
      contextModule: "delivery"
    }),
  createDepositOrder: (amount) =>
    apiClient.post("/food/delivery/wallet/deposit/order", { amount }, {
      contextModule: "delivery"
    }),
  verifyDepositPayment: (body) =>
    apiClient.post("/food/delivery/wallet/deposit/verify", body ?? {}, {
      contextModule: "delivery"
    }),
  /** Wallet transactions - from wallet response (no separate backend endpoint) */
  getWalletTransactions: (params) =>
    apiClient
      .get("/food/delivery/wallet", {
        params: params ?? {},
        contextModule: "delivery",
      })
      .then((res) => ({
        ...res,
        data: {
          ...res.data,
          data: {
            transactions: res?.data?.data?.wallet?.transactions ?? [],
          },
        },
      })),
  /** Zone discovery */
  getZonesInRadius: (lat, lng, radiusKm = 10) =>
    apiClient.get("/food/zones/nearby", {
      params: { lat, lng, radius: radiusKm },
      contextModule: "delivery",
    }),
  /** Store Shop (Delivery Boy purchases from Admin store) */
  getStoreProducts: (params = {}) =>
    apiClient.get('/food/delivery/store/products', { params, contextModule: 'delivery' }),
  getStoreProductById: (id) =>
    apiClient.get(`/food/delivery/store/products/${String(id)}`, { contextModule: 'delivery' }),
  createStoreOrder: (body) =>
    apiClient.post('/food/delivery/store/orders', body ?? {}, { contextModule: 'delivery' }),
  getMyStoreOrders: (params = {}) =>
    apiClient.get('/food/delivery/store/orders', { params, contextModule: 'delivery' }),
  getStoreOrderById: (id) =>
    apiClient.get(`/food/delivery/store/orders/${String(id)}`, { contextModule: 'delivery' }),
  /** Store Shop (Delivery Boy purchases) */
  getStoreProducts: (params = {}) =>
    apiClient.get('/food/delivery/store/products', { params, contextModule: 'delivery' }),
  getStoreProductById: (id) =>
    apiClient.get(`/food/delivery/store/products/${String(id)}`, { contextModule: 'delivery' }),
  placeStoreOrder: (body) =>
    apiClient.post('/food/delivery/store/orders', body ?? {}, { contextModule: 'delivery' }),
  placeBulkStoreOrder: (body) =>
    apiClient.post('/food/delivery/store/orders/bulk', body ?? {}, { contextModule: 'delivery' }),
  verifyStoreOrder: (body) =>
    apiClient.post('/food/delivery/store/orders/verify', body ?? {}, { contextModule: 'delivery' }),
  verifyBulkStoreOrder: (body) =>
    apiClient.post('/food/delivery/store/orders/bulk/verify', body ?? {}, { contextModule: 'delivery' }),
  getMyStoreOrders: (params = {}) =>
    apiClient.get('/food/delivery/store/orders', { params, contextModule: 'delivery' }),
  getMyStoreOrderById: (id) =>
    apiClient.get(`/food/delivery/store/orders/${String(id)}`, { contextModule: 'delivery' }),
  /** Fetch incoming and active exclusivity requests */
  getExclusivityRequests: () =>
    apiClient.get("/food/delivery/exclusivity-requests", {
      contextModule: "delivery",
    }),
  /** Alias: association-centric payload for delivery app integrations */
  getShopAssociation: () =>
    apiClient.get("/food/delivery/shop-association", {
      contextModule: "delivery",
    }),
  /** Accept exclusivity request */
  acceptExclusivityRequest: (requestId) =>
    apiClient.post(
      `/food/delivery/exclusivity-requests/${String(requestId)}/accept`,
      {},
      { contextModule: "delivery" },
    ),
  /** Decline exclusivity request */
  rejectExclusivityRequest: (requestId) =>
    apiClient.post(
      `/food/delivery/exclusivity-requests/${String(requestId)}/reject`,
      {},
      { contextModule: "delivery" },
    ),
  /** Leave active partnership */
  leaveExclusivityPartnership: () =>
    apiClient.post(
      "/food/delivery/exclusivity-requests/leave",
      {},
      { contextModule: "delivery" },
    ),
  /** Respond to association request via alias endpoint */
  respondShopAssociation: (requestId, action) =>
    apiClient.post(
      "/food/delivery/shop-association/respond",
      { requestId: String(requestId), action: String(action || "").toLowerCase() },
      { contextModule: "delivery" },
    ),
};

export const userAPI = {
  /** Get current user profile (Bearer USER). */
  getProfile: () =>
    getUserMeOnce().then((res) => {
      const user =
        res?.data?.data?.user ??
        res?.data?.user ??
        res?.data?.data ??
        res?.data;
      return { ...res, data: { ...res.data, data: { user } } };
    }),
  /** PATCH /food/user/profile (Bearer USER) */
  updateProfile: (body) =>
    apiClient.patch("/food/user/profile", body ?? {}, {
      contextModule: "user",
    }),
  /** Upload and set user profile image (multipart). Field name: file */
  uploadProfileImage: (file) => {
    if (!file) return Promise.reject(new Error("File is required"));
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/food/user/profile/profile-image", formData, {
      contextModule: "user",
    });
  },
  /** GET /food/user/wallet (Bearer USER). Deduped + short-cached. */
  getWallet: (() => {
    let inFlight = null;
    let cached = null;
    let cacheTime = 0;
    const CACHE_MS = 3000;
    return (options = {}) => {
      if (options?.noCache) {
        return apiClient.get("/food/user/wallet", {
          contextModule: "user",
          params: { _ts: Date.now() },
        });
      }
      const now = Date.now();
      if (cached && now - cacheTime < CACHE_MS) return Promise.resolve(cached);
      if (!inFlight) {
        inFlight = apiClient
          .get("/food/user/wallet", { contextModule: "user" })
          .then((res) => {
            cached = res;
            cacheTime = Date.now();
            return res;
          })
          .finally(() => {
            inFlight = null;
          });
      }
      return inFlight;
    };
  })(),
  /** GET /food/user/referrals/stats (Bearer USER) */
  getReferralStats: () =>
    apiClient.get("/food/user/referrals/stats", { contextModule: "user" }),
  /** GET /food/user/referrals/details (Bearer USER) */
  getReferralDetails: () =>
    apiClient.get("/food/user/referrals/details", { contextModule: "user" }),
  getSubscriptionPackages: () =>
    apiClient.get("/food/user/subscription-packages", {
      contextModule: "user",
    }),
  getSubscriptions: () =>
    apiClient.get("/food/user/subscriptions", {
      contextModule: "user",
    }),
  getCurrentSubscription: () =>
    apiClient.get("/food/user/subscriptions/current", {
      contextModule: "user",
    }),
  createSubscriptionRazorpayOrder: (body = {}) =>
    apiClient.post("/food/user/subscriptions/razorpay/order", body ?? {}, {
      contextModule: "user",
    }),
  verifySubscriptionRazorpayPayment: (body = {}) =>
    apiClient.post("/food/user/subscriptions/razorpay/verify", body ?? {}, {
      contextModule: "user",
    }),
  activateSubscription: (body = {}) =>
    apiClient.post("/food/user/subscriptions", body ?? {}, {
      contextModule: "user",
    }),
  cancelSubscription: (subscriptionId) =>
    apiClient.patch(
      `/food/user/subscriptions/${String(subscriptionId)}/cancel`,
      {},
      { contextModule: "user" },
    ),
  /** POST /food/user/wallet/topup/order (Bearer USER). Body: { amount } */
  createWalletTopupOrder: (amount) =>
    apiClient.post(
      "/food/user/wallet/topup/order",
      { amount: Number(amount) },
      { contextModule: "user" },
    ),
  /** POST /food/user/wallet/topup/verify (Bearer USER) */
  verifyWalletTopupPayment: (body) =>
    apiClient.post("/food/user/wallet/topup/verify", body ?? {}, {
      contextModule: "user",
    }),
  /** GET /food/user/addresses (Bearer USER). Deduped + short-cached. */
  getAddresses: (() => {
    let inFlight = null;
    let cached = null;
    let cacheTime = 0;
    const CACHE_MS = 3000;
    return () => {
      const now = Date.now();
      if (cached && now - cacheTime < CACHE_MS) return Promise.resolve(cached);
      if (!inFlight) {
        inFlight = apiClient
          .get("/food/user/addresses", { contextModule: "user" })
          .then((res) => {
            cached = res;
            cacheTime = Date.now();
            return res;
          })
          .finally(() => {
            inFlight = null;
          });
      }
      return inFlight;
    };
  })(),
  /** POST /food/user/addresses (Bearer USER) */
  addAddress: (body) =>
    apiClient.post("/food/user/addresses", body ?? {}, {
      contextModule: "user",
    }),
  /** PATCH /food/user/addresses/:id (Bearer USER) */
  updateAddress: (id, body) =>
    apiClient.patch(`/food/user/addresses/${String(id)}`, body ?? {}, {
      contextModule: "user",
    }),
  /** DELETE /food/user/addresses/:id (Bearer USER) */
  deleteAddress: (id) =>
    apiClient.delete(`/food/user/addresses/${String(id)}`, {
      contextModule: "user",
    }),
  /** PATCH /food/user/addresses/:id/default (Bearer USER) */
  setDefaultAddress: (id) =>
    apiClient.patch(
      `/food/user/addresses/${String(id)}/default`,
      {},
      { contextModule: "user" },
    ),
  /** POST /food/user/safety-emergency-reports (Bearer USER) */
  createSafetyEmergencyReport: (message) =>
    apiClient.post(
      "/food/user/safety-emergency-reports",
      { message: String(message || "") },
      { contextModule: "user" },
    ),
  /** GET /food/user/safety-emergency-reports (Bearer USER) */
  getMySafetyEmergencyReports: (params) =>
    apiClient.get("/food/user/safety-emergency-reports", {
      params: params ?? {},
      contextModule: "user",
    }),
  /**
   * Legacy UI compatibility: update "current user location".
   * We already persist the user's selected location in localStorage in the UI.
   * Keep this as a no-op success so existing flows don't break.
   */
  updateLocation: (_payload) =>
    Promise.resolve({
      data: { success: true, message: "Location saved (client)", data: null },
    }),
  saveFcmToken: (token, options = {}) => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const platform = options?.platform === "mobile" ? "mobile" : "web";
    const path =
      platform === "mobile" ? "/fcm-tokens/mobile/save" : "/fcm-tokens/save";
    return apiClient.post(
      path,
      { token: String(token), platform },
      { contextModule: "user" },
    );
  },
  removeFcmToken: (token, options = {}) => {
    if (!token) return Promise.reject(new Error("FCM token is required"));
    const platform = options?.platform === "mobile" ? "mobile" : "web";
    return apiClient.delete(
      `/fcm-tokens/remove/${encodeURIComponent(String(token))}`,
      {
        data: { token: String(token), platform },
        contextModule: "user",
      },
    );
  },
  testFcmNotification: (options = {}) => {
    const platform = options?.platform === "mobile" ? "mobile" : "web";
    return apiClient.post("/fcm-tokens/test", { platform }, { contextModule: "user" });
  },
};
export const locationAPI = createStubAPI();
export const zoneAPI = {
  /** Public: detect active service zone for a lat/lng point. */
  detectZone: (lat, lng) =>
    apiClient.get("/food/zones/detect", {
      params: { lat, lng },
    }),
  /** Public: list active zones (for onboarding dropdowns). */
  getPublicZones: (params = {}, config = {}) =>
    apiClient.get("/food/zones/public", { params: params ?? {}, ...config }),
};
export const uploadAPI = {
  /**
   * Upload a single image file to the backend (Cloudinary-backed).
   * @param {File|Blob} file
   * @param {{ folder?: string }} options
   */
  uploadMedia: (file, options = {}) => {
    if (!file) {
      return Promise.reject(new Error("File is required for upload"));
    }

    const formData = new FormData();
    formData.append("file", file);
    if (options.folder) {
      formData.append("folder", options.folder);
    }

    return apiClient.post("/uploads/image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
/** Order API (user app – Bearer USER token). Minimal calls: single create/verify, list/details cached by caller. */
export const orderAPI = {
  calculateOrder: (payload) =>
    apiClient.post("/food/orders/calculate", payload ?? {}, {
      contextModule: "user",
    }),
  createOrder: (payload) =>
    apiClient.post("/food/orders", payload ?? {}, { contextModule: "user" }),
  verifyPayment: (body) =>
    apiClient.post("/food/orders/verify-payment", body ?? {}, {
      contextModule: "user",
    }),
  getOrders: (params = {}) =>
    apiClient
      .get("/food/orders", {
        params: { limit: 20, page: 1, ...params },
        contextModule: "user",
      })
      .then((res) => {
        const payload = res?.data?.data;

        // Normalize backend paginated shape:
        // { data: { data: [...], meta: { total, page, limit, totalPages } } }
        // into UI-friendly:
        // { data: { orders: [...], pagination: { total, page, limit, pages } } }
        if (
          payload &&
          typeof payload === "object" &&
          Array.isArray(payload.data) &&
          payload.meta &&
          typeof payload.meta === "object"
        ) {
          const meta = payload.meta;
          return {
            ...res,
            data: {
              ...res.data,
              data: {
                ...payload,
                orders: payload.data,
                pagination: {
                  total: Number(meta.total || 0),
                  page: Number(meta.page || 1),
                  limit: Number(meta.limit || params.limit || 20),
                  pages: Number(meta.totalPages || 1),
                },
              },
            },
          };
        }

        return res;
      }),
  getOrderDetails: (() => {
    const inFlight = new Map();
    const cache = new Map();
    /** Dedupes overlapping calls (StrictMode, poll + socket) without hiding fresh data for long. */
    const CACHE_MS = 800;

    return (orderId, options = {}) => {
      const key = String(orderId ?? "").trim();
      if (!key) {
        return Promise.reject(new Error("orderId required"));
      }

      const force = options.force === true;
      const now = Date.now();
      if (!force) {
        const hit = cache.get(key);
        if (hit && now - hit.at < CACHE_MS) {
          return Promise.resolve(hit.res);
        }
      }

      const pending = inFlight.get(key);
      if (pending) return pending;

      const p = apiClient
        .get(`/food/orders/${key}`, { contextModule: "user" })
        .then((res) => {
          cache.set(key, { at: Date.now(), res });
          return res;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, p);
      return p;
    };
  })(),
  cancelOrder: (orderId, body = {}) =>
    apiClient.patch(`/food/orders/${String(orderId)}/cancel`, body ?? {}, {
      contextModule: "user",
    }),
  updateOrderInstructions: (orderId, instructions) =>
    apiClient.patch(`/food/orders/${String(orderId)}/instructions`, { instructions }, {
      contextModule: "user",
    }),
  submitOrderRatings: (orderId, body = {}) =>
    apiClient.patch(`/food/orders/${String(orderId)}/ratings`, body ?? {}, { contextModule: "user" }),
  /** Submit a complaint for an order (user). */
  submitComplaint: (payload) =>
    apiClient.post(
      "/food/user/support/ticket",
      {
        type: "order",
        orderId: payload.orderId,
        issueType: payload.complaintType,
        description: `${payload.subject}: ${payload.description}`,
      },
      { contextModule: "user" }
    ),
};

export const heroBannerAPI = createStubAPI();
export const publicAPI = {
  getTerms: () => apiClient.get(API_ENDPOINTS.ADMIN.TERMS_PUBLIC),
  getDeliveryTerms: () => apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_TERMS_PUBLIC),
  getPrivacy: () => apiClient.get(API_ENDPOINTS.ADMIN.PRIVACY_PUBLIC),
  getDeliveryPrivacy: () => apiClient.get(API_ENDPOINTS.ADMIN.DELIVERY_PRIVACY_PUBLIC),
  getAbout: () => apiClient.get(API_ENDPOINTS.ADMIN.ABOUT_PUBLIC),
  getRefund: () => apiClient.get(API_ENDPOINTS.ADMIN.REFUND_PUBLIC),
  getShipping: () => apiClient.get(API_ENDPOINTS.ADMIN.SHIPPING_PUBLIC),
  getCancellation: () => apiClient.get(API_ENDPOINTS.ADMIN.CANCELLATION_PUBLIC),
};
