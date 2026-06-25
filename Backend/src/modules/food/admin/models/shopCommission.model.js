import mongoose from 'mongoose';

const commissionValueSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['percentage', 'amount'],
            default: 'percentage'
        },
        value: { type: Number, default: 0 }
    },
    { _id: false }
);

const shopCommissionSchema = new mongoose.Schema(
    {
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodShop',
            required: true,
            unique: true,
            index: true
        },
        defaultCommission: {
            type: commissionValueSchema,
            default: () => ({ type: 'percentage', value: 0 })
        },
        bulkOrderCommission: {
            type: commissionValueSchema,
            default: null
        },
        notes: { type: String, trim: true, default: '' },
        status: { type: Boolean, default: true, index: true }
    },
    { collection: 'food_shop_commissions', timestamps: true }
);


export const FoodShopCommission = mongoose.model('FoodShopCommission', shopCommissionSchema);

