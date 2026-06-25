import { FoodShop } from '../models/shop.model.js';
import { FoodNotification } from '../../../../core/notifications/models/notification.model.js';
import { notifyOwnerSafely, notifyAdminsSafely } from '../../../../core/notifications/firebase.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const toDateLabel = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const nextDay = (date) => new Date(date.getTime() + DAY_MS);

const buildShopNotificationPayload = (shop) => {
    const expiryDate = shop?.fssaiExpiry ? new Date(shop.fssaiExpiry) : null;
    const shopName = shop?.shopName || 'Shop';
    const ownerName = shop?.ownerName || 'Shop owner';
    const expiryLabel = toDateLabel(expiryDate);
    const title = 'FSSAI License Expired';
    const message = `${shopName} FSSAI license expired on ${expiryLabel}. Owner: ${ownerName}. FSSAI No: ${shop?.fssaiNumber || 'N/A'}.`;

    return {
        title,
        message,
        link: '/shop/fssai',
        category: 'compliance',
        source: 'FSSAI_EXPIRY',
        metadata: {
            shopId: String(shop?._id || ''),
            shopName,
            ownerName,
            ownerPhone: shop?.ownerPhone || '',
            fssaiNumber: shop?.fssaiNumber || '',
            expiryDate: expiryDate ? expiryDate.toISOString() : null
        }
    };
};

const buildAdminSummary = (shop) => {
    const expiryDate = shop?.fssaiExpiry ? new Date(shop.fssaiExpiry) : null;
    const expiryLabel = toDateLabel(expiryDate);
    return {
        id: `fssai-expired-${String(shop?._id || '')}`,
        shopId: String(shop?._id || ''),
        shopName: shop?.shopName || 'Shop',
        ownerName: shop?.ownerName || '',
        ownerPhone: shop?.ownerPhone || '',
        fssaiNumber: shop?.fssaiNumber || '',
        fssaiExpiry: expiryDate ? expiryDate.toISOString() : null,
        expiryLabel,
        title: 'FSSAI License Expired',
        message: `${shop?.shopName || 'Shop'} FSSAI expired on ${expiryLabel}. Owner: ${shop?.ownerName || 'N/A'}.`,
        createdAt: expiryDate ? expiryDate.toISOString() : shop?.updatedAt || shop?.createdAt || new Date().toISOString(),
        path: '/admin/food/shops'
    };
};

export const listExpiredFssaiShops = async () => {
    const today = startOfToday();

    const shops = await FoodShop.find({
        status: 'approved',
        fssaiExpiry: { $lt: nextDay(today) }
    })
        .select('shopName ownerName ownerPhone fssaiNumber fssaiExpiry')
        .sort({ fssaiExpiry: -1, updatedAt: -1 })
        .lean();

    return shops
        .filter((shop) => shop?.fssaiExpiry)
        .map(buildAdminSummary);
};

export const syncExpiredFssaiNotifications = async () => {
    const shops = await listExpiredFssaiShops();
    let createdCount = 0;

    for (const summary of shops) {
        const expiryIso = summary.fssaiExpiry;
        const shopId = summary.shopId;
        if (!shopId || !expiryIso) continue;

        const payload = buildShopNotificationPayload({
            _id: shopId,
            shopName: summary.shopName,
            ownerName: summary.ownerName,
            ownerPhone: summary.ownerPhone,
            fssaiNumber: summary.fssaiNumber,
            fssaiExpiry: expiryIso
        });

        const existing = await FoodNotification.findOne({
            ownerType: 'SHOP',
            ownerId: shopId,
            source: 'FSSAI_EXPIRY',
            'metadata.expiryDate': expiryIso
        })
            .select('_id')
            .lean();

        if (existing) continue;

        await FoodNotification.create({
            ownerType: 'SHOP',
            ownerId: shopId,
            title: payload.title,
            message: payload.message,
            link: payload.link,
            category: payload.category,
            source: payload.source,
            metadata: payload.metadata
        });

        await notifyOwnerSafely(
            { ownerType: 'SHOP', ownerId: shopId },
            {
                title: payload.title,
                body: payload.message,
                data: {
                    type: 'fssai_expired',
                    shopId,
                    expiryDate: expiryIso,
                    fssaiNumber: summary.fssaiNumber || ''
                }
            }
        );

        await notifyAdminsSafely({
            title: 'Shop FSSAI Expired',
            body: `${summary.shopName} FSSAI expired on ${summary.expiryLabel}. Owner: ${summary.ownerName || 'N/A'}.`,
            data: {
                type: 'shop_fssai_expired',
                shopId,
                expiryDate: expiryIso,
                fssaiNumber: summary.fssaiNumber || ''
            }
        });

        createdCount += 1;
    }

    return {
        totalExpired: shops.length,
        createdCount
    };
};
