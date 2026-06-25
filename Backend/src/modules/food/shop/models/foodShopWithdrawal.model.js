import mongoose from 'mongoose';

const foodShopWithdrawalSchema = new mongoose.Schema({
    shopId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodShop',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: [1, 'Minimum withdrawal amount is ₹1']
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    paymentMethod: {
        type: String,
        default: 'bank_transfer'
    },
    bankDetails: {
        accountNumber: String,
        ifscCode: String,
        bankName: String,
        accountHolderName: String
    },
    adminNote: String,
    rejectionReason: String,
    transactionId: String, // Final bank transaction reference from admin
    processedAt: Date
}, { 
    collection: 'food_shop_withdrawals', 
    timestamps: true 
});

foodShopWithdrawalSchema.index({ createdAt: -1 });

export const FoodShopWithdrawal = mongoose.model('FoodShopWithdrawal', foodShopWithdrawalSchema);
