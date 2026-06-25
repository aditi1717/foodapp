import { FoodShop } from '../models/shop.model.js';
import { uploadImageBuffer } from '../../../../services/cloudinary.service.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import mongoose from 'mongoose';
import { FoodZone } from '../../admin/models/zone.model.js';
import { FoodShopCommission } from '../../admin/models/shopCommission.model.js';
import { FoodOffer } from '../../admin/models/offer.model.js';
import { FoodOfferUsage } from '../../admin/models/offerUsage.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { getPriorityListingShopIds } from '../../shared/subscription.service.js';

const normalizeName = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ');

const normalizePhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(-15);
    return {
        digits: digits || '',
        last10: digits ? digits.slice(-10) : ''
    };
};

const normalizeRatingValue = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(5, Number(numeric.toFixed(1))));
};

const normalizeTotalRatingsValue = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.floor(numeric));
};

const toUrl = (v) => (v && (typeof v === 'string' ? v : v.url)) ? (typeof v === 'string' ? v : v.url) : '';

const normalizeShopTime = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const toHHMM = (hour, minute) => {
        const h = Number(hour);
        const m = Number(minute);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
        if (h < 0 || h > 23 || m < 0 || m > 59) return '';
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // HH:mm / H:mm
    const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) return toHHMM(hhmm[1], hhmm[2]);

    // hh:mm AM/PM
    const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (ampm) {
        let hour = Number(ampm[1]);
        const minute = Number(ampm[2]);
        const period = ampm[3].toUpperCase();
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '';
        if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return '';
        if (period === 'AM') hour = hour === 12 ? 0 : hour;
        if (period === 'PM') hour = hour === 12 ? 12 : hour + 12;
        return toHHMM(hour, minute);
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return toHHMM(parsed.getHours(), parsed.getMinutes());
    }

    return '';
};

const timeToMinutes = (value) => {
    const normalized = normalizeShopTime(value);
    if (!normalized) return null;
    const [h, m] = normalized.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
};

const parseEstimatedDeliveryMinutes = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const matches = raw.match(/\d+/g);
    if (!matches || !matches.length) return null;
    const numbers = matches.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0);
    if (!numbers.length) return null;
    return Math.round(numbers[numbers.length - 1]);
};

const toShopProfile = (doc) => {
    if (!doc) return null;
    const loc = doc.location && typeof doc.location === 'object' ? doc.location : null;
    const location =
        (loc?.formattedAddress ||
            loc?.address ||
            loc?.addressLine1 ||
            loc?.addressLine2 ||
            loc?.area ||
            loc?.city ||
            loc?.state ||
            loc?.pincode ||
            loc?.landmark ||
            doc.addressLine1 ||
            doc.addressLine2 ||
            doc.area ||
            doc.city ||
            doc.state ||
            doc.pincode ||
            doc.landmark)
            ? {
                type: loc?.type || 'Point',
                coordinates: Array.isArray(loc?.coordinates) ? loc.coordinates : undefined,
                latitude: typeof loc?.latitude === 'number' ? loc.latitude : (Array.isArray(loc?.coordinates) ? loc.coordinates[1] : undefined),
                longitude: typeof loc?.longitude === 'number' ? loc.longitude : (Array.isArray(loc?.coordinates) ? loc.coordinates[0] : undefined),
                formattedAddress: loc?.formattedAddress || loc?.address || '',
                address: loc?.address || loc?.formattedAddress || '',
                addressLine1: loc?.addressLine1 || doc.addressLine1 || '',
                addressLine2: loc?.addressLine2 || doc.addressLine2 || '',
                area: loc?.area || doc.area || '',
                city: loc?.city || doc.city || '',
                state: loc?.state || doc.state || '',
                pincode: loc?.pincode || doc.pincode || '',
                landmark: loc?.landmark || doc.landmark || ''
            }
            : null;

    const menuImages = Array.isArray(doc.menuImages)
        ? doc.menuImages.map((m) => toUrl(m)).filter(Boolean).map((url) => ({ url, publicId: null }))
        : [];
    const coverImages = Array.isArray(doc.coverImages)
        ? doc.coverImages.map((m) => toUrl(m)).filter(Boolean).map((url) => ({ url, publicId: null }))
        : [];

    return {
        id: doc._id,
        _id: doc._id,
        shopId: doc.shopId || undefined,
        name: doc.shopName || '',
        shopName: doc.shopName || '',
        zoneId: doc.zoneId ? String(doc.zoneId) : '',
        cuisines: Array.isArray(doc.cuisines) ? doc.cuisines : [],
        location,
        ownerName: doc.ownerName || '',
        ownerEmail: doc.ownerEmail || '',
        ownerPhone: doc.ownerPhone || '',
        primaryContactNumber: doc.primaryContactNumber || '',
        panNumber: doc.panNumber || '',
        nameOnPan: doc.nameOnPan || '',
        panImage: doc.panImage ? { url: doc.panImage } : null,
        gstRegistered: Boolean(doc.gstRegistered),
        gstNumber: doc.gstNumber || '',
        gstLegalName: doc.gstLegalName || '',
        gstAddress: doc.gstAddress || '',
        gstImage: doc.gstImage ? { url: doc.gstImage } : null,
        fssaiNumber: doc.fssaiNumber || '',
        fssaiExpiry: doc.fssaiExpiry || null,
        fssaiImage: doc.fssaiImage ? { url: doc.fssaiImage } : null,
        accountNumber: doc.accountNumber || '',
        ifscCode: doc.ifscCode || '',
        accountHolderName: doc.accountHolderName || '',
        accountType: doc.accountType || '',
        upiId: doc.upiId || '',
        upiQrImage: doc.upiQrImage ? { url: doc.upiQrImage } : null,
        pureVegShop: Boolean(doc.pureVegShop),
        zoneId: doc.zoneId ? String(doc.zoneId?._id || doc.zoneId) : '',
        zoneName: doc.zoneId?.name || doc.zoneId?.zoneName || doc.zoneId?.serviceLocation || '',
        profileImage: doc.profileImage ? { url: doc.profileImage } : null,
        menuImages,
        coverImages,
        openingTime: normalizeShopTime(doc.openingTime) || null,
        closingTime: normalizeShopTime(doc.closingTime) || null,
        openDays: Array.isArray(doc.openDays) ? doc.openDays : [],
        estimatedDeliveryTime: doc.estimatedDeliveryTime || '',
        featuredDish: doc.featuredDish || '',
        featuredPrice: doc.featuredPrice ?? null,
        offer: doc.offer || '',
        estimatedDeliveryTimeMinutes:
            Number.isFinite(Number(doc.estimatedDeliveryTimeMinutes))
                ? Number(doc.estimatedDeliveryTimeMinutes)
                : null,
        isAcceptingOrders: doc.isAcceptingOrders !== false,
        takeawayEnabled: doc.takeawayEnabled !== false,
        status: doc.status || null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        rating: normalizeRatingValue(doc.rating),
        totalRatings: normalizeTotalRatingsValue(doc.totalRatings)
    };
};

const toFiniteNumber = (value) => {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : null;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeCuisine = (value) => String(value || '').trim().slice(0, 80);

const parseSortBy = (value) => {
    const v = String(value || '').trim();
    const allowed = new Set(['nearest', 'rating', 'newest', 'deliveryTime', 'price-low', 'price-high', 'rating-high', 'rating-low']);
    return allowed.has(v) ? v : null;
};

const attachPriorityListingFlag = (shops = [], priorityShopIds = []) => {
    const priorityIdSet = new Set((priorityShopIds || []).map((id) => String(id)));
    return (shops || []).map((shop) => ({
        ...shop,
        isPriorityListing: priorityIdSet.has(String(shop?._id || shop?.id || shop?.shopId || '')),
    }));
};

const zoneToPolygon = (zoneDoc) => {
    const coords = Array.isArray(zoneDoc?.coordinates) ? zoneDoc.coordinates : [];
    if (coords.length < 3) return null;
    const ring = coords
        .map((c) => [Number(c.longitude), Number(c.latitude)])
        .filter((pair) => pair.every((n) => Number.isFinite(n)));
    if (ring.length < 3) return null;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    return { type: 'Polygon', coordinates: [ring] };
};

const buildZoneShopFilter = async (zoneIdRaw) => {
    const trimmedZoneId = String(zoneIdRaw || '').trim();
    if (!trimmedZoneId || !mongoose.Types.ObjectId.isValid(trimmedZoneId)) {
        return null;
    }

    const targetZoneId = new mongoose.Types.ObjectId(trimmedZoneId);
    const zoneDoc = await FoodZone.findOne({ _id: trimmedZoneId, isActive: true }).lean();
    const polygon = zoneToPolygon(zoneDoc);

    const clauses = [{ zoneId: targetZoneId }];
    if (polygon) {
        clauses.push({ location: { $geoWithin: { $geometry: polygon } } });
    }

    return { $or: clauses };
};

const notifyAdminsAboutShopProfileReview = async (shopId, shopName) => {
    try {
        const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
        void notifyAdminsSafely({
            title: 'Shop Profile Updated',
            body: `Shop "${shopName || 'Unknown Shop'}" updated its profile and is pending approval again.`,
            data: {
                type: 'shop_profile_updated',
                subType: 'shop',
                id: String(shopId)
            }
        });
    } catch (e) {
        console.error('Failed to notify admins of shop profile resubmission:', e);
    }
};

export const registerShop = async (payload, files) => {
    const {
        shopName,
        ownerName,
        ownerEmail,
        ownerPhone,
        primaryContactNumber,
        pureVegShop,
        addressLine1,
        addressLine2,
        area,
        city,
        state,
        pincode,
        landmark,
        formattedAddress,
        latitude,
        longitude,
        zoneId,
        cuisines,
        openingTime,
        closingTime,
        openDays,
        estimatedDeliveryTime,
        panNumber,
        nameOnPan,
        gstRegistered,
        gstNumber,
        gstLegalName,
        gstAddress,
        fssaiNumber,
        fssaiExpiry,
        accountNumber,
        ifscCode,
        accountHolderName,
        accountType,
        featuredDish,
        offer
    } = payload;

    if (!ownerPhone) {
        throw new ValidationError('Owner phone is required to register a shop');
    }

    const { digits: ownerPhoneDigits, last10: ownerPhoneLast10 } = normalizePhone(ownerPhone);
    if (!ownerPhoneLast10) {
        throw new ValidationError('Owner phone is invalid');
    }

    const shopNameNormalized = normalizeName(shopName);
    if (!shopNameNormalized) {
        throw new ValidationError('Shop name is required to register a shop');
    }

    const images = {};

    if (files?.profileImage?.[0]) {
        images.profileImage = await uploadImageBuffer(files.profileImage[0].buffer, 'food/shops/profile');
    }
    if (files?.panImage?.[0]) {
        images.panImage = await uploadImageBuffer(files.panImage[0].buffer, 'food/shops/pan');
    }
    if (files?.gstImage?.[0]) {
        images.gstImage = await uploadImageBuffer(files.gstImage[0].buffer, 'food/shops/gst');
    }
    if (files?.fssaiImage?.[0]) {
        images.fssaiImage = await uploadImageBuffer(files.fssaiImage[0].buffer, 'food/shops/fssai');
    }

    let menuImages = [];
    if (files?.menuImages?.length) {
        menuImages = await Promise.all(
            files.menuImages.map((file) => uploadImageBuffer(file.buffer, 'food/shops/menu'))
        );
    }

    const normalizedOpeningTime = normalizeShopTime(openingTime);
    const normalizedClosingTime = normalizeShopTime(closingTime);
    const openingMinutes = timeToMinutes(normalizedOpeningTime);
    const closingMinutes = timeToMinutes(normalizedClosingTime);
    if (openingMinutes !== null && closingMinutes !== null) {
        if (openingMinutes === closingMinutes) {
            throw new ValidationError('Opening time and closing time cannot be same');
        }

    }
    const estimatedDeliveryTimeText = String(estimatedDeliveryTime || '').trim();
    const estimatedDeliveryTimeMinutes = parseEstimatedDeliveryMinutes(estimatedDeliveryTimeText);

    try {
        const latNum = toFiniteNumber(latitude);
        const lngNum = toFiniteNumber(longitude);
        const shop = await FoodShop.create({
            shopName,
            shopNameNormalized,
            ownerName,
            ownerEmail,
            // Store phone in a consistent digits-only format to match OTP login flow.
            ownerPhone: ownerPhoneDigits,
            ownerPhoneDigits,
            ownerPhoneLast10,
            primaryContactNumber,
            pureVegShop: pureVegShop === true,
            zoneId: zoneId && mongoose.Types.ObjectId.isValid(String(zoneId).trim())
                ? new mongoose.Types.ObjectId(String(zoneId).trim())
                : undefined,
            // Store unified location object (geo + address).
            location: {
                type: 'Point',
                coordinates: latNum !== null && lngNum !== null ? [lngNum, latNum] : undefined,
                latitude: latNum ?? undefined,
                longitude: lngNum ?? undefined,
                formattedAddress: typeof formattedAddress === 'string' ? formattedAddress.trim() : '',
                address: typeof formattedAddress === 'string' ? formattedAddress.trim() : '',
                addressLine1: addressLine1 || '',
                addressLine2: addressLine2 || '',
                area: area || '',
                city: city || '',
                state: state || '',
                pincode: pincode || '',
                landmark: landmark || ''
            },
            cuisines: cuisines || [],
            openingTime: normalizedOpeningTime || undefined,
            closingTime: normalizedClosingTime || undefined,
            openDays: openDays || [],
            estimatedDeliveryTime: estimatedDeliveryTimeText || undefined,
            estimatedDeliveryTimeMinutes: estimatedDeliveryTimeMinutes ?? undefined,
            panNumber,
            nameOnPan,
            gstRegistered,
            gstNumber,
            gstLegalName,
            gstAddress,
            fssaiNumber,
            fssaiExpiry,
            accountNumber,
            ifscCode,
            accountHolderName,
            accountType,
            estimatedDeliveryTime: estimatedDeliveryTime || '',
            featuredDish: featuredDish || '',
            offer: offer || '',
            menuImages,
            ...images
        });
        await FoodShopCommission.updateOne(
            { shopId: shop._id },
            {
                $setOnInsert: {
                    defaultCommission: { type: 'percentage', value: 25 },
                    notes: '',
                    status: true
                }
            },
            { upsert: true }
        );

        try {
            const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
            void notifyAdminsSafely({
                title: 'New Shop Registration 🏪',
                body: `A new shop "${shop.shopName}" has registered and is pending approval.`,
                data: {
                    type: 'new_registration',
                    subType: 'shop',
                    id: String(shop._id)
                }
            });
        } catch (e) {
            console.error('Failed to notify admins of new shop registration:', e);
        }

        return shop.toObject();
    } catch (err) {
        // Handle uniqueness conflicts deterministically (race-safe).
        if (err && (err.code === 11000 || err?.name === 'MongoServerError')) {
            throw new ValidationError('Shop with this name and owner phone already exists');
        }
        throw err;
    }
};

export const getCurrentShopProfile = async (shopId) => {
    if (!shopId) return null;
    const doc = await FoodShop.findById(shopId)
        .select(
            [
                'shopName',
                'cuisines',
                'location',
                'addressLine1',
                'addressLine2',
                'area',
                'city',
                'state',
                'pincode',
                'landmark',
                'ownerName',
                'ownerEmail',
                'ownerPhone',
                'primaryContactNumber',
                'panNumber',
                'nameOnPan',
                'panImage',
                'gstRegistered',
                'gstNumber',
                'gstLegalName',
                'gstAddress',
                'gstImage',
                'fssaiNumber',
                'fssaiExpiry',
                'fssaiImage',
                'accountNumber',
                'ifscCode',
                'accountHolderName',
                'accountType',
                'upiId',
                'upiQrImage',
                'pureVegShop',
                'zoneId',
                'profileImage',
                'coverImages',
                'menuImages', 'featuredDish', 'offer', 'featuredPrice',
                'openingTime',
                'closingTime',
                'openDays',
                'estimatedDeliveryTime',
                'featuredDish',
                'featuredPrice',
                'offer',
                'estimatedDeliveryTimeMinutes',
                'isAcceptingOrders',
                'takeawayEnabled',
                'status',
                'createdAt',
                'updatedAt'
            ].join(' ')
        )
        .populate('zoneId', 'name zoneName serviceLocation')
        .lean();
    return toShopProfile(doc);
};

export const updateShopAcceptingOrders = async (shopId, isAcceptingOrders) => {
    if (!shopId) {
        throw new ValidationError('Invalid shop id');
    }
    const value = Boolean(isAcceptingOrders);
    const doc = await FoodShop.findByIdAndUpdate(
        shopId,
        { $set: { isAcceptingOrders: value } },
        {
            new: true,
            runValidators: true,
            projection: [
                'shopName',
                'cuisines',
                'location',
                'addressLine1',
                'addressLine2',
                'area',
                'city',
                'state',
                'pincode',
                'landmark',
                'ownerName',
                'ownerEmail',
                'ownerPhone',
                'primaryContactNumber',
                'accountNumber',
                'ifscCode',
                'accountHolderName',
                'accountType',
                'upiId',
                'upiQrImage',
                'pureVegShop',
                'profileImage',
                'coverImages',
                'menuImages', 'featuredDish', 'offer', 'featuredPrice',
                'openingTime',
                'closingTime',
                'openDays',
                'isAcceptingOrders',
                'takeawayEnabled',
                'status',
                'createdAt',
                'updatedAt'
            ].join(' ')
        }
    ).lean();
    return toShopProfile(doc);
};


export const updateShopProfile = async (shopId, body = {}, files = {}) => {
    if (!shopId) {
        throw new ValidationError('Invalid shop id');
    }

    const currentShop = await FoodShop.findById(shopId)
        .select([
            'shopName',
            'shopNameNormalized',
            'ownerPhone',
            'ownerPhoneDigits',
            'ownerPhoneLast10',
            'primaryContactNumber',
            'status',
            'location',
            'addressLine1',
            'addressLine2',
            'area',
            'city',
            'state',
            'pincode',
            'landmark',
            'zoneId',
            'fssaiNumber',
            'fssaiExpiry',
            'fssaiImage',
            'menuImages', 'featuredDish', 'offer', 'featuredPrice'
        ].join(' '))
        .lean();

    if (!currentShop) {
        throw new ValidationError('Shop not found');
    }

    const update = {};

    // Owner/contact fields (used by shop Contact Details screens)
    if (body.ownerName !== undefined) {
        const ownerName = String(body.ownerName || '').trim();
        if (!ownerName) {
            throw new ValidationError('Owner name cannot be empty');
        }
        if (ownerName.length > 120) {
            throw new ValidationError('Owner name is too long');
        }
        update.ownerName = ownerName;
    }

    if (body.ownerEmail !== undefined) {
        const ownerEmail = String(body.ownerEmail || '').trim().toLowerCase();
        if (ownerEmail) {
            const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!EMAIL_REGEX.test(ownerEmail)) {
                throw new ValidationError('Owner email is invalid');
            }
            if (ownerEmail.length > 254) {
                throw new ValidationError('Owner email is too long');
            }
            update.ownerEmail = ownerEmail;
        } else {
            update.ownerEmail = '';
        }
    }

    // Note: UI keeps phone read-only, but we accept it safely and normalize if sent.
    if (body.ownerPhone !== undefined) {
        const { digits, last10 } = normalizePhone(body.ownerPhone);
        if (!digits || digits.length < 8) {
            throw new ValidationError('Owner phone is invalid');
        }

        const currentOwnerPhoneDigits =
            currentShop.ownerPhoneDigits ||
            normalizePhone(currentShop.ownerPhone).digits ||
            '';

        if (digits !== currentOwnerPhoneDigits) {
            update.ownerPhone = digits;
            update.ownerPhoneDigits = digits;
            update.ownerPhoneLast10 = last10 || undefined;
        }
    }

    if (body.primaryContactNumber !== undefined) {
        const { digits } = normalizePhone(body.primaryContactNumber);
        const normalizedPrimaryContact =
            digits || String(body.primaryContactNumber || '').trim();
        const currentPrimaryContact =
            currentShop.primaryContactNumber != null
                ? String(currentShop.primaryContactNumber).trim()
                : '';

        if (normalizedPrimaryContact !== currentPrimaryContact) {
            update.primaryContactNumber = normalizedPrimaryContact;
        }
    }

    if (body.pureVegShop !== undefined) {
        if (typeof body.pureVegShop === 'boolean') {
            update.pureVegShop = body.pureVegShop;
        } else if (typeof body.pureVegShop === 'string') {
            const normalized = body.pureVegShop.trim().toLowerCase();
            if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
                update.pureVegShop = true;
            } else if (normalized === 'false' || normalized === '0' || normalized === 'no') {
                update.pureVegShop = false;
            } else {
                throw new ValidationError('pureVegShop must be a boolean');
            }
        } else {
            throw new ValidationError('pureVegShop must be a boolean');
        }
    }

    if (body.takeawayEnabled !== undefined) {
        if (typeof body.takeawayEnabled === 'boolean') {
            update.takeawayEnabled = body.takeawayEnabled;
        } else if (typeof body.takeawayEnabled === 'string') {
            const normalized = body.takeawayEnabled.trim().toLowerCase();
            if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
                update.takeawayEnabled = true;
            } else if (normalized === 'false' || normalized === '0' || normalized === 'no') {
                update.takeawayEnabled = false;
            } else {
                throw new ValidationError('takeawayEnabled must be a boolean');
            }
        } else {
            throw new ValidationError('takeawayEnabled must be a boolean');
        }
    }

    const hasFlatLocationFields = [
        'formattedAddress',
        'addressLine1',
        'addressLine2',
        'area',
        'city',
        'state',
        'pincode',
        'landmark',
        'latitude',
        'longitude'
    ].some((field) => body[field] !== undefined);

    const requiresReapproval = () => (
        body.location !== undefined ||
        hasFlatLocationFields ||
        body.zoneId !== undefined ||
        body.fssaiNumber !== undefined ||
        body.fssaiExpiry !== undefined ||
        body.fssaiImage !== undefined ||
        Boolean(files?.fssaiImage?.[0])
    );

    if (body.zoneId !== undefined) {
        const zoneId = String(body.zoneId || '').trim();
        update.zoneId = zoneId && mongoose.Types.ObjectId.isValid(zoneId)
            ? new mongoose.Types.ObjectId(zoneId)
            : undefined;
    }

    // Bank + UPI fields (Explore -> Update Bank Details page)
    if (body.accountHolderName !== undefined) {
        update.accountHolderName = String(body.accountHolderName || '').trim();
    }
    if (body.accountNumber !== undefined) {
        update.accountNumber = String(body.accountNumber || '').replace(/\s|-/g, '').trim();
    }
    if (body.ifscCode !== undefined) {
        update.ifscCode = String(body.ifscCode || '').trim().toUpperCase();
    }
    if (body.accountType !== undefined) {
        update.accountType = String(body.accountType || '').trim();
    }
    if (body.upiId !== undefined) {
        update.upiId = String(body.upiId || '').trim();
    }
    if (body.upiQrImage !== undefined || body.upiQrCode !== undefined) {
        const qrImage = body.upiQrImage !== undefined ? body.upiQrImage : body.upiQrCode;
        update.upiQrImage = String(qrImage || '').trim();
    }

    if (body.name !== undefined || body.shopName !== undefined) {
        const raw = body.name !== undefined ? body.name : body.shopName;
        const name = String(raw || '').trim();
        if (!name) {
            throw new ValidationError('Shop name cannot be empty');
        }
        const normalizedName = normalizeName(name) || undefined;
        const currentName = String(currentShop.shopName || '').trim();
        const currentNormalizedName =
            currentShop.shopNameNormalized || normalizeName(currentName) || undefined;

        if (name !== currentName || normalizedName !== currentNormalizedName) {
            update.shopName = name;
            update.shopNameNormalized = normalizedName;
        }
    }

    if (body.cuisines !== undefined) {
        const cuisineValues = Array.isArray(body.cuisines)
            ? body.cuisines
            : String(body.cuisines || '').split(',');
        const cuisines = cuisineValues
            .map((c) => String(c || '').trim())
            .filter(Boolean)
            .slice(0, 50);
        update.cuisines = cuisines;
    }

    if (body.location !== undefined || hasFlatLocationFields) {
        const loc = body.location && typeof body.location === 'object'
            ? body.location
            : {
                formattedAddress: body.formattedAddress,
                address: body.formattedAddress,
                addressLine1: body.addressLine1,
                addressLine2: body.addressLine2,
                area: body.area,
                city: body.city,
                state: body.state,
                pincode: body.pincode,
                landmark: body.landmark,
                latitude: body.latitude,
                longitude: body.longitude
            };
        if (!loc) {
            throw new ValidationError('Location must be an object');
        }
        const toStr = (v) => (v != null ? String(v).trim() : '');
        const formattedAddress = toStr(loc.formattedAddress || loc.address);
        update.addressLine1 = toStr(loc.addressLine1);
        update.addressLine2 = toStr(loc.addressLine2);
        update.area = toStr(loc.area);
        update.city = toStr(loc.city);
        update.state = toStr(loc.state);
        update.pincode = toStr(loc.pincode);
        update.landmark = toStr(loc.landmark);

        // Optional geo coords for server-side distance filtering.
        const lat = toFiniteNumber(loc.latitude);
        const lng = toFiniteNumber(loc.longitude);
        update.location = {
            type: 'Point',
            coordinates: lat !== null && lng !== null ? [lng, lat] : undefined,
            latitude: lat ?? undefined,
            longitude: lng ?? undefined,
            formattedAddress,
            address: formattedAddress,
            addressLine1: toStr(loc.addressLine1),
            addressLine2: toStr(loc.addressLine2),
            area: toStr(loc.area),
            city: toStr(loc.city),
            state: toStr(loc.state),
            pincode: toStr(loc.pincode),
            landmark: toStr(loc.landmark)
        };
    }

    if (body.openingTime !== undefined) {
        update.openingTime = normalizeShopTime(body.openingTime) || '';
    }
    if (body.closingTime !== undefined) {
        update.closingTime = normalizeShopTime(body.closingTime) || '';
    }
    if (body.openDays !== undefined) {
        if (!Array.isArray(body.openDays) && typeof body.openDays !== 'string') {
            throw new ValidationError('openDays must be an array or comma-separated string');
        }
        const daysArray = Array.isArray(body.openDays)
            ? body.openDays
            : body.openDays.split(',').map(d => d.trim()).filter(Boolean);
        update.openDays = daysArray
            .map((day) => String(day || '').trim())
            .filter(Boolean)
            .slice(0, 7);
    }
    if (body.featuredDish !== undefined) { update.featuredDish = String(body.featuredDish || '').trim(); } if (body.offer !== undefined) { update.offer = String(body.offer || '').trim(); } if (body.featuredPrice !== undefined) { update.featuredPrice = Number(body.featuredPrice) || null; } if (body.estimatedDeliveryTime !== undefined) {
        const estimatedDeliveryTimeText = String(body.estimatedDeliveryTime || '').trim();
        update.estimatedDeliveryTime = estimatedDeliveryTimeText;
        update.estimatedDeliveryTimeMinutes = parseEstimatedDeliveryMinutes(estimatedDeliveryTimeText) ?? undefined;
    }

    const openingMinutes = body.openingTime !== undefined ? timeToMinutes(update.openingTime) : null;
    const closingMinutes = body.closingTime !== undefined ? timeToMinutes(update.closingTime) : null;
    if (openingMinutes !== null && closingMinutes !== null) {
        if (openingMinutes === closingMinutes) {
            throw new ValidationError('Opening time and closing time cannot be same');
        }

    }

    if (body.menuImages !== undefined) {
        if (!Array.isArray(body.menuImages)) {
            body.menuImages = [body.menuImages];
        }
        const urls = body.menuImages
            .map((m) => toUrl(m))
            .filter(Boolean)
            .slice(0, 20);
        update.menuImages = urls;
    }

    if (body.coverImages !== undefined) {
        if (!Array.isArray(body.coverImages)) {
            throw new ValidationError('coverImages must be an array');
        }
        const urls = body.coverImages
            .map((m) => toUrl(m))
            .filter(Boolean)
            .slice(0, 20);
        update.coverImages = urls;
    }

    if (body.profileImage !== undefined) {
        update.profileImage = toUrl(body.profileImage) || '';
    }

    if (body.panNumber !== undefined) {
        update.panNumber = String(body.panNumber || '').trim().toUpperCase();
    }
    if (body.nameOnPan !== undefined) {
        update.nameOnPan = String(body.nameOnPan || '').trim();
    }
    if (body.panImage !== undefined) {
        update.panImage = toUrl(body.panImage) || '';
    }
    if (body.gstRegistered !== undefined) {
        if (typeof body.gstRegistered === 'boolean') {
            update.gstRegistered = body.gstRegistered;
        } else if (typeof body.gstRegistered === 'string') {
            const normalized = body.gstRegistered.trim().toLowerCase();
            if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
                update.gstRegistered = true;
            } else if (normalized === 'false' || normalized === '0' || normalized === 'no') {
                update.gstRegistered = false;
            } else {
                throw new ValidationError('gstRegistered must be a boolean');
            }
        } else {
            throw new ValidationError('gstRegistered must be a boolean');
        }
    }
    if (body.gstNumber !== undefined) {
        update.gstNumber = String(body.gstNumber || '').trim().toUpperCase();
    }
    if (body.gstLegalName !== undefined) {
        update.gstLegalName = String(body.gstLegalName || '').trim();
    }
    if (body.gstAddress !== undefined) {
        update.gstAddress = String(body.gstAddress || '').trim();
    }
    if (body.gstImage !== undefined) {
        update.gstImage = toUrl(body.gstImage) || '';
    }
    if (body.fssaiNumber !== undefined) {
        update.fssaiNumber = String(body.fssaiNumber || '').trim();
    }
    if (body.fssaiExpiry !== undefined) {
        const rawExpiry = String(body.fssaiExpiry || '').trim();
        if (!rawExpiry) {
            update.fssaiExpiry = null;
        } else {
            const parsedExpiry = new Date(rawExpiry);
            if (Number.isNaN(parsedExpiry.getTime())) {
                throw new ValidationError('FSSAI expiry date is invalid');
            }
            update.fssaiExpiry = parsedExpiry;
        }
    }
    if (body.fssaiImage !== undefined) {
        update.fssaiImage = toUrl(body.fssaiImage) || '';
    }

    if (files?.profileImage?.[0]) {
        update.profileImage = await uploadImageBuffer(files.profileImage[0].buffer, 'food/shops/profile');
    }
    if (files?.panImage?.[0]) {
        update.panImage = await uploadImageBuffer(files.panImage[0].buffer, 'food/shops/pan');
    }
    if (files?.gstImage?.[0]) {
        update.gstImage = await uploadImageBuffer(files.gstImage[0].buffer, 'food/shops/gst');
    }
    if (files?.fssaiImage?.[0]) {
        update.fssaiImage = await uploadImageBuffer(files.fssaiImage[0].buffer, 'food/shops/fssai');
    }
    if (Array.isArray(files?.menuImages) && files.menuImages.length) {
        const uploadedMenuImages = await Promise.all(
            files.menuImages.slice(0, 20).map((file) => uploadImageBuffer(file.buffer, 'food/shops/menu'))
        );
        const existingMenuImages = Array.isArray(update.menuImages)
            ? update.menuImages
            : (Array.isArray(currentShop.menuImages)
                ? currentShop.menuImages.map((image) => toUrl(image)).filter(Boolean)
                : []);
        update.menuImages = [...existingMenuImages, ...uploadedMenuImages]
            .filter(Boolean)
            .slice(0, 20);
    }

    if (!Object.keys(update).length) {
        return getCurrentShopProfile(shopId);
    }

    const shouldRequireReapproval = requiresReapproval();
    if (shouldRequireReapproval) {
        update.status = 'pending';
    }

    try {
        const doc = await FoodShop.findByIdAndUpdate(
            shopId,
            shouldRequireReapproval
                ? {
                    $set: update,
                    $unset: {
                        approvedAt: 1,
                        rejectedAt: 1,
                        rejectionReason: 1
                    }
                }
                : {
                    $set: update
                },
            {
                new: true,
                runValidators: true,
                projection: [
                    'shopName',
                    'cuisines',
                    'location',
                    'addressLine1',
                    'addressLine2',
                    'area',
                    'city',
                    'state',
                    'pincode',
                    'landmark',
                    'ownerName',
                    'ownerEmail',
                    'ownerPhone',
                    'primaryContactNumber',
                'pureVegShop',
                'profileImage',
                'coverImages',
                'menuImages', 'featuredDish', 'offer', 'featuredPrice',
                    'openingTime',
                    'closingTime',
                    'openDays',
                    'status',
                    'createdAt',
                    'updatedAt',
                    'panNumber',
                    'nameOnPan',
                    'panImage',
                    'gstRegistered',
                    'gstNumber',
                    'gstLegalName',
                    'gstAddress',
                    'gstImage',
                    'fssaiNumber',
                    'fssaiExpiry',
                    'fssaiImage',
                    'accountNumber',
                    'ifscCode',
                    'accountHolderName',
                    'accountType',
                    'upiId',
                    'upiQrImage',
                    'estimatedDeliveryTime',
                    'estimatedDeliveryTimeMinutes',
                    'zoneId',
                    'takeawayEnabled'
                ].join(' ')
            }
        ).lean();

        if (shouldRequireReapproval && currentShop.status !== 'pending') {
            const shopNameForNotification =
                update.shopName || currentShop.shopName || doc?.shopName;
            void notifyAdminsAboutShopProfileReview(shopId, shopNameForNotification);
        }

        return toShopProfile(doc);
    } catch (err) {
        if (err && err.code === 11000) {
            throw new ValidationError('A shop with this name and phone already exists');
        }
        throw err;
    }
};

export const uploadShopProfileImage = async (shopId, file) => {
    if (!shopId) throw new ValidationError('Invalid shop id');
    if (!file?.buffer) throw new ValidationError('Image file is required');

    const currentShop = await FoodShop.findById(shopId)
        .select('shopName status')
        .lean();
    if (!currentShop) throw new ValidationError('Shop not found');

    const url = await uploadImageBuffer(file.buffer, 'food/shops/profile');
    const doc = await FoodShop.findByIdAndUpdate(
        shopId,
        {
            $set: {
                profileImage: url,
                status: 'pending'
            },
            $unset: {
                approvedAt: 1,
                rejectedAt: 1,
                rejectionReason: 1
            }
        },
        { new: true, projection: 'profileImage coverImages shopName cuisines location menuImages addressLine1 addressLine2 area city state pincode landmark ownerName ownerEmail ownerPhone primaryContactNumber pureVegShop openingTime closingTime openDays status createdAt updatedAt' }
    ).lean();

    if (!doc) throw new ValidationError('Shop not found');

    if (currentShop.status !== 'pending') {
        void notifyAdminsAboutShopProfileReview(shopId, currentShop.shopName || doc.shopName);
    }

    return { profileImage: { url } };
};

export const uploadShopMenuImage = async (file) => {
    if (!file?.buffer) throw new ValidationError('Image file is required');
    const url = await uploadImageBuffer(file.buffer, 'food/shops/menu');
    return { menuImage: { url, publicId: null } };
};

export const uploadShopCoverImages = async (shopId, files = []) => {
    if (!shopId) throw new ValidationError('Invalid shop id');
    if (!Array.isArray(files) || files.length === 0) {
        throw new ValidationError('At least one image file is required');
    }

    const validFiles = files.filter((file) => file?.buffer);
    if (validFiles.length === 0) {
        throw new ValidationError('At least one valid image file is required');
    }

    const currentShop = await FoodShop.findById(shopId)
        .select('shopName status profileImage coverImages')
        .lean();
    if (!currentShop) throw new ValidationError('Shop not found');

    const uploadedUrls = await Promise.all(
        validFiles.slice(0, 20).map((file) => uploadImageBuffer(file.buffer, 'food/shops/cover'))
    );
    const existingCoverImages = Array.isArray(currentShop.coverImages)
        ? currentShop.coverImages.map((image) => toUrl(image)).filter(Boolean)
        : [];
    const nextCoverImages = [...existingCoverImages];

    uploadedUrls.forEach((url) => {
        if (!nextCoverImages.includes(url)) nextCoverImages.push(url);
    });

    const update = {
        coverImages: nextCoverImages.slice(0, 20),
        status: 'pending'
    };

    if (!toUrl(currentShop.profileImage) && uploadedUrls[0]) {
        update.profileImage = uploadedUrls[0];
    }

    await FoodShop.findByIdAndUpdate(
        shopId,
        {
            $set: update,
            $unset: {
                approvedAt: 1,
                rejectedAt: 1,
                rejectionReason: 1
            }
        },
        { new: true }
    ).lean();

    if (currentShop.status !== 'pending') {
        void notifyAdminsAboutShopProfileReview(shopId, currentShop.shopName || '');
    }

    return {
        coverImages: uploadedUrls.map((url) => ({ url, publicId: null })),
        profileImage: update.profileImage ? { url: update.profileImage } : undefined
    };
};

export const uploadShopMenuImages = async (shopId, files = []) => {
    if (!shopId) throw new ValidationError('Invalid shop id');
    if (!Array.isArray(files) || files.length === 0) {
        throw new ValidationError('At least one image file is required');
    }

    const validFiles = files.filter((file) => file?.buffer);
    if (validFiles.length === 0) {
        throw new ValidationError('At least one valid image file is required');
    }

    const currentShop = await FoodShop.findById(shopId)
        .select('shopName status menuImages')
        .lean();
    if (!currentShop) throw new ValidationError('Shop not found');

    const uploadedUrls = await Promise.all(
        validFiles.slice(0, 20).map((file) => uploadImageBuffer(file.buffer, 'food/shops/menu'))
    );
    const existingMenuImages = Array.isArray(currentShop.menuImages)
        ? currentShop.menuImages.map((image) => toUrl(image)).filter(Boolean)
        : [];
    const nextMenuImages = [...existingMenuImages];

    uploadedUrls.forEach((url) => {
        if (!nextMenuImages.includes(url)) nextMenuImages.push(url);
    });

    await FoodShop.findByIdAndUpdate(
        shopId,
        {
            $set: {
                menuImages: nextMenuImages.slice(0, 20),
                status: 'pending'
            },
            $unset: {
                approvedAt: 1,
                rejectedAt: 1,
                rejectionReason: 1
            }
        },
        { new: true }
    ).lean();

    if (currentShop.status !== 'pending') {
        void notifyAdminsAboutShopProfileReview(shopId, currentShop.shopName || '');
    }

    return {
        menuImages: uploadedUrls.map((url) => ({ url, publicId: null }))
    };
};

export const listApprovedShops = async (query = {}) => {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const filter = { status: 'approved' };

    if (query.city && String(query.city).trim()) {
        const city = String(query.city).trim().slice(0, 80);
        const rx = { $regex: escapeRegex(city), $options: 'i' };
        filter.$and = [...(filter.$and || []), { $or: [{ 'location.city': rx }, { city: rx }] }];
    }
    if (query.area && String(query.area).trim()) {
        const area = String(query.area).trim().slice(0, 80);
        const rx = { $regex: escapeRegex(area), $options: 'i' };
        filter.$and = [...(filter.$and || []), { $or: [{ 'location.area': rx }, { area: rx }] }];
    }
    if (query.cuisine && String(query.cuisine).trim()) {
        const cuisine = normalizeCuisine(query.cuisine);
        // cuisines is an array of strings.
        filter.cuisines = { $in: [new RegExp(escapeRegex(cuisine), 'i')] };
    }
    if (query.hasOffers === 'true') {
        filter.offer = { $exists: true, $ne: null, $ne: '' };
    }
    const minRating = toFiniteNumber(query.minRating);
    if (minRating !== null) {
        filter.rating = { $gte: Math.max(0, Math.min(5, minRating)) };
    }
    const maxDeliveryTime = toFiniteNumber(query.maxDeliveryTime);
    if (maxDeliveryTime !== null) {
        filter.estimatedDeliveryTimeMinutes = { $lte: Math.max(0, Math.round(maxDeliveryTime)) };
    }
    const maxPrice = toFiniteNumber(query.maxPrice);
    if (maxPrice !== null) {
        filter.featuredPrice = { $lte: Math.max(0, maxPrice) };
    }
    if (query.topRated === 'true') {
        filter.rating = { ...(filter.rating || {}), $gte: 4.5 };
    }
    if (query.trusted === 'true') {
        filter.totalRatings = { ...(filter.totalRatings || {}), $gte: 100 };
    }
    if (query.search && String(query.search).trim()) {
        const raw = String(query.search).trim().slice(0, 80);
        const term = escapeRegex(raw);
        if (term.length >= 2) {
            filter.$or = [
                { shopName: { $regex: term, $options: 'i' } },
                { area: { $regex: term, $options: 'i' } },
                { city: { $regex: term, $options: 'i' } },
                { 'location.area': { $regex: term, $options: 'i' } },
                { 'location.city': { $regex: term, $options: 'i' } },
                { cuisines: { $in: [new RegExp(term, 'i')] } }
            ];
        }
    }

    // Optional zone polygon filter (when shop.zoneId is not set yet).
    const zoneFilter = await buildZoneShopFilter(query.zoneId);
    if (zoneFilter) {
        filter.$and = [...(filter.$and || []), zoneFilter];
    }

    const visibleShopIds = await FoodItem.distinct('shopId', {
        $or: [
            { approvalStatus: 'approved' },
            { approvalStatus: null, isApproved: { $ne: false } },
            { approvalStatus: { $exists: false }, isApproved: { $ne: false } }
        ]
    });
    const visibleShopObjectIds = visibleShopIds
        .map((id) => String(id || '').trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

    if (!visibleShopObjectIds.length) {
        return { shops: [], shops: [], total: 0, page, limit };
    }

    filter._id = { $in: visibleShopObjectIds };

    const lat = toFiniteNumber(query.lat);
    const lng = toFiniteNumber(query.lng);
    // Accept both radiusKm (preferred) and maxDistance (legacy frontend param).
    const radiusKm = toFiniteNumber(query.radiusKm) ?? toFiniteNumber(query.maxDistance);
    const sortBy = parseSortBy(query.sortBy);
    const shouldApplyPriorityListing =
        Boolean(query.zoneId && mongoose.Types.ObjectId.isValid(String(query.zoneId).trim()));
    const priorityShopIds = shouldApplyPriorityListing
        ? await getPriorityListingShopIds(visibleShopObjectIds.map((id) => String(id)))
        : [];
    const priorityShopObjectIds = priorityShopIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

    const projection = {
        shopName: 1,
        area: 1,
        city: 1,
        cuisines: 1,
        profileImage: 1,
        coverImages: 1,
        menuImages: 1,
        estimatedDeliveryTime: 1,
        estimatedDeliveryTimeMinutes: 1,
        offer: 1,
        featuredDish: 1,
        featuredPrice: 1,
        takeawayEnabled: 1,
        rating: 1,
        totalRatings: 1,
        isAcceptingOrders: 1,
        status: 1,
        pureVegShop: 1,
        createdAt: 1,
        zoneId: 1,
        location: 1,
        openingTime: 1,
        closingTime: 1,
        openDays: 1
    };

    // Use $geoNear only when geo is explicitly needed (radius filter or nearest sorting).
    // This avoids accidentally hiding shops that do not have coordinates yet.
    const wantsGeo = (radiusKm !== null) || sortBy === 'nearest';
    if (lat !== null && lng !== null && wantsGeo) {
        const geoNear = {
            $geoNear: {
                near: { type: 'Point', coordinates: [lng, lat] },
                distanceField: 'distanceMeters',
                spherical: true,
                query: filter
            }
        };
        if (radiusKm !== null) {
            geoNear.$geoNear.maxDistance = Math.max(0.1, radiusKm) * 1000;
        }

        const sortStage = (() => {
            if (sortBy === 'rating' || sortBy === 'rating-high') return { $sort: { rating: -1, distanceMeters: 1 } };
            if (sortBy === 'rating-low') return { $sort: { rating: 1, distanceMeters: 1 } };
            if (sortBy === 'price-low') return { $sort: { featuredPrice: 1, distanceMeters: 1 } };
            if (sortBy === 'price-high') return { $sort: { featuredPrice: -1, distanceMeters: 1 } };
            if (sortBy === 'newest') return { $sort: { createdAt: -1 } };
            if (sortBy === 'deliveryTime') return { $sort: { estimatedDeliveryTimeMinutes: 1, distanceMeters: 1 } };
            // nearest (default)
            return { $sort: { distanceMeters: 1 } };
        })();

        const basePipeline = [
            geoNear,
            {
                $addFields: {
                    distanceInKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 2] }
                }
            },
            sortStage
        ];

        if (!priorityShopObjectIds.length) {
            const [pageDocs, totalDocs] = await Promise.all([
                FoodShop.aggregate([
                    ...basePipeline,
                    { $project: projection },
                    { $skip: skip },
                    { $limit: limit }
                ]),
                FoodShop.aggregate([...basePipeline, { $count: 'count' }])
            ]);

            const total = totalDocs?.[0]?.count || 0;
            const shops = attachPriorityListingFlag(pageDocs, priorityShopIds);
            return {
                shops: shops,
                shops,
                total,
                page,
                limit
            };
        }

        const priorityFilter = { ...filter, _id: { $in: priorityShopObjectIds } };
        const normalFilter = { ...filter, _id: { $nin: priorityShopObjectIds, $in: visibleShopObjectIds } };
        const priorityPipeline = [
            {
                ...geoNear,
                $geoNear: {
                    ...geoNear.$geoNear,
                    query: priorityFilter
                }
            },
            ...basePipeline.slice(1)
        ];
        const normalPipeline = [
            {
                ...geoNear,
                $geoNear: {
                    ...geoNear.$geoNear,
                    query: normalFilter
                }
            },
            ...basePipeline.slice(1)
        ];

        const [priorityCountDocs, normalCountDocs] = await Promise.all([
            FoodShop.aggregate([...priorityPipeline, { $count: 'count' }]),
            FoodShop.aggregate([...normalPipeline, { $count: 'count' }])
        ]);

        const priorityCount = priorityCountDocs?.[0]?.count || 0;
        const normalCount = normalCountDocs?.[0]?.count || 0;
        const total = priorityCount + normalCount;
        const prioritySkip = Math.min(skip, priorityCount);
        const priorityLimit = Math.max(0, Math.min(limit, priorityCount - prioritySkip));
        const normalSkip = Math.max(0, skip - priorityCount);
        const normalLimit = Math.max(0, limit - priorityLimit);

        const [priorityDocs, normalDocs] = await Promise.all([
            priorityLimit > 0
                ? FoodShop.aggregate([
                    ...priorityPipeline,
                    { $project: projection },
                    { $skip: prioritySkip },
                    { $limit: priorityLimit }
                ])
                : Promise.resolve([]),
            normalLimit > 0
                ? FoodShop.aggregate([
                    ...normalPipeline,
                    { $project: projection },
                    { $skip: normalSkip },
                    { $limit: normalLimit }
                ])
                : Promise.resolve([])
        ]);

        const shops = attachPriorityListingFlag([...priorityDocs, ...normalDocs], priorityShopIds);
        return {
            shops: shops,
            shops,
            total,
            page,
            limit
        };
    }

    // Non-geo path: normal query + sort.
    const sort = (() => {
        if (sortBy === 'rating' || sortBy === 'rating-high') return { rating: -1, createdAt: -1 };
        if (sortBy === 'rating-low') return { rating: 1, createdAt: -1 };
        if (sortBy === 'price-low') return { featuredPrice: 1, createdAt: -1 };
        if (sortBy === 'price-high') return { featuredPrice: -1, createdAt: -1 };
        if (sortBy === 'deliveryTime') return { estimatedDeliveryTimeMinutes: 1, createdAt: -1 };
        return { createdAt: -1 };
    })();

    let shopsRaw = [];
    let total = 0;

    if (!priorityShopObjectIds.length) {
        [shopsRaw, total] = await Promise.all([
            FoodShop.find(filter)
                .select(Object.keys(projection).join(' '))
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            FoodShop.countDocuments(filter)
        ]);
    } else {
        const priorityFilter = { ...filter, _id: { $in: priorityShopObjectIds } };
        const normalFilter = { ...filter, _id: { $nin: priorityShopObjectIds, $in: visibleShopObjectIds } };

        const [priorityCount, normalCount] = await Promise.all([
            FoodShop.countDocuments(priorityFilter),
            FoodShop.countDocuments(normalFilter)
        ]);

        total = priorityCount + normalCount;
        const prioritySkip = Math.min(skip, priorityCount);
        const priorityLimit = Math.max(0, Math.min(limit, priorityCount - prioritySkip));
        const normalSkip = Math.max(0, skip - priorityCount);
        const normalLimit = Math.max(0, limit - priorityLimit);

        const [priorityDocs, normalDocs] = await Promise.all([
            priorityLimit > 0
                ? FoodShop.find(priorityFilter)
                    .select(Object.keys(projection).join(' '))
                    .sort(sort)
                    .skip(prioritySkip)
                    .limit(priorityLimit)
                    .lean()
                : Promise.resolve([]),
            normalLimit > 0
                ? FoodShop.find(normalFilter)
                    .select(Object.keys(projection).join(' '))
                    .sort(sort)
                    .skip(normalSkip)
                    .limit(normalLimit)
                    .lean()
                : Promise.resolve([])
        ]);

        shopsRaw = [...priorityDocs, ...normalDocs];
    }

    const shops = (shopsRaw || []).map((r) => ({
        ...r,
        // Frontend user app expects `name` and often checks `profileImage.url`
        shopId: r._id,
        id: r._id,
        name: r.shopName || '',
        zoneId: r.zoneId ? String(r.zoneId?._id || r.zoneId) : '',
        rating: normalizeRatingValue(r.rating),
        totalRatings: normalizeTotalRatingsValue(r.totalRatings),
        profileImage: r.profileImage ? { url: r.profileImage } : null,
        coverImages: Array.isArray(r.coverImages) ? r.coverImages : [],
        openingTime: r.openingTime || null,
        closingTime: r.closingTime || null,
        openDays: Array.isArray(r.openDays) ? r.openDays : [],
        takeawayEnabled: r.takeawayEnabled !== false,
        isPriorityListing: priorityShopIds.includes(String(r._id)),
        // Keep menuImages as an array for fallbacks; allow both string and {url} on client.
        menuImages: Array.isArray(r.menuImages) ? r.menuImages : []
    }));

    return { shops, shops: shops, total, page, limit };
};

export const getApprovedShopByIdOrSlug = async (idOrSlug) => {
    const value = String(idOrSlug || '').trim();
    if (!value) return null;

    // ObjectId path
    if (/^[0-9a-fA-F]{24}$/.test(value)) {
        const doc = await FoodShop.findOne({ _id: value, status: 'approved' }).lean();
        if (!doc) return null;
        return {
            ...doc,
            rating: normalizeRatingValue(doc.rating),
            totalRatings: normalizeTotalRatingsValue(doc.totalRatings)
        };
    }

    // Slug path: use normalized field for index-friendly exact match.
    const shopNameNormalized = normalizeName(value);
    if (!shopNameNormalized) return null;

    const doc = await FoodShop.findOne({
        status: 'approved',
        shopNameNormalized
    }).lean();
    if (!doc) return null;
    return {
        ...doc,
        rating: normalizeRatingValue(doc.rating),
        totalRatings: normalizeTotalRatingsValue(doc.totalRatings)
    };
};

export const listPublicOffers = async (query = {}, userId = null) => {
    const now = new Date();
    const shopIdRaw = String(query?.shopId || '').trim();
    const hasShopFilter = mongoose.Types.ObjectId.isValid(shopIdRaw);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const filter = {
        status: 'active',
        approvalStatus: 'approved',
        $and: [
            { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: endOfToday } }] },
            { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: todayStart } }] }
        ],
        showInCart: { $ne: false }
    };

    let list = await FoodOffer.find(filter)
        .sort({ createdAt: -1 })
        .populate({ path: 'shopId', select: 'shopName shopNameNormalized profileImage estimatedDeliveryTime rating' })
        .lean();

    // 1. Filter expired/not-started coupons (endDate valid till end-of-day) and globally exhausted coupons
    list = list.filter(o => {
        if (hasShopFilter) {
            const scope = String(o?.shopScope || '').toLowerCase();
            const offerShopId = String(o?.shopId?._id || o?.shopId || '').trim();
            const isApplicableForShop =
                scope === 'all' ||
                (scope === 'selected' && offerShopId === shopIdRaw);
            if (!isApplicableForShop) return false;
        }
        if (o?.startDate) {
            const start = new Date(o.startDate);
            if (!Number.isNaN(start.getTime())) {
                start.setHours(0, 0, 0, 0);
                if (now < start) return false;
            }
        }
        if (o?.endDate) {
            const expiry = new Date(o.endDate);
            if (!Number.isNaN(expiry.getTime())) {
                expiry.setHours(23, 59, 59, 999);
                if (now > expiry) return false;
            }
        }
        if (!o.usageLimit) return true; // null, 0, or missing means unlimited
        const used = o.usedCount || 0;
        return used < o.usageLimit;
    });

    // 2. If userId is provided, filter based on personal usage limits
    if (userId && list.length > 0) {
        const offerIds = list.map((o) => o._id);
        const usages = await FoodOfferUsage.find({
            userId: new mongoose.Types.ObjectId(String(userId)),
            offerId: { $in: offerIds }
        }).lean();

        const usageMap = new Map(usages.map((u) => [String(u.offerId), u.count]));

        list = list.filter((o) => {
            if (o.perUserLimit != null && o.perUserLimit > 0) {
                const userCount = usageMap.get(String(o._id)) || 0;
                return userCount < o.perUserLimit;
            }
            return true;
        });
    }

    const allOffers = list.map((o) => {
        const shop = o.shopId && typeof o.shopId === 'object' ? o.shopId : null;
        const shopSlug = shop?.shopNameNormalized || undefined;
        const shopName =
            o.shopScope === 'selected'
                ? (shop?.shopName || 'Selected Shop')
                : 'All Shops';

        const title =
            o.discountType === 'percentage'
                ? `${Number(o.discountValue) || 0}% OFF`
                : `Flat ₹${Number(o.discountValue) || 0} OFF`;

        return {
            id: String(o._id),
            offerId: String(o._id),
            couponCode: o.couponCode,
            title,
            discountType: o.discountType,
            discountValue: o.discountValue,
            maxDiscount: o.maxDiscount ?? null,
            customerScope: o.customerScope,
            shopScope: o.shopScope,
            shopId: shop?._id ? String(shop._id) : (o.shopScope === 'selected' ? String(o.shopId) : null),
            shopName,
            shopSlug,
            shopImage: shop?.profileImage || null,
            deliveryTime: shop?.estimatedDeliveryTime || null,
            shopRating: typeof shop?.rating === 'number' ? shop.rating : 0,
            endDate: o.endDate || null,
            showInCart: o.showInCart !== false,
            minOrderValue: o.minOrderValue ?? 0
        };
    });

    return { allOffers, groupedByOffer: {} };
};

/**
 * List complaints for a shop.
 * Calls adminService.getShopComplaints with fixed shopId.
 */
export const getShopComplaints = async (shopId, query = {}) => {
    const { getShopComplaints: getComplaintsInternal } = await import('../../admin/services/admin.service.js');
    return getComplaintsInternal({ ...query, shopId });
};

