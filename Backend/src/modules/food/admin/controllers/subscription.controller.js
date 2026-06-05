import { sendResponse } from '../../../../utils/response.js';
import {
    createSubscriptionPackage,
    deleteSubscriptionPackage,
    listAdminSubscriptionSubscribers,
    listSubscriptionPackages,
    updateSubscriptionPackage,
    updateSubscriptionPackageStatus,
} from '../../shared/subscription.service.js';

export const listSubscriptionPackagesController = async (req, res, next) => {
    try {
        const result = await listSubscriptionPackages({
            type: req.query?.type,
            activeOnly: req.query?.activeOnly === 'true',
        });
        return sendResponse(res, 200, 'Subscription packages retrieved successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const listSubscriptionSubscribersController = async (req, res, next) => {
    try {
        const result = await listAdminSubscriptionSubscribers({
            type: req.query?.type,
            search: req.query?.search,
            zoneId: req.query?.zoneId,
            status: req.query?.status,
        });
        return sendResponse(res, 200, 'Subscription subscribers retrieved successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const createSubscriptionPackageController = async (req, res, next) => {
    try {
        const result = await createSubscriptionPackage(req.body || {}, req.user?.userId);
        return sendResponse(res, 201, 'Subscription package created successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const updateSubscriptionPackageController = async (req, res, next) => {
    try {
        const result = await updateSubscriptionPackage(req.params.id, req.body || {}, req.user?.userId);
        return sendResponse(res, 200, 'Subscription package updated successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const updateSubscriptionPackageStatusController = async (req, res, next) => {
    try {
        const result = await updateSubscriptionPackageStatus(req.params.id, req.body?.active, req.user?.userId);
        return sendResponse(res, 200, 'Subscription package status updated successfully', result);
    } catch (error) {
        return next(error);
    }
};

export const deleteSubscriptionPackageController = async (req, res, next) => {
    try {
        const result = await deleteSubscriptionPackage(req.params.id);
        return sendResponse(res, 200, 'Subscription package deleted successfully', result);
    } catch (error) {
        return next(error);
    }
};
