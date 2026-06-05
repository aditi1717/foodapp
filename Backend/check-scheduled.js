import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your_db';

async function check() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const FoodOrder = mongoose.model('FoodOrder', new mongoose.Schema({}, { strict: false }), 'food_orders');
    const FoodRestaurant = mongoose.model('FoodRestaurant', new mongoose.Schema({}, { strict: false }), 'food_restaurants');

    // Find all scheduled takeaway orders
    const orders = await FoodOrder.find({
      isScheduled: true,
      fulfillmentType: 'takeaway'
    }).sort({ createdAt: -1 }).limit(10).lean();

    console.log(`\nFound ${orders.length} scheduled takeaway orders:\n`);
    for (const order of orders) {
      console.log('--------------------------------------------');
      console.log('Order ID:', order.orderId);
      console.log('Mongo ID:', order._id);
      console.log('Status:', order.orderStatus);
      console.log('isActivated:', order.isActivated);
      console.log('Fulfillment Type:', order.fulfillmentType);
      console.log('Payment Method:', order.payment?.method);
      console.log('Payment Status:', order.payment?.status);
      console.log('Scheduled At:', order.scheduledAt);
      console.log('Created At:', order.createdAt);
      console.log('Restaurant ID:', order.restaurantId);
      
      const rest = await FoodRestaurant.findById(order.restaurantId).select('name status').lean();
      console.log('Restaurant Name:', rest ? rest.name : 'Not found');
      console.log('Restaurant Status:', rest ? rest.status : 'N/A');

      // Test listOrdersRestaurant filter query
      const filter = {
        restaurantId: order.restaurantId,
        $or: [
          { "payment.method": { $in: ["cash", "wallet"] } },
          { "payment.status": { $in: ["paid", "authorized", "captured", "settled", "refunded"] } },
          { orderStatus: { $in: ["cancelled_by_user", "cancelled_by_restaurant", "cancelled_by_user_unavailable", "cancelled_by_admin"] } },
        ],
      };

      const matchedInList = await FoodOrder.findOne({ _id: order._id, ...filter }).lean();
      console.log('Matched in listOrdersRestaurant query?', matchedInList ? '✅ YES' : '❌ NO');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

check();
