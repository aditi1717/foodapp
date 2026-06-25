import express from 'express';
import { AuthError } from '../../../../core/auth/errors.js';
import { FoodAdmin } from '../../../../core/admin/admin.model.js';
import * as adminController from '../controllers/admin.controller.js';
import * as foodApprovalController from '../controllers/foodApproval.controller.js';
import * as addonsApprovalController from '../controllers/addonsApproval.controller.js';
import * as businessSettingsController from '../controllers/businessSettings.controller.js';
import * as feedbackExperienceController from '../controllers/feedbackExperience.controller.js';
import * as notificationBroadcastController from '../controllers/notificationBroadcast.controller.js';
import * as subscriptionController from '../controllers/subscription.controller.js';
import * as orderController from '../../orders/controllers/order.controller.js';
import {
    ADMIN_PERMISSION_PATHS,
    canAccessPermissionPath,
    getRequiredPermissionForApiRoute,
} from '../constants/adminPermissions.js';
import { getAdminPageController, upsertAdminPageController } from '../controllers/pageContent.controller.js';
import { upload } from '../../../../middleware/upload.js';

const router = express.Router();

// ----- Public Business Settings (No Admin Required) -----
router.get('/business-settings/public', businessSettingsController.getBusinessSettings);

const normalizeObjectIdList = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((id) => (id ? String(id) : ''))
        .map((id) => id.trim())
        .filter(Boolean);
};

const requireAdmin = async (req, _res, next) => {
    try {
        const user = req.user;
        if (!user || user.role !== 'ADMIN') {
            return next(new AuthError('Admin access required'));
        }

        const adminDoc = await FoodAdmin.findById(user.userId)
            .select('_id role email name isActive adminType permissions zoneIds')
            .lean();

        if (!adminDoc || adminDoc.isActive === false) {
            return next(new AuthError('Admin account is inactive or not found'));
        }

        const adminType = String(adminDoc.adminType || 'SUPER_ADMIN').toUpperCase();
        const permissions = Array.isArray(adminDoc.permissions) ? adminDoc.permissions : [];
        const zoneIds = normalizeObjectIdList(adminDoc.zoneIds);

        req.adminAuth = {
            id: String(adminDoc._id),
            role: 'ADMIN',
            adminType,
            permissions,
            zoneIds,
            isSuperAdmin: adminType === 'SUPER_ADMIN',
            isSubAdmin: adminType === 'SUB_ADMIN',
        };

        if (adminType === 'SUB_ADMIN') {
            const requiredPermission = getRequiredPermissionForApiRoute(req.method, req.path);
            if (requiredPermission && !canAccessPermissionPath(permissions, requiredPermission)) {
                return next(new AuthError('Sub-admin does not have permission for this action'));
            }
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

router.use(requireAdmin);

const requireSuperAdmin = (req, _res, next) => {
    if (!req.adminAuth?.isSuperAdmin) {
        return next(new AuthError('Super admin access required'));
    }
    return next();
};

const requireAdminPermission = (permissionPath) => (req, _res, next) => {
    if (req.adminAuth?.isSuperAdmin) return next();
    if (!req.adminAuth?.isSubAdmin) return next();
    if (canAccessPermissionPath(req.adminAuth.permissions, permissionPath)) return next();
    return next(new AuthError('Sub-admin does not have permission for this action'));
};

// ----- Admin Management -----
router.get('/admins', requireAdminPermission(ADMIN_PERMISSION_PATHS.MANAGE_ADMINS), adminController.listAdmins);
router.post('/admins', requireSuperAdmin, adminController.createAdmin);
router.patch('/admins/:id', requireSuperAdmin, adminController.updateAdmin);
router.patch('/admins/:id/status', requireSuperAdmin, adminController.updateAdminStatus);
router.delete('/admins/:id', requireSuperAdmin, adminController.deleteAdmin);

// ----- Broadcast Notifications -----
router.post('/notifications/broadcast', notificationBroadcastController.createBroadcastNotificationController);
router.get('/notifications/broadcast', notificationBroadcastController.getBroadcastNotificationsController);
router.delete('/notifications/broadcast/:id', notificationBroadcastController.deleteBroadcastNotificationController);

// ----- Customers -----
router.get('/customers', adminController.getCustomers);
router.get('/customers/:id', adminController.getCustomerById);
router.patch('/customers/:id/status', adminController.updateCustomerStatus);

// ----- Safety / Emergency Reports -----
router.get('/safety-emergency-reports', adminController.getSafetyEmergencyReports);
router.put('/safety-emergency-reports/:id/status', adminController.updateSafetyEmergencyStatus);
router.put('/safety-emergency-reports/:id/priority', adminController.updateSafetyEmergencyPriority);
router.delete('/safety-emergency-reports/:id', adminController.deleteSafetyEmergencyReport);

// ----- Support Tickets (users) -----
router.get('/support-tickets', adminController.getSupportTicketsController);
router.patch('/support-tickets/:id', adminController.updateSupportTicketController);
router.get('/global-search', adminController.globalSearch);
router.get('/shops/complaints', adminController.getShopComplaints);
router.patch('/shops/complaints/:id', adminController.updateShopComplaint);

// ----- Shops -----
router.get('/shops', adminController.getShops);
router.get('/dashboard-stats', adminController.getDashboardStats);
router.get('/reports/shops', adminController.getShopReport);
router.get('/reports/transactions', adminController.getTransactionReport);
router.get('/reports/tax', adminController.getTaxReport);
router.get('/reports/tax/:id', adminController.getTaxReportDetail);
router.get('/shops/pending', adminController.getPendingShops);
router.get('/shops/reviews', adminController.getShopReviews);
router.get('/shops/:id', adminController.getShopById);
router.get('/shops/:id/outlet-timings', adminController.getShopOutletTimings);
router.get('/shops/:id/analytics', adminController.getShopAnalytics);
router.get('/shops/:id/menu', adminController.getShopMenuById);
router.post('/shops', adminController.createShop);
router.patch('/shops/:id', adminController.updateShopById);
router.put('/shops/:id/outlet-timings', adminController.updateShopOutletTimings);
router.patch('/shops/:id/status', adminController.updateShopStatus);
router.patch('/shops/:id/location', adminController.updateShopLocation);
router.patch('/shops/:id/menu', adminController.updateShopMenuById);
router.patch('/shops/:id/approve', adminController.approveShop);
router.patch('/shops/:id/reject', adminController.rejectShop);
router.delete('/shops/:id', adminController.deleteShopById);

// ----- Shop Commission -----
router.get('/shop-commissions/bootstrap', adminController.getShopCommissionBootstrap);
router.get('/shop-commissions', adminController.getShopCommissions);
router.post('/shop-commissions', adminController.createShopCommission);
router.get('/shop-commissions/:id', adminController.getShopCommissionById);
router.patch('/shop-commissions/:id', adminController.updateShopCommission);
router.delete('/shop-commissions/:id', adminController.deleteShopCommission);
router.patch('/shop-commissions/:id/toggle', adminController.toggleShopCommissionStatus);

// ----- Categories -----
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.patch('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);
router.patch('/categories/:id/toggle', adminController.toggleCategoryStatus);
router.patch('/categories/:id/approve', adminController.approveCategory);
router.patch('/categories/:id/reject', adminController.rejectCategory);
router.patch('/categories/:id/make-global', adminController.makeCategoryGlobal);

// ----- Subcategories -----
router.get('/subcategories', adminController.getSubcategories);
router.post('/subcategories', adminController.createSubcategory);
router.patch('/subcategories/:id', adminController.updateSubcategory);
router.delete('/subcategories/:id', adminController.deleteSubcategory);
router.patch('/subcategories/:id/toggle', adminController.toggleSubcategoryStatus);
router.patch('/subcategories/:id/approve', adminController.approveSubcategory);
router.patch('/subcategories/:id/reject', adminController.rejectSubcategory);

// ----- Shop Add-ons Approval -----
router.get('/addons', addonsApprovalController.getShopAddons);
router.patch('/addons/:id', addonsApprovalController.updateShopAddon);
router.patch('/addons/:id/approve', addonsApprovalController.approveShopAddon);
router.patch('/addons/:id/reject', addonsApprovalController.rejectShopAddon);

// ----- Foods -----
router.get('/foods', adminController.getFoods);
router.post('/foods', adminController.createFood);
router.patch('/foods/:id', adminController.updateFood);
router.delete('/foods/:id', adminController.deleteFood);
// Food approval queue (pending items created by shops)
router.get('/foods/pending-approvals', foodApprovalController.getPendingFoodApprovals);
router.patch('/foods/:id/approve', foodApprovalController.approveFoodItemController);
router.patch('/foods/:id/reject', foodApprovalController.rejectFoodItemController);

// ----- Offers & Coupons -----
router.get('/offers', adminController.getAllOffers);
router.get('/offers/pending', adminController.getPendingShopOffers);
router.post('/offers', adminController.createAdminOffer);
router.patch('/offers/:id/cart-visibility', adminController.updateAdminOfferCartVisibility);
router.patch('/offers/:id', adminController.updateAdminOffer);
router.delete('/offers/:id', adminController.deleteAdminOffer);
router.patch('/offers/:id/approve', adminController.approveShopOffer);
router.patch('/offers/:id/reject', adminController.rejectShopOffer);
router.get('/offers/shop/pending', adminController.getPendingShopProductOffers);
router.patch('/offers/shop/:id/approve', adminController.approveShopProductOffer);
router.patch('/offers/shop/:id/reject', adminController.rejectShopProductOffer);

// ----- Feedback Experience (Admin) -----
router.get('/feedback-experiences', feedbackExperienceController.getFeedbackExperiences);
router.delete('/feedback-experiences/:id', feedbackExperienceController.deleteFeedbackExperience);

// ----- Fee Settings -----
router.get('/fee-settings', adminController.getFeeSettings);
router.put('/fee-settings', adminController.createOrUpdateFeeSettings);

// ----- Referral Settings -----
router.get('/referral-settings', adminController.getReferralSettings);
router.put('/referral-settings', adminController.createOrUpdateReferralSettings);

// ----- Business Settings -----
router.get('/business-settings/public', businessSettingsController.getBusinessSettings); // Public endpoint
router.get('/business-settings', businessSettingsController.getBusinessSettings);
router.patch('/business-settings', upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
]), businessSettingsController.updateBusinessSettings);

// ----- Subscription Packages -----
router.get('/subscription-packages', subscriptionController.listSubscriptionPackagesController);
router.get('/subscription-subscribers', subscriptionController.listSubscriptionSubscribersController);
router.post('/subscription-packages', subscriptionController.createSubscriptionPackageController);
router.patch('/subscription-packages/:id', subscriptionController.updateSubscriptionPackageController);
router.patch('/subscription-packages/:id/status', subscriptionController.updateSubscriptionPackageStatusController);
router.delete('/subscription-packages/:id', subscriptionController.deleteSubscriptionPackageController);

// ----- Delivery Cash Limit -----
router.get('/delivery-cash-limit', adminController.getDeliveryCashLimit);
router.patch('/delivery-cash-limit', adminController.updateDeliveryCashLimit);

// ----- Delivery Emergency Help -----
router.get('/delivery-emergency-help', adminController.getEmergencyHelp);
router.put('/delivery-emergency-help', adminController.createOrUpdateEmergencyHelp);

// ----- Withdrawals (admin) -----
router.get('/delivery/withdrawals', adminController.getDeliveryWithdrawals);
router.patch('/delivery/withdrawals/:id', adminController.updateDeliveryWithdrawalStatus);
router.get('/shop/withdrawals', adminController.getWithdrawals);
router.patch('/shop/withdrawals/:id', adminController.updateWithdrawalStatus);
router.get('/delivery/cash-limit-settlements', adminController.getCashLimitSettlements);
router.get('/payout-settlements/preview', adminController.getPayoutSettlementPreview);
router.get('/payout-settlements/history', adminController.getPayoutSettlementHistory);
router.get('/payout-settlements/history/:batchId', adminController.getPayoutSettlementHistoryBatchDetails);
router.post('/payout-settlements/mark-all-paid', adminController.markAllPayoutSettlementsPaid);

// ----- Delivery partners & general -----
router.get('/delivery/join-requests', adminController.getDeliveryJoinRequests);
router.get('/delivery/wallets', adminController.getDeliveryWallets);
router.get('/delivery/bonus-transactions', adminController.getDeliveryPartnerBonusTransactions);
router.get('/delivery/earnings', adminController.getDeliveryEarnings);
router.post('/delivery/bonus', adminController.addDeliveryPartnerBonus);
router.get('/delivery/commission-rules', adminController.getDeliveryCommissionRules);
router.post('/delivery/commission-rules', adminController.createDeliveryCommissionRule);
router.patch('/delivery/commission-rules/:id', adminController.updateDeliveryCommissionRule);
router.delete('/delivery/commission-rules/:id', adminController.deleteDeliveryCommissionRule);
router.patch('/delivery/commission-rules/:id/status', adminController.toggleDeliveryCommissionRuleStatus);
router.get('/delivery/reviews', adminController.getDeliverymanReviews);
router.get('/contact-messages', adminController.getContactMessages);
router.get('/delivery/earning-addons', adminController.getEarningAddons);
router.post('/delivery/earning-addons', adminController.createEarningAddon);
router.patch('/delivery/earning-addons/:id', adminController.updateEarningAddon);
router.delete('/delivery/earning-addons/:id', adminController.deleteEarningAddon);
router.patch('/delivery/earning-addons/:id/status', adminController.toggleEarningAddonStatus);
router.get('/delivery/earning-addon-history', adminController.getEarningAddonHistory);
router.post('/delivery/earning-addon-history/:id/credit', adminController.creditEarningToWallet);
router.post('/delivery/earning-addon-history/:id/cancel', adminController.cancelEarningAddonHistory);
router.post('/delivery/earning-addon-completions/check', adminController.checkEarningAddonCompletions);
router.get('/delivery/support-tickets/stats', adminController.getSupportTicketStats);
router.get('/delivery/support-tickets', adminController.getSupportTickets);
router.patch('/delivery/support-tickets/:id', adminController.updateSupportTicket);
router.get('/delivery/partners', adminController.getDeliveryPartners);
router.get('/delivery/partners-pending-zone', adminController.getDeliveryPartnersPendingZoneChange);
router.get('/delivery/:id', adminController.getDeliveryPartnerById);
router.patch('/delivery/:id/zone', adminController.updateDeliveryPartnerZone);
router.patch('/delivery/:id/approve', adminController.approveDeliveryPartner);
router.patch('/delivery/:id/reject', adminController.rejectDeliveryPartner);
router.patch('/delivery/:id/zone-change/approve', adminController.approveDeliveryPartnerZoneChange);
router.patch('/delivery/:id/zone-change/reject', adminController.rejectDeliveryPartnerZoneChange);

// ----- Zones -----
router.get('/zones', adminController.getZones);
router.get('/zones/:id', adminController.getZoneById);
router.post('/zones', adminController.createZone);
router.patch('/zones/:id', adminController.updateZone);
router.delete('/zones/:id', adminController.deleteZone);

// ----- Orders -----
router.get('/orders', orderController.listOrdersAdminController);
router.get('/orders/:orderId', orderController.getOrderByIdAdminController);
router.patch('/orders/:orderId/status', orderController.updateOrderStatusAdminController);
router.post('/orders/:orderId/resend-delivery-notification', orderController.resendAssignedDeliveryNotificationAdminController);
router.delete('/orders/:orderId', orderController.deleteOrderAdminController);

// ----- CMS Pages (About + legal) -----
router.get('/pages-social-media/:key', getAdminPageController);
router.put('/pages-social-media/:key', upsertAdminPageController);

router.get('/sidebar-badges', adminController.getSidebarBadges);
router.get('/notifications/fssai-expired', adminController.getExpiredFssaiNotifications);


// ----- Store Products (Admin sells to Delivery Boys) -----
router.get('/store/products', adminController.getStoreProducts);
router.post('/store/products', adminController.createStoreProduct);
router.patch('/store/products/:id', adminController.updateStoreProduct);
router.delete('/store/products/:id', adminController.deleteStoreProduct);
router.patch('/store/products/:id/stock', adminController.updateStoreProductStock);

// ----- Store Orders -----
router.get('/store/orders', adminController.getStoreOrders);
router.put('/store/orders/:id/status', adminController.updateStoreOrderStatus);
export default router;
