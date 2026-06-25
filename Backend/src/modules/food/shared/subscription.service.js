
import mongoose from 'mongoose';
import { ValidationError, NotFoundError, ForbiddenError } from '../../../core/auth/errors.js';
import { FoodSubscriptionPackage } from '../admin/models/subscriptionPackage.model.js';
import { FoodSubscription } from './subscription.model.js';
import { FoodShop } from '../shop/models/shop.model.js';
import { FoodUser } from '../../../core/users/user.model.js';
import { FoodZone } from '../admin/models/zone.model.js';
import { createInboxNotifications } from '../../../core/notifications/notification.service.js';
import { notifyOwnerSafely } from '../../../core/notifications/firebase.service.js';
import { createRazorpayOrder, getRazorpayKeyId, isRazorpayConfigured, verifyPaymentSignature } from '../orders/helpers/razorpay.helper.js';

const VALID_DURATION_UNITS = ['Days', 'Months', 'Years'];
const VALID_FEATURE_ICONS = ['ShieldCheck', 'Heart', 'Zap', 'Gift', 'BadgePercent', 'Truck'];

const formatCurrency = (value, currency = 'INR') => {
    if (currency !== 'INR') {
        return `${currency} ${Number(value || 0).toFixed(2)}`;
    }
    return `₹ ${Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const canonicalizePackageType = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'resto' || normalized === 'shop') return 'Resto';
    if (normalized === 'customer' || normalized === 'user') return 'Customer';
    throw new ValidationError('Invalid package type');
};

const canonicalizeDurationUnit = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized.startsWith('day')) return 'Days';
    if (normalized.startsWith('month')) return 'Months';
    if (normalized.startsWith('year')) return 'Years';
    throw new ValidationError('Invalid duration unit');
};

const parseDurationString = (value) => {
    const match = String(value || '').trim().match(/^(\d+)\s*(day|days|month|months|year|years)$/i);
    if (!match) return null;
    return {
        durationValue: Number(match[1]),
        durationUnit: canonicalizeDurationUnit(match[2]),
    };
};

const parsePriceValue = (value) => {
    if (value === undefined || value === null || value === '') {
        throw new ValidationError('Price is required');
    }
    const numeric = Number(String(value).replace(/[^\d.]/g, ''));
    if (!Number.isFinite(numeric) || numeric < 0) {
        throw new ValidationError('Invalid price');
    }
    return Number(numeric.toFixed(2));
};

const parsePositiveInteger = (value, fieldLabel) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) {
        throw new ValidationError(`${fieldLabel} must be at least 1`);
    }
    return Math.round(numeric);
};

const normalizeFeatures = (features) => {
    if (!Array.isArray(features)) return [];

    return features
        .map((feature) => ({
            icon: VALID_FEATURE_ICONS.includes(String(feature?.icon || '').trim())
                ? String(feature.icon).trim()
                : 'ShieldCheck',
            text: String(feature?.text || '').trim(),
        }))
        .filter((feature) => feature.text)
        .slice(0, 6);
};

const addDurationToDate = (date, durationValue, durationUnit) => {
    const next = new Date(date);
    if (durationUnit === 'Days') {
        next.setDate(next.getDate() + durationValue);
        return next;
    }
    if (durationUnit === 'Months') {
        next.setMonth(next.getMonth() + durationValue);
        return next;
    }
    next.setFullYear(next.getFullYear() + durationValue);
    return next;
};

const getDaysLeft = (expiryDate) => {
    if (!expiryDate) return 0;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry.getTime() - now.getTime();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const buildPackageSnapshot = (pkg) => ({
    packageId: pkg._id,
    name: pkg.name,
    type: pkg.type,
    description: pkg.description || '',
    image: pkg.image || '',
    features: normalizeFeatures(pkg.features),
    priceValue: pkg.priceValue,
    markedPriceValue: pkg.markedPriceValue ?? pkg.priceValue,
    priceCurrency: pkg.priceCurrency || 'INR',
    durationValue: pkg.durationValue,
    durationUnit: pkg.durationUnit,
    restoBenefitType: pkg.restoBenefitType || null,
    commissionRate: pkg.commissionRate ?? null,
    freeDeliveryType: pkg.freeDeliveryType || null,
    maxFreeDeliveries: pkg.maxFreeDeliveries ?? null,
});

const mapPackageDoc = (pkg, subscribers = 0) => ({
    id: String(pkg._id),
    name: pkg.name,
    type: pkg.type,
    description: pkg.description || '',
    image: pkg.image || null,
    features: normalizeFeatures(pkg.features),
    price: formatCurrency(pkg.priceValue, pkg.priceCurrency),
    markedPrice: formatCurrency(pkg.markedPriceValue ?? pkg.priceValue, pkg.priceCurrency),
    priceValue: pkg.priceValue,
    markedPriceValue: pkg.markedPriceValue ?? pkg.priceValue,
    priceCurrency: pkg.priceCurrency || 'INR',
    duration: `${pkg.durationValue} ${pkg.durationUnit}`,
    durationValue: pkg.durationValue,
    durationUnit: pkg.durationUnit,
    subscribers,
    active: pkg.active !== false,
    restoBenefitType: pkg.restoBenefitType || '',
    commissionRate: pkg.commissionRate ?? '',
    freeDeliveryType: pkg.freeDeliveryType || '',
    maxFreeDeliveries: pkg.maxFreeDeliveries ?? '',
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
});

const getEffectiveSubscriptionPackage = (subscription, livePackageMap = new Map()) => {
    const snapshotPackage = subscription.packageSnapshot || {};
    const livePackage = livePackageMap.get(String(subscription.packageId));
    const isExpired = subscription.status === 'expired' || new Date(subscription.expiryDate).getTime() < Date.now();
    const isActive = subscription.status === 'active' && !isExpired;

    if (isActive && livePackage) {
        return {
            name: livePackage.name,
            type: livePackage.type,
            description: livePackage.description || '',
            image: livePackage.image || '',
            features: normalizeFeatures(livePackage.features),
            priceValue: livePackage.priceValue,
            markedPriceValue: livePackage.markedPriceValue ?? livePackage.priceValue,
            priceCurrency: livePackage.priceCurrency || 'INR',
            durationValue: livePackage.durationValue,
            durationUnit: livePackage.durationUnit,
            restoBenefitType: livePackage.restoBenefitType || null,
            commissionRate: livePackage.commissionRate ?? null,
            freeDeliveryType: livePackage.freeDeliveryType || null,
            maxFreeDeliveries: livePackage.maxFreeDeliveries ?? null,
        };
    }

    return snapshotPackage;
};

const mapSubscriptionDoc = (subscription, livePackageMap = new Map()) => {
    const isExpired = subscription.status === 'expired' || new Date(subscription.expiryDate).getTime() < Date.now();
    const isActive = subscription.status === 'active' && !isExpired;
    const pkg = getEffectiveSubscriptionPackage(subscription, livePackageMap);
    const daysLeft = isActive ? getDaysLeft(subscription.expiryDate) : 0;

    return {
        id: String(subscription._id),
        packageId: String(subscription.packageId),
        name: pkg.name,
        type: pkg.type,
        description: pkg.description || '',
        image: pkg.image || null,
        features: normalizeFeatures(pkg.features),
        price: formatCurrency(pkg.priceValue, pkg.priceCurrency),
        markedPrice: formatCurrency(pkg.markedPriceValue ?? pkg.priceValue, pkg.priceCurrency),
        priceValue: pkg.priceValue,
        markedPriceValue: pkg.markedPriceValue ?? pkg.priceValue,
        duration: `${pkg.durationValue} ${pkg.durationUnit}`,
        durationValue: pkg.durationValue,
        durationUnit: pkg.durationUnit,
        purchaseDate: subscription.purchaseDate,
        startDate: subscription.startDate,
        expiryDate: subscription.expiryDate,
        paymentMethod: subscription.paymentMethod,
        razorpayOrderId: subscription.razorpayOrderId || '',
        razorpayPaymentId: subscription.razorpayPaymentId || '',
        freeDeliveryType: pkg.freeDeliveryType || '',
        maxFreeDeliveries: pkg.maxFreeDeliveries ?? '',
        deliveriesUsed: subscription.deliveriesUsed ?? 0,
        restoBenefitType: pkg.restoBenefitType || '',
        commissionRate: pkg.commissionRate ?? '',
        daysLeft,
        status: isActive ? 'active' : subscription.status === 'cancelled' ? 'cancelled' : 'expired',
        active: isActive,
        cancelledAt: subscription.cancelledAt || null,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
    };
};

const maybeSendShopExpiryReminder = async (subscription) => {
    if (!subscription || subscription.ownerType !== 'SHOP' || subscription.status !== 'active') return;

    const daysLeft = getDaysLeft(subscription.expiryDate);
    const reminderField =
        daysLeft === 10 ? 'reminder10SentAt' : daysLeft === 2 ? 'reminder2SentAt' : null;

    if (!reminderField) return;
    if (subscription[reminderField]) return;

    const updated = await FoodSubscription.findOneAndUpdate(
        {
            _id: subscription._id,
            ownerType: 'SHOP',
            status: 'active',
            [reminderField]: null,
        },
        {
            $set: { [reminderField]: new Date() },
        },
        { new: true }
    ).lean();

    if (!updated) return;

    const title = `Subscription expires in ${daysLeft} days`;
    const message =
        daysLeft === 2
            ? 'Your shop subscription will expire in 2 days. Renew soon to avoid losing benefits.'
            : 'Your shop subscription will expire in 10 days. Renew in time to keep your benefits active.';

    const metadata = {
        subscriptionId: String(subscription._id),
        packageId: String(subscription.packageId),
        daysLeft: String(daysLeft),
        type: 'shop_subscription_expiry_reminder',
    };

    await createInboxNotifications({
        notifications: [
            {
                ownerType: 'SHOP',
                ownerId: subscription.ownerId,
                title,
                message,
                link: '/food/shop/my-subscription',
                category: 'subscription',
                source: 'SUBSCRIPTION_EXPIRY_REMINDER',
                metadata,
            },
        ],
    });

    await notifyOwnerSafely(
        { ownerType: 'SHOP', ownerId: subscription.ownerId },
        {
            title,
            body: message,
            data: {
                type: 'subscription_expiry_reminder',
                link: '/food/shop/my-subscription',
                subscriptionId: String(subscription._id),
                daysLeft: String(daysLeft),
            },
        }
    );
};

const maybeSendUserExpiryReminder = async (subscription) => {
    if (!subscription || subscription.ownerType !== 'USER' || subscription.status !== 'active') return;

    const daysLeft = getDaysLeft(subscription.expiryDate);
    const reminderField =
        daysLeft === 10 ? 'reminder10SentAt' : daysLeft === 2 ? 'reminder2SentAt' : null;

    if (!reminderField) return;
    if (subscription[reminderField]) return;

    const updated = await FoodSubscription.findOneAndUpdate(
        {
            _id: subscription._id,
            ownerType: 'USER',
            status: 'active',
            [reminderField]: null,
        },
        {
            $set: { [reminderField]: new Date() },
        },
        { new: true }
    ).lean();

    if (!updated) return;

    const title = `Subscription expires in ${daysLeft} days`;
    const message =
        daysLeft === 2
            ? 'Your subscription will expire in 2 days. Renew soon to keep your free-delivery benefits active.'
            : 'Your subscription will expire in 10 days. Renew in time to keep your benefits active.';

    const metadata = {
        subscriptionId: String(subscription._id),
        packageId: String(subscription.packageId),
        daysLeft: String(daysLeft),
        type: 'user_subscription_expiry_reminder',
    };

    await createInboxNotifications({
        notifications: [
            {
                ownerType: 'USER',
                ownerId: subscription.ownerId,
                title,
                message,
                link: '/food/profile/my-subscriptions',
                category: 'subscription',
                source: 'SUBSCRIPTION_EXPIRY_REMINDER',
                metadata,
            },
        ],
    });

    await notifyOwnerSafely(
        { ownerType: 'USER', ownerId: subscription.ownerId },
        {
            title,
            body: message,
            data: {
                type: 'subscription_expiry_reminder',
                link: '/food/profile/my-subscriptions',
                subscriptionId: String(subscription._id),
                daysLeft: String(daysLeft),
            },
        }
    );
};

const getLivePackageMap = async (subscriptions = []) => {
    const packageIds = [
        ...new Set(
            subscriptions
                .map((subscription) => String(subscription?.packageId || '').trim())
                .filter((packageId) => mongoose.Types.ObjectId.isValid(packageId))
        ),
    ];

    if (packageIds.length === 0) return new Map();

    const packages = await FoodSubscriptionPackage.find({
        _id: { $in: packageIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }).lean();

    return new Map(packages.map((pkg) => [String(pkg._id), pkg]));
};

const getValidatedPackageForOwner = async (ownerType, packageId) => {
    const normalizedPackageId = String(packageId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(normalizedPackageId)) {
        throw new ValidationError('Valid packageId is required');
    }

    const expectedType = ownerType === 'USER' ? 'Customer' : 'Resto';
    const pkg = await FoodSubscriptionPackage.findById(normalizedPackageId);
    if (!pkg || pkg.active === false) {
        throw new NotFoundError('Subscription package not found or inactive');
    }
    if (pkg.type !== expectedType) {
        throw new ForbiddenError(`This package is not available for ${ownerType.toLowerCase()}`);
    }

    return pkg;
};

const normalizePackagePayload = (body, { partial = false } = {}) => {
    const payload = {};

    if (!partial || body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) throw new ValidationError('Package name is required');
        payload.name = name;
    }

    if (!partial || body.type !== undefined) {
        payload.type = canonicalizePackageType(body.type);
    }

    if (!partial || body.description !== undefined) {
        payload.description = String(body.description || '').trim();
    }

    if (!partial || body.image !== undefined) {
        payload.image = String(body.image || '').trim();
    }

    if (!partial || body.features !== undefined) {
        payload.features = normalizeFeatures(body.features);
    }

    if (!partial || body.active !== undefined) {
        payload.active = body.active !== false;
    }

    if (!partial || body.priceValue !== undefined || body.price !== undefined) {
        payload.priceValue = parsePriceValue(body.priceValue ?? body.price);
        payload.markedPriceValue = parsePriceValue(body.markedPriceValue ?? body.markedPrice ?? payload.priceValue);
        if (payload.markedPriceValue < payload.priceValue) {
            throw new ValidationError('Marked price must be greater than or equal to selling price');
        }
        payload.priceCurrency = 'INR';
    }

    if (!partial || body.durationValue !== undefined || body.duration !== undefined || body.durationUnit !== undefined) {
        const parsedDuration = parseDurationString(body.duration);
        const durationValue = body.durationValue ?? parsedDuration?.durationValue;
        const durationUnit = body.durationUnit ?? parsedDuration?.durationUnit;

        payload.durationValue = parsePositiveInteger(durationValue, 'Duration');
        payload.durationUnit = canonicalizeDurationUnit(durationUnit);
    }

    const effectiveType = payload.type ?? (body.type !== undefined ? canonicalizePackageType(body.type) : null);

    if (effectiveType === 'Resto') {
        const benefitType = String(body.restoBenefitType || '').trim();
        if (!benefitType) throw new ValidationError('Shop benefit type is required');
        if (!['commission_reduction', 'priority_listing'].includes(benefitType)) {
            throw new ValidationError('Invalid shop benefit type');
        }
        payload.restoBenefitType = benefitType;
        payload.freeDeliveryType = null;
        payload.maxFreeDeliveries = null;
        if (benefitType === 'commission_reduction') {
            const commissionRate = Number(body.commissionRate);
            if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
                throw new ValidationError('Commission rate must be between 0 and 100');
            }
            payload.commissionRate = Number(commissionRate);
        } else {
            payload.commissionRate = null;
        }
    }

    if (effectiveType === 'Customer') {
        const freeDeliveryType = String(body.freeDeliveryType || '').trim();
        if (!freeDeliveryType) throw new ValidationError('Free delivery type is required');
        if (!['unlimited', 'capped'].includes(freeDeliveryType)) {
            throw new ValidationError('Invalid free delivery type');
        }
        payload.freeDeliveryType = freeDeliveryType;
        payload.restoBenefitType = null;
        payload.commissionRate = null;
        if (freeDeliveryType === 'capped') {
            payload.maxFreeDeliveries = parsePositiveInteger(body.maxFreeDeliveries, 'Max free deliveries');
        } else {
            payload.maxFreeDeliveries = null;
        }
    }

    if (payload.durationUnit && !VALID_DURATION_UNITS.includes(payload.durationUnit)) {
        throw new ValidationError('Invalid duration unit');
    }

    return payload;
};

const getSubscribersMap = async (packageIds) => {
    if (!Array.isArray(packageIds) || packageIds.length === 0) return new Map();

    const rows = await FoodSubscription.aggregate([
        {
            $match: {
                packageId: { $in: packageIds.map((id) => new mongoose.Types.ObjectId(id)) },
                status: 'active',
                expiryDate: { $gte: new Date() },
            },
        },
        {
            $group: {
                _id: '$packageId',
                count: { $sum: 1 },
            },
        },
    ]);

    return new Map(rows.map((row) => [String(row._id), row.count]));
};

export const listSubscriptionPackages = async ({ type, activeOnly = false } = {}) => {
    const query = {};
    if (type) query.type = canonicalizePackageType(type);
    if (activeOnly) query.active = true;

    const packages = await FoodSubscriptionPackage.find(query).sort({ createdAt: -1 }).lean();
    const subscribersMap = await getSubscribersMap(packages.map((pkg) => String(pkg._id)));
    return {
        packages: packages.map((pkg) => mapPackageDoc(pkg, subscribersMap.get(String(pkg._id)) || 0)),
    };
};

export const createSubscriptionPackage = async (body, adminId) => {
    const payload = normalizePackagePayload(body);
    const created = await FoodSubscriptionPackage.create({
        ...payload,
        createdBy: adminId || null,
        updatedBy: adminId || null,
    });
    return { package: mapPackageDoc(created.toObject(), 0) };
};

export const updateSubscriptionPackage = async (packageId, body, adminId) => {
    if (!mongoose.Types.ObjectId.isValid(packageId)) {
        throw new ValidationError('Invalid package id');
    }
    const pkg = await FoodSubscriptionPackage.findById(packageId);
    if (!pkg) throw new NotFoundError('Subscription package not found');

    const payload = normalizePackagePayload(
        {
            ...pkg.toObject(),
            ...body,
            type: body.type ?? pkg.type,
        },
        { partial: true },
    );

    Object.assign(pkg, payload, { updatedBy: adminId || null });
    await pkg.save();

    const subscribersMap = await getSubscribersMap([String(pkg._id)]);
    return { package: mapPackageDoc(pkg.toObject(), subscribersMap.get(String(pkg._id)) || 0) };
};

export const updateSubscriptionPackageStatus = async (packageId, isActive, adminId) => {
    if (!mongoose.Types.ObjectId.isValid(packageId)) {
        throw new ValidationError('Invalid package id');
    }
    const pkg = await FoodSubscriptionPackage.findById(packageId);
    if (!pkg) throw new NotFoundError('Subscription package not found');

    pkg.active = isActive !== false;
    pkg.updatedBy = adminId || null;
    await pkg.save();

    const subscribersMap = await getSubscribersMap([String(pkg._id)]);
    return { package: mapPackageDoc(pkg.toObject(), subscribersMap.get(String(pkg._id)) || 0) };
};

export const deleteSubscriptionPackage = async (packageId) => {
    if (!mongoose.Types.ObjectId.isValid(packageId)) {
        throw new ValidationError('Invalid package id');
    }

    const pkg = await FoodSubscriptionPackage.findById(packageId);
    if (!pkg) throw new NotFoundError('Subscription package not found');

    await Promise.all([
        FoodSubscription.deleteMany({ packageId: pkg._id }),
        FoodSubscriptionPackage.deleteOne({ _id: pkg._id }),
    ]);

    return {
        deleted: true,
        packageId: String(pkg._id),
    };
};

export const listAdminSubscriptionSubscribers = async ({ type, search = '', zoneId = '', status = '' } = {}) => {
    const normalizedType = canonicalizePackageType(type);
    const ownerType = normalizedType === 'Customer' ? 'USER' : 'SHOP';

    await FoodSubscription.updateMany(
        {
            ownerType,
            status: 'active',
            expiryDate: { $lt: new Date() },
        },
        { $set: { status: 'expired' } },
    );

    const subscriptions = await FoodSubscription.find({ ownerType }).sort({ purchaseDate: -1 }).lean();
    const livePackageMap = await getLivePackageMap(subscriptions);

    const ownerIds = [...new Set(subscriptions.map((subscription) => String(subscription.ownerId)).filter(Boolean))];
    const [shops, users] = await Promise.all([
        ownerType === 'SHOP'
            ? FoodShop.find({ _id: { $in: ownerIds } })
                .select('shopName ownerName ownerPhone profileImage zoneId')
                .lean()
            : Promise.resolve([]),
        ownerType === 'USER'
            ? FoodUser.find({ _id: { $in: ownerIds } })
                .select('name phone profileImage email')
                .lean()
            : Promise.resolve([]),
    ]);
    const zoneIds = [...new Set(shops.map((doc) => String(doc?.zoneId || '')).filter(Boolean))];
    const zones = zoneIds.length
        ? await FoodZone.find({ _id: { $in: zoneIds } }).select('name zoneName serviceLocation').lean()
        : [];

    const shopMap = new Map(shops.map((doc) => [String(doc._id), doc]));
    const userMap = new Map(users.map((doc) => [String(doc._id), doc]));
    const zoneMap = new Map(
        zones.map((doc) => [
            String(doc._id),
            doc.name || doc.zoneName || doc.serviceLocation || 'Unknown Zone',
        ]),
    );

    const rows = subscriptions.map((subscription) => {
        const mapped = mapSubscriptionDoc(subscription, livePackageMap);
        const ownerId = String(subscription.ownerId);
        const isShop = ownerType === 'SHOP';
        const owner = isShop ? shopMap.get(ownerId) : userMap.get(ownerId);

        return {
            id: mapped.id,
            transactionId: mapped.razorpayPaymentId || mapped.razorpayOrderId || mapped.id,
            ownerId,
            ownerType,
            name: isShop
                ? owner?.shopName || owner?.ownerName || 'Unknown Shop'
                : owner?.name || 'Unknown User',
            phone: isShop ? owner?.ownerPhone || '' : owner?.phone || '',
            image: isShop ? owner?.profileImage || '' : owner?.profileImage || '',
            packageName: mapped.name,
            price: mapped.price,
            priceValue: mapped.priceValue,
            expiryDate: mapped.expiryDate,
            purchaseDate: mapped.purchaseDate,
            status: mapped.status,
            daysLeft: mapped.daysLeft,
            duration: mapped.duration,
            freeDeliveryType: mapped.freeDeliveryType || '',
            maxFreeDeliveries: mapped.maxFreeDeliveries ?? '',
            deliveriesUsed: mapped.deliveriesUsed ?? 0,
            usageLabel: mapped.usageLabel || '',
            restoBenefitType: mapped.restoBenefitType || '',
            commissionRate: mapped.commissionRate ?? '',
            zoneId: isShop ? String(owner?.zoneId || '') : '',
            zoneLabel: isShop ? zoneMap.get(String(owner?.zoneId || '')) || 'N/A' : '',
        };
    });

    const normalizedSearch = String(search || '').trim().toLowerCase();
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const normalizedZoneId = String(zoneId || '').trim();

    const filteredRows = rows.filter((row) => {
        if (normalizedStatus && String(row.status || '').toLowerCase() !== normalizedStatus) {
            return false;
        }
        if (normalizedZoneId && row.ownerType === 'SHOP' && String(row.zoneId || '') !== normalizedZoneId) {
            return false;
        }
        if (!normalizedSearch) return true;
        return [
            row.name,
            row.phone,
            row.packageName,
            row.zoneLabel,
        ]
            .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    });

    const activeCount = filteredRows.filter((row) => row.status === 'active').length;
    const totalRevenue = filteredRows.reduce((sum, row) => sum + Number(row.priceValue || 0), 0);
    const zoneOptions = ownerType === 'SHOP'
        ? [...new Map(
            rows
                .filter((row) => row.zoneId)
                .map((row) => [row.zoneId, { id: row.zoneId, label: row.zoneLabel || 'Unknown Zone' }]),
        ).values()]
        : [];

    return {
        subscribers: filteredRows,
        summary: {
            totalSubscriptions: filteredRows.length,
            activeSubscriptions: activeCount,
            totalRevenue,
        },
        zones: zoneOptions,
    };
};

const expireOwnerSubscriptions = async (ownerType, ownerId) => {
    await FoodSubscription.updateMany(
        {
            ownerType,
            ownerId,
            status: 'active',
            expiryDate: { $lt: new Date() },
        },
        {
            $set: { status: 'expired' },
        },
    );
};

const getActiveOwnerSubscriptionDoc = async (ownerType, ownerId) => {
    await expireOwnerSubscriptions(ownerType, ownerId);
    return await FoodSubscription.findOne({
        ownerType,
        ownerId,
        status: 'active',
    }).sort({ purchaseDate: -1 });
};

export const getActiveUserFreeDeliveryBenefit = async (userId) => {
    const subscriptionDoc = await getActiveOwnerSubscriptionDoc('USER', userId);
    const subscription = subscriptionDoc ? subscriptionDoc.toObject() : null;
    if (!subscription) {
        return {
            hasActiveSubscription: false,
            canApplyFreeDelivery: false,
            freeDeliveryType: null,
            maxFreeDeliveries: null,
            deliveriesUsed: 0,
            usageLabel: '',
            reason: 'no_active_subscription',
        };
    }

    const livePackageMap = await getLivePackageMap([subscription]);
    const pkg = getEffectiveSubscriptionPackage(subscription, livePackageMap);
    const freeDeliveryType = String(pkg?.freeDeliveryType || '').trim() || null;
    const maxFreeDeliveries = Number(pkg?.maxFreeDeliveries || 0);
    const deliveriesUsed = Math.max(0, Number(subscription?.deliveriesUsed || 0));

    let canApplyFreeDelivery = false;
    let reason = 'subscription_not_eligible';

    if (freeDeliveryType === 'unlimited') {
        canApplyFreeDelivery = true;
        reason = 'active';
    } else if (freeDeliveryType === 'capped') {
        canApplyFreeDelivery = maxFreeDeliveries > 0 && deliveriesUsed < maxFreeDeliveries;
        reason = canApplyFreeDelivery ? 'active' : 'limit_reached';
    }

    return {
        hasActiveSubscription: true,
        subscriptionId: String(subscription._id),
        packageId: String(subscription.packageId),
        canApplyFreeDelivery,
        freeDeliveryType,
        maxFreeDeliveries: freeDeliveryType === 'capped' ? maxFreeDeliveries : null,
        deliveriesUsed,
        usageLabel: freeDeliveryType === 'capped' ? `${deliveriesUsed}/${maxFreeDeliveries}` : '',
        reason,
    };
};

export const consumeUserFreeDeliveryBenefit = async (subscriptionId) => {
    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        return { consumed: false, reason: 'invalid_subscription' };
    }

    const subscription = await FoodSubscription.findById(subscriptionId).lean();
    if (!subscription || subscription.ownerType !== 'USER' || subscription.status !== 'active') {
        return { consumed: false, reason: 'subscription_not_active' };
    }

    const livePackageMap = await getLivePackageMap([subscription]);
    const pkg = getEffectiveSubscriptionPackage(subscription, livePackageMap);
    if (String(pkg?.freeDeliveryType || '') !== 'capped') {
        return { consumed: false, reason: 'not_capped' };
    }

    const maxFreeDeliveries = Number(pkg?.maxFreeDeliveries || 0);
    if (!Number.isFinite(maxFreeDeliveries) || maxFreeDeliveries < 1) {
        return { consumed: false, reason: 'invalid_cap' };
    }

    const updated = await FoodSubscription.findOneAndUpdate(
        {
            _id: subscription._id,
            ownerType: 'USER',
            status: 'active',
            expiryDate: { $gte: new Date() },
            deliveriesUsed: { $lt: maxFreeDeliveries },
        },
        {
            $inc: { deliveriesUsed: 1 },
        },
        { new: true },
    ).lean();

    if (!updated) {
        return { consumed: false, reason: 'limit_reached' };
    }

    return {
        consumed: true,
        deliveriesUsed: Math.max(0, Number(updated.deliveriesUsed || 0)),
        maxFreeDeliveries,
        usageLabel: `${Math.max(0, Number(updated.deliveriesUsed || 0))}/${maxFreeDeliveries}`,
    };
};

export const releaseUserFreeDeliveryBenefit = async (subscriptionId) => {
    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        return { released: false, reason: 'invalid_subscription' };
    }

    const updated = await FoodSubscription.findOneAndUpdate(
        {
            _id: new mongoose.Types.ObjectId(subscriptionId),
            ownerType: 'USER',
            deliveriesUsed: { $gt: 0 },
        },
        {
            $inc: { deliveriesUsed: -1 },
        },
        { new: true },
    ).lean();

    if (!updated) {
        return { released: false, reason: 'nothing_to_release' };
    }

    return {
        released: true,
        deliveriesUsed: Math.max(0, Number(updated.deliveriesUsed || 0)),
    };
};

export const getPriorityListingShopIds = async (shopIds = []) => {
    const normalizedShopIds = [
        ...new Set(
            (Array.isArray(shopIds) ? shopIds : [])
                .map((id) => String(id || '').trim())
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        ),
    ];

    if (!normalizedShopIds.length) return [];

    await FoodSubscription.updateMany(
        {
            ownerType: 'SHOP',
            ownerId: { $in: normalizedShopIds.map((id) => new mongoose.Types.ObjectId(id)) },
            status: 'active',
            expiryDate: { $lt: new Date() },
        },
        { $set: { status: 'expired' } },
    );

    const subscriptions = await FoodSubscription.find({
        ownerType: 'SHOP',
        ownerId: { $in: normalizedShopIds.map((id) => new mongoose.Types.ObjectId(id)) },
        status: 'active',
        expiryDate: { $gte: new Date() },
    }).lean();

    if (!subscriptions.length) return [];

    const livePackageMap = await getLivePackageMap(subscriptions);

    return subscriptions
        .filter((subscription) => {
            const pkg = getEffectiveSubscriptionPackage(subscription, livePackageMap);
            return String(pkg?.restoBenefitType || '') === 'priority_listing';
        })
        .map((subscription) => String(subscription.ownerId))
        .filter(Boolean);
};

export const getActiveShopCommissionBenefit = async (shopId) => {
    const normalizedShopId = String(shopId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(normalizedShopId)) {
        return {
            hasActiveSubscription: false,
            appliesReducedCommission: false,
            commissionRate: null,
            subscriptionId: null,
            reason: 'invalid_shop',
        };
    }

    await FoodSubscription.updateMany(
        {
            ownerType: 'SHOP',
            ownerId: new mongoose.Types.ObjectId(normalizedShopId),
            status: 'active',
            expiryDate: { $lt: new Date() },
        },
        { $set: { status: 'expired' } },
    );

    const subscription = await FoodSubscription.findOne({
        ownerType: 'SHOP',
        ownerId: new mongoose.Types.ObjectId(normalizedShopId),
        status: 'active',
        expiryDate: { $gte: new Date() },
    })
        .sort({ purchaseDate: -1 })
        .lean();

    if (!subscription) {
        return {
            hasActiveSubscription: false,
            appliesReducedCommission: false,
            commissionRate: null,
            subscriptionId: null,
            packageName: null,
            expiryDate: null,
            daysLeft: 0,
            reason: 'no_active_subscription',
        };
    }

    const livePackageMap = await getLivePackageMap([subscription]);
    const pkg = getEffectiveSubscriptionPackage(subscription, livePackageMap);
    const commissionRate = Number(pkg?.commissionRate);
    const appliesReducedCommission =
        String(pkg?.restoBenefitType || '') === 'commission_reduction' &&
        Number.isFinite(commissionRate) &&
        commissionRate >= 0;

    return {
        hasActiveSubscription: true,
        appliesReducedCommission,
        commissionRate: appliesReducedCommission ? commissionRate : null,
        subscriptionId: String(subscription._id),
        packageName: pkg?.name || null,
        expiryDate: subscription.expiryDate || null,
        daysLeft: getDaysLeft(subscription.expiryDate),
        reason: appliesReducedCommission ? 'active' : 'not_commission_package',
    };
};

export const listOwnerSubscriptions = async (ownerType, ownerId) => {
    await expireOwnerSubscriptions(ownerType, ownerId);
    const subscriptions = await FoodSubscription.find({ ownerType, ownerId }).sort({ purchaseDate: -1 }).lean();
    if (ownerType === 'SHOP') {
        await Promise.all(
            subscriptions
                .filter((subscription) => subscription?.status === 'active')
                .map((subscription) => maybeSendShopExpiryReminder(subscription))
        );
    } else if (ownerType === 'USER') {
        await Promise.all(
            subscriptions
                .filter((subscription) => subscription?.status === 'active')
                .map((subscription) => maybeSendUserExpiryReminder(subscription))
        );
    }
    const livePackageMap = await getLivePackageMap(subscriptions);
    return {
        subscriptions: subscriptions.map((subscription) => mapSubscriptionDoc(subscription, livePackageMap)),
    };
};

export const getCurrentOwnerSubscription = async (ownerType, ownerId) => {
    const subscriptionDoc = await getActiveOwnerSubscriptionDoc(ownerType, ownerId);
    const subscription = subscriptionDoc ? subscriptionDoc.toObject() : null;
    if (ownerType === 'SHOP' && subscription?.status === 'active') {
        await maybeSendShopExpiryReminder(subscription);
    } else if (ownerType === 'USER' && subscription?.status === 'active') {
        await maybeSendUserExpiryReminder(subscription);
    }
    const livePackageMap = subscription ? await getLivePackageMap([subscription]) : new Map();

    return {
        subscription: subscription ? mapSubscriptionDoc(subscription, livePackageMap) : null,
    };
};

export const activateOwnerSubscription = async (ownerType, ownerId, body) => {
    const pkg = await getValidatedPackageForOwner(ownerType, body.packageId);
    const activeSubscription = await getActiveOwnerSubscriptionDoc(ownerType, ownerId);
    if (activeSubscription) {
        throw new ValidationError('You already have an active subscription plan. Please wait until it expires.');
    }

    const startDate = new Date();
    const expiryDate = addDurationToDate(startDate, pkg.durationValue, pkg.durationUnit);

    const created = await FoodSubscription.create({
        ownerType,
        ownerId,
        packageId: pkg._id,
        packageSnapshot: buildPackageSnapshot(pkg),
        status: 'active',
        paymentMethod: String(body.paymentMethod || 'wallet').trim() || 'wallet',
        razorpayOrderId: String(body.razorpayOrderId || '').trim(),
        razorpayPaymentId: String(body.razorpayPaymentId || '').trim(),
        razorpaySignature: String(body.razorpaySignature || '').trim(),
        pricePaid: pkg.priceValue,
        purchaseDate: startDate,
        startDate,
        expiryDate,
        deliveriesUsed: 0,
    });

    return {
        subscription: mapSubscriptionDoc(created.toObject()),
    };
};

export const createOwnerSubscriptionRazorpayOrder = async (ownerType, ownerId, body = {}) => {
    const pkg = await getValidatedPackageForOwner(ownerType, body.packageId);
    const activeSubscription = await getActiveOwnerSubscriptionDoc(ownerType, ownerId);
    if (activeSubscription) {
        throw new ValidationError('You already have an active subscription plan. Please wait until it expires.');
    }
    const amountPaise = Math.round(Number(pkg.priceValue || 0) * 100);

    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
        throw new ValidationError('Invalid subscription amount');
    }

    if (!isRazorpayConfigured()) {
        return {
            package: mapPackageDoc(pkg.toObject(), 0),
            razorpay: {
                key: getRazorpayKeyId() || 'rzp_test_dummy',
                orderId: `sub_dev_${String(ownerId).slice(-6)}_${Date.now()}`,
                amount: amountPaise,
                currency: 'INR',
            },
        };
    }

    const ownerReceiptPrefix = ownerType === 'SHOP' ? 'sub_rest' : 'sub_user';
    const receipt = `${ownerReceiptPrefix}_${String(ownerId).slice(-6)}_${Date.now()}`;
    const order = await createRazorpayOrder(amountPaise, 'INR', receipt);

    return {
        package: mapPackageDoc(pkg.toObject(), 0),
        razorpay: {
            key: getRazorpayKeyId(),
            orderId: String(order.id),
            amount: Number(order.amount) || amountPaise,
            currency: order.currency || 'INR',
        },
    };
};

export const verifyOwnerSubscriptionRazorpayPayment = async (ownerType, ownerId, body = {}) => {
    const pkg = await getValidatedPackageForOwner(ownerType, body.packageId);
    const razorpayOrderId = String(body.razorpayOrderId || '').trim();
    const razorpayPaymentId = String(body.razorpayPaymentId || '').trim();
    const razorpaySignature = String(body.razorpaySignature || '').trim();

    if (!razorpayOrderId) throw new ValidationError('razorpayOrderId is required');
    if (!razorpayPaymentId) throw new ValidationError('razorpayPaymentId is required');
    if (!razorpaySignature) throw new ValidationError('razorpaySignature is required');

    const existingSubscription = await FoodSubscription.findOne({
        ownerType,
        ownerId,
        $or: [
            { razorpayOrderId },
            { razorpayPaymentId },
        ],
    }).lean();

    if (existingSubscription) {
        const livePackageMap = await getLivePackageMap([existingSubscription]);
        return {
            subscription: mapSubscriptionDoc(existingSubscription, livePackageMap),
        };
    }

    const isValid = isRazorpayConfigured()
        ? verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)
        : true;

    if (!isValid) {
        throw new ValidationError('Payment verification failed');
    }

    return activateOwnerSubscription(ownerType, ownerId, {
        packageId: String(pkg._id),
        paymentMethod: 'razorpay',
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
    });
};

export const cancelOwnerSubscription = async (ownerType, ownerId, subscriptionId) => {
    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        throw new ValidationError('Invalid subscription id');
    }

    const subscription = await FoodSubscription.findOne({
        _id: subscriptionId,
        ownerType,
        ownerId,
    });

    if (!subscription) throw new NotFoundError('Subscription not found');

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    await subscription.save();

    return {
        subscription: mapSubscriptionDoc(subscription.toObject()),
    };
};
