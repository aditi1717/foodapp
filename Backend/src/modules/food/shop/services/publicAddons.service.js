import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodShop } from '../models/shop.model.js';
import { FoodAddon } from '../models/foodAddon.model.js';

export async function getPublicApprovedShopAddons(shopIdOrSlug) {
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

    const addons = await FoodAddon.find({
        shopId: new mongoose.Types.ObjectId(String(shop._id)),
        isDeleted: { $ne: true },
        approvalStatus: 'approved',
        isAvailable: true,
        published: { $ne: null }
    })
        .sort({ approvedAt: -1, updatedAt: -1 })
        .select('_id published')
        .lean();

    return (addons || [])
        .filter((a) => a && a.published)
        .map((a) => {
            const p = a.published;
            return {
                id: a._id,
                _id: a._id,
                name: p.name || '',
                description: p.description || '',
                price: Number(p.price) || 0,
                image: p.image || '',
                images: Array.isArray(p.images) ? p.images : []
            };
        });
}

