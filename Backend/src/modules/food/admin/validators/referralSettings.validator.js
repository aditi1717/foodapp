import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const normalizeBooleanLike = (value) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    return value;
};

const schema = z.object({
    referralRewardUser: z.number().min(0).optional(),
    referralRewardReferredUser: z.number().min(0).optional(),
    referralRewardDelivery: z.number().min(0).optional(),
    referralLimitUser: z.number().min(0).optional(),
    referralLimitDelivery: z.number().min(0).optional(),
    isActive: z.boolean().optional()
});

export const validateReferralSettingsUpsertDto = (body) => {
    const normalized = {
        referralRewardUser: body?.referralRewardUser !== undefined ? Number(body.referralRewardUser) : undefined,
        referralRewardReferredUser: body?.referralRewardReferredUser !== undefined ? Number(body.referralRewardReferredUser) : undefined,
        referralRewardDelivery: body?.referralRewardDelivery !== undefined ? Number(body.referralRewardDelivery) : undefined,
        referralLimitUser: body?.referralLimitUser !== undefined ? Number(body.referralLimitUser) : undefined,
        referralLimitDelivery: body?.referralLimitDelivery !== undefined ? Number(body.referralLimitDelivery) : undefined,
        isActive: normalizeBooleanLike(body?.isActive)
    };

    const result = schema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

