import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';

const toTrimmedString = (value) => (value == null ? '' : String(value).trim());

const normalizeVariantBulkOrderPricing = (entry = {}) => {
    const raw = entry?.bulkOrderPricing;
    if (raw === undefined) return undefined;

    const enabled = raw?.enabled === true;
    if (!enabled) {
        return {
            enabled: false,
            minQuantity: null,
            bulkPrice: null
        };
    }

    const minQuantity = Number(raw?.minQuantity);
    if (!Number.isInteger(minQuantity) || minQuantity < 1) {
        throw new ValidationError('Variant bulk minimum quantity must be at least 1');
    }

    const bulkPrice = Number(raw?.bulkPrice);
    if (!Number.isFinite(bulkPrice) || bulkPrice < 0) {
        throw new ValidationError('Variant bulk price must be 0 or greater');
    }

    return {
        enabled: true,
        minQuantity,
        bulkPrice
    };
};

export const extractRawFoodVariants = (value = {}) => {
    if (Array.isArray(value?.variants)) return value.variants;
    if (Array.isArray(value?.variations)) return value.variations;
    return [];
};

export const normalizeFoodVariantsInput = (value = [], options = {}) => {
    const {
        allowEmpty = true,
        priceLabel = 'Variant price'
    } = options;

    if (value == null || value === '') {
        if (allowEmpty) return [];
        throw new ValidationError('At least one variant is required');
    }

    if (!Array.isArray(value)) {
        throw new ValidationError('Variants must be an array');
    }

    const normalized = value
        .map((entry = {}) => {
            const name = toTrimmedString(entry?.name);
            if (!name) {
                throw new ValidationError('Each variant must have a name');
            }

            const price = Number(entry?.price);
            if (!Number.isFinite(price) || price <= 0) {
                throw new ValidationError(`${priceLabel} must be greater than 0`);
            }

            const variant = {
                name,
                price
            };

            const bulkOrderPricing = normalizeVariantBulkOrderPricing(entry);
            if (bulkOrderPricing !== undefined) {
                variant.bulkOrderPricing = bulkOrderPricing;
            }

            const variantId = entry?._id || entry?.id;
            if (variantId && mongoose.Types.ObjectId.isValid(String(variantId))) {
                variant._id = new mongoose.Types.ObjectId(String(variantId));
            }

            return variant;
        })
        .filter(Boolean);

    if (!allowEmpty && normalized.length === 0) {
        throw new ValidationError('At least one variant is required');
    }

    return normalized;
};

export const serializeFoodVariants = (value = []) =>
    (Array.isArray(value) ? value : [])
        .map((entry = {}) => {
            const name = toTrimmedString(entry?.name);
            const price = Number(entry?.price);
            if (!name || !Number.isFinite(price) || price <= 0) return null;

            const variantId = entry?._id || entry?.id;
            return {
                id: variantId ? String(variantId) : '',
                _id: variantId ? String(variantId) : '',
                name,
                price,
                bulkOrderPricing: {
                    enabled: entry?.bulkOrderPricing?.enabled === true,
                    minQuantity: Number.isFinite(Number(entry?.bulkOrderPricing?.minQuantity))
                        ? Number(entry.bulkOrderPricing.minQuantity)
                        : null,
                    bulkPrice: Number.isFinite(Number(entry?.bulkOrderPricing?.bulkPrice))
                        ? Number(entry.bulkOrderPricing.bulkPrice)
                        : null
                }
            };
        })
        .filter(Boolean);

export const hasFoodVariants = (value = {}) => serializeFoodVariants(value?.variants || value?.variations || []).length > 0;

export const getFoodDisplayPrice = (value = {}) => {
    const variants = serializeFoodVariants(value?.variants || value?.variations || []);
    if (variants.length > 0) {
        return Math.min(...variants.map((entry) => Number(entry.price) || 0));
    }

    const price = Number(value?.price);
    return Number.isFinite(price) ? price : 0;
};
