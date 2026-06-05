import { sendResponse } from '../../../../utils/response.js';
import {
    activateOwnerSubscription,
    cancelOwnerSubscription,
    createOwnerSubscriptionRazorpayOrder,
    getCurrentOwnerSubscription,
    listOwnerSubscriptions,
    listSubscriptionPackages,
    verifyOwnerSubscriptionRazorpayPayment,
} from '../../shared/subscription.service.js';

export const listCustomerSubscriptionPackagesController = async (_req, res, next) => {
    try {
        const result = await listSubscriptionPackages({ type: 'Customer', activeOnly: true });
        return sendResponse(res, 200, 'Customer subscription packages retrieved successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const listMySubscriptionsController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await listOwnerSubscriptions('USER', userId);
        return sendResponse(res, 200, 'Subscriptions retrieved successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const getCurrentMySubscriptionController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await getCurrentOwnerSubscription('USER', userId);
        return sendResponse(res, 200, 'Current subscription retrieved successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const createMySubscriptionController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await activateOwnerSubscription('USER', userId, req.body || {});
        return sendResponse(res, 201, 'Subscription activated successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const createMySubscriptionRazorpayOrderController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await createOwnerSubscriptionRazorpayOrder('USER', userId, req.body || {});
        return sendResponse(res, 200, 'Subscription Razorpay order created successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const verifyMySubscriptionRazorpayPaymentController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await verifyOwnerSubscriptionRazorpayPayment('USER', userId, req.body || {});
        return sendResponse(res, 200, 'Subscription payment verified successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const cancelMySubscriptionController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await cancelOwnerSubscription('USER', userId, req.params.subscriptionId);
        return sendResponse(res, 200, 'Subscription cancelled successfully', result);
    } catch (error) {
        return next(error);
    }
};
