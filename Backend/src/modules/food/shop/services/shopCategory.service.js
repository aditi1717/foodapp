import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodCategory } from '../../admin/models/category.model.js';
import { FoodSubcategory } from '../../admin/models/subcategory.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodShop } from '../models/shop.model.js';
import {
    backfillLegacyCategoryWorkflow,
    GLOBAL_CATEGORY_FILTER,
    isCategoryVisibleNow,
    normalizeCategoryFoodTypeScope,
    serializeCategoryForResponse,
    toObjectId
} from '../../shared/categoryWorkflow.js';

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const APPROVED_CATEGORY_FILTER = [
    { approvalStatus: 'approved' },
    { approvalStatus: { $exists: false }, isApproved: { $ne: false } }
];

const getShopContext = async (shopId) => {
    if (!shopId || !mongoose.Types.ObjectId.isValid(String(shopId))) {
        throw new ValidationError('Invalid shop id');
    }

    const shop = await FoodShop.findById(shopId)
        .select('zoneId pureVegShop')
        .lean();
    if (!shop?._id) {
        throw new ValidationError('Shop not found');
    }

    return {
        shopId: toObjectId(shopId),
        zoneId: shop.zoneId ? String(shop.zoneId) : '',
        pureVegShop: shop.pureVegShop === true
    };
};

const applyZoneVisibilityFilter = (filterAndList, zoneIdRaw) => {
    if (zoneIdRaw && mongoose.Types.ObjectId.isValid(zoneIdRaw)) {
        filterAndList.push({
            $or: [
                { zoneId: new mongoose.Types.ObjectId(zoneIdRaw) },
                { zoneId: { $exists: false } },
                { zoneId: null }
            ]
        });
        return;
    }

    filterAndList.push({
        $or: [{ zoneId: { $exists: false } }, { zoneId: null }]
    });
};

export async function listShopCategories(shopId, query = {}) {
    const context = await getShopContext(shopId);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 1000, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const includeInactive = query.includeInactive === 'true' || query.includeInactive === '1';
    const privateOnly = query.privateOnly === 'true' || query.privateOnly === '1';
    const withCounts = query.withCounts === 'true' || query.withCounts === '1';
    const compact = query.compact === 'true' || query.compact === '1';
    const zoneIdRaw = typeof query.zoneId === 'string' ? query.zoneId.trim() : context.zoneId;

    const filter = {};
    if (!includeInactive) filter.isActive = true;

    const visibilityFilter = compact
        ? {
            $or: [
                {
                    $and: [
                        { $or: GLOBAL_CATEGORY_FILTER },
                        { $or: APPROVED_CATEGORY_FILTER }
                    ]
                },
                {
                    shopId: context.shopId,
                    $or: APPROVED_CATEGORY_FILTER
                }
            ]
        }
        : {
            $or: [
                ...(privateOnly ? [] : [{
                    $and: [
                        { $or: GLOBAL_CATEGORY_FILTER },
                        { $or: APPROVED_CATEGORY_FILTER }
                    ]
                }]),
                { shopId: context.shopId },
                ...(privateOnly ? [] : [{ createdByShopId: context.shopId }])
            ]
        };

    filter.$and = [visibilityFilter];
    if (search) {
        const term = escapeRegex(search.slice(0, 80));
        filter.$and.push({ name: { $regex: term, $options: 'i' } });
    }
    applyZoneVisibilityFilter(filter.$and, zoneIdRaw);

    if (compact && context.pureVegShop) {
        filter.$and.push({ foodTypeScope: 'Veg' });
    }

    const queryBuilder = FoodCategory.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
            compact
                ? 'name image type foodTypeScope approvalStatus rejectionReason zoneId shopId createdByShopId isActive sortOrder visibilityStartTime visibilityEndTime requestedAt approvedAt rejectedAt globalizedAt'
                : 'name image type foodTypeScope approvalStatus rejectionReason zoneId shopId createdByShopId isActive sortOrder visibilityStartTime visibilityEndTime requestedAt approvedAt rejectedAt globalizedAt createdAt updatedAt'
        );

    const [list, total] = await Promise.all([
        queryBuilder.lean(),
        FoodCategory.countDocuments(filter)
    ]);

    const statsById = await backfillLegacyCategoryWorkflow(list);
    const shopIds = !compact
        ? Array.from(
            new Set(
                list
                    .flatMap((category) => [category?.shopId, category?.createdByShopId])
                    .map((value) => (value ? String(value) : ''))
                    .filter(Boolean)
            )
        )
        : [];
    const shops = shopIds.length
        ? await FoodShop.find({ _id: { $in: shopIds } })
            .select('shopName ownerName ownerPhone')
            .lean()
        : [];
    const shopMap = new Map(shops.map((shop) => [String(shop._id), shop]));

    const hydratedList = !compact
        ? list.map((category) => ({
            ...category,
            shopId: category?.shopId ? shopMap.get(String(category.shopId)) || category.shopId : category.shopId,
            createdByShopId: category?.createdByShopId ? shopMap.get(String(category.createdByShopId)) || category.createdByShopId : category.createdByShopId
        }))
        : list;

    const categories = hydratedList.map((category) =>
        serializeCategoryForResponse(category, {
            currentShopId: shopId,
            includeCounts: withCounts || !compact,
            statsById
        })
    );

    return { categories, total, page, limit };
}

export async function listPublicCategories(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 1000, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const zoneIdRaw = typeof query.zoneId === 'string' ? query.zoneId.trim() : '';

    const approvedCategoryIds = await FoodItem.distinct('categoryId', {
        approvalStatus: 'approved',
        categoryId: { $ne: null }
    });

    if (!approvedCategoryIds.length) {
        return { categories: [], total: 0, page, limit };
    }

    const filter = {
        _id: { $in: approvedCategoryIds },
        isActive: true,
        $and: [{ $or: GLOBAL_CATEGORY_FILTER }, { $or: APPROVED_CATEGORY_FILTER }]
    };

    if (search) {
        const term = escapeRegex(search.slice(0, 80));
        filter.$and.push({ name: { $regex: term, $options: 'i' } });
    }
    applyZoneVisibilityFilter(filter.$and, zoneIdRaw);

    const list = await FoodCategory.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .select('name image type foodTypeScope zoneId sortOrder visibilityStartTime visibilityEndTime createdAt updatedAt')
        .lean();

    await backfillLegacyCategoryWorkflow(list);
    const visibleList = list.filter((category) => isCategoryVisibleNow(category, { timezone: 'Asia/Kolkata' }));
    const paged = visibleList.slice(skip, skip + limit);
    const categories = paged.map((category) => serializeCategoryForResponse(category));

    return { categories, total: visibleList.length, page, limit };
}

export async function createShopCategory(shopId, body = {}) {
    const context = await getShopContext(shopId);

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ValidationError('Category name is required');
    if (name.length > 200) throw new ValidationError('Category name is too long');

    const image = typeof body.image === 'string' ? body.image.trim() : '';
    if (!image) throw new ValidationError('Category image is required');

    const foodTypeScopeRaw = typeof body.foodTypeScope === 'string' ? body.foodTypeScope.trim() : '';
    if (!foodTypeScopeRaw) {
        throw new ValidationError('Category diet type is required');
    }
    const foodTypeScope = normalizeCategoryFoodTypeScope(foodTypeScopeRaw, '');
    if (!foodTypeScope) {
        throw new ValidationError('Invalid category diet type');
    }
    if (context.pureVegShop && foodTypeScope !== 'Veg') {
        throw new ValidationError('Pure veg shops can only create veg categories');
    }

    const doc = new FoodCategory({
        name,
        image,
        type: typeof body.type === 'string' ? body.type.trim() : '',
        foodTypeScope,
        isActive: body.isActive !== false,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
        shopId: context.shopId,
        createdByShopId: context.shopId,
        approvalStatus: 'pending',
        isApproved: false,
        rejectionReason: '',
        requestedAt: new Date(),
        zoneId: context.zoneId && mongoose.Types.ObjectId.isValid(context.zoneId)
            ? new mongoose.Types.ObjectId(context.zoneId)
            : undefined
    });
    await doc.save();
    return doc.toObject();
}

export async function updateShopCategory(shopId, id, body = {}) {
    const context = await getShopContext(shopId);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Invalid category id');
    }

    const doc = await FoodCategory.findOne({
        _id: id,
        $or: [
            { shopId: context.shopId },
            { createdByShopId: context.shopId }
        ]
    });
    if (!doc) return null;

    const nextFoodTypeScope = body.foodTypeScope !== undefined
        ? normalizeCategoryFoodTypeScope(body.foodTypeScope, '')
        : normalizeCategoryFoodTypeScope(doc.foodTypeScope, 'Both');
    if (body.foodTypeScope !== undefined && !nextFoodTypeScope) {
        throw new ValidationError('Invalid category diet type');
    }
    if (context.pureVegShop && nextFoodTypeScope !== 'Veg') {
        throw new ValidationError('Pure veg shops can only keep veg categories');
    }

    if (body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) throw new ValidationError('Category name is required');
        if (name.length > 200) throw new ValidationError('Category name is too long');
        doc.name = name;
    }
    if (body.image !== undefined) {
        const image = String(body.image || '').trim();
        if (!image) throw new ValidationError('Category image is required');
        doc.image = image;
    }
    if (body.type !== undefined) doc.type = String(body.type || '').trim();
    if (body.isActive !== undefined) doc.isActive = body.isActive !== false;
    if (body.sortOrder !== undefined) doc.sortOrder = Number(body.sortOrder) || 0;
    if (body.foodTypeScope !== undefined) {
        const incompatibleFoods = nextFoodTypeScope === 'Both'
            ? 0
            : await FoodItem.countDocuments({
                categoryId: doc._id,
                foodType: nextFoodTypeScope === 'Veg' ? 'Non-Veg' : 'Veg'
            });
        if (incompatibleFoods > 0) {
            throw new ValidationError(`This category already has ${incompatibleFoods} food item(s) outside the selected diet type`);
        }
        doc.foodTypeScope = nextFoodTypeScope;
    }

    const criticalFields = ['name', 'image', 'type', 'foodTypeScope'];
    const isCriticalUpdate = Object.keys(body).some(key => criticalFields.includes(key));

    doc.createdByShopId = doc.createdByShopId || context.shopId;

    if (isCriticalUpdate) {
        doc.approvalStatus = 'pending';
        doc.isApproved = false;
        doc.rejectionReason = '';
        doc.requestedAt = new Date();
        doc.approvedAt = undefined;
        doc.rejectedAt = undefined;
    }

    await doc.save();
    return doc.toObject();
}

export async function deleteShopCategory(shopId, id) {
    const context = await getShopContext(shopId);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('Invalid category id');
    }

    const category = await FoodCategory.findOne({ _id: id, shopId: context.shopId }).select('_id').lean();
    if (!category?._id) return null;

    const inUse = await FoodItem.countDocuments({ categoryId: id, shopId: context.shopId });
    if (inUse > 0) {
        throw new ValidationError('Cannot delete category while it has items');
    }

    const deleted = await FoodCategory.findOneAndDelete({ _id: id, shopId: context.shopId }).lean();
    return deleted ? { id } : null;
}

export async function listShopSubcategories(shopId, query = {}) {
    const context = await getShopContext(shopId);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 1000, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const categoryId = typeof query.categoryId === 'string' ? query.categoryId.trim() : '';

    const categoryFilter = {};
    if (categoryId) {
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            throw new ValidationError('Invalid category id');
        }
        categoryFilter._id = new mongoose.Types.ObjectId(categoryId);
    }

    categoryFilter.isActive = true;
    categoryFilter.$and = [
        {
            $or: [
                {
                    $and: [
                        { $or: GLOBAL_CATEGORY_FILTER },
                        { $or: APPROVED_CATEGORY_FILTER }
                    ]
                },
                { shopId: context.shopId },
                { createdByShopId: context.shopId }
            ]
        }
    ];
    applyZoneVisibilityFilter(categoryFilter.$and, context.zoneId);

    if (context.pureVegShop) {
        categoryFilter.$and.push({ foodTypeScope: 'Veg' });
    }

    const visibleCategoryIds = await FoodCategory.find(categoryFilter).distinct('_id');
    if (!visibleCategoryIds.length) {
        return { subcategories: [], total: 0, page, limit };
    }

    const filter = {
        isActive: true,
        categoryId: { $in: visibleCategoryIds },
        $or: APPROVED_CATEGORY_FILTER,
    };

    if (search) {
        const term = escapeRegex(search.slice(0, 80));
        filter.name = { $regex: term, $options: 'i' };
    }

    const [list, total] = await Promise.all([
        FoodSubcategory.find(filter)
            .sort({ sortOrder: 1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('categoryId', 'name foodTypeScope')
            .lean(),
        FoodSubcategory.countDocuments(filter),
    ]);

    const subcategories = list.map((subcategory) => ({
        ...subcategory,
        id: subcategory._id,
        categoryId: subcategory?.categoryId?._id || subcategory?.categoryId,
        categoryName: subcategory?.categoryId?.name || '',
        foodTypeScope: subcategory?.foodTypeScope || subcategory?.categoryId?.foodTypeScope || 'Both',
        status: subcategory?.isActive !== false,
    }));

    return { subcategories, total, page, limit };
}
