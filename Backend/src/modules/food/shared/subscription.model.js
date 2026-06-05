import mongoose from 'mongoose';

const packageFeatureSnapshotSchema = new mongoose.Schema(
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

const packageSnapshotSchema = new mongoose.Schema(
    {
        packageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodSubscriptionPackage',
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ['Customer', 'Resto'],
            required: true,
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
            type: [packageFeatureSnapshotSchema],
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
        restoBenefitType: {
            type: String,
            enum: ['commission_reduction', 'priority_listing', null],
            default: null,
        },
        commissionRate: {
            type: Number,
            default: null,
        },
        freeDeliveryType: {
            type: String,
            enum: ['unlimited', 'capped', null],
            default: null,
        },
        maxFreeDeliveries: {
            type: Number,
            default: null,
        },
    },
    { _id: false },
);

const subscriptionSchema = new mongoose.Schema(
    {
        ownerType: {
            type: String,
            enum: ['USER', 'RESTAURANT'],
            required: true,
            index: true,
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        packageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodSubscriptionPackage',
            required: true,
            index: true,
        },
        packageSnapshot: {
            type: packageSnapshotSchema,
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'cancelled', 'expired'],
            default: 'active',
            index: true,
        },
        paymentMethod: {
            type: String,
            default: 'wallet',
            trim: true,
        },
        razorpayOrderId: {
            type: String,
            default: '',
            trim: true,
        },
        razorpayPaymentId: {
            type: String,
            default: '',
            trim: true,
        },
        razorpaySignature: {
            type: String,
            default: '',
            trim: true,
        },
        pricePaid: {
            type: Number,
            required: true,
            min: 0,
        },
        purchaseDate: {
            type: Date,
            default: Date.now,
        },
        startDate: {
            type: Date,
            default: Date.now,
        },
        expiryDate: {
            type: Date,
            required: true,
            index: true,
        },
        deliveriesUsed: {
            type: Number,
            default: 0,
            min: 0,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
        reminder10SentAt: {
            type: Date,
            default: null,
        },
        reminder2SentAt: {
            type: Date,
            default: null,
        },
    },
    {
        collection: 'food_subscriptions',
        timestamps: true,
    },
);

subscriptionSchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 });
subscriptionSchema.index({ packageId: 1, status: 1 });
subscriptionSchema.index({ razorpayOrderId: 1 });
subscriptionSchema.index({ razorpayPaymentId: 1 });

export const FoodSubscription = mongoose.model('FoodSubscription', subscriptionSchema);
