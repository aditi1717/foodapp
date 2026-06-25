import {
    listShopCategories,
    listPublicCategories,
    listShopSubcategories,
    createShopCategory,
    updateShopCategory,
    deleteShopCategory
} from '../services/shopCategory.service.js';
import { sendResponse, sendError } from '../../../../utils/response.js';
import { FoodShop } from '../models/shop.model.js';

export const listCategoriesController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        // Default to shop's zone when caller doesn't pass zoneId.
        // This returns (zone categories + global categories) instead of only global.
        const query = { ...(req.query || {}) };
        if (!shopId) {
            // Public endpoint: no auth available. Return approved categories (zone-aware).
            const data = await listPublicCategories(query);
            return sendResponse(res, 200, 'Categories fetched successfully', data);
        }

        if (!query.zoneId) {
            const r = await FoodShop.findById(shopId).select('zoneId').lean();
            if (r?.zoneId) {
                query.zoneId = String(r.zoneId);
            }
        }
        const data = await listShopCategories(shopId, query);
        return sendResponse(res, 200, 'Categories fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const createCategoryController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const category = await createShopCategory(shopId, req.body || {});
        return sendResponse(res, 201, 'Category created successfully', { category });
    } catch (error) {
        next(error);
    }
};

export const listSubcategoriesController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const data = await listShopSubcategories(shopId, req.query || {});
        return sendResponse(res, 200, 'Subcategories fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

export const updateCategoryController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const category = await updateShopCategory(shopId, req.params.id, req.body || {});
        if (!category) return sendError(res, 404, 'Category not found');
        return sendResponse(res, 200, 'Category updated successfully', { category });
    } catch (error) {
        next(error);
    }
};

export const deleteCategoryController = async (req, res, next) => {
    try {
        const shopId = req.user?.userId;
        const result = await deleteShopCategory(shopId, req.params.id);
        if (!result) return sendError(res, 404, 'Category not found');
        return sendResponse(res, 200, 'Category deleted successfully', result);
    } catch (error) {
        next(error);
    }
};

