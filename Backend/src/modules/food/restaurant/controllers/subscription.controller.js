import { sendResponse } from '../../../../utils/response.js';
import {
    activateOwnerSubscription,
    createOwnerSubscriptionRazorpayOrder,
    getCurrentOwnerSubscription,
    listOwnerSubscriptions,
    listSubscriptionPackages,
    verifyOwnerSubscriptionRazorpayPayment,
} from '../../shared/subscription.service.js';

export const listRestaurantSubscriptionPackagesController = async (_req, res, next) => {
    try {
        const result = await listSubscriptionPackages({ type: 'Resto', activeOnly: true });
        return sendResponse(res, 200, 'Restaurant subscription packages retrieved successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const listRestaurantSubscriptionsController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await listOwnerSubscriptions('RESTAURANT', restaurantId);
        return sendResponse(res, 200, 'Restaurant subscriptions retrieved successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const getCurrentRestaurantSubscriptionController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await getCurrentOwnerSubscription('RESTAURANT', restaurantId);
        return sendResponse(res, 200, 'Current restaurant subscription retrieved successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const activateRestaurantSubscriptionController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await activateOwnerSubscription('RESTAURANT', restaurantId, req.body || {});
        return sendResponse(res, 201, 'Restaurant subscription activated successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const createRestaurantSubscriptionRazorpayOrderController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await createOwnerSubscriptionRazorpayOrder('RESTAURANT', restaurantId, req.body || {});
        return sendResponse(res, 200, 'Restaurant subscription Razorpay order created successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const verifyRestaurantSubscriptionRazorpayPaymentController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        const result = await verifyOwnerSubscriptionRazorpayPayment('RESTAURANT', restaurantId, req.body || {});
        return sendResponse(res, 201, 'Restaurant subscription payment verified successfully', result);
    } catch (error) {
        return next(error);
    }
};
