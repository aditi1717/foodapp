import mongoose from 'mongoose';

const packageFeatureSchema = new mongoose.Schema(
    {
        icon: {
            type: String,
            default: 'ShieldCheck',
            trim: true,
        },
        text: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { _id: false },
);

const subscriptionPackageSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ['Customer', 'Resto'],
            required: true,
            index: true,
        },
        description: {
            type: String,
            default: '',
            trim: true,
        },
        image: {
            type: String,
            default: '',
            trim: true,
        },
        features: {
            type: [packageFeatureSchema],
            default: [],
        },
        priceValue: {
            type: Number,
            required: true,
            min: 0,
        },
        markedPriceValue: {
            type: Number,
            default: null,
            min: 0,
        },
        priceCurrency: {
            type: String,
            default: 'INR',
            trim: true,
        },
        durationValue: {
            type: Number,
            required: true,
            min: 1,
        },
        durationUnit: {
            type: String,
            enum: ['Days', 'Months', 'Years'],
            required: true,
        },
        active: {
            type: Boolean,
            default: true,
            index: true,
        },
        restoBenefitType: {
            type: String,
            enum: ['commission_reduction', 'priority_listing', null],
            default: null,
        },
        commissionRate: {
            type: Number,
            default: null,
            min: 0,
        },
        freeDeliveryType: {
            type: String,
            enum: ['unlimited', 'capped', null],
            default: null,
        },
        maxFreeDeliveries: {
            type: Number,
            default: null,
            min: 1,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin',
            default: null,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin',
            default: null,
        },
    },
    {
        collection: 'food_subscription_packages',
        timestamps: true,
    },
);

subscriptionPackageSchema.index({ type: 1, active: 1, createdAt: -1 });

export const FoodSubscriptionPackage = mongoose.model('FoodSubscriptionPackage', subscriptionPackageSchema);
