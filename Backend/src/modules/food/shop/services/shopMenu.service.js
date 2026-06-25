import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodShop } from '../models/shop.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodCategory } from '../../admin/models/category.model.js';
import { getFoodDisplayPrice, serializeFoodVariants } from '../../admin/services/foodVariant.service.js';
import { isCategoryVisibleNow } from '../../shared/categoryWorkflow.js';

const buildMenuFromFoods = async (foods = [], options = {}) => {
    const categoryIds = Array.from(
        new Set(
            (foods || [])
                .map((food) => {
                    const raw = food?.categoryId;
                    if (!raw) return '';
                    return String(raw);
                })
                .filter((value) => mongoose.Types.ObjectId.isValid(value))
        )
    );

    const categoryDocs = categoryIds.length
        ? await FoodCategory.find({ _id: { $in: categoryIds } })
            .select('name image sortOrder foodTypeScope visibilityStartTime visibilityEndTime')
            .lean()
        : [];
    const categoryMap = new Map(categoryDocs.map((doc) => [String(doc._id), doc]));
    const visibleCategoryIdSet = new Set(
        categoryDocs
            .filter((doc) => options.ignoreVisibility || isCategoryVisibleNow(doc, { timezone: 'Asia/Kolkata' }))
            .map((doc) => String(doc._id))
    );

    const byCategory = new Map();
    for (const food of foods) {
        const categoryId = food?.categoryId ? String(food.categoryId) : '';
        if (categoryId && !visibleCategoryIdSet.has(categoryId)) {
            continue;
        }
        const categoryDoc = categoryMap.get(categoryId) || null;
        const sectionName = (categoryDoc?.name || food?.categoryName || food?.category || 'Menu').trim() || 'Menu';
        const groupKey = categoryId || `name:${sectionName.toLowerCase()}`;

        if (!byCategory.has(groupKey)) {
            byCategory.set(groupKey, {
                id: categoryId || null,
                name: sectionName,
                image: categoryDoc?.image || '',
                foodTypeScope: categoryDoc?.foodTypeScope || 'Both',
                sortOrder: Number.isFinite(Number(categoryDoc?.sortOrder)) ? Number(categoryDoc.sortOrder) : Number.MAX_SAFE_INTEGER,
                items: [],
                subsectionsMap: new Map()
            });
        }

        const normalizedItem = {
            id: String(food._id),
            _id: food._id,
            categoryId: categoryId || null,
            categoryName: sectionName,
            category: sectionName,
            subcategoryId: food?.subcategoryId ? String(food.subcategoryId) : null,
            subcategoryName: (food?.subcategoryName || '').trim(),
            name: food.name,
            description: food.description || '',
            price: getFoodDisplayPrice(food),
            variants: serializeFoodVariants(food.variants),
            variations: serializeFoodVariants(food.variants),
            bulkOrderPricing: {
                enabled: food?.bulkOrderPricing?.enabled === true,
                minQuantity: Number.isFinite(Number(food?.bulkOrderPricing?.minQuantity))
                    ? Number(food.bulkOrderPricing.minQuantity)
                    : null,
                bulkPrice: Number.isFinite(Number(food?.bulkOrderPricing?.bulkPrice))
                    ? Number(food.bulkOrderPricing.bulkPrice)
                    : null
            },
            image: food.image || '',
            foodType: food.foodType || 'Non-Veg',
            isAvailable: food.isAvailable !== false,
            approvalStatus: food.approvalStatus || 'approved',
            rejectionReason: food.rejectionReason || '',
            requestedAt: food.requestedAt,
            approvedAt: food.approvedAt,
            rejectedAt: food.rejectedAt,
            preparationTime: food.preparationTime || '',
            createdAt: food.createdAt,
            updatedAt: food.updatedAt
        };

        const group = byCategory.get(groupKey);
        const subcategoryName = String(normalizedItem.subcategoryName || '').trim();
        const subcategoryId = normalizedItem.subcategoryId ? String(normalizedItem.subcategoryId) : '';
        const hasSubcategory = Boolean(subcategoryName || subcategoryId);

        if (hasSubcategory) {
            const subsectionKey = subcategoryId || `name:${subcategoryName.toLowerCase()}`;
            if (!group.subsectionsMap.has(subsectionKey)) {
                group.subsectionsMap.set(subsectionKey, {
                    id: subcategoryId || null,
                    subcategoryId: subcategoryId || null,
                    name: subcategoryName || 'Subcategory',
                    items: []
                });
            }
            group.subsectionsMap.get(subsectionKey).items.push(normalizedItem);
        } else {
            group.items.push(normalizedItem);
        }
    }

    const orderedGroups = Array.from(byCategory.values()).sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });

    const sections = orderedGroups.map((group, idx) => {
        const subsectionItemsCount = Array.from(group.subsectionsMap.values()).reduce(
            (sum, subsection) => sum + (Array.isArray(subsection.items) ? subsection.items.length : 0),
            0
        );
        const totalItems = group.items.length + subsectionItemsCount;

        return ({
        id: group.id || `section-${idx}`,
        categoryId: group.id || null,
        name: group.name,
        image: group.image || '',
        foodTypeScope: group.foodTypeScope || 'Both',
        sortOrder: Number.isFinite(Number(group.sortOrder)) ? Number(group.sortOrder) : 0,
        itemCount: totalItems,
        items: group.items.sort((a, b) => {
            const at = new Date(a.createdAt || a.requestedAt || 0).getTime();
            const bt = new Date(b.createdAt || b.requestedAt || 0).getTime();
            return bt - at;
        }),
        subsections: Array.from(group.subsectionsMap.values())
            .map((subsection, subIndex) => ({
                id: subsection.id || `subsection-${idx}-${subIndex}`,
                subcategoryId: subsection.subcategoryId || null,
                name: subsection.name,
                itemCount: subsection.items.length,
                items: subsection.items.sort((a, b) => {
                    const at = new Date(a.createdAt || a.requestedAt || 0).getTime();
                    const bt = new Date(b.createdAt || b.requestedAt || 0).getTime();
                    return bt - at;
                })
            }))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    })});

    const categories = sections.map((section) => ({
        id: section.categoryId || section.id,
        categoryId: section.categoryId || null,
        name: section.name,
        image: section.image || '',
        foodTypeScope: section.foodTypeScope || 'Both',
        sortOrder: section.sortOrder || 0,
        itemCount: section.itemCount || 0
    }));

    return { sections, categories };
};

export async function getShopMenu(shopId) {
    if (!shopId || !mongoose.Types.ObjectId.isValid(String(shopId))) {
        throw new ValidationError('Invalid shop id');
    }
    const foods = await FoodItem.find({ shopId })
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean();
    return buildMenuFromFoods(foods, { ignoreVisibility: true });
}

export async function updateShopMenu(shopId, body = {}) {
    // Option A: single source of truth (food_items). Menu layout snapshots are disabled.
    // Keep endpoint for backward compatibility, but make it explicit.
    throw new ValidationError('Menu editing is disabled. Menu is generated from food items.');
}

export async function getPublicApprovedShopMenu(shopIdOrSlug) {
    const value = String(shopIdOrSlug || '').trim();
    if (!value) throw new ValidationError('Shop id is required');

    let shop = null;
    if (/^[0-9a-fA-F]{24}$/.test(value)) {
        shop = await FoodShop.findOne({ _id: value, status: 'approved' })
            .select('_id status')
            .lean();
    } else {
        const normalized = value.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
        shop = await FoodShop.findOne({ shopNameNormalized: normalized, status: 'approved' })
            .select('_id status')
            .lean();
    }

    if (!shop?._id) {
        return null;
    }
    const foods = await FoodItem.find({ shopId: shop._id, approvalStatus: 'approved' })
        .sort({ createdAt: -1 })
        .limit(2000)
        .lean();
    return buildMenuFromFoods(foods);
}

export async function syncMenuItemApprovalStatus(shopId, itemId, status, rejectionReason = '') {
    // No-op in Option A (menu snapshots removed). Approval status lives only in food_items.
    // Kept to avoid breaking admin approval flows that call this helper.
    return;
}
