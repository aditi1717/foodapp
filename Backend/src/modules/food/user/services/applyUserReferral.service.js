import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { normalizeReferralCode } from '../../../../core/users/referralCode.util.js';
import { FoodReferralSettings } from '../../admin/models/referralSettings.model.js';
import { FoodReferralLog } from '../../admin/models/referralLog.model.js';
import { creditReferralReward } from './userWallet.service.js';

export const applyUserReferral = async (userId, referralCodeRaw) => {
    const referralCode = normalizeReferralCode(referralCodeRaw);
    if (!referralCode) {
        return { applied: false, skipped: true, reason: 'empty_referral_code' };
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
        throw new ValidationError('Invalid user');
    }

    const user = await FoodUser.findById(userId);
    if (!user) throw new ValidationError('User not found');

    if (user.referredBy) {
        if (String(user.referredBy) === String(user._id)) {
            throw new ValidationError('Self referral is not allowed');
        }
        return { applied: false, skipped: true, reason: 'referral_already_used' };
    }

    await user.populate?.('referredBy', '_id');
    const [referrer, settingsDoc] = await Promise.all([
        FoodUser.findOne({
            $or: [
                { referralCode },
                ...(mongoose.Types.ObjectId.isValid(referralCode)
                    ? [{ _id: new mongoose.Types.ObjectId(referralCode) }]
                    : [])
            ]
        }).select('_id referralCode referralCount isActive').lean(),
        FoodReferralSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean()
    ]);

    if (!referrer) {
        throw new ValidationError('Invalid referral code');
    }
    if (String(referrer._id) === String(user._id)) {
        throw new ValidationError('Self referral is not allowed');
    }
    if (!settingsDoc) {
        throw new ValidationError('Referral program is not active');
    }
    if (referrer.isActive === false) {
        throw new ValidationError('Referral code is not active');
    }

    const referrerReward = Math.max(0, Number(settingsDoc.referralRewardUser) || 0);
    const referredUserReward = Math.max(0, Number(settingsDoc.referralRewardReferredUser) || 0);
    const limit = Math.max(0, Number(settingsDoc.referralLimitUser) || 0);
    const isWithinLimit = limit <= 0 || Number(referrer.referralCount || 0) < limit;

    if (!isWithinLimit) {
        await FoodReferralLog.create({
            referrerId: referrer._id,
            refereeId: user._id,
            role: 'USER',
            rewardAmount: referrerReward,
            status: 'rejected',
            reason: 'limit_reached'
        });
        throw new ValidationError('Referral limit reached for this code');
    }

    if (referrerReward <= 0 && referredUserReward <= 0) {
        await FoodReferralLog.create({
            referrerId: referrer._id,
            refereeId: user._id,
            role: 'USER',
            rewardAmount: 0,
            status: 'rejected',
            reason: 'reward_disabled'
        });
        throw new ValidationError('Referral rewards are currently unavailable');
    }

    user.referredBy = referrer._id;
    await user.save();

    const log = await FoodReferralLog.create({
        referrerId: referrer._id,
        refereeId: user._id,
        role: 'USER',
        rewardAmount: referrerReward,
        status: 'credited'
    });

    await FoodUser.updateOne(
        { _id: referrer._id },
        { $inc: { referralCount: 1 } }
    );

    if (referrerReward > 0) {
        await creditReferralReward(referrer._id, referrerReward, {
            role: 'USER',
            refereeId: String(user._id),
            referralLogId: String(log._id),
            referralCode: String(referrer.referralCode || referralCode),
            side: 'referrer'
        });
    }

    if (referredUserReward > 0) {
        await creditReferralReward(user._id, referredUserReward, {
            role: 'USER',
            referrerId: String(referrer._id),
            referralLogId: String(log._id),
            referralCode: String(referrer.referralCode || referralCode),
            side: 'referred_user'
        });
    }

    return {
        applied: true,
        skipped: false,
        referralCode: String(referrer.referralCode || referralCode),
        referrerId: String(referrer._id),
        referrerReward,
        referredUserReward,
        referralLogId: String(log._id)
    };
};
