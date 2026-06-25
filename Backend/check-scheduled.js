import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your_db';

async function check() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const FoodOrder = mongoose.model('FoodOrder', new mongoose.Schema({}, { strict: false }), 'food_orders');
    const FoodShop = mongoose.model('FoodShop', new mongoose.Schema({}, { strict: false }), 'food_shops');

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
      console.log('Shop ID:', order.shopId);
      
      const rest = await FoodShop.findById(order.shopId).select('name status').lean();
      console.log('Shop Name:', rest ? rest.name : 'Not found');
      console.log('Shop Status:', rest ? rest.status : 'N/A');

      // Test listOrdersShop filter query
      const filter = {
        shopId: order.shopId,
        $or: [
          { "payment.method": { $in: ["cash", "wallet"] } },
          { "payment.status": { $in: ["paid", "authorized", "captured", "settled", "refunded"] } },
          { orderStatus: { $in: ["cancelled_by_user", "cancelled_by_shop", "cancelled_by_user_unavailable", "cancelled_by_admin"] } },
        ],
      };

      const matchedInList = await FoodOrder.findOne({ _id: order._id, ...filter }).lean();
      console.log('Matched in listOrdersShop query?', matchedInList ? '✅ YES' : '❌ NO');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

check();
