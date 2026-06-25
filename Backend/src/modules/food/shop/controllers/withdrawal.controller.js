import { sendResponse, sendError } from '../../../../utils/response.js';
import { FoodShopWithdrawal } from '../models/foodShopWithdrawal.model.js';
import { FoodShop } from '../models/shop.model.js';
import { getShopFinance } from '../services/shopFinance.service.js';

export const createWithdrawalRequestController = async (req, res, next) => {
    try {
        const ownerId = req.user?.userId;
        const { amount, bankDetails } = req.body;

        if (!ownerId) return sendError(res, 401, 'Shop authentication required');

        // Resolve actual FoodShop ID
        const shopProfile = await FoodShop.findOne({ _id: ownerId }).select('_id').lean();
        const shopId = shopProfile?._id;

        if (!shopId) return sendError(res, 404, 'Shop profile not found');
        if (!amount || amount <= 0) return sendError(res, 400, 'Invalid withdrawal amount');

        // Check if shop has enough balance
        const finance = await getShopFinance(shopId);
        const availableBalance = finance?.currentCycle?.estimatedPayout || 0;

        if (amount > availableBalance) {
            return sendError(res, 400, `Insufficient balance. Available: ₹${availableBalance}`);
        }

        // Create the withdrawal request
        const withdrawal = new FoodShopWithdrawal({
            shopId,
            amount,
            bankDetails,
            status: 'pending'
        });

        await withdrawal.save();

        return sendResponse(res, 201, 'Withdrawal request submitted successfully', withdrawal);
    } catch (error) {
        next(error);
    }
};

export const listMyWithdrawalsController = async (req, res, next) => {
    try {
        const ownerId = req.user?.userId;
        if (!ownerId) return sendError(res, 401, 'Shop authentication required');

        // Resolve actual FoodShop ID
        const shopProfile = await FoodShop.findOne({ _id: ownerId }).select('_id').lean();
        const shopId = shopProfile?._id;

        if (!shopId) {
            return sendResponse(res, 200, 'Withdrawals fetched successfully', []);
        }

        const withdrawals = await FoodShopWithdrawal.find({ shopId })
            .sort({ createdAt: -1 })
            .lean();

        return sendResponse(res, 200, 'Withdrawals fetched successfully', withdrawals);
    } catch (error) {
        next(error);
    }
};
