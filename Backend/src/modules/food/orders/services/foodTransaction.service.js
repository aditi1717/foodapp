import { FoodTransaction } from '../models/foodTransaction.model.js';
import { FoodShopCommission } from '../../admin/models/shopCommission.model.js';
import mongoose from 'mongoose';
import { getActiveShopCommissionBenefit } from '../../shared/subscription.service.js';

const SHOP_COMMISSION_CACHE_MS = 60 * 1000;
let shopCommissionRulesCache = null;
let shopCommissionRulesLoadedAt = 0;

async function getActiveShopCommissionRules() {
  const now = Date.now();
  if (
    shopCommissionRulesCache &&
    now - shopCommissionRulesLoadedAt < SHOP_COMMISSION_CACHE_MS
  ) {
    return shopCommissionRulesCache;
  }

  const list = await FoodShopCommission.find({
    status: { $ne: false },
  }).lean();
  shopCommissionRulesCache = list || [];
  shopCommissionRulesLoadedAt = now;
  return shopCommissionRulesCache;
}

export function computeShopCommissionAmount(baseAmount, rule) {
  const safeBase = Math.max(0, Number(baseAmount) || 0);
  if (!Number.isFinite(safeBase) || safeBase < 0) return 0;

  const commissionConfig = rule?.commission || rule?.defaultCommission || null;
  const commissionType = commissionConfig?.type || 'percentage';
  const commissionValue = Math.max(
    0,
    Number(commissionConfig?.value ?? 0) || 0
  );

  let commissionAmount = 0;
  if (commissionType === 'percentage') {
    commissionAmount = safeBase * (commissionValue / 100);
  } else if (commissionType === 'amount') {
    commissionAmount = commissionValue;
  }

  // Round to 2 decimals and clamp to [0, base]
  commissionAmount = Math.round((commissionAmount || 0) * 100) / 100;
  commissionAmount = Math.max(0, Math.min(commissionAmount, safeBase));

  return { commissionAmount, commissionType, commissionValue, baseAmount: safeBase };
}

export async function getShopCommissionSnapshot(orderDoc) {
  const subtotal = Number(orderDoc?.pricing?.subtotal ?? 0) || 0;
  const isBulkOrder = orderDoc?.isBulkOrder === true;
  
  // For Scenario 3 (item-level offers), commission is on discounted amount
  // For Scenario 1 & 2 (coupons), commission is on original amount
  const offerByShop = Number(orderDoc?.pricing?.offerByShop ?? 0) || 0;
  
  // Base amount for commission calculation
  // If item-level offer exists, use discounted amount
  // Otherwise, use original subtotal
  const baseAmount = offerByShop > 0 
    ? Math.max(0, subtotal - offerByShop)
    : subtotal;
  
  const shopIdRaw =
    orderDoc?.shopId?._id ?? orderDoc?.shopId ?? null;

  if (!shopIdRaw) {
    return {
      commissionAmount: 0,
      commissionType: 'percentage',
      commissionValue: 0,
      baseAmount,
    };
  }

  const rules = await getActiveShopCommissionRules();
  const rule =
    rules.find((r) => String(r.shopId) === String(shopIdRaw)) ||
    // Fallback: accept legacy docs where shopId may be stored under `shop` / `shop_id`
    rules.find((r) => String(r.shop || r.shop_id || '') === String(shopIdRaw)) ||
    null;

  const subscriptionBenefit = await getActiveShopCommissionBenefit(shopIdRaw);

  if (isBulkOrder) {
    const bulkOrderCommission = rule?.bulkOrderCommission;
    if (
      bulkOrderCommission &&
      ['percentage', 'amount'].includes(String(bulkOrderCommission.type || '')) &&
      Number.isFinite(Number(bulkOrderCommission.value))
    ) {
      return computeShopCommissionAmount(baseAmount, {
        commission: {
          type: bulkOrderCommission.type,
          value: Number(bulkOrderCommission.value || 0),
        },
        source: 'bulk',
      });
    }
  }

  if (subscriptionBenefit?.appliesReducedCommission) {
    return computeShopCommissionAmount(baseAmount, {
      commission: {
        type: 'percentage',
        value: Number(subscriptionBenefit.commissionRate || 0),
      },
      source: 'subscription',
      subscriptionId: subscriptionBenefit.subscriptionId || null,
    });
  }

  if (!rule?.defaultCommission) {
    return {
      commissionAmount: 0,
      commissionType: 'percentage',
      commissionValue: 0,
      baseAmount,
    };
  }

  return computeShopCommissionAmount(baseAmount, {
    commission: rule?.defaultCommission,
    source: 'default',
  });
}

/**
 * Creates an initial 'pending' transaction when an order is created.
 */
export async function createInitialTransaction(order) {
    const { commissionAmount } = await getShopCommissionSnapshot(order);
    
    // Split logic
    const totalCustomerPaid = order.pricing?.total || 0;
    const riderShare = order.riderEarning || 0;
    // Prefer commission already computed & stored on the order (source of truth for this order),
    // fallback to rule snapshot for older orders.
    const shopCommissionFromOrder = Number(order.pricing?.shopCommission);
    const shopCommission =
        Number.isFinite(shopCommissionFromOrder) && shopCommissionFromOrder > 0
            ? shopCommissionFromOrder
            : (commissionAmount || 0);
    // Scenario 1 (shop coupon) & Scenario 3 (item offer): deduct shop-funded discounts
    // from shopNet so the stored shopShare reflects the shop's true payout.
    const couponByShop = Number(order.pricing?.couponByShop || 0);
    const offerByShop  = Number(order.pricing?.offerByShop  || 0);
    const shopNet = (order.pricing?.subtotal || 0) + (order.pricing?.packagingFee || 0)
        - shopCommission
        - couponByShop   // Scenario 1: shop-funded coupon deducted from payout
        - offerByShop;   // Scenario 3: item-level offer deducted from payout

    // Platform net includes GST and should only bear platform-funded discounts.
    // Do not add shop-funded discounts to admin/platform earning.
    const couponByAdmin = Number(order.pricing?.couponByAdmin || 0);
    const tax = Number(order.pricing?.tax || 0);
    const rawPlatformNetProfit = (Number(order.pricing?.platformFee || 0) || 0)
        + (Number(order.pricing?.deliveryFee || 0) || 0)
        + tax
        + shopCommission
        - riderShare
        - couponByAdmin;
    // Guard schema constraint (min: 0) and avoid order creation failure on heavy discounts.
    const platformNetProfit = Math.max(0, Number(rawPlatformNetProfit) || 0);

    const transaction = new FoodTransaction({
        orderId: order._id,

        userId: order.userId,
        shopId: order.shopId,
        deliveryPartnerId: order.dispatch?.deliveryPartnerId,
        paymentMethod: order.payment?.method || 'cash',
        status: order.payment?.status === 'paid' ? 'captured' : 'pending',
        payment: {
            method: String(order.payment?.method || 'cash'),
            status: String(order.payment?.status || 'cod_pending'),
            amountDue: Number(order.payment?.amountDue ?? order.pricing?.total ?? 0) || 0,
            razorpay: {
                orderId: String(order.payment?.razorpay?.orderId || ''),
                paymentId: String(order.payment?.razorpay?.paymentId || ''),
                signature: String(order.payment?.razorpay?.signature || ''),
            },
            qr: {
                qrId: String(order.payment?.qr?.qrId || ''),
                imageUrl: String(order.payment?.qr?.imageUrl || ''),
                paymentLinkId: String(order.payment?.qr?.paymentLinkId || ''),
                shortUrl: String(order.payment?.qr?.shortUrl || ''),
                status: String(order.payment?.qr?.status || ''),
                expiresAt: order.payment?.qr?.expiresAt || null,
            }
        },
        pricing: {
            subtotal: Number(order.pricing?.subtotal || 0) || 0,
            tax: Number(order.pricing?.tax || 0) || 0,
            packagingFee: Number(order.pricing?.packagingFee || 0) || 0,
            deliveryFee: Number(order.pricing?.deliveryFee || 0) || 0,
            platformFee: Number(order.pricing?.platformFee || 0) || 0,
            shopCommission,
            discount: Number(order.pricing?.discount || 0) || 0,
            couponByAdmin: Number(order.pricing?.couponByAdmin || 0) || 0,
            couponByShop: Number(order.pricing?.couponByShop || 0) || 0,
            offerByShop: Number(order.pricing?.offerByShop || 0) || 0,
            total: Number(order.pricing?.total || 0) || 0,
            currency: String(order.pricing?.currency || order.currency || 'INR'),
        },
        amounts: {
            totalCustomerPaid,
            shopShare: Math.max(0, shopNet),
            shopCommission,
            riderShare,
            platformNetProfit,
            taxAmount: order.pricing?.tax || 0
        },
        gateway: {
            razorpayOrderId: order.payment?.razorpay?.orderId,
            qrUrl: order.payment?.qr?.imageUrl
        },
        history: [{
            kind: 'created',
            amount: totalCustomerPaid,
            note: 'Initial transaction created with order'
        }]
    });

    await transaction.save();

    // Link back to the order
    try {
        await mongoose.model('FoodOrder').updateOne(
            { _id: order._id },
            { $set: { transactionId: transaction._id } }
        );
    } catch (err) {
        // Log but don't fail transaction if the backlink fails
    }

    return transaction;
}

/**
 * Updates transaction status (captured, settled, etc) and appends to history.
 */
export async function updateTransactionStatus(orderId, kind, details = {}) {
    const query = { orderId };
    const transaction = await FoodTransaction.findOne(query);
    if (!transaction) return null;

    if (details.status) transaction.status = details.status;
    if (details.razorpayPaymentId) transaction.gateway.razorpayPaymentId = details.razorpayPaymentId;
    if (details.razorpaySignature) transaction.gateway.razorpaySignature = details.razorpaySignature;
    
    transaction.history.push({
        kind,
        amount: transaction.amounts.totalCustomerPaid,
        at: new Date(),
        note: details.note || `Transaction updated: ${kind}`,
        recordedBy: { role: details.recordedByRole || 'SYSTEM', id: details.recordedById }
    });

    await transaction.save();
    return transaction;
}

/**
 * Updates the rider in the transaction when an order is accepted.
 */
export async function updateTransactionRider(orderId, riderId) {
    const query = { orderId };
    return await FoodTransaction.findOneAndUpdate(
        query,
        { $set: { deliveryPartnerId: riderId } },
        { new: true }
    );
}

/**
 * Marks shop as settled in the finance record.
 */
export async function settleShop(orderId, adminId) {
    return await updateTransactionStatus(orderId, 'settled', {
        status: 'captured', // Ensure it's marked as captured if it was pending cash
        note: 'Shop payout settled by admin',
        recordedByRole: 'ADMIN',
        recordedById: adminId
    });
}
