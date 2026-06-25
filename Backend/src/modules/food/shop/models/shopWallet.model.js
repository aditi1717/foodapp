import mongoose from 'mongoose';

/**
 * ShopWallet — tracks the financial balance for each shop.
 * Credited when orders are delivered; debited when settlements are processed.
 */
const shopWalletSchema = new mongoose.Schema(
    {
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodShop',
            required: true,
            unique: true,
            index: true
        },
        balance: { type: Number, default: 0 },
        /** Amount locked for pending settlements (cannot be withdrawn) */
        lockedAmount: { type: Number, default: 0, min: 0 },
        /** Lifetime earnings */
        totalEarnings: { type: Number, default: 0, min: 0 },
        /** Total amount already settled/paid out */
        totalSettled: { type: Number, default: 0, min: 0 }
    },
    { collection: 'food_shop_wallets', timestamps: true }
);

export const FoodShopWallet = mongoose.model('FoodShopWallet', shopWalletSchema);
