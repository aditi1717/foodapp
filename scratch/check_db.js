import mongoose from 'mongoose';
import { FoodCategory } from './Backend/src/modules/Food/admin/models/category.model.js';

async function check() {
  try {
    // Try to find the connection string from .env
    const fs = await import('fs');
    const env = fs.readFileSync('./Backend/.env', 'utf8');
    const mongoUri = env.match(/MONGODB_URI=(.+)/)?.[1] || 'mongodb://localhost:27017/foodapp';
    
    console.log('Connecting to:', mongoUri.split('@').pop()); // Hide credentials
    await mongoose.connect(mongoUri.trim());
    
    const aditi = await FoodCategory.findOne({ name: /aditi/i });
    if (!aditi) {
      console.log('Category "aditi" not found');
      return;
    }
    
    console.log('Aditi Parent:', {
      id: aditi._id,
      name: aditi.name,
      approvalStatus: aditi.approvalStatus,
      isActive: aditi.isActive
    });
    
    const subs = await FoodCategory.find({ 
      $or: [
        { parentId: aditi._id }, 
        { parentCategoryId: aditi._id },
        { subCategoryOf: aditi._id }
      ] 
    });
    
    console.log(`Found ${subs.length} subcategories:`);
    subs.forEach(s => {
      console.log(`- ${s.name} (${s._id})`);
      console.log(`  Approval: ${s.approvalStatus}, isActive: ${s.isActive}`);
      console.log(`  ParentId: ${s.parentId}, ParentCategoryId: ${s.parentCategoryId}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

check();
