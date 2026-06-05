import { sendResponse, sendError } from '../../../../utils/response.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodRestaurantWithdrawal } from '../models/foodRestaurantWithdrawal.model.js';
import { creditWallet, debitWallet, getWalletWithTransactions, lockWalletAmount, unlockWalletAmount } from '../../../../core/payments/wallet.service.js';
import { 
    createRazorpayOrder, 
    getRazorpayKeyId, 
    isRazorpayConfigured, 
    verifyPaymentSignature 
} from '../../orders/helpers/razorpay.helper.js';

export const getWalletDetailsController = async (req, res, next) => {
    try {
        const ownerId = req.user?.userId;
        if (!ownerId) return sendError(res, 401, 'Restaurant authentication required');

        // Resolve actual FoodRestaurant ID
        const restaurantProfile = await FoodRestaurant.findOne({ _id: ownerId }).select('_id').lean();
        const restaurantId = restaurantProfile?._id;
        if (!restaurantId) return sendError(res, 404, 'Restaurant profile not found');

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const walletData = await getWalletWithTransactions('restaurant', restaurantId, { page, limit });

        // Fetch withdrawals to merge pending and rejected ones into transactions history
        const withdrawals = await FoodRestaurantWithdrawal.find({ restaurantId }).sort({ createdAt: -1 }).lean();
        const pendingOrRejectedTxns = withdrawals
            .filter(w => w.status === 'pending' || w.status === 'rejected')
            .map(w => ({
                _id: w._id,
                type: 'debit',
                amount: w.amount,
                description: w.status === 'pending' ? 'Withdrawal Request (Pending)' : 'Withdrawal Request (Rejected)',
                status: w.status === 'pending' ? 'Pending' : 'Rejected',
                createdAt: w.createdAt,
                category: 'wallet_debit'
            }));

        // Merge and sort newest first
        const allTransactions = [...pendingOrRejectedTxns, ...(walletData.transactions || [])]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        walletData.transactions = allTransactions;

        return sendResponse(res, 200, 'Wallet details fetched successfully', walletData);
    } catch (error) {
        next(error);
    }
};

export const createDepositOrderController = async (req, res, next) => {
    try {
        const ownerId = req.user?.userId;
        if (!ownerId) return sendError(res, 401, 'Restaurant authentication required');

        const { amount } = req.body;
        const depositAmount = Number(amount);
        if (!depositAmount || depositAmount <= 0) {
            return sendError(res, 400, 'Invalid deposit amount');
        }

        // Resolve actual FoodRestaurant ID
        const restaurantProfile = await FoodRestaurant.findOne({ _id: ownerId }).select('_id').lean();
        const restaurantId = restaurantProfile?._id;
        if (!restaurantId) return sendError(res, 404, 'Restaurant profile not found');

        const amountPaise = Math.round(depositAmount * 100);
        const receipt = `resto_wt_${String(restaurantId).slice(-8)}_${Date.now()}`;
        
        let order;
        if (!isRazorpayConfigured()) {
            // Dev/Mock fallback
            const orderId = `order_dev_${Date.now()}`;
            order = {
                id: orderId,
                amount: amountPaise,
                currency: 'INR'
            };
        } else {
            try {
                order = await createRazorpayOrder(amountPaise, 'INR', receipt);
            } catch (razorpayError) {
                console.warn("Razorpay API call failed, falling back to mock dev order:", razorpayError.message || razorpayError);
                // Fallback to dev/mock order if Razorpay call fails (e.g. invalid keys in dev environment)
                const orderId = `order_dev_${Date.now()}`;
                order = {
                    id: orderId,
                    amount: amountPaise,
                    currency: 'INR'
                };
            }
        }

        return sendResponse(res, 200, 'Razorpay order created successfully', {
            razorpay: {
                key: getRazorpayKeyId() || 'rzp_test_dummy',
                orderId: order.id,
                amount: order.amount,
                currency: order.currency || 'INR'
            }
        });
    } catch (error) {
        next(error);
    }
};

export const verifyDepositPaymentController = async (req, res, next) => {
    try {
        const ownerId = req.user?.userId;
        if (!ownerId) return sendError(res, 401, 'Restaurant authentication required');

        const { amount, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
        const depositAmount = Number(amount);

        if (!razorpayOrderId) return sendError(res, 400, 'razorpayOrderId is required');
        if (!razorpayPaymentId) return sendError(res, 400, 'razorpayPaymentId is required');
        if (!depositAmount || depositAmount <= 0) return sendError(res, 400, 'Invalid deposit amount');

        const isDevOrder = String(razorpayOrderId).startsWith('order_dev_');
        if (!razorpaySignature && isRazorpayConfigured() && !isDevOrder) {
            return sendError(res, 400, 'razorpaySignature is required');
        }

        // Resolve actual FoodRestaurant ID
        const restaurantProfile = await FoodRestaurant.findOne({ _id: ownerId }).select('_id').lean();
        const restaurantId = restaurantProfile?._id;
        if (!restaurantId) return sendError(res, 404, 'Restaurant profile not found');

        // Verify signature if Razorpay is configured and it's not a dev order
        const ok = (isRazorpayConfigured() && !isDevOrder)
            ? verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)
            : true;

        if (!ok) {
            return sendError(res, 400, 'Payment verification failed');
        }

        // Credit the wallet
        const result = await creditWallet({
            entityType: 'restaurant',
            entityId: restaurantId,
            amount: depositAmount,
            description: 'Loaded from Razorpay Account',
            category: 'wallet_topup',
            paymentId: razorpayPaymentId,
            metadata: {
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature
            }
        });

        return sendResponse(res, 200, 'Deposit successful', result);
    } catch (error) {
        next(error);
    }
};

export const withdrawFromWalletController = async (req, res, next) => {
    try {
        const ownerId = req.user?.userId;
        if (!ownerId) return sendError(res, 401, 'Restaurant authentication required');

        const { amount } = req.body;
        const withdrawAmount = Number(amount);
        if (!withdrawAmount || withdrawAmount <= 0) {
            return sendError(res, 400, 'Invalid withdrawal amount');
        }

        // Resolve actual FoodRestaurant ID
        const restaurantProfile = await FoodRestaurant.findOne({ _id: ownerId }).select('_id accountNumber ifscCode bankName accountHolderName').lean();
        const restaurantId = restaurantProfile?._id;
        if (!restaurantId) return sendError(res, 404, 'Restaurant profile not found');

        // Check if there is enough balance in the wallet
        const walletData = await getWalletWithTransactions('restaurant', restaurantId, { page: 1, limit: 1 });
        const availableBalance = walletData?.availableBalance || 0;

        if (withdrawAmount > availableBalance) {
            return sendError(res, 400, `Insufficient wallet balance. Available: ₹${availableBalance}`);
        }

        // Lock the amount in the wallet to prevent double-spending
        const result = await lockWalletAmount('restaurant', restaurantId, withdrawAmount);

        // Create a corresponding pending withdrawal document for admin approval
        const withdrawal = new FoodRestaurantWithdrawal({
            restaurantId,
            amount: withdrawAmount,
            status: 'pending',
            paymentMethod: 'bank_transfer',
            bankDetails: {
                accountNumber: restaurantProfile.accountNumber || '',
                ifscCode: restaurantProfile.ifscCode || '',
                bankName: restaurantProfile.bankName || '',
                accountHolderName: restaurantProfile.accountHolderName || restaurantProfile.restaurantName || ''
            }
        });
        await withdrawal.save();

        return sendResponse(res, 200, 'Withdrawal request submitted successfully', { ...result, withdrawal });
    } catch (error) {
        next(error);
    }
};
