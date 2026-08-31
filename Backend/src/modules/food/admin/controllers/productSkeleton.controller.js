import * as skeletonService from '../services/productSkeleton.service.js';

export async function createProductSkeletonController(req, res, next) {
    try {
        const item = await skeletonService.createProductSkeleton(req.body || {});
        res.status(201).json({
            success: true,
            message: 'Product Skeleton created successfully',
            data: { skeleton: item }
        });
    } catch (error) {
        next(error);
    }
}

export async function getProductSkeletonsController(req, res, next) {
    try {
        const data = await skeletonService.getProductSkeletons(req.query || {});
        res.status(200).json({
            success: true,
            message: 'Product Skeletons fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getProductSkeletonByIdController(req, res, next) {
    try {
        const item = await skeletonService.getProductSkeletonById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Product Skeleton not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Product Skeleton fetched successfully',
            data: { skeleton: item }
        });
    } catch (error) {
        next(error);
    }
}

export async function updateProductSkeletonController(req, res, next) {
    try {
        const item = await skeletonService.updateProductSkeleton(req.params.id, req.body || {});
        res.status(200).json({
            success: true,
            message: 'Product Skeleton updated successfully',
            data: { skeleton: item }
        });
    } catch (error) {
        next(error);
    }
}

export async function deleteProductSkeletonController(req, res, next) {
    try {
        const item = await skeletonService.deleteProductSkeleton(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Product Skeleton not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Product Skeleton deleted successfully'
        });
    } catch (error) {
        next(error);
    }
}

export async function getSkeletonsByCategoryController(req, res, next) {
    try {
        const { categoryId, subcategoryId } = req.query;
        const items = await skeletonService.getSkeletonsByCategory(categoryId, subcategoryId);
        res.status(200).json({
            success: true,
            message: 'Matching Product Skeletons fetched successfully',
            data: { skeletons: items }
        });
    } catch (error) {
        next(error);
    }
}
