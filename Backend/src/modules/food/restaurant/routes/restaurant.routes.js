import express from 'express';
import { upload } from '../../../../middleware/upload.js';
import {
    registerRestaurantController,
    listApprovedRestaurantsController,
    getApprovedRestaurantController,
    listPublicOffersController,
    getCurrentRestaurantController,
    updateRestaurantProfileController,
    updateRestaurantAcceptingOrdersController,
    uploadRestaurantProfileImageController,
    uploadRestaurantMenuImageController,
    uploadRestaurantCoverImagesController,
    uploadRestaurantMenuImagesController,
    getRestaurantComplaintsController
} from '../controllers/restaurant.controller.js';
import {
    createRestaurantSupportTicketController,
    listRestaurantSupportTicketsController
} from '../controllers/supportTicket.controller.js';
import {
    listCategoriesController,
    listSubcategoriesController
} from '../controllers/restaurantCategory.controller.js';
import { getMenuController, updateMenuController, getPublicRestaurantMenuController } from '../controllers/restaurantMenu.controller.js';
import { getPublicRestaurantAddonsController } from '../controllers/publicAddons.controller.js';
import * as feedbackExperienceController from '../../admin/controllers/feedbackExperience.controller.js';
import {
    getOutletTimingsByRestaurantIdController,
    getCurrentRestaurantOutletTimingsController,
    upsertCurrentRestaurantOutletTimingsController
} from '../controllers/outletTimings.controller.js';
import {
    createRestaurantFoodController,
    updateRestaurantFoodController
} from '../controllers/restaurantFood.controller.js';
import {
    createRestaurantOfferController,
    deleteRestaurantOfferController,
    updateRestaurantOfferController,
    listRestaurantOffersController
} from '../controllers/restaurantOffer.controller.js';
import {
    createRestaurantProductOfferController,
    listRestaurantProductOffersController,
    deleteRestaurantProductOfferController,
    updateRestaurantProductOfferController,
    listPublicRestaurantProductOffersController
} from '../controllers/restaurantProductOffer.controller.js';
import {
    listAddonsController,
    createAddonController,
    updateAddonController,
    deleteAddonController
} from '../controllers/restaurantAddon.controller.js';
import * as orderController from '../../orders/controllers/order.controller.js';
import { authMiddleware, optionalAuthMiddleware } from '../../../../core/auth/auth.middleware.js';
import { sendError } from '../../../../utils/response.js';
import { getRestaurantFinanceController } from '../controllers/restaurantFinance.controller.js';
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
    activateRestaurantSubscriptionController,
    createRestaurantSubscriptionRazorpayOrderController,
    getCurrentRestaurantSubscriptionController,
    listRestaurantSubscriptionPackagesController,
    listRestaurantSubscriptionsController,
    verifyRestaurantSubscriptionRazorpayPaymentController
} from '../controllers/subscription.controller.js';

import { cacheResponse, invalidateCache } from '../../../../middleware/cache.js';

const router = express.Router();

const requireRestaurant = (req, res, next) => {
    if (req.user?.role !== 'RESTAURANT') {
        return sendError(res, 403, 'Restaurant access required');
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

router.post('/register', uploadFields, registerRestaurantController);

// Public: approved restaurants list (for user app)
router.get('/restaurants', cacheResponse(300, 'restaurants'), listApprovedRestaurantsController);
router.get('/restaurants/:id', cacheResponse(600, 'restaurant_detail'), getApprovedRestaurantController);
router.get('/restaurants/:id/menu', cacheResponse(600, 'restaurant_menu'), getPublicRestaurantMenuController);
router.get('/restaurants/:id/outlet-timings', cacheResponse(600, 'restaurant_timings'), getOutletTimingsByRestaurantIdController);
router.get('/offers', optionalAuthMiddleware, listPublicOffersController);
// Public: categories list (zone-aware; returns zone categories + global)
router.get('/categories/public', cacheResponse(600, 'categories'), listCategoriesController);

// Restaurant dashboard/profile (Bearer token + RESTAURANT role)
router.get('/current', authMiddleware, requireRestaurant, getCurrentRestaurantController);
router.patch('/profile', authMiddleware, requireRestaurant, uploadFields, async (req, res, next) => {
    // Invalidate caches when profile is updated
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_detail:*');
    next();
}, updateRestaurantProfileController);
router.patch('/availability', authMiddleware, requireRestaurant, async (req, res, next) => {
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_detail:*');
    next();
}, updateRestaurantAcceptingOrdersController);
router.get('/outlet-timings', authMiddleware, requireRestaurant, getCurrentRestaurantOutletTimingsController);
router.put('/outlet-timings', authMiddleware, requireRestaurant, async (req, res, next) => {
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_detail:*');
    await invalidateCache('restaurant_timings:*');
    next();
}, upsertCurrentRestaurantOutletTimingsController);
router.get('/finance', authMiddleware, requireRestaurant, getRestaurantFinanceController);
router.get('/subscription-packages', authMiddleware, requireRestaurant, listRestaurantSubscriptionPackagesController);
router.get('/subscription', authMiddleware, requireRestaurant, getCurrentRestaurantSubscriptionController);
router.get('/subscriptions', authMiddleware, requireRestaurant, listRestaurantSubscriptionsController);
router.post('/subscription/razorpay/order', authMiddleware, requireRestaurant, createRestaurantSubscriptionRazorpayOrderController);
router.post(
    '/subscription/razorpay/verify',
    authMiddleware,
    requireRestaurant,
    async (_req, _res, next) => {
        await invalidateCache('restaurants:*');
        await invalidateCache('restaurant_detail:*');
        next();
    },
    verifyRestaurantSubscriptionRazorpayPaymentController
);
router.post(
    '/subscription',
    authMiddleware,
    requireRestaurant,
    async (_req, _res, next) => {
        await invalidateCache('restaurants:*');
        await invalidateCache('restaurant_detail:*');
        next();
    },
    activateRestaurantSubscriptionController
);
router.post(
    '/profile/profile-image',
    authMiddleware,
    requireRestaurant,
    upload.single('file'),
    async (req, res, next) => {
        await invalidateCache('restaurants:*');
        await invalidateCache('restaurant_detail:*');
        next();
    },
    uploadRestaurantProfileImageController
);
router.post(
    '/profile/menu-image',
    authMiddleware,
    requireRestaurant,
    upload.single('file'),
    async (req, res, next) => {
        await invalidateCache('restaurant_menu:*');
        next();
    },
    uploadRestaurantMenuImageController
);
router.post(
    '/profile/cover-images',
    authMiddleware,
    requireRestaurant,
    upload.array('files', 20),
    async (req, res, next) => {
        await invalidateCache('restaurant_detail:*');
        next();
    },
    uploadRestaurantCoverImagesController
);
router.post(
    '/profile/menu-images',
    authMiddleware,
    requireRestaurant,
    upload.array('files', 20),
    async (req, res, next) => {
        await invalidateCache('restaurant_menu:*');
        next();
    },
    uploadRestaurantMenuImagesController
);

// Categories (restaurant dashboard). Read-only for item creation, CRUD for Menu Categories page.
router.get('/categories', authMiddleware, requireRestaurant, listCategoriesController);
router.get('/subcategories', authMiddleware, requireRestaurant, listSubcategoriesController);
router.post('/categories', authMiddleware, requireRestaurant, (_req, res) => sendError(res, 403, 'Only admin can create categories'));
router.patch('/categories/:id', authMiddleware, requireRestaurant, (_req, res) => sendError(res, 403, 'Only admin can update categories'));
router.delete('/categories/:id', authMiddleware, requireRestaurant, (_req, res) => sendError(res, 403, 'Only admin can delete categories'));

// Menu (restaurant dashboard) - only fields needed by UI
router.get('/menu', authMiddleware, requireRestaurant, getMenuController);
router.patch('/menu', authMiddleware, requireRestaurant, async (req, res, next) => {
    await invalidateCache('restaurant_menu:*');
    next();
}, updateMenuController);

// Feedback (restaurant dashboard)
router.post('/feedback-experience', authMiddleware, requireRestaurant, feedbackExperienceController.createFeedbackExperience);

// Public: restaurant add-ons (user app)
router.get('/restaurants/:id/addons', cacheResponse(600, 'restaurant_addons'), getPublicRestaurantAddonsController);

// Foods (restaurant creates/updates items -> stored in food_items collection)
router.post('/foods', authMiddleware, requireRestaurant, async (req, res, next) => {
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_menu:*');
    next();
}, createRestaurantFoodController);
router.patch('/foods/:id', authMiddleware, requireRestaurant, async (req, res, next) => {
    await invalidateCache('restaurants:*');
    await invalidateCache('restaurant_menu:*');
    next();
}, updateRestaurantFoodController);

// Add-ons (restaurant dashboard) - approval handled by admin
router.get('/addons', authMiddleware, requireRestaurant, listAddonsController);
router.post('/addons', authMiddleware, requireRestaurant, createAddonController);
router.patch('/addons/:id', authMiddleware, requireRestaurant, updateAddonController);
router.delete('/addons/:id', authMiddleware, requireRestaurant, deleteAddonController);

// Coupons (restaurant-created, pending admin approval)
router.post('/coupons', authMiddleware, requireRestaurant, createRestaurantOfferController);
router.get('/coupons', authMiddleware, requireRestaurant, listRestaurantOffersController);
router.patch('/coupons/:id', authMiddleware, requireRestaurant, updateRestaurantOfferController);
router.delete('/coupons/:id', authMiddleware, requireRestaurant, deleteRestaurantOfferController);

// Product offers (restaurant-created, pending admin approval)
router.post('/offers/restaurant', authMiddleware, requireRestaurant, createRestaurantProductOfferController);
router.get('/offers/restaurant', authMiddleware, requireRestaurant, listRestaurantProductOffersController);
router.delete('/offers/restaurant/:id', authMiddleware, requireRestaurant, deleteRestaurantProductOfferController);
router.patch('/offers/restaurant/:id', authMiddleware, requireRestaurant, updateRestaurantProductOfferController);
// Public: list offers for a restaurant for user-facing pages
router.get('/public/restaurants/:id/offers', optionalAuthMiddleware, listPublicRestaurantProductOffersController);

// Orders (restaurant dashboard)
router.get('/orders', authMiddleware, requireRestaurant, orderController.listOrdersRestaurantController);
router.get('/orders/:orderId', authMiddleware, requireRestaurant, orderController.getOrderByIdRestaurantController);
router.patch('/orders/:orderId/status', authMiddleware, requireRestaurant, orderController.updateOrderStatusRestaurantController);
router.post('/orders/:orderId/assign-delivery', authMiddleware, requireRestaurant, orderController.assignDeliveryPartnerRestaurantController);
router.post('/orders/:orderId/auto-assign-delivery', authMiddleware, requireRestaurant, orderController.autoAssignDeliveryPartnerRestaurantController);
router.post('/orders/:orderId/resend-notification', authMiddleware, requireRestaurant, orderController.resendDeliveryNotificationRestaurantController);

// Complaints (restaurant dashboard)
router.get('/complaints', authMiddleware, requireRestaurant, getRestaurantComplaintsController);
router.post('/support/tickets', authMiddleware, requireRestaurant, createRestaurantSupportTicketController);
router.get('/support/tickets', authMiddleware, requireRestaurant, listRestaurantSupportTicketsController);


// Complaints (restaurant dashboard)
router.get('/complaints', authMiddleware, requireRestaurant, getRestaurantComplaintsController);
router.post('/support/tickets', authMiddleware, requireRestaurant, createRestaurantSupportTicketController);
router.get('/support/tickets', authMiddleware, requireRestaurant, listRestaurantSupportTicketsController);

// Exclusivity / Delivery partners management routes
router.get('/delivery-partners/search', authMiddleware, requireRestaurant, searchDeliveryPartnerController);
router.post('/delivery-partners/invite', authMiddleware, requireRestaurant, sendExclusivityInviteController);
router.post('/delivery-partners/cancel', authMiddleware, requireRestaurant, cancelExclusivityInviteController);
router.post('/delivery-partners/remove', authMiddleware, requireRestaurant, removeExclusivityRiderController);
router.get('/delivery-partners', authMiddleware, requireRestaurant, listExclusivityPartnersController);

// Wallet routes
router.get('/wallet', authMiddleware, requireRestaurant, getWalletDetailsController);
router.post('/wallet/deposit/order', authMiddleware, requireRestaurant, createDepositOrderController);
router.post('/wallet/deposit/verify', authMiddleware, requireRestaurant, verifyDepositPaymentController);
router.post('/wallet/withdraw', authMiddleware, requireRestaurant, withdrawFromWalletController);

export default router;
