import { sendResponse } from '../../../../utils/response.js';
import {
    activateOwnerSubscription,
    createOwnerSubscriptionRazorpayOrder,
    getCurrentOwnerSubscription,
    listOwnerSubscriptions,
    listSubscriptionPackages,
    verifyOwnerSubscriptionRazorpayPayment,
} from '../../shared/subscription.service.js';

export const listShopSubscriptionPackagesController = async (_req, res, next) => {
    try {
        const result = await listSubscriptionPackages({ type: 'Resto', activeOnly: true });
        return sendResponse(res, 200, 'Shop subscription packages retrieved successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const listShopSubscriptionsController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const result = await listOwnerSubscriptions('SHOP', shopId);
        return sendResponse(res, 200, 'Shop subscriptions retrieved successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const getCurrentShopSubscriptionController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const result = await getCurrentOwnerSubscription('SHOP', shopId);
        return sendResponse(res, 200, 'Current shop subscription retrieved successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const activateShopSubscriptionController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const result = await activateOwnerSubscription('SHOP', shopId, req.body || {});
        return sendResponse(res, 201, 'Shop subscription activated successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const createShopSubscriptionRazorpayOrderController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const result = await createOwnerSubscriptionRazorpayOrder('SHOP', shopId, req.body || {});
        return sendResponse(res, 200, 'Shop subscription Razorpay order created successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const verifyShopSubscriptionRazorpayPaymentController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const result = await verifyOwnerSubscriptionRazorpayPayment('SHOP', shopId, req.body || {});
        return sendResponse(res, 201, 'Shop subscription payment verified successfully', result);
    } catch (error) {
        return next(error);
    }
};
