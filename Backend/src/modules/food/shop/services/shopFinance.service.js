import mongoose from 'mongoose';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodTransaction } from '../../orders/models/foodTransaction.model.js';
import { FoodShop } from '../models/shop.model.js';
import { FoodShopWithdrawal } from '../models/foodShopWithdrawal.model.js';
import { getWalletBalance } from '../../../../core/payments/wallet.service.js';

function toTwoDigitYearString(dateObj) {
    const y = String(dateObj.getFullYear());
    return y.slice(-2);
}

function monthShort(monthIndex) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIndex] || 'Jan';
}

function getFixedCurrentCycleWindow(now = new Date()) {
    const startDay = 15;
    
    let year = now.getFullYear();
    let month = now.getMonth();

    // If before start day, settlement belongs to previous month cycle.
    if (now.getDate() < startDay) {
        month = month - 1;
        if (month < 0) {
            month = 11;
            year -= 1;
        }
    }

    const start = new Date(year, month, startDay, 0, 0, 0, 0);
    // End should be either fixed 21 or now, let's make it more inclusive for "Current Cycle"
    // Users want to see their active earnings, so we extend it to 'now'
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return {
        start,
        end,
        startMeta: { day: String(startDay), month: monthShort(month), year: toTwoDigitYearString(new Date(year, month, startDay)) },
        endMeta: { day: String(now.getDate()), month: monthShort(now.getMonth()), year: toTwoDigitYearString(now) }
    };
}

function parseISODateParam(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
}

function parseISODateParamEnd(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d;
}

function buildShopFinanceTransactionEligibility() {
    return {
        $or: [
            { status: { $in: ['captured', 'authorized'] } },
            // Legacy fallback: older no-response transactions may have been marked failed.
            { status: 'failed', history: { $elemMatch: { kind: 'cancelled_by_delivery_no_response' } } }
        ]
    };
}

function toValidDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getOrderEffectiveDeliveredAt(order = {}) {
    return toValidDate(
        order?.deliveryState?.deliveredAt ||
        order?.deliveredAt ||
        order?.completedAt ||
        order?.updatedAt ||
        order?.createdAt
    );
}

function isDeliveredOrder(order = {}) {
    const status = String(order?.orderStatus || '').toLowerCase();
    return status === 'delivered' || status === 'cancelled_by_user_unavailable';
}

function mapTransactionToFinanceOrder(tx, effectiveDateOverride = null) {
    const order = tx?.orderId || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const foodNames = items.map((it) => it?.name).filter(Boolean).join(', ');
    const orderTotalExclTax = Math.max(
        0,
        Number(order?.pricing?.total ?? 0) - Number(order?.pricing?.tax ?? 0) || 0
    );
    const payout = Number(tx?.amounts?.shopShare || 0);
    const isSettled = Boolean(tx?.settlement?.isShopSettled === true);
    const fulfillmentType = String(order?.fulfillmentType || '').toLowerCase() === 'takeaway'
        ? 'takeaway'
        : 'delivery';
    const paymentMethod = String(tx?.paymentMethod || order?.payment?.method || '').toLowerCase();
    const isScheduled = Boolean(order?.isScheduled || order?.scheduledAt);
    const cashInHandAmount = fulfillmentType === 'takeaway' && paymentMethod === 'cash'
        ? Number(tx?.amounts?.totalCustomerPaid || order?.pricing?.total || 0)
        : 0;
    const cashInHandStatus = fulfillmentType !== 'takeaway'
        ? 'n_a'
        : cashInHandAmount > 0
            ? (isSettled ? 'paid_to_admin' : 'unpaid_to_admin')
            : 'n_a';

    return {
        orderId: order?.orderId || tx?.orderReadableId,
        orderMongoId: order?._id?.toString?.() || '',
        createdAt: effectiveDateOverride || tx?.createdAt,
        placedAt: order?.createdAt || tx?.createdAt,
        items,
        foodNames,
        orderTotal: orderTotalExclTax,
        totalAmount: tx?.amounts?.totalCustomerPaid || 0,
        payout,
        commission: tx?.amounts?.shopCommission || 0,
        paymentMethod,
        orderStatus: order?.orderStatus || order?.deliveryState?.currentPhase || order?.deliveryState?.status,
        fulfillmentType,
        deliveryFleet: order?.deliveryFleet || '',
        isScheduled,
        scheduledAt: order?.scheduledAt || null,
        status: tx?.status,
        isSettled,
        settledAt: tx?.settlement?.shopSettledAt || null,
        paidAmount: isSettled ? payout : 0,
        unpaidAmount: isSettled ? 0 : payout,
        cashInHandAmount,
        cashInHandStatus,
        pricing: {
            subtotal: order?.pricing?.subtotal || 0,
            packagingFee: order?.pricing?.packagingFee || 0,
            couponByAdmin: order?.pricing?.couponByAdmin || 0,
            couponByShop: order?.pricing?.couponByShop || 0,
            offerByShop: order?.pricing?.offerByShop || 0,
            tax: order?.pricing?.tax || 0,
            deliveryFee: order?.pricing?.deliveryFee || 0,
            platformFee: order?.pricing?.platformFee || 0,
            total: order?.pricing?.total || 0,
            shopCommission: tx?.amounts?.shopCommission || 0
        }
    };
}

export async function getShopFinance(shopId, query = {}) {
    if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) return null;
    const rid = new mongoose.Types.ObjectId(shopId);

    // Fetch shop profile for header display.
    const shop = await FoodShop.findById(rid)
        .select('shopName addressLine1 addressLine2 area city state pincode location')
        .lean();

    const address =
        shop?.location?.formattedAddress ||
        (shop?.addressLine1
            ? [shop.addressLine1, shop.addressLine2, shop.area].filter(Boolean).join(', ')
            : shop?.addressLine1 || '');

    const nowWindow = getFixedCurrentCycleWindow(new Date());

    const [shopWalletBalance, takeawayCashInHandAgg] = await Promise.all([
        getWalletBalance('shop', String(shopId)),
        FoodTransaction.aggregate([
            {
                $match: {
                    shopId: rid,
                    ...buildShopFinanceTransactionEligibility(),
                    'settlement.isShopSettled': { $ne: true }
                }
            },
            {
                $lookup: {
                    from: 'food_orders',
                    localField: 'orderId',
                    foreignField: '_id',
                    as: 'order'
                }
            },
            { $unwind: { path: '$order', preserveNullAndEmptyArrays: false } },
            {
                $addFields: {
                    resolvedPaymentMethod: {
                        $toLower: {
                            $ifNull: ['$paymentMethod', '$order.payment.method']
                        }
                    }
                }
            },
            {
                $match: {
                    'order.orderStatus': 'delivered',
                    'order.fulfillmentType': 'takeaway',
                    resolvedPaymentMethod: 'cash'
                }
            },
            {
                $group: {
                    _id: null,
                    cashInHand: {
                        $sum: { $ifNull: ['$amounts.totalCustomerPaid', 0] }
                    },
                    orderCount: { $sum: 1 }
                }
            }
        ])
    ]);

    // Current cycle: sum ledger payouts in the fixed window.
    const currentTransactionsRaw = await FoodTransaction.find({
        shopId: rid,
        ...buildShopFinanceTransactionEligibility(),
    })
        .populate('orderId', 'orderId createdAt updatedAt completedAt deliveredAt items pricing deliveryState orderStatus fulfillmentType deliveryFleet isScheduled scheduledAt')
        .sort({ createdAt: -1 })
        .lean();

    const currentCycleOrders = currentTransactionsRaw
        .filter((tx) => {
            const order = tx?.orderId || {};
            if (!isDeliveredOrder(order)) return false;
            const effectiveDeliveredAt = getOrderEffectiveDeliveredAt(order);
            return effectiveDeliveredAt && effectiveDeliveredAt >= nowWindow.start && effectiveDeliveredAt <= nowWindow.end;
        })
        .map((tx) => {
            const effectiveDate = getOrderEffectiveDeliveredAt(tx?.orderId || {}) || tx.createdAt;
            return {
                ...mapTransactionToFinanceOrder(tx, effectiveDate),
                recoveredFromDue: false
            };
        });

    const currentCycleEstimatedPayout = currentCycleOrders.reduce(
        (sum, o) => sum + (Number(o.payout) || 0),
        0
    );

    // Calculate global estimated payout (all unsettled transactions)
    const allUnsettledTransactionsRaw = await FoodTransaction.find({
        shopId: rid,
        ...buildShopFinanceTransactionEligibility(),
        'settlement.isShopSettled': { $ne: true }
    })
        .populate('orderId', 'orderStatus createdAt updatedAt completedAt deliveredAt deliveryState.deliveredAt fulfillmentType deliveryFleet isScheduled scheduledAt pricing')
        .select('amounts.shopShare orderId')
        .lean();

    const allUnsettledTransactions = allUnsettledTransactionsRaw.filter((tx) =>
        isDeliveredOrder(tx?.orderId || {})
    );

    const globalEstimatedPayout = allUnsettledTransactions.reduce(
        (sum, tx) => sum + (Number(tx.amounts?.shopShare) || 0),
        0
    );

    // Block only pending withdrawals from available balance.
    // Approved/rejected requests are processed records and should not keep locking payout.
    const pendingWithdrawalsAgg = await FoodShopWithdrawal.aggregate([
        {
            $match: {
                shopId: rid,
                $expr: {
                    $eq: [{ $toLower: { $trim: { input: '$status' } } }, 'pending']
                }
            }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalPendingWithdrawals = Number(pendingWithdrawalsAgg?.[0]?.total || 0);
    const availableBalance = Math.max(0, globalEstimatedPayout - totalPendingWithdrawals);
    const takeawayCashInHand = Math.max(0, Number(takeawayCashInHandAgg?.[0]?.cashInHand || 0));
    const takeawayCashOrderCount = Math.max(0, Number(takeawayCashInHandAgg?.[0]?.orderCount || 0));
    const shopWalletAvailableBalance = Math.max(
        0,
        Number(shopWalletBalance?.availableBalance ?? shopWalletBalance?.balance ?? 0) || 0
    );
    const takeawayCashLimitLeft = Math.max(0, shopWalletAvailableBalance - takeawayCashInHand);

    const currentCycle = {
        start: { ...nowWindow.startMeta },
        end: { ...nowWindow.endMeta },
        totalEarnings: currentCycleEstimatedPayout, // We still show current cycle earnings label
        totalWithdrawn: totalPendingWithdrawals,
        estimatedPayout: availableBalance, // This is what UI shows as "Estimated Payout" (Available Balance)
        totalOrders: currentCycleOrders.length,
        payoutDate: null,
        takeawayCod: {
            walletBalance: shopWalletAvailableBalance,
            cashInHand: takeawayCashInHand,
            remainingCashLimit: takeawayCashLimitLeft,
            activeCashOrders: takeawayCashOrderCount
        },
        orders: currentCycleOrders
    };

    // Invoice Summary (derived from current cycle or broader if needed)
    const invoiceSummary = {
        count: currentCycleOrders.length,
        subtotal: currentCycleOrders.reduce((sum, o) => sum + (Number(o.orderTotal) || 0), 0),
        taxes: currentCycleOrders.reduce((sum, o) => sum + Math.max(0, (Number(o.totalAmount) || 0) - (Number(o.orderTotal) || 0)), 0),
        gross: currentCycleOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
    };

    // Past cycles: build from provided startDate/endDate query.
    const startDate = parseISODateParam(query.startDate);
    const endDate = parseISODateParamEnd(query.endDate);

    let pastCyclesResult = { orders: [], totalOrders: 0 };
    if (startDate && endDate) {
        const pastTransactions = await FoodTransaction.find({
            shopId: rid,
            ...buildShopFinanceTransactionEligibility(),
        })
            .populate('orderId', 'orderId createdAt updatedAt completedAt deliveredAt items pricing deliveryState orderStatus fulfillmentType deliveryFleet isScheduled scheduledAt')
            .sort({ createdAt: -1 })
            .lean();

        const pastCycleOrders = pastTransactions
            .filter((tx) => {
                const order = tx?.orderId || {};
                if (!isDeliveredOrder(order)) return false;
                const effectiveDeliveredAt = getOrderEffectiveDeliveredAt(order);
                return effectiveDeliveredAt && effectiveDeliveredAt >= startDate && effectiveDeliveredAt <= endDate;
            })
            .map((tx) => {
                const effectiveDate = getOrderEffectiveDeliveredAt(tx?.orderId || {}) || tx.createdAt;
                return mapTransactionToFinanceOrder(tx, effectiveDate);
            });

        pastCyclesResult = {
            orders: pastCycleOrders,
            totalOrders: pastCycleOrders.length
        };
    }

    return {
        shop: {
            name: shop?.shopName || '',
            shopId: shop?._id ? `REST${shop._id.toString().slice(-6).padStart(6, '0')}` : 'N/A',
            address
        },
        currentCycle,
        invoiceSummary,
        pastCycles: pastCyclesResult
    };
}


