import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodItem } from '../models/food.model.js';
import { FoodAddon } from '../../shop/models/foodAddon.model.js';
import { FoodShop } from '../../shop/models/shop.model.js';
import { syncMenuItemApprovalStatus } from '../../shop/services/shopMenu.service.js';
import { getFoodDisplayPrice, serializeFoodVariants } from './foodVariant.service.js';
import { invalidateCache } from '../../../../middleware/cache.js';

const toShopDisplayId = (mongoId) => {
    const s = String(mongoId || '');
    return s.length >= 5 ? s.slice(-5) : s;
};

export async function listPendingFoodApprovals(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 200, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { approvalStatus: 'pending' };
    if (query.shopId && mongoose.Types.ObjectId.isValid(String(query.shopId))) {
        filter.shopId = query.shopId;
    }
    if (query.search && String(query.search).trim()) {
        const term = String(query.search).trim().slice(0, 80);
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
            { categoryName: { $regex: term, $options: 'i' } }
        ];
    }

    const foodList = await FoodItem.find(filter)
        .sort({ requestedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('shopId categoryName name description price variants bulkOrderPricing image foodType approvalStatus requestedAt createdAt')
        .lean();

    const addonList = await FoodAddon.find({ approvalStatus: 'pending' })
        .sort({ requestedAt: -1, createdAt: -1 })
        .limit(limit)
        .select('shopId draft isAvailable requestedAt createdAt')
        .lean();

    const shopIds = Array.from(new Set([
        ...foodList.map((f) => String(f.shopId)),
        ...addonList.map((a) => String(a.shopId))
    ].filter(Boolean)));

    const shops = shopIds.length
        ? await FoodShop.find({ _id: { $in: shopIds } }).select('shopName').lean()
        : [];
    const shopMap = new Map(shops.map((r) => [String(r._id), r.shopName]));

    const foodRequests = foodList.map((f) => ({
        _id: f._id,
        id: f._id,
        entityType: 'food',
        type: 'food',
        shopName: shopMap.get(String(f.shopId)) || 'Unknown Shop',
        shopId: toShopDisplayId(f.shopId),
        category: f.categoryName || '',
        itemName: f.name,
        foodType: f.foodType || 'Non-Veg',
        sectionName: f.categoryName || '',
        subsectionName: '',
        approvalStatus: f.approvalStatus || 'pending',
        price: getFoodDisplayPrice(f),
        variants: serializeFoodVariants(f.variants),
        bulkOrderPricing: {
            enabled: f?.bulkOrderPricing?.enabled === true,
            minQuantity: Number.isFinite(Number(f?.bulkOrderPricing?.minQuantity))
                ? Number(f.bulkOrderPricing.minQuantity)
                : null,
            bulkPrice: Number.isFinite(Number(f?.bulkOrderPricing?.bulkPrice))
                ? Number(f.bulkOrderPricing.bulkPrice)
                : null
        },
        image: f.image || '',
        images: f.image ? [f.image] : [],
        description: f.description || '',
        requestedAt: f.requestedAt || f.createdAt,
        isActionable: (f.approvalStatus || 'pending') === 'pending'
    }));

    const addonRequests = addonList.map((a) => ({
        _id: a._id,
        id: a._id,
        entityType: 'addon',
        type: 'addon',
        shopName: shopMap.get(String(a.shopId)) || 'Unknown Shop',
        shopId: toShopDisplayId(a.shopId),
        category: 'Add-on',
        itemName: a.draft?.name || 'Unnamed Add-on',
        foodType: 'Add-on',
        sectionName: 'Add-on',
        subsectionName: '',
        approvalStatus: 'pending',
        price: a.draft?.price ?? 0,
        image: a.draft?.image || (a.draft?.images && a.draft.images[0]) || '',
        images: a.draft?.images || (a.draft?.image ? [a.draft.image] : []),
        requestedAt: a.requestedAt || a.createdAt,
        isActionable: true,
        description: a.draft?.description || ''
    }));

    const allRequests = [...foodRequests, ...addonRequests].sort((a, b) => 
        new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );

    return { requests: allRequests, page, limit, total: allRequests.length };
}

export async function approveFoodItem(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw new ValidationError('Invalid food id');
    }
    const updated = await FoodItem.findOneAndUpdate(
        { _id: id, approvalStatus: 'pending' },
        { $set: { approvalStatus: 'approved', approvedAt: new Date(), rejectedAt: null, rejectionReason: '' } },
        { new: true }
    ).lean();
    if (updated?.shopId) {
        // Single DB update; makes user-facing menu reflect approval immediately.
        await syncMenuItemApprovalStatus(updated.shopId, updated._id, 'approved', '');
        await invalidateCache('shops:*');
        await invalidateCache('shop_menu:*');
        
        try {
            const { notifyOwnersSafely } = await import('../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'SHOP', ownerId: updated.shopId }],
                {
                    title: 'Dish Approved! 🍲',
                    body: `Your dish "${updated.name}" has been approved and is now visible to customers.`,
                    image: updated.image || 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                    data: {
                        type: 'food_approved',
                        foodId: String(updated._id),
                        shopId: String(updated.shopId)
                    }
                }
            );
        } catch (e) {
            console.error('Failed to send food approval notification:', e);
        }
    }
    return updated;
}

export async function rejectFoodItem(id, reason) {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw new ValidationError('Invalid food id');
    }
    const r = typeof reason === 'string' ? reason.trim() : '';
    if (!r) throw new ValidationError('Rejection reason is required');
    if (r.length > 500) throw new ValidationError('Rejection reason is too long');

    const updated = await FoodItem.findOneAndUpdate(
        { _id: id, approvalStatus: 'pending' },
        { $set: { approvalStatus: 'rejected', rejectedAt: new Date(), rejectionReason: r, approvedAt: null } },
        { new: true }
    ).lean();
    if (updated?.shopId) {
        await syncMenuItemApprovalStatus(updated.shopId, updated._id, 'rejected', r);
        await invalidateCache('shops:*');
        await invalidateCache('shop_menu:*');
        
        try {
            const { notifyOwnersSafely } = await import('../../../core/notifications/firebase.service.js');
            await notifyOwnersSafely(
                [{ ownerType: 'SHOP', ownerId: updated.shopId }],
                {
                    title: 'Dish Rejected ❌',
                    body: `Your dish "${updated.name}" was rejected. Reason: ${r}`,
                    image: updated.image || 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
                    data: {
                        type: 'food_rejected',
                        foodId: String(updated._id),
                        shopId: String(updated.shopId),
                        reason: r
                    }
                }
            );
        } catch (e) {
            console.error('Failed to send food rejection notification:', e);
        }
    }
    return updated;
}

