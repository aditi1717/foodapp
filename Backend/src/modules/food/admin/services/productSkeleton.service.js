import mongoose from 'mongoose';
import { FoodProductSkeleton } from '../models/productSkeleton.model.js';
import { FoodCategory } from '../models/category.model.js';
import { FoodSubcategory } from '../models/subcategory.model.js';
import { FoodItem } from '../models/food.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

export async function createProductSkeleton(data = {}) {
    const { name, image, description = '', categoryId, subcategoryId = null, foodType = 'Non-Veg' } = data;

    if (!name || !String(name).trim()) throw new ValidationError('Skeleton name is required');
    if (!image || !String(image).trim()) throw new ValidationError('Image URL is required');
    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) throw new ValidationError('Valid category is required');

    const category = await FoodCategory.findById(categoryId).lean();
    if (!category) throw new ValidationError('Selected category not found');

    const subcatCount = await FoodSubcategory.countDocuments({ categoryId: new mongoose.Types.ObjectId(categoryId) });
    if (subcatCount > 0 && !subcategoryId) {
        throw new ValidationError('Subcategory is required for this category');
    }

    let subcategoryName = '';
    if (subcategoryId) {
        if (!mongoose.Types.ObjectId.isValid(subcategoryId)) throw new ValidationError('Invalid subcategory ID');
        const subcat = await FoodSubcategory.findById(subcategoryId).lean();
        if (subcat) subcategoryName = subcat.name || '';
    }

    const doc = await FoodProductSkeleton.create({
        name: String(name).trim(),
        image: String(image).trim(),
        description: String(description || '').trim(),
        categoryId,
        categoryName: category.name || '',
        subcategoryId: subcategoryId || null,
        subcategoryName,
        foodType: ['Veg', 'Non-Veg'].includes(foodType) ? foodType : 'Non-Veg',
        isActive: true
    });

    return doc.toObject();
}

export async function getProductSkeletons(query = {}) {
    const { search = '', categoryId, subcategoryId, page = 1, limit = 50, isActive } = query;
    const filter = {};

    if (isActive !== undefined && isActive !== '') {
        filter.isActive = String(isActive) === 'true';
    }
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
        filter.categoryId = new mongoose.Types.ObjectId(categoryId);
    }
    if (subcategoryId && mongoose.Types.ObjectId.isValid(subcategoryId)) {
        filter.subcategoryId = new mongoose.Types.ObjectId(subcategoryId);
    }
    if (search && String(search).trim()) {
        const term = String(search).trim();
        filter.$or = [
            { name: { $regex: term, $options: 'i' } },
            { description: { $regex: term, $options: 'i' } },
            { categoryName: { $regex: term, $options: 'i' } }
        ];
    }

    const skip = Math.max(0, (Number(page) || 1) - 1) * Math.max(1, Math.min(200, Number(limit) || 50));
    const limitNum = Math.max(1, Math.min(200, Number(limit) || 50));

    const [items, total] = await Promise.all([
        FoodProductSkeleton.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        FoodProductSkeleton.countDocuments(filter)
    ]);

    const skeletonIds = items.map(i => i._id);
    const counts = skeletonIds.length > 0
        ? await FoodItem.aggregate([
            { $match: { skeletonId: { $in: skeletonIds } } },
            { $group: { _id: '$skeletonId', count: { $sum: 1 } } }
          ])
        : [];

    const countMap = new Map();
    counts.forEach(c => {
        if (c._id) countMap.set(String(c._id), c.count);
    });

    const itemsWithCounts = items.map(item => ({
        ...item,
        linkedProductsCount: countMap.get(String(item._id)) || 0
    }));

    return {
        items: itemsWithCounts,
        pagination: {
            page: Number(page) || 1,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
        }
    };
}

export async function getProductSkeletonById(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const item = await FoodProductSkeleton.findById(id).lean();
    return item;
}

export async function updateProductSkeleton(id, data = {}) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid skeleton ID');
    const skeleton = await FoodProductSkeleton.findById(id);
    if (!skeleton) throw new ValidationError('Product Skeleton not found');

    const oldName = skeleton.name;
    const oldCategoryId = skeleton.categoryId;
    const { name, image, description, categoryId, subcategoryId, foodType, isActive } = data;

    if (name !== undefined) skeleton.name = String(name).trim();
    if (image !== undefined) skeleton.image = String(image).trim();
    if (description !== undefined) skeleton.description = String(description).trim();
    if (foodType !== undefined && ['Veg', 'Non-Veg'].includes(foodType)) skeleton.foodType = foodType;
    if (isActive !== undefined) skeleton.isActive = Boolean(isActive);

    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
        const category = await FoodCategory.findById(categoryId).lean();
        if (category) {
            skeleton.categoryId = category._id;
            skeleton.categoryName = category.name || '';
        }
    }

    if (subcategoryId !== undefined) {
        if (!subcategoryId) {
            skeleton.subcategoryId = null;
            skeleton.subcategoryName = '';
        } else if (mongoose.Types.ObjectId.isValid(subcategoryId)) {
            const subcat = await FoodSubcategory.findById(subcategoryId).lean();
            if (subcat) {
                skeleton.subcategoryId = subcat._id;
                skeleton.subcategoryName = subcat.name || '';
            }
        }
    }

    await skeleton.save();

    // Auto-propagate real-time updates to all linked shop food items
    const foodItemUpdates = {};
    if (name !== undefined) foodItemUpdates.name = skeleton.name;
    if (image !== undefined) foodItemUpdates.image = skeleton.image;
    if (description !== undefined) foodItemUpdates.description = skeleton.description;
    if (foodType !== undefined) foodItemUpdates.foodType = skeleton.foodType;
    if (categoryId !== undefined) {
        foodItemUpdates.categoryId = skeleton.categoryId;
        foodItemUpdates.categoryName = skeleton.categoryName;
    }
    if (subcategoryId !== undefined) {
        foodItemUpdates.subcategoryId = skeleton.subcategoryId;
        foodItemUpdates.subcategoryName = skeleton.subcategoryName;
    }

    if (Object.keys(foodItemUpdates).length > 0) {
        const queryOr = [
            { skeletonId: skeleton._id },
            { skeletonId: String(skeleton._id) }
        ];
        if (oldCategoryId) {
            queryOr.push({ categoryId: oldCategoryId, name: oldName });
            if (oldName && oldName !== skeleton.name) {
                queryOr.push({ categoryId: oldCategoryId, name: skeleton.name });
            }
        }
        if (skeleton.categoryId) {
            queryOr.push({ categoryId: skeleton.categoryId, name: skeleton.name });
        }
        await FoodItem.updateMany(
            { $or: queryOr },
            {
                $set: {
                    ...foodItemUpdates,
                    skeletonId: skeleton._id,
                    isFromSkeleton: true
                }
            }
        );
    }

    return skeleton.toObject();
}

export async function deleteProductSkeleton(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid skeleton ID');
    const deleted = await FoodProductSkeleton.findByIdAndDelete(id).lean();
    if (deleted) {
        // Unlink food items (or keep link with isFromSkeleton flag)
        await FoodItem.updateMany({ skeletonId: id }, { $set: { skeletonId: null, isFromSkeleton: false } });
    }
    return deleted;
}

export async function getSkeletonsByCategory(categoryId, subcategoryId = null) {
    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) return [];

    const filter = {
        categoryId: new mongoose.Types.ObjectId(categoryId),
        isActive: true
    };

    if (subcategoryId && mongoose.Types.ObjectId.isValid(subcategoryId)) {
        filter.subcategoryId = new mongoose.Types.ObjectId(subcategoryId);
    }

    const items = await FoodProductSkeleton.find(filter)
        .sort({ name: 1 })
        .lean();

    return items;
}
