import express from 'express';
import { upload } from '../../../../middleware/upload.js';
import {
    registerShopController,
    listApprovedShopsController,
    getApprovedShopController,
    listPublicOffersController,
    getCurrentShopController,
    updateShopProfileController,
    updateShopAcceptingOrdersController,
    uploadShopProfileImageController,
    uploadShopMenuImageController,
    uploadShopCoverImagesController,
    uploadShopMenuImagesController,
    getShopComplaintsController
} from '../controllers/shop.controller.js';
import {
    createShopSupportTicketController,
    listShopSupportTicketsController
} from '../controllers/supportTicket.controller.js';
import {
    listCategoriesController,
    listSubcategoriesController
} from '../controllers/shopCategory.controller.js';
import { getMenuController, updateMenuController, getPublicShopMenuController } from '../controllers/shopMenu.controller.js';
import { getPublicShopAddonsController } from '../controllers/publicAddons.controller.js';
import * as feedbackExperienceController from '../../admin/controllers/feedbackExperience.controller.js';
import {
    getOutletTimingsByShopIdController,
    getCurrentShopOutletTimingsController,
    upsertCurrentShopOutletTimingsController
} from '../controllers/outletTimings.controller.js';
import {
    createShopFoodController,
    updateShopFoodController
} from '../controllers/shopFood.controller.js';
import {
    createShopOfferController,
    deleteShopOfferController,
    updateShopOfferController,
    listShopOffersController
} from '../controllers/shopOffer.controller.js';
import {
    createShopProductOfferController,
    listShopProductOffersController,
    deleteShopProductOfferController,
    updateShopProductOfferController,
    listPublicShopProductOffersController
} from '../controllers/shopProductOffer.controller.js';
import {
    listAddonsController,
    createAddonController,
    updateAddonController,
    deleteAddonController
} from '../controllers/shopAddon.controller.js';
import * as orderController from '../../orders/controllers/order.controller.js';
import { authMiddleware, optionalAuthMiddleware } from '../../../../core/auth/auth.middleware.js';
import { sendError } from '../../../../utils/response.js';
import { getShopFinanceController } from '../controllers/shopFinance.controller.js';
import {
    getWalletDetailsController,
    createDepositOrderController,
    verifyDepositPaymentController,
    withdrawFromWalletController
} from '../controllers/wallet.controller.js';
import {
    searchDeliveryPartnerController,
    sendExclusivityInviteController,
    cancelExclusivityInviteController,
    removeExclusivityRiderController,
    listExclusivityPartnersController
} from '../../delivery/controllers/deliveryExclusivity.controller.js';
import {
    activateShopSubscriptionController,
    createShopSubscriptionRazorpayOrderController,
    getCurrentShopSubscriptionController,
    listShopSubscriptionPackagesController,
    listShopSubscriptionsController,
    verifyShopSubscriptionRazorpayPaymentController
} from '../controllers/subscription.controller.js';

import { cacheResponse, invalidateCache } from '../../../../middleware/cache.js';

const router = express.Router();

const requireShop = (req, res, next) => {
    if (req.user?.role !== 'SHOP') {
        return sendError(res, 403, 'Shop access required');
    }
    next();
};

const uploadFields = upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'panImage', maxCount: 1 },
    { name: 'gstImage', maxCount: 1 },
    { name: 'fssaiImage', maxCount: 1 },
    { name: 'menuImages', maxCount: 10 }
]);

router.post('/register', uploadFields, registerShopController);

// Public: approved shops list (for user app)
router.get('/shops', cacheResponse(300, 'shops'), listApprovedShopsController);
router.get('/shops/:id', cacheResponse(600, 'shop_detail'), getApprovedShopController);
router.get('/shops/:id/menu', cacheResponse(600, 'shop_menu'), getPublicShopMenuController);
router.get('/shops/:id/outlet-timings', cacheResponse(600, 'shop_timings'), getOutletTimingsByShopIdController);
router.get('/offers', optionalAuthMiddleware, listPublicOffersController);
// Public: categories list (zone-aware; returns zone categories + global)
router.get('/categories/public', cacheResponse(600, 'categories'), listCategoriesController);

// Shop dashboard/profile (Bearer token + SHOP role)
router.get('/current', authMiddleware, requireShop, getCurrentShopController);
router.patch('/profile', authMiddleware, requireShop, uploadFields, async (req, res, next) => {
    // Invalidate caches when profile is updated
    await invalidateCache('shops:*');
    await invalidateCache('shop_detail:*');
    next();
}, updateShopProfileController);
router.patch('/availability', authMiddleware, requireShop, async (req, res, next) => {
    await invalidateCache('shops:*');
    await invalidateCache('shop_detail:*');
    next();
}, updateShopAcceptingOrdersController);
router.get('/outlet-timings', authMiddleware, requireShop, getCurrentShopOutletTimingsController);
router.put('/outlet-timings', authMiddleware, requireShop, async (req, res, next) => {
    await invalidateCache('shops:*');
    await invalidateCache('shop_detail:*');
    await invalidateCache('shop_timings:*');
    next();
}, upsertCurrentShopOutletTimingsController);
router.get('/finance', authMiddleware, requireShop, getShopFinanceController);
router.get('/subscription-packages', authMiddleware, requireShop, listShopSubscriptionPackagesController);
router.get('/subscription', authMiddleware, requireShop, getCurrentShopSubscriptionController);
router.get('/subscriptions', authMiddleware, requireShop, listShopSubscriptionsController);
router.post('/subscription/razorpay/order', authMiddleware, requireShop, createShopSubscriptionRazorpayOrderController);
router.post(
    '/subscription/razorpay/verify',
    authMiddleware,
    requireShop,
    async (_req, _res, next) => {
        await invalidateCache('shops:*');
        await invalidateCache('shop_detail:*');
        next();
    },
    verifyShopSubscriptionRazorpayPaymentController
);
router.post(
    '/subscription',
    authMiddleware,
    requireShop,
    async (_req, _res, next) => {
        await invalidateCache('shops:*');
        await invalidateCache('shop_detail:*');
        next();
    },
    activateShopSubscriptionController
);
router.post(
    '/profile/profile-image',
    authMiddleware,
    requireShop,
    upload.single('file'),
    async (req, res, next) => {
        await invalidateCache('shops:*');
        await invalidateCache('shop_detail:*');
        next();
    },
    uploadShopProfileImageController
);
router.post(
    '/profile/menu-image',
    authMiddleware,
    requireShop,
    upload.single('file'),
    async (req, res, next) => {
        await invalidateCache('shop_menu:*');
        next();
    },
    uploadShopMenuImageController
);
router.post(
    '/profile/cover-images',
    authMiddleware,
    requireShop,
    upload.array('files', 20),
    async (req, res, next) => {
        await invalidateCache('shop_detail:*');
        next();
    },
    uploadShopCoverImagesController
);
router.post(
    '/profile/menu-images',
    authMiddleware,
    requireShop,
    upload.array('files', 20),
    async (req, res, next) => {
        await invalidateCache('shop_menu:*');
        next();
    },
    uploadShopMenuImagesController
);

// Categories (shop dashboard). Read-only for item creation, CRUD for Menu Categories page.
router.get('/categories', authMiddleware, requireShop, listCategoriesController);
router.get('/subcategories', authMiddleware, requireShop, listSubcategoriesController);
router.post('/categories', authMiddleware, requireShop, (_req, res) => sendError(res, 403, 'Only admin can create categories'));
router.patch('/categories/:id', authMiddleware, requireShop, (_req, res) => sendError(res, 403, 'Only admin can update categories'));
router.delete('/categories/:id', authMiddleware, requireShop, (_req, res) => sendError(res, 403, 'Only admin can delete categories'));

// Menu (shop dashboard) - only fields needed by UI
router.get('/menu', authMiddleware, requireShop, getMenuController);
router.patch('/menu', authMiddleware, requireShop, async (req, res, next) => {
    await invalidateCache('shop_menu:*');
    next();
}, updateMenuController);

// Feedback (shop dashboard)
router.post('/feedback-experience', authMiddleware, requireShop, feedbackExperienceController.createFeedbackExperience);

// Public: shop add-ons (user app)
router.get('/shops/:id/addons', cacheResponse(600, 'shop_addons'), getPublicShopAddonsController);

// Foods (shop creates/updates items -> stored in food_items collection)
router.post('/foods', authMiddleware, requireShop, async (req, res, next) => {
    await invalidateCache('shops:*');
    await invalidateCache('shop_menu:*');
    next();
}, createShopFoodController);
router.patch('/foods/:id', authMiddleware, requireShop, async (req, res, next) => {
    await invalidateCache('shops:*');
    await invalidateCache('shop_menu:*');
    next();
}, updateShopFoodController);

// Add-ons (shop dashboard) - approval handled by admin
router.get('/addons', authMiddleware, requireShop, listAddonsController);
router.post('/addons', authMiddleware, requireShop, createAddonController);
router.patch('/addons/:id', authMiddleware, requireShop, updateAddonController);
router.delete('/addons/:id', authMiddleware, requireShop, deleteAddonController);

// Coupons (shop-created, pending admin approval)
router.post('/coupons', authMiddleware, requireShop, createShopOfferController);
router.get('/coupons', authMiddleware, requireShop, listShopOffersController);
router.patch('/coupons/:id', authMiddleware, requireShop, updateShopOfferController);
router.delete('/coupons/:id', authMiddleware, requireShop, deleteShopOfferController);

// Product offers (shop-created, pending admin approval)
router.post('/offers/shop', authMiddleware, requireShop, createShopProductOfferController);
router.get('/offers/shop', authMiddleware, requireShop, listShopProductOffersController);
router.delete('/offers/shop/:id', authMiddleware, requireShop, deleteShopProductOfferController);
router.patch('/offers/shop/:id', authMiddleware, requireShop, updateShopProductOfferController);
// Public: list offers for a shop for user-facing pages
router.get('/public/shops/:id/offers', optionalAuthMiddleware, listPublicShopProductOffersController);

// Orders (shop dashboard)
router.get('/orders', authMiddleware, requireShop, orderController.listOrdersShopController);
router.get('/orders/:orderId', authMiddleware, requireShop, orderController.getOrderByIdShopController);
router.patch('/orders/:orderId/status', authMiddleware, requireShop, orderController.updateOrderStatusShopController);
router.post('/orders/:orderId/assign-delivery', authMiddleware, requireShop, orderController.assignDeliveryPartnerShopController);
router.post('/orders/:orderId/auto-assign-delivery', authMiddleware, requireShop, orderController.autoAssignDeliveryPartnerShopController);
router.post('/orders/:orderId/resend-notification', authMiddleware, requireShop, orderController.resendDeliveryNotificationShopController);

// Complaints (shop dashboard)
router.get('/complaints', authMiddleware, requireShop, getShopComplaintsController);
router.post('/support/tickets', authMiddleware, requireShop, createShopSupportTicketController);
router.get('/support/tickets', authMiddleware, requireShop, listShopSupportTicketsController);


// Complaints (shop dashboard)
router.get('/complaints', authMiddleware, requireShop, getShopComplaintsController);
router.post('/support/tickets', authMiddleware, requireShop, createShopSupportTicketController);
router.get('/support/tickets', authMiddleware, requireShop, listShopSupportTicketsController);

// Exclusivity / Delivery partners management routes
router.get('/delivery-partners/search', authMiddleware, requireShop, searchDeliveryPartnerController);
router.post('/delivery-partners/invite', authMiddleware, requireShop, sendExclusivityInviteController);
router.post('/delivery-partners/cancel', authMiddleware, requireShop, cancelExclusivityInviteController);
router.post('/delivery-partners/remove', authMiddleware, requireShop, removeExclusivityRiderController);
router.get('/delivery-partners', authMiddleware, requireShop, listExclusivityPartnersController);

// Wallet routes
router.get('/wallet', authMiddleware, requireShop, getWalletDetailsController);
router.post('/wallet/deposit/order', authMiddleware, requireShop, createDepositOrderController);
router.post('/wallet/deposit/verify', authMiddleware, requireShop, verifyDepositPaymentController);
router.post('/wallet/withdraw', authMiddleware, requireShop, withdrawFromWalletController);

export default router;
