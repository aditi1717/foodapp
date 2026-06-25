import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/iggymet';

async function diagnose() {
  try {
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;

    // 1. Get all zones
    const zones = await db.collection('food_zones').find({}).toArray();
    console.log('\n--- ZONES ---');
    zones.forEach(z => {
      console.log(`Zone ID: ${z._id}, Name: ${z.name}`);
    });

    // 2. Get all shops, their names, and their zones
    const shops = await db.collection('food_shops').find({}).toArray();
    console.log('\n--- SHOPS ---');
    shops.forEach(r => {
      console.log(`Shop ID: ${r._id}, Name: ${r.shopName || r.name}, Zone ID: ${r.zoneId || r.serviceZoneId}, status: ${r.status}`);
    });

    // 3. Get all food items with category containing 'chat' or similar
    const foods = await db.collection('food_items').find({}).toArray();
    console.log('\n--- FOOD ITEMS ---');
    foods.forEach(f => {
      console.log(`Food ID: ${f._id}, Name: ${f.name}, Shop ID: ${f.shopId}, Category: ${f.categoryName || f.category}, Status: ${f.approvalStatus}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

diagnose();
