import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodCategory } from '../../admin/models/category.model.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import {
    extractRawFoodVariants,
    getFoodDisplayPrice,
    hasFoodVariants,
    normalizeFoodVariantsInput
} from '../../admin/services/foodVariant.service.js';
import {
    backfillLegacyCategoryWorkflow,
    categoryAllowsFoodType,
    GLOBAL_CATEGORY_FILTER
} from '../../shared/categoryWorkflow.js';

const toStr = (v) => (v != null ? String(v).trim() : '');
const APPROVED_CATEGORY_FILTER = [
    { approvalStatus: 'approved' },
    { approvalStatus: { $exists: false }, isApproved: { $ne: false } }
];

const normalizeFoodType = (v) => {
    const t = String(v || '').trim();
    if (!t) return 'Non-Veg';
    if (t === 'Veg') return 'Veg';
    if (t === 'Non-Veg') return 'Non-Veg';
    if (t === 'Egg') return 'Non-Veg';
    return 'Non-Veg';
};

const getCreateFoodPricing = (body = {}) => {
    const variants = normalizeFoodVariantsInput(extractRawFoodVariants(body));
    if (variants.length > 0) {
        return {
            price: getFoodDisplayPrice({ variants }),
            variants
        };
    }

    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) throw new ValidationError('Price is invalid');
    return {
        price,
        variants: []
    };
};

const getUpdatedFoodPricing = (existing = {}, body = {}) => {
    const variantsTouched = body.variants !== undefined || body.variations !== undefined;
    const existingHasVariants = hasFoodVariants(existing);
    const update = {};

    if (variantsTouched) {
        const variants = normalizeFoodVariantsInput(extractRawFoodVariants(body));
        
        // Deep comparison for variants (using JSON stringify for simplicity here)
        const variantsChanged = JSON.stringify(variants) !== JSON.stringify(existing.variants || []);
        
        if (variantsChanged) {
            update.variants = variants;
            if (variants.length > 0) {
                update.price = getFoodDisplayPrice({ variants });
                return update;
            }
            
            const nextBasePrice = body.price !== undefined ? Number(body.price) : Number(existing.price);
            if (!Number.isFinite(nextBasePrice) || nextBasePrice < 0) {
                throw new ValidationError('Base price is required when variants are removed');
            }
            update.price = nextBasePrice;
            return update;
        }
    }

    if (body.price !== undefined) {
        if (existingHasVariants && !variantsTouched) {
            // If it has variants and we aren't updating them, we shouldn't update base price directly
            return update;
        }
        const price = Number(body.price);
        if (!Number.isFinite(price) || price < 0) throw new ValidationError('Price is invalid');
        
        if (price !== existing.price) {
            update.price = price;
        }
    }

    return update;
};

const getRestaurantContext = async (restaurantId) => {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }

    const restaurant = await FoodRestaurant.findById(restaurantId)
        .select('pureVegRestaurant')
        .lean();
    if (!restaurant?._id) {
        throw new ValidationError('Restaurant not found');
    }

    return {
        restaurantId: new mongoose.Types.ObjectId(String(restaurantId)),
        pureVegRestaurant: restaurant.pureVegRestaurant === true
    };
};

const getAccessibleCategoryFilter = (context) => ({
    $or: [
        { restaurantId: context.restaurantId, $or: APPROVED_CATEGORY_FILTER },
        {
            $and: [
                { $or: GLOBAL_CATEGORY_FILTER },
                { $or: APPROVED_CATEGORY_FILTER }
            ]
        }
    ]
});

const resolveCategoryForRestaurant = async (context, body = {}) => {
    const categoryIdRaw = toStr(body.categoryId);
    const categoryNameRaw = toStr(body.categoryName);
    const subCategoryIdRaw = toStr(body.subCategoryId);
    const subCategoryNameRaw = toStr(body.subCategoryName);
    const foodType = normalizeFoodType(body.foodType);

    if (!categoryIdRaw && !categoryNameRaw) {
        return { categoryObjectId: undefined, categoryName: '', subCategoryObjectId: undefined, subCategoryName: '' };
    }

    const baseFilter = {
        ...getAccessibleCategoryFilter(context),
        isActive: { $ne: false }
    };
    if (context.pureVegRestaurant) {
        baseFilter.foodTypeScope = 'Veg';
    }

    let category = null;
    if (categoryIdRaw) {
        if (!mongoose.Types.ObjectId.isValid(categoryIdRaw)) {
            throw new ValidationError('Invalid category id');
        }

        category = await FoodCategory.findOne({
            _id: new mongoose.Types.ObjectId(categoryIdRaw),
            ...baseFilter
        }).lean();
    } else {
        const exact = `^${String(categoryNameRaw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
        const matches = await FoodCategory.find({
            ...baseFilter,
            name: { $regex: exact, $options: 'i' }
        })
            .sort({ createdAt: -1 })
            .limit(2)
            .lean();
        if (matches.length > 1) {
            throw new ValidationError('Multiple categories share this name. Please choose a specific category.');
        }
        category = matches[0] || null;
    }

    if (!category?._id) {
        throw new ValidationError('Category not found for this restaurant');
    }

    await backfillLegacyCategoryWorkflow([category]);

    if (String(category.approvalStatus || '') !== 'approved') {
        throw new ValidationError('This category is awaiting admin approval');
    }
    if (context.pureVegRestaurant && String(category.foodTypeScope || '') !== 'Veg') {
        throw new ValidationError('Pure veg restaurants can only use veg categories');
    }
    if (!categoryAllowsFoodType(category.foodTypeScope, foodType)) {
        throw new ValidationError(`This ${category.foodTypeScope} category cannot accept ${foodType} food`);
    }

    let subCategory = null;
    if (subCategoryIdRaw) {
        if (!mongoose.Types.ObjectId.isValid(subCategoryIdRaw)) {
            throw new ValidationError('Invalid subcategory id');
        }
        subCategory = await FoodCategory.findOne({
            _id: new mongoose.Types.ObjectId(subCategoryIdRaw),
            ...baseFilter
        }).lean();
    }

    if (!subCategory?._id) {
        const hasSubCategories = await FoodCategory.exists({
            $or: [
                { parentCategoryId: category._id },
                { parentId: category._id },
                { subCategoryOf: category._id }
            ]
        });
        if (hasSubCategories) {
            throw new ValidationError('Subcategory is mandatory for this category');
        }
    }

    return {
        categoryObjectId: category._id,
        categoryName: category.name || '',
        subCategoryObjectId: subCategory?._id,
        subCategoryName: subCategory?.name || '',
        category
    };
};

export async function createRestaurantFood(restaurantId, body = {}) {
    const context = await getRestaurantContext(restaurantId);

    const name = toStr(body.name);
    if (!name) throw new ValidationError('Item name is required');
    if (name.length > 200) throw new ValidationError('Item name is too long');

    const { price, variants } = getCreateFoodPricing(body);

    const description = toStr(body.description);
    const image = toStr(body.image);
    const isAvailable = body.isAvailable !== false;
    const foodType = normalizeFoodType(body.foodType);
    const preparationTime = toStr(body.preparationTime);
    const { categoryObjectId, categoryName, subCategoryObjectId, subCategoryName } = await resolveCategoryForRestaurant(context, { ...body, foodType });

    const doc = await FoodItem.create({
        restaurantId,
        categoryId: categoryObjectId,
        categoryName: categoryName || '',
        subCategoryId: subCategoryObjectId,
        subCategoryName: subCategoryName || '',
        name,
        description,
        price,
        variants,
        image,
        foodType,
        isAvailable,
        preparationTime,
        approvalStatus: 'pending',
        requestedAt: new Date()
    });

    try {
        const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
        void notifyAdminsSafely({
            title: 'New Product Approval Request ðŸ”',
            body: `Restaurant has submitted a new item "${doc.name}" for approval.`,
            data: {
                type: 'approval_request',
                subType: 'food',
                id: String(doc._id)
            }
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to notify admins of new food approval request:', e);
    }

    return doc.toObject();
}

export async function updateRestaurantFood(restaurantId, foodId, body = {}) {
    const context = await getRestaurantContext(restaurantId);
    if (!foodId || !mongoose.Types.ObjectId.isValid(String(foodId))) {
        throw new ValidationError('Invalid food id');
    }

    const existing = await FoodItem.findOne({ _id: foodId, restaurantId }).lean();
    if (!existing) return null;

    const update = {};

    if (body.name !== undefined) {
        const name = toStr(body.name);
        if (!name) throw new ValidationError('Item name is required');
        if (name.length > 200) throw new ValidationError('Item name is too long');
        if (name !== existing.name) update.name = name;
    }
    if (body.description !== undefined) {
        const description = toStr(body.description);
        if (description !== toStr(existing.description)) update.description = description;
    }
    if (body.image !== undefined) {
        const image = toStr(body.image);
        if (image !== toStr(existing.image)) update.image = image;
    }

    const pricingUpdate = getUpdatedFoodPricing(existing, body);
    Object.keys(pricingUpdate).forEach(key => {
        update[key] = pricingUpdate[key];
    });

    if (body.isAvailable !== undefined) {
        if (body.isAvailable !== existing.isAvailable) update.isAvailable = body.isAvailable !== false;
    }
    if (body.preparationTime !== undefined) {
        const prepTime = toStr(body.preparationTime);
        if (prepTime !== toStr(existing.preparationTime)) update.preparationTime = prepTime;
    }

    const targetFoodType = body.foodType !== undefined ? normalizeFoodType(body.foodType) : normalizeFoodType(existing.foodType);
    if (body.foodType !== undefined && targetFoodType !== existing.foodType) {
        update.foodType = targetFoodType;
    }

    if (
        body.categoryId !== undefined ||
        body.categoryName !== undefined ||
        body.subCategoryId !== undefined ||
        body.subCategoryName !== undefined ||
        body.foodType !== undefined
    ) {
        const { categoryObjectId, categoryName, subCategoryObjectId, subCategoryName } = await resolveCategoryForRestaurant(context, {
            categoryId: body.categoryId !== undefined ? body.categoryId : existing.categoryId,
            categoryName: body.categoryName !== undefined ? body.categoryName : existing.categoryName,
            subCategoryId: body.subCategoryId !== undefined ? body.subCategoryId : existing.subCategoryId,
            subCategoryName: body.subCategoryName !== undefined ? body.subCategoryName : existing.subCategoryName,
            foodType: targetFoodType
        });
        
        if (
            String(categoryObjectId || '') !== String(existing.categoryId || '') ||
            String(subCategoryObjectId || '') !== String(existing.subCategoryId || '')
        ) {
            update.categoryId = categoryObjectId;
            update.categoryName = categoryName || '';
            update.subCategoryId = subCategoryObjectId;
            update.subCategoryName = subCategoryName || '';
        }
    }

    const SENSITIVE_FIELDS = ['name', 'description', 'image', 'price', 'variants', 'foodType', 'categoryId', 'categoryName', 'subCategoryId', 'subCategoryName'];
    const hasSensitiveChanges = Object.keys(update).some(key => SENSITIVE_FIELDS.includes(key));
    const shouldResubmitForApproval = hasSensitiveChanges;

    if (shouldResubmitForApproval) {
        update.approvalStatus = 'pending';
        update.requestedAt = new Date();
        update.rejectionReason = '';
        update.approvedAt = null;
        update.rejectedAt = null;
    }

    const updated = await FoodItem.findOneAndUpdate(
        { _id: foodId, restaurantId },
        { $set: update },
        { new: true }
    ).lean();

    if (updated && shouldResubmitForApproval) {
        try {
            const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
            void notifyAdminsSafely({
                title: 'Updated Product Approval Request',
                body: `Restaurant has updated and resubmitted "${updated.name}" for approval.`,
                data: {
                    type: 'approval_request',
                    subType: 'food',
                    id: String(updated._id)
                }
            });
        } catch (e) {
            console.error('Failed to notify admins of resubmitted food approval request:', e);
        }
    }

    return updated;
}
