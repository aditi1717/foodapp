import crypto from 'crypto';
import { FoodUser } from './user.model.js';

const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_REFERRAL_CODE_LENGTH = 6;
const MAX_REFERRAL_CODE_ATTEMPTS = 25;

export const normalizeReferralCode = (value) =>
    String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

export const looksLikeLegacyReferralCode = (value) => /^[a-f0-9]{24}$/i.test(String(value || '').trim());

const generateReferralCodeCandidate = (length = DEFAULT_REFERRAL_CODE_LENGTH) => {
    const bytes = crypto.randomBytes(length);
    let code = '';
    for (let index = 0; index < length; index += 1) {
        code += REFERRAL_CODE_ALPHABET[bytes[index] % REFERRAL_CODE_ALPHABET.length];
    }
    return code;
};

export const generateUniqueUserReferralCode = async ({
    length = DEFAULT_REFERRAL_CODE_LENGTH,
    excludeUserId = null
} = {}) => {
    for (let attempt = 0; attempt < MAX_REFERRAL_CODE_ATTEMPTS; attempt += 1) {
        const candidate = generateReferralCodeCandidate(length);
        const existing = await FoodUser.exists({
            referralCode: candidate,
            ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {})
        });
        if (!existing) return candidate;
    }

    return generateUniqueUserReferralCode({
        length: length + 1,
        excludeUserId
    });
};

export const ensureUserReferralCode = async (userDoc) => {
    if (!userDoc?._id) return userDoc;

    const normalizedExisting = normalizeReferralCode(userDoc.referralCode);
    const shouldReplaceExisting =
        !normalizedExisting ||
        looksLikeLegacyReferralCode(normalizedExisting);

    if (!shouldReplaceExisting && normalizedExisting === userDoc.referralCode) {
        return userDoc;
    }

    const referralCode = shouldReplaceExisting
        ? await generateUniqueUserReferralCode({ excludeUserId: userDoc._id })
        : normalizedExisting;

    userDoc.referralCode = referralCode;
    await userDoc.save();
    return userDoc;
};
