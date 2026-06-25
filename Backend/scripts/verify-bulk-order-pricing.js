import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { FoodUser } from '../src/core/users/user.model.js';
import { FoodItem } from '../src/modules/food/admin/models/food.model.js';
import { FoodShopCommission } from '../src/modules/food/admin/models/shopCommission.model.js';
import { FoodShop } from '../src/modules/food/shop/models/shop.model.js';
import * as orderService from '../src/modules/food/orders/services/order.service.js';
import {
  computeShopCommissionAmount,
  getShopCommissionSnapshot,
} from '../src/modules/food/orders/services/foodTransaction.service.js';

function buildAddress(shop) {
  const coords = shop?.location?.coordinates || [77.5946, 12.9716];
  const lng = Number(coords[0]) || 77.5946;
  const lat = Number(coords[1]) || 12.9716;

  return {
    label: 'Home',
    street: 'Verification Street',
    city: 'Test City',
    state: 'Test State',
    zipCode: '560001',
    phone: '9876543210',
    name: 'Bulk Test User',
    fullName: 'Bulk Test User',
    location: { type: 'Point', coordinates: [lng + 0.001, lat + 0.001] },
  };
}

function buildItemPayload(food) {
  const base = {
    itemId: String(food._id),
    name: food.name,
    quantity: 1,
    image: food.image || '',
    isVeg: String(food.foodType || '').toLowerCase() === 'veg',
  };

  const enabledVariant = Array.isArray(food.variants)
    ? food.variants.find(
        (variant) =>
          variant?.bulkOrderPricing?.enabled === true &&
          Number(variant?.bulkOrderPricing?.minQuantity) >= 1,
      )
    : null;

  if (enabledVariant) {
    const minQty = Number(enabledVariant.bulkOrderPricing.minQuantity || 1);
    return {
      ...base,
      variantId: String(enabledVariant._id),
      variantName: enabledVariant.name,
      variantPrice: Number(enabledVariant.price || 0),
      price: Number(enabledVariant.price || 0),
      quantity: minQty,
      expectedBulkPrice: Number(enabledVariant.bulkOrderPricing.bulkPrice || 0),
      expectedMinQuantity: minQty,
      source: 'variant',
    };
  }

  const minQty = Number(food.bulkOrderPricing?.minQuantity || 1);
  return {
    ...base,
    price: Number(food.price || 0),
    quantity: minQty,
    expectedBulkPrice: Number(food.bulkOrderPricing?.bulkPrice || 0),
    expectedMinQuantity: minQty,
    source: 'food',
  };
}

async function verifyBulkPricingAndValidation() {
  const user = await FoodUser.findOne({}).select('_id').lean();
  if (!user?._id) throw new Error('No user found for verification');

  const food = await FoodItem.findOne({
    approvalStatus: 'approved',
    $or: [
      { 'bulkOrderPricing.enabled': true },
      { 'variants.bulkOrderPricing.enabled': true },
    ],
  })
    .select('_id name image foodType price variants bulkOrderPricing shopId')
    .lean();
  if (!food?._id) throw new Error('No bulk-enabled food item found');

  const shop = await FoodShop.findById(food.shopId)
    .select('_id shopName status takeawayEnabled location zoneId')
    .lean();
  if (!shop?._id) throw new Error('Shop for bulk-enabled food not found');

  const item = buildItemPayload(food);
  const address = buildAddress(shop);
  const items = [
    {
      itemId: item.itemId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      variantId: item.variantId,
      variantName: item.variantName,
      variantPrice: item.variantPrice,
      image: item.image,
      isVeg: item.isVeg,
    },
  ];

  const calculateDto = {
    orderType: 'food',
    fulfillmentType: 'delivery',
    shopId: String(shop._id),
    address,
    items,
    isBulkOrder: true,
  };

  const pricingResult = await orderService.calculateOrder(String(user._id), calculateDto);
  const pricedItem = pricingResult?.items?.[0];

  const unscheduledDto = {
    ...calculateDto,
    paymentMethod: 'razorpay',
    pricing: pricingResult.pricing,
    isScheduled: false,
  };

  const cashDto = {
    ...calculateDto,
    paymentMethod: 'cash',
    pricing: pricingResult.pricing,
    isScheduled: true,
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  };

  const output = {
    sample: {
      shopName: shop.shopName,
      itemName: food.name,
      bulkSource: item.source,
      expectedBulkPrice: item.expectedBulkPrice,
      expectedMinQuantity: item.expectedMinQuantity,
    },
    calculateOrder: {
      ok: Number(pricedItem?.price) === Number(item.expectedBulkPrice),
      returnedPrice: Number(pricedItem?.price || 0),
      subtotal: Number(pricingResult?.pricing?.subtotal || 0),
      itemIsBulkOrder: pricedItem?.isBulkOrder === true,
      itemBulkMinQuantity: Number(pricedItem?.bulkMinQuantity || 0),
    },
    createOrderUnscheduled: null,
    createOrderCash: null,
  };

  try {
    await orderService.createOrder(String(user._id), unscheduledDto);
    output.createOrderUnscheduled = {
      ok: false,
      message: 'Expected failure but order creation passed',
    };
  } catch (error) {
    output.createOrderUnscheduled = {
      ok: /scheduled delivery/i.test(String(error?.message || '')),
      message: error?.message || String(error),
    };
  }

  try {
    await orderService.createOrder(String(user._id), cashDto);
    output.createOrderCash = {
      ok: false,
      message: 'Expected failure but order creation passed',
    };
  } catch (error) {
    output.createOrderCash = {
      ok: /cash/i.test(String(error?.message || '')),
      message: error?.message || String(error),
    };
  }

  return output;
}

async function verifyBulkCommissionSelection() {
  const commissionDoc = await FoodShopCommission.findOne({
    status: { $ne: false },
    'bulkOrderCommission.type': { $in: ['percentage', 'amount'] },
  }).lean();

  if (!commissionDoc) {
    return {
      ok: false,
      message:
        'No shop commission doc with bulkOrderCommission configured was found for runtime verification.',
    };
  }

  const baseAmount = 1000;
  const expectedBulk = computeShopCommissionAmount(baseAmount, {
    commission: commissionDoc.bulkOrderCommission,
  });
  const expectedDefault = computeShopCommissionAmount(baseAmount, {
    commission: commissionDoc.defaultCommission,
  });
  const snapshot = await getShopCommissionSnapshot({
    shopId: commissionDoc.shopId,
    isBulkOrder: true,
    pricing: {
      subtotal: baseAmount,
      offerByShop: 0,
    },
  });

  return {
    shopId: String(commissionDoc.shopId),
    defaultCommission: commissionDoc.defaultCommission,
    bulkOrderCommission: commissionDoc.bulkOrderCommission,
    expectedBulkAmount: expectedBulk.commissionAmount,
    expectedDefaultAmount: expectedDefault.commissionAmount,
    snapshotAmount: snapshot.commissionAmount,
    bulkCommissionApplied:
      Number(snapshot.commissionAmount) === Number(expectedBulk.commissionAmount),
  };
}

async function main() {
  await connectDB();

  const bulkPricing = await verifyBulkPricingAndValidation();
  const bulkCommission = await verifyBulkCommissionSelection();

  console.log(
    JSON.stringify(
      {
        bulkPricing,
        bulkCommission,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error?.message || String(error),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await disconnectDB();
    } catch {
      // ignore disconnect errors
    }
    await mongoose.disconnect().catch(() => {});
  });
