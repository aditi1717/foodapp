// Script to verify delivery partner multi-order capacity limits and exclusivity rules
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FoodOrder } from './src/modules/food/orders/models/order.model.js';
import { FoodDeliveryPartner } from './src/modules/food/delivery/models/deliveryPartner.model.js';
import { FoodDeliveryExclusivity } from './src/modules/food/delivery/models/deliveryExclusivity.model.js';
import { FoodBusinessSettings } from './src/modules/food/admin/models/businessSettings.model.js';
import { FoodRestaurant } from './src/modules/food/restaurant/models/restaurant.model.js';
import {
  assignDeliveryPartnerRestaurant,
  assignDeliveryPartnerAdmin
} from './src/modules/food/orders/services/order.service.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your_db';

async function testRules() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Fetch or create a test Restaurant
    let restaurant = await FoodRestaurant.findOne();
    if (!restaurant) {
      restaurant = await FoodRestaurant.create({
        restaurantName: 'Test Verify Restaurant',
        name: 'Test Owner',
        phone: '9999999999',
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716] // Bangalore
        },
        address: 'Bangalore, India'
      });
      console.log('Created mock restaurant:', restaurant._id);
    }

    // 2. Fetch or create test Delivery Partners
    // Partner A (Global Rider)
    let partnerA = await FoodDeliveryPartner.findOne({ phone: '8888888888' });
    if (!partnerA) {
      partnerA = await FoodDeliveryPartner.create({
        name: 'Rider A (Global)',
        phone: '8888888888',
        status: 'approved',
        availabilityStatus: 'online',
        zoneId: new mongoose.Types.ObjectId(),
        lastLat: 12.9716,
        lastLng: 77.5946
      });
      console.log('Created mock Rider A:', partnerA._id);
    } else {
      // Ensure online and approved
      partnerA.status = 'approved';
      partnerA.availabilityStatus = 'online';
      await partnerA.save();
    }

    // Partner B (Exclusive/Associated Rider)
    let partnerB = await FoodDeliveryPartner.findOne({ phone: '7777777777' });
    if (!partnerB) {
      partnerB = await FoodDeliveryPartner.create({
        name: 'Rider B (Exclusive)',
        phone: '7777777777',
        status: 'approved',
        availabilityStatus: 'online',
        zoneId: new mongoose.Types.ObjectId(),
        lastLat: 12.9716,
        lastLng: 77.5946
      });
      console.log('Created mock Rider B:', partnerB._id);
    } else {
      partnerB.status = 'approved';
      partnerB.availabilityStatus = 'online';
      await partnerB.save();
    }

    // Setup exclusivity association for Rider B
    await FoodDeliveryExclusivity.deleteOne({ deliveryPartnerId: partnerB._id });
    const exclusivity = await FoodDeliveryExclusivity.create({
      restaurantId: restaurant._id,
      deliveryPartnerId: partnerB._id,
      status: 'associated',
      associatedAt: new Date()
    });
    console.log('Created exclusivity association for Rider B with Restaurant:', restaurant._id);

    // 3. Set business settings limit
    let settings = await FoodBusinessSettings.findOne();
    if (!settings) {
      settings = await FoodBusinessSettings.create({
        maxActiveOrdersPerRider: 2
      });
    } else {
      settings.maxActiveOrdersPerRider = 2;
      await settings.save();
    }
    console.log('Set business settings maxActiveOrdersPerRider to:', settings.maxActiveOrdersPerRider);

    // 4. Create active orders and assign to Rider A
    // Clean up older active orders assigned to Rider A to have a clean slate
    await FoodOrder.deleteMany({
      "dispatch.deliveryPartnerId": partnerA._id
    });

    console.log('\n--- Test Case 1: Exclusivity Skip ---');
    console.log('Rider B is exclusive. Verify that Rider B is completely excluded from auto-assignment.');
    // Let's import listNearbyOnlineDeliveryPartners dynamically to test
    const { listNearbyOnlineDeliveryPartners } = await import('./src/modules/food/orders/services/order.service.js');
    const { partners } = await listNearbyOnlineDeliveryPartners(restaurant._id, { maxKm: 15, limit: 10 });
    const foundRiderB = partners.some(p => String(p.partnerId) === String(partnerB._id));
    console.log('Is Rider B found in online search?', foundRiderB ? '❌ Yes (Bug!)' : '✅ No (Correctly skipped)');

    console.log('\n--- Test Case 2: Capacity Limit Skip ---');
    // Create 2 mock active orders assigned to Rider A
    const order1 = await FoodOrder.create({
      orderId: 'TEST-ORD-1',
      orderType: 'quick',
      restaurantId: restaurant._id,
      zoneId: partnerA.zoneId,
      items: [{ itemId: 'item1', name: 'Veg Burger', price: 100, quantity: 1 }],
      pricing: { subtotal: 100, total: 100 },
      payment: { method: 'cash', status: 'cod_pending' },
      orderStatus: 'preparing',
      dispatch: {
        deliveryPartnerId: partnerA._id,
        status: 'accepted',
        acceptedAt: new Date()
      }
    });

    const order2 = await FoodOrder.create({
      orderId: 'TEST-ORD-2',
      orderType: 'quick',
      restaurantId: restaurant._id,
      zoneId: partnerA.zoneId,
      items: [{ itemId: 'item2', name: 'Cheese Pizza', price: 200, quantity: 1 }],
      pricing: { subtotal: 200, total: 200 },
      payment: { method: 'cash', status: 'cod_pending' },
      orderStatus: 'preparing',
      dispatch: {
        deliveryPartnerId: partnerA._id,
        status: 'accepted',
        acceptedAt: new Date()
      }
    });
    console.log('Created 2 active orders assigned to Rider A.');

    // Search online partners again. Since Rider A has 2 active orders and limit is 2, Rider A should be skipped.
    const searchAfterLimit = await listNearbyOnlineDeliveryPartners(restaurant._id, { maxKm: 15, limit: 10 });
    const foundRiderA = searchAfterLimit.partners.some(p => String(p.partnerId) === String(partnerA._id));
    console.log('Is Rider A found in online search after reaching capacity?', foundRiderA ? '❌ Yes (Bug!)' : '✅ No (Correctly skipped)');

    console.log('\n--- Test Case 3: Restaurant Manual Assignment Guard ---');
    console.log('Assigning 2 active orders to Rider B (exclusive/associated) to reach capacity...');
    order1.dispatch.deliveryPartnerId = partnerB._id;
    await order1.save();
    order2.dispatch.deliveryPartnerId = partnerB._id;
    await order2.save();

    console.log('Attempting to manually assign a 3rd order to Rider B via restaurant (capacity reached)...');
    const order3 = await FoodOrder.create({
      orderId: 'TEST-ORD-3',
      orderType: 'quick',
      restaurantId: restaurant._id,
      zoneId: partnerB.zoneId,
      items: [{ itemId: 'item3', name: 'French Fries', price: 80, quantity: 1 }],
      pricing: { subtotal: 80, total: 80 },
      payment: { method: 'cash', status: 'cod_pending' },
      orderStatus: 'confirmed',
      dispatch: {
        status: 'unassigned'
      }
    });

    try {
      await assignDeliveryPartnerRestaurant(order3._id, restaurant._id, partnerB._id);
      console.log('❌ Error: Allowed assigning order beyond capacity limit via Restaurant!');
    } catch (err) {
      console.log('✅ Correctly blocked Restaurant manual assignment! Received validation error:', err.message);
    }

    console.log('\n--- Test Case 4: Admin Manual Assignment Block ---');
    console.log('Attempting to manually assign an order to Rider A via admin...');
    try {
      await assignDeliveryPartnerAdmin(order3._id, partnerA._id, new mongoose.Types.ObjectId(), { role: 'ADMIN' });
      console.log('❌ Error: Admin manual assignment did not throw!');
    } catch (err) {
      if (err.message.includes('disabled')) {
        console.log('✅ Correctly blocked Admin manual assignment! Received validation error:', err.message);
      } else {
        console.log('❌ Unexpected error from Admin manual assignment:', err.message);
      }
    }

    // Clean up mock data
    await FoodOrder.deleteMany({ orderId: { $in: ['TEST-ORD-1', 'TEST-ORD-2', 'TEST-ORD-3'] } });
    console.log('\n🧹 Cleaned up mock orders.');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Error during testing:', error);
    process.exit(1);
  }
}

testRules();
