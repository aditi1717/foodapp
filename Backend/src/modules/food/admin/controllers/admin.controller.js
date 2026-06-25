import mongoose from 'mongoose';
import * as adminService from '../services/admin.service.js';
import { validateCategoryListQuery, validateCategoryRejectDto, validateCategoryUpsertDto } from '../validators/category.validator.js';
import { validateSubcategoryListQuery, validateSubcategoryRejectDto, validateSubcategoryUpsertDto } from '../validators/subcategory.validator.js';
import { validateCreateOfferDto, validateUpdateOfferCartVisibilityDto } from '../validators/offer.validator.js';
import { validateAddDeliveryBonusDto } from '../validators/deliveryBonus.validator.js';
import { validateCheckCompletionsDto, validateEarningAddonHistoryActionDto, validateEarningAddonUpsertDto, validateToggleEarningAddonStatusDto } from '../validators/earningAddon.validator.js';
import { validateDeliveryCommissionRuleDto, validateOptionalStatusDto, validateShopCommissionUpsertDto } from '../validators/commission.validator.js';
import { validateFeeSettingsUpsertDto } from '../validators/feeSettings.validator.js';
import { validateDeliveryEmergencyHelpUpsertDto } from '../validators/deliveryEmergencyHelp.validator.js';
import { validateReferralSettingsUpsertDto } from '../validators/referralSettings.validator.js';
import { getOutletTimingsForShop, upsertOutletTimingsForShop } from '../../shop/services/outletTimings.service.js';

// ----- Customers / Users -----
export async function getCustomers(req, res, next) {
    try {
        const data = await adminService.getCustomers(req.query || {}, req.adminAuth || {});
        res.status(200).json({ success: true, message: 'Customers fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getCustomerById(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid customer id' });
        }
        const customer = await adminService.getCustomerById(id);
        if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
        res.status(200).json({ success: true, message: 'Customer fetched successfully', data: { user: customer, customer } });
    } catch (error) {
        next(error);
    }
}

export async function updateCustomerStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid customer id' });
        }
        const isActive = req.body?.isActive;
        const updated = await adminService.updateCustomerStatus(id, isActive);
        if (!updated) return res.status(404).json({ success: false, message: 'Customer not found' });
        res.status(200).json({ success: true, message: 'Customer status updated successfully', data: { user: updated, customer: updated } });
    } catch (error) {
        next(error);
    }
}

// ----- Safety / Emergency Reports -----
export async function getSafetyEmergencyReports(req, res, next) {
    try {
        const data = await adminService.getSafetyEmergencyReports(req.query || {});
        res.status(200).json({ success: true, message: 'Safety emergency reports fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateSafetyEmergencyStatus(req, res, next) {
    try {
        const { id } = req.params;
        const updated = await adminService.updateSafetyEmergencyStatus(id, req.body?.status);
        if (!updated) return res.status(404).json({ success: false, message: 'Report not found' });
        res.status(200).json({ success: true, message: 'Status updated successfully', data: { report: updated } });
    } catch (error) {
        next(error);
    }
}

export async function updateSafetyEmergencyPriority(req, res, next) {
    try {
        const { id } = req.params;
        const updated = await adminService.updateSafetyEmergencyPriority(id, req.body?.priority);
        if (!updated) return res.status(404).json({ success: false, message: 'Report not found' });
        res.status(200).json({ success: true, message: 'Priority updated successfully', data: { report: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteSafetyEmergencyReport(req, res, next) {
    try {
        const { id } = req.params;
        const deleted = await adminService.deleteSafetyEmergencyReport(id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Report not found' });
        res.status(200).json({ success: true, message: 'Safety emergency report deleted successfully', data: { report: deleted } });
    } catch (error) {
        next(error);
    }
}

export async function updateShopComplaint(req, res, next) {
    try {
        const { id } = req.params;
        const { status, adminResponse } = req.body;
        const updated = await adminService.updateShopComplaint(id, { status, adminResponse });
        res.status(200).json({ success: true, message: 'Complaint updated successfully', data: { complaint: updated } });
    } catch (error) {
        next(error);
    }
}

// ----- Shops -----
export async function getShopComplaints(req, res, next) {
    try {
        const data = await adminService.getShopComplaints(req.query || {});
        res.status(200).json({ success: true, message: 'Shop complaints fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function globalSearch(req, res, next) {
    try {
        const { query } = req.query;
        const data = await adminService.globalSearch(query);
        res.status(200).json({
            success: true,
            message: 'Global search results fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getShops(req, res, next) {
    try {
        const data = await adminService.getShops(req.query, req.adminAuth || {});
        res.status(200).json({
            success: true,
            message: 'Shops fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getShopReport(req, res, next) {
    try {
        const data = await adminService.getShopReport(req.query || {});
        res.status(200).json({
            success: true,
            message: 'Shop report fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getDashboardStats(req, res, next) {
    try {
        const data = await adminService.getDashboardStats(req.query || {}, req.adminAuth || {});
        res.status(200).json({
            success: true,
            message: 'Dashboard stats fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getTransactionReport(req, res, next) {
    try {
        const data = await adminService.getTransactionReport(req.query || {});
        res.status(200).json({
            success: true,
            message: 'Transaction report fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getTaxReport(req, res, next) {
    try {
        const data = await adminService.getTaxReport(req.query || {});
        res.status(200).json({
            success: true,
            message: 'Tax report fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getTaxReportDetail(req, res, next) {
    try {
        const { id } = req.params;
        const data = await adminService.getTaxReportDetail(id, req.query || {});
        res.status(200).json({
            success: true,
            message: 'Tax report detail fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getShopReviews(req, res, next) {
    try {
        const data = await adminService.getShopReviews(req.query);
        res.status(200).json({
            success: true,
            message: 'Shop reviews fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getShopById(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid shop id' });
        }
        const shop = await adminService.getShopById(id, req.adminAuth || {});
        if (!shop) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Shop fetched successfully',
            data: shop
        });
    } catch (error) {
        next(error);
    }
}

export async function getShopOutletTimings(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid shop id' });
        }
        const data = await getOutletTimingsForShop(id);
        return res.status(200).json({
            success: true,
            message: 'Outlet timings fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function updateShopOutletTimings(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid shop id' });
        }
        const data = await upsertOutletTimingsForShop(id, req.body?.outletTimings);
        return res.status(200).json({
            success: true,
            message: 'Outlet timings updated successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getShopAnalytics(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid shop id' });
        }
        const data = await adminService.getShopAnalytics(id);
        if (!data) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Shop analytics fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getShopMenuById(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid shop id' });
        }
        const menu = await adminService.getShopMenuById(id);
        if (!menu) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        res.status(200).json({ success: true, message: 'Menu fetched successfully', data: { menu } });
    } catch (error) {
        next(error);
    }
}

export async function updateShopMenuById(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid shop id' });
        }
        const menu = await adminService.updateShopMenuById(id, req.body || {});
        if (!menu) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        res.status(200).json({ success: true, message: 'Menu updated successfully', data: { menu } });
    } catch (error) {
        next(error);
    }
}

export async function updateShopById(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid shop id' });
        }
        const updated = await adminService.updateShopById(id, req.body || {}, req.adminAuth || {});
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        res.status(200).json({ success: true, message: 'Shop updated successfully', data: { shop: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteShopById(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid shop id' });
        }
        const result = await adminService.deleteShopById(id, req.adminAuth || {});
        if (!result) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Shop deleted successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
}

export async function updateShopStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid shop id' });
        }
        const updated = await adminService.updateShopStatus(id, req.body || {}, req.adminAuth || {});
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        res.status(200).json({ success: true, message: 'Shop status updated successfully', data: { shop: updated } });
    } catch (error) {
        next(error);
    }
}

export async function updateShopLocation(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid shop id' });
        }
        const updated = await adminService.updateShopLocation(id, req.body || {}, req.adminAuth || {});
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        res.status(200).json({ success: true, message: 'Shop location updated successfully', data: { shop: updated } });
    } catch (error) {
        next(error);
    }
}

// ----- Foods -----
export async function getFoods(req, res, next) {
    try {
        const data = await adminService.getFoods(req.query || {});
        res.status(200).json({ success: true, message: 'Foods fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createFood(req, res, next) {
    try {
        const created = await adminService.createFood(req.body || {});
        res.status(201).json({ success: true, message: 'Food created successfully', data: { food: created } });
    } catch (error) {
        next(error);
    }
}

export async function updateFood(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid food id' });
        }
        const updated = await adminService.updateFood(id, req.body || {});
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Food not found' });
        }
        res.status(200).json({ success: true, message: 'Food updated successfully', data: { food: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteFood(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid food id' });
        }
        const result = await adminService.deleteFood(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Food not found' });
        }
        res.status(200).json({ success: true, message: 'Food deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

// ----- Categories -----
export async function getCategories(req, res, next) {
    try {
        const query = validateCategoryListQuery(req.query || {});
        const data = await adminService.getCategories(query);
        res.status(200).json({ success: true, message: 'Categories fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createCategory(req, res, next) {
    try {
        const body = validateCategoryUpsertDto(req.body || {});
        const created = await adminService.createCategory(body);
        res.status(201).json({ success: true, message: 'Category created successfully', data: { category: created } });
    } catch (error) {
        next(error);
    }
}

export async function updateCategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category id' });
        }
        const body = validateCategoryUpsertDto(req.body || {});
        const updated = await adminService.updateCategory(id, body);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category updated successfully', data: { category: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteCategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category id' });
        }
        const result = await adminService.deleteCategory(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function toggleCategoryStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category id' });
        }
        const updated = await adminService.toggleCategoryStatus(id);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category status updated successfully', data: { category: updated } });
    } catch (error) {
        next(error);
    }
}

export async function approveCategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category id' });
        }
        const updated = await adminService.approveCategory(id);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Category not found or already approved' });
        }
        res.status(200).json({ success: true, message: 'Category approved successfully', data: { category: updated } });
    } catch (error) {
        next(error);
    }
}

export async function rejectCategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category id' });
        }
        const body = validateCategoryRejectDto(req.body || {});
        const updated = await adminService.rejectCategory(id, body.reason);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category rejected successfully', data: { category: updated } });
    } catch (error) {
        next(error);
    }
}

export async function makeCategoryGlobal(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category id' });
        }
        const updated = await adminService.makeCategoryGlobal(id);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category is now global', data: { category: updated } });
    } catch (error) {
        next(error);
    }
}

// ----- Offers & Coupons -----
export async function getAllOffers(req, res, next) {
    try {
        const data = await adminService.getAllOffers(req.query || {});
        res.status(200).json({ success: true, message: 'Offers fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createAdminOffer(req, res, next) {
    try {
        const body = validateCreateOfferDto(req.body || {});
        const created = await adminService.createAdminOffer(body);
        res.status(201).json({ success: true, message: 'Offer created successfully', data: { offer: created } });
    } catch (error) {
        next(error);
    }
}

export async function updateAdminOfferCartVisibility(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid offer id' });
        }
        const body = validateUpdateOfferCartVisibilityDto(req.body || {});
        const updated = await adminService.updateAdminOfferCartVisibility(id, body.itemId, body.showInCart);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        res.status(200).json({ success: true, message: 'Offer updated successfully', data: { offer: updated } });
    } catch (error) {
        next(error);
    }
}

export async function updateAdminOffer(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid offer id' });
        }
        const body = validateCreateOfferDto(req.body || {});
        const updated = await adminService.updateAdminOffer(id, body);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        res.status(200).json({ success: true, message: 'Offer updated successfully', data: { offer: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteAdminOffer(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid offer id' });
        }
        const result = await adminService.deleteAdminOffer(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        res.status(200).json({ success: true, message: 'Offer deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function getPendingShopOffers(req, res, next) {
    try {
        const data = await adminService.getPendingShopOffers(req.query || {});
        res.status(200).json({ success: true, message: 'Pending shop coupons fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function approveShopOffer(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid offer id' });
        }
        const updated = await adminService.approveShopOffer(id);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        res.status(200).json({ success: true, message: 'Offer approved successfully', data: { offer: updated } });
    } catch (error) {
        next(error);
    }
}

export async function rejectShopOffer(req, res, next) {
    try {
        const { id } = req.params;
        const reason = req.body?.reason || '';
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid offer id' });
        }
        const updated = await adminService.rejectShopOffer(id, reason);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        res.status(200).json({ success: true, message: 'Offer rejected successfully', data: { offer: updated } });
    } catch (error) {
        next(error);
    }
}

export async function getPendingShopProductOffers(req, res, next) {
    try {
        const data = await adminService.getPendingShopProductOffers(req.query || {});
        res.status(200).json({ success: true, message: 'Pending shop product offers fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function approveShopProductOffer(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid offer id' });
        }
        const updated = await adminService.approveShopProductOffer(id);
        if (!updated) return res.status(404).json({ success: false, message: 'Offer not found' });
        res.status(200).json({ success: true, message: 'Offer approved successfully', data: { offer: updated } });
    } catch (error) {
        next(error);
    }
}

export async function rejectShopProductOffer(req, res, next) {
    try {
        const { id } = req.params;
        const reason = req.body?.reason || '';
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid offer id' });
        }
        const updated = await adminService.rejectShopProductOffer(id, reason);
        if (!updated) return res.status(404).json({ success: false, message: 'Offer not found' });
        res.status(200).json({ success: true, message: 'Offer rejected successfully', data: { offer: updated } });
    } catch (error) {
        next(error);
    }
}


export async function getSupportTicketsController(req, res, next) {
    try {
        const data = await adminService.getSupportTickets(req.query || {});
        res.status(200).json({ success: true, message: 'Support tickets fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateSupportTicketController(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid ticket id' });
        }
        const updated = await adminService.updateSupportTicket(id, req.body || {});
        if (!updated) return res.status(404).json({ success: false, message: 'Ticket not found' });
        res.status(200).json({ success: true, message: 'Support ticket updated successfully', data: { ticket: updated } });
    } catch (error) {
        next(error);
    }
}

export async function getPendingShops(req, res, next) {
    try {
        const pending = await adminService.getPendingShops();
        res.status(200).json({
            success: true,
            message: 'Pending shops fetched successfully',
            data: pending
        });
    } catch (error) {
        next(error);
    }
}

// ----- Delivery partner bonus (admin) -----
export async function getDeliveryPartnerBonusTransactions(req, res, next) {
    try {
        const data = await adminService.getDeliveryPartnerBonusTransactions(req.query || {});
        res.status(200).json({ success: true, message: 'Bonus transactions fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function addDeliveryPartnerBonus(req, res, next) {
    try {
        const body = validateAddDeliveryBonusDto(req.body || {});
        const created = await adminService.addDeliveryPartnerBonus(body, req.user);
        res.status(201).json({ success: true, message: 'Bonus added successfully', data: { transaction: created } });
    } catch (error) {
        next(error);
    }
}

export async function getDeliveryEarnings(req, res, next) {
    try {
        const data = await adminService.getDeliveryEarnings(req.query || {});
        res.status(200).json({ success: true, message: 'Delivery earnings fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

// ----- Earning Addon (admin) -----
export async function getEarningAddons(req, res, next) {
    try {
        const data = await adminService.getEarningAddons();
        res.status(200).json({ success: true, message: 'Earning addons fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createEarningAddon(req, res, next) {
    try {
        const body = validateEarningAddonUpsertDto(req.body || {});
        const created = await adminService.createEarningAddon(body);
        res.status(201).json({ success: true, message: 'Earning addon created successfully', data: { earningAddon: created } });
    } catch (error) {
        next(error);
    }
}

export async function updateEarningAddon(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid earning addon id' });
        }
        const body = validateEarningAddonUpsertDto(req.body || {});
        const updated = await adminService.updateEarningAddon(id, body);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Earning addon not found' });
        }
        res.status(200).json({ success: true, message: 'Earning addon updated successfully', data: { earningAddon: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteEarningAddon(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid earning addon id' });
        }
        const result = await adminService.deleteEarningAddon(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Earning addon not found' });
        }
        res.status(200).json({ success: true, message: 'Earning addon deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function toggleEarningAddonStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid earning addon id' });
        }
        const { status } = validateToggleEarningAddonStatusDto(req.body || {});
        const updated = await adminService.toggleEarningAddonStatus(id, status);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Earning addon not found' });
        }
        res.status(200).json({ success: true, message: 'Status updated successfully', data: { earningAddon: updated } });
    } catch (error) {
        next(error);
    }
}

export async function getEarningAddonHistory(req, res, next) {
    try {
        const data = await adminService.getEarningAddonHistory(req.query || {});
        res.status(200).json({ success: true, message: 'Earning addon history fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function creditEarningToWallet(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid history id' });
        }
        const { notes } = validateEarningAddonHistoryActionDto(req.body || {});
        const updated = await adminService.creditEarningAddonHistory(id, notes);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'History record not found' });
        }
        res.status(200).json({ success: true, message: 'Earning credited successfully', data: { history: updated } });
    } catch (error) {
        next(error);
    }
}

export async function cancelEarningAddonHistory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid history id' });
        }
        const { reason } = validateEarningAddonHistoryActionDto(req.body || {});
        const updated = await adminService.cancelEarningAddonHistory(id, reason);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'History record not found' });
        }
        res.status(200).json({ success: true, message: 'Earning cancelled successfully', data: { history: updated } });
    } catch (error) {
        next(error);
    }
}

export async function checkEarningAddonCompletions(req, res, next) {
    try {
        const { deliveryPartnerId, force } = validateCheckCompletionsDto(req.body || {});
        const data = await adminService.checkEarningAddonCompletions(deliveryPartnerId, force);
        res.status(200).json({ success: true, message: 'Completion check done', data });
    } catch (error) {
        next(error);
    }
}

// ----- Shop Commission (admin) -----
export async function getShopCommissions(req, res, next) {
    try {
        const data = await adminService.getShopCommissions();
        res.status(200).json({ success: true, message: 'Shop commissions fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getShopCommissionBootstrap(req, res, next) {
    try {
        const data = await adminService.getShopCommissionBootstrap();
        res.status(200).json({ success: true, message: 'Shop commission bootstrap fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getShopCommissionById(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid commission id' });
        }
        const commission = await adminService.getShopCommissionById(id);
        if (!commission) {
            return res.status(404).json({ success: false, message: 'Commission not found' });
        }
        res.status(200).json({ success: true, message: 'Commission fetched successfully', data: { commission } });
    } catch (error) {
        next(error);
    }
}

export async function createShopCommission(req, res, next) {
    try {
        const body = validateShopCommissionUpsertDto(req.body || {});
        const created = await adminService.createShopCommission(body);
        res.status(201).json({ success: true, message: 'Commission created successfully', data: { commission: created } });
    } catch (error) {
        next(error);
    }
}

export async function updateShopCommission(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid commission id' });
        }
        const body = validateShopCommissionUpsertDto(req.body || {});
        const updated = await adminService.updateShopCommission(id, body);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Commission not found' });
        }
        res.status(200).json({ success: true, message: 'Commission updated successfully', data: { commission: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteShopCommission(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid commission id' });
        }
        const result = await adminService.deleteShopCommission(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Commission not found' });
        }
        res.status(200).json({ success: true, message: 'Commission deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function toggleShopCommissionStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid commission id' });
        }
        const updated = await adminService.toggleShopCommissionStatus(id);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Commission not found' });
        }
        res.status(200).json({ success: true, message: 'Status updated successfully', data: { commission: updated } });
    } catch (error) {
        next(error);
    }
}

// ----- Delivery commission rules (admin) -----
export async function getDeliveryCommissionRules(req, res, next) {
    try {
        const data = await adminService.getDeliveryCommissionRules();
        res.status(200).json({ success: true, message: 'Commission rules fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createDeliveryCommissionRule(req, res, next) {
    try {
        const body = validateDeliveryCommissionRuleDto(req.body || {});
        const created = await adminService.createDeliveryCommissionRule(body);
        res.status(201).json({ success: true, message: 'Commission rule created successfully', data: { commission: created } });
    } catch (error) {
        next(error);
    }
}

export async function updateDeliveryCommissionRule(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid commission id' });
        }
        const body = validateDeliveryCommissionRuleDto(req.body || {});
        const updated = await adminService.updateDeliveryCommissionRule(id, body);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Commission rule not found' });
        }
        res.status(200).json({ success: true, message: 'Commission rule updated successfully', data: { commission: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteDeliveryCommissionRule(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid commission id' });
        }
        const result = await adminService.deleteDeliveryCommissionRule(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Commission rule not found' });
        }
        res.status(200).json({ success: true, message: 'Commission rule deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function toggleDeliveryCommissionRuleStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid commission id' });
        }
        const { status } = validateOptionalStatusDto(req.body || {});
        if (typeof status !== 'boolean') {
            return res.status(400).json({ success: false, message: 'status is required' });
        }
        const updated = await adminService.toggleDeliveryCommissionRuleStatus(id, status);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Commission rule not found' });
        }
        res.status(200).json({ success: true, message: 'Status updated successfully', data: { commission: updated } });
    } catch (error) {
        next(error);
    }
}

// ----- Fee Settings (admin) -----
export async function getFeeSettings(req, res, next) {
    try {
        const data = await adminService.getFeeSettings();
        res.status(200).json({ success: true, message: 'Fee settings fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createOrUpdateFeeSettings(req, res, next) {
    try {
        const body = validateFeeSettingsUpsertDto(req.body || {});
        const feeSettings = await adminService.upsertFeeSettings(body);
        res.status(200).json({ success: true, message: 'Fee settings saved successfully', data: { feeSettings } });
    } catch (error) {
        next(error);
    }
}

// ----- Referral Settings (admin) -----
export async function getReferralSettings(req, res, next) {
    try {
        const data = await adminService.getReferralSettings();
        res.status(200).json({ success: true, message: 'Referral settings fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createOrUpdateReferralSettings(req, res, next) {
    try {
        const body = validateReferralSettingsUpsertDto(req.body || {});
        const referralSettings = await adminService.upsertReferralSettings(body);
        res.status(200).json({ success: true, message: 'Referral settings saved successfully', data: { referralSettings } });
    } catch (error) {
        next(error);
    }
}

// ----- Delivery Cash Limit (admin) -----
export async function getDeliveryCashLimit(req, res, next) {
    try {
        const data = await adminService.getDeliveryCashLimitSettings();
        res.status(200).json({ success: true, message: 'Delivery cash limit fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateDeliveryCashLimit(req, res, next) {
    try {
        const data = await adminService.upsertDeliveryCashLimitSettings(req.body || {});
        res.status(200).json({ success: true, message: 'Delivery cash limit updated successfully', data });
    } catch (error) {
        next(error);
    }
}

// ----- Delivery Emergency Help (admin) -----
export async function getEmergencyHelp(req, res, next) {
    try {
        const data = await adminService.getDeliveryEmergencyHelp();
        res.status(200).json({ success: true, message: 'Emergency help fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createOrUpdateEmergencyHelp(req, res, next) {
    try {
        const body = validateDeliveryEmergencyHelpUpsertDto(req.body || {});
        const data = await adminService.upsertDeliveryEmergencyHelp(body);
        res.status(200).json({ success: true, message: 'Emergency help saved successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function approveShop(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid shop id'
            });
        }
        const shop = await adminService.approveShop(id);
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: 'Shop not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Shop approved successfully',
            data: shop
        });
    } catch (error) {
        next(error);
    }
}

export async function createShop(req, res, next) {
    try {
        const shop = await adminService.createShopByAdmin(req.body || {});
        res.status(201).json({
            success: true,
            message: 'Shop created successfully',
            data: shop
        });
    } catch (error) {
        next(error);
    }
}

export async function rejectShop(req, res, next) {
    try {
        const { id } = req.params;
        const { reason } = req.body || {};
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid shop id'
            });
        }
        const shop = await adminService.rejectShop(id, reason);
        if (!shop) {
            return res.status(404).json({
                success: false,
                message: 'Shop not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Shop rejected successfully',
            data: shop
        });
    } catch (error) {
        next(error);
    }
}

// ----- Delivery join requests -----
export async function getDeliveryJoinRequests(req, res, next) {
    try {
        const data = await adminService.getDeliveryJoinRequests(req.query);
        res.status(200).json({
            success: true,
            message: 'Delivery join requests fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}


// ----- Support tickets -----
export async function getSupportTicketStats(req, res, next) {
    try {
        const data = await adminService.getSupportTicketStats();
        res.status(200).json({
            success: true,
            message: 'Support ticket stats fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getSupportTickets(req, res, next) {
    try {
        const data = await adminService.getSupportTickets(req.query);
        res.status(200).json({
            success: true,
            message: 'Support tickets fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function updateSupportTicket(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid ticket id' });
        }
        const updated = await adminService.updateSupportTicket(id, req.body || {});
        if (!updated) return res.status(404).json({ success: false, message: 'Ticket not found' });
        res.status(200).json({ success: true, message: 'Support ticket updated successfully', data: { ticket: updated } });
    } catch (error) {
        next(error);
    }
}

// ----- Delivery partners -----
export async function getDeliveryPartners(req, res, next) {
    try {
        const data = await adminService.getDeliveryPartners(req.query, req.adminAuth || {});
        res.status(200).json({
            success: true,
            message: 'Delivery partners fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getDeliveryPartnersPendingZoneChange(req, res, next) {
    try {
        const data = await adminService.getDeliveryPartnersPendingZoneChange(req.query, req.adminAuth || {});
        res.status(200).json({
            success: true,
            message: 'Delivery partners pending zone change fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getDeliverymanReviews(req, res, next) {
    try {
        const data = await adminService.getDeliverymanReviews(req.query);
        res.status(200).json({
            success: true,
            message: 'Deliveryman reviews fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getContactMessages(req, res, next) {
    try {
        const data = await adminService.getContactMessages(req.query);
        res.status(200).json({
            success: true,
            message: 'Contact messages fetched successfully',
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function getDeliveryPartnerById(req, res, next) {
    try {
        const delivery = await adminService.getDeliveryPartnerById(req.params.id);
        if (!delivery) {
            return res.status(404).json({
                success: false,
                message: 'Delivery partner not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Delivery partner fetched successfully',
            data: { delivery }
        });
    } catch (error) {
        next(error);
    }
}

export async function approveDeliveryPartner(req, res, next) {
    try {
        const partner = await adminService.approveDeliveryPartner(req.params.id);
        if (!partner) {
            return res.status(404).json({
                success: false,
                message: 'Delivery partner not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Delivery partner approved successfully',
            data: partner
        });
    } catch (error) {
        next(error);
    }
}

export async function rejectDeliveryPartner(req, res, next) {
    try {
        const reason = req.body?.reason != null ? String(req.body.reason).trim() : '';
        const partner = await adminService.rejectDeliveryPartner(req.params.id, reason);
        if (!partner) {
            return res.status(404).json({
                success: false,
                message: 'Delivery partner not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Delivery partner rejected successfully',
            data: partner
        });
    } catch (error) {
        next(error);
    }
}

export async function updateDeliveryPartnerZone(req, res, next) {
    try {
        const zoneId = req.body?.zoneId != null ? String(req.body.zoneId).trim() : '';
        const partner = await adminService.updateDeliveryPartnerZone(req.params.id, zoneId, req.adminAuth || {});
        if (!partner) {
            return res.status(404).json({
                success: false,
                message: 'Delivery partner not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Delivery partner zone updated successfully',
            data: { partner }
        });
    } catch (error) {
        next(error);
    }
}

export async function approveDeliveryPartnerZoneChange(req, res, next) {
    try {
        const partner = await adminService.approveDeliveryPartnerZoneChange(req.params.id, req.adminAuth || {});
        if (!partner) {
            return res.status(404).json({
                success: false,
                message: 'Delivery partner not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Zone change approved successfully',
            data: { partner }
        });
    } catch (error) {
        next(error);
    }
}

export async function rejectDeliveryPartnerZoneChange(req, res, next) {
    try {
        const reason = req.body?.reason != null ? String(req.body.reason).trim() : '';
        const partner = await adminService.rejectDeliveryPartnerZoneChange(req.params.id, reason, req.adminAuth || {});
        if (!partner) {
            return res.status(404).json({
                success: false,
                message: 'Delivery partner not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Zone change rejected successfully',
            data: { partner }
        });
    } catch (error) {
        next(error);
    }
}

export async function getZones(req, res, next) {
    try {
        const data = await adminService.getZones(req.query || {}, req.adminAuth || {});
        res.status(200).json({ success: true, message: 'Zones fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getZoneById(req, res, next) {
    try {
        const zone = await adminService.getZoneById(req.params.id, req.adminAuth || {});
        if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });
        res.status(200).json({ success: true, message: 'Zone fetched successfully', data: { zone } });
    } catch (error) {
        next(error);
    }
}

export async function createZone(req, res, next) {
    try {
        const zone = await adminService.createZone(req.body || {});
        res.status(201).json({ success: true, message: 'Zone created successfully', data: { zone } });
    } catch (error) {
        next(error);
    }
}

export async function updateZone(req, res, next) {
    try {
        const zone = await adminService.updateZone(req.params.id, req.body || {});
        if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });
        res.status(200).json({ success: true, message: 'Zone updated successfully', data: { zone } });
    } catch (error) {
        next(error);
    }
}

export async function deleteZone(req, res, next) {
    try {
        const result = await adminService.deleteZone(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Zone not found' });
        res.status(200).json({ success: true, message: 'Zone deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function getWithdrawals(req, res, next) {
    try {
        const data = await adminService.getWithdrawals(req.query || {});
        res.status(200).json({ success: true, message: 'Withdrawals fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateWithdrawalStatus(req, res, next) {
    try {
        const { id } = req.params;
        const data = await adminService.updateWithdrawalStatus(id, req.body || {});
        res.status(200).json({ success: true, message: 'Withdrawal status updated successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getDeliveryWithdrawals(req, res, next) {
    try {
        const data = await adminService.getDeliveryWithdrawals(req.query || {});
        res.status(200).json({ success: true, message: 'Delivery withdrawals fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateDeliveryWithdrawalStatus(req, res, next) {
    try {
        const { id } = req.params;
        const data = await adminService.updateDeliveryWithdrawalStatus(id, req.body || {});
        res.status(200).json({ success: true, message: 'Delivery withdrawal status updated successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getDeliveryWallets(req, res, next) {
    try {
        const data = await adminService.getDeliveryWallets(req.query || {});
        res.status(200).json({ success: true, message: 'Delivery wallets fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getCashLimitSettlements(req, res, next) {
    try {
        const data = await adminService.getCashLimitSettlements(req.query || {});
        res.status(200).json({ success: true, message: 'Cash limit settlements fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getPayoutSettlementPreview(req, res, next) {
    try {
        const beneficiaryType = String(req.query?.beneficiaryType || 'delivery').toLowerCase();
        if (!['delivery', 'shop'].includes(beneficiaryType)) {
            return res.status(400).json({ success: false, message: 'Invalid beneficiaryType' });
        }
        const data = beneficiaryType === 'delivery' 
            ? await adminService.getDeliveryPayoutSettlementPreview(req.query || {}, req.adminAuth || {})
            : await adminService.getShopPayoutSettlementPreview(req.query || {}, req.adminAuth || {});
        res.status(200).json({ success: true, message: 'Payout settlement preview fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getPayoutSettlementHistory(req, res, next) {
    try {
        const beneficiaryType = String(req.query?.beneficiaryType || 'delivery').toLowerCase();
        if (!['delivery', 'shop'].includes(beneficiaryType)) {
            return res.status(400).json({ success: false, message: 'Invalid beneficiaryType' });
        }
        const data = beneficiaryType === 'delivery' 
            ? await adminService.getDeliveryPayoutSettlementHistory(req.query || {}, req.adminAuth || {})
            : await adminService.getShopPayoutSettlementHistory(req.query || {}, req.adminAuth || {});
        res.status(200).json({ success: true, message: 'Payout settlement history fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function markAllPayoutSettlementsPaid(req, res, next) {
    try {
        const beneficiaryType = String(req.body?.beneficiaryType || 'delivery').toLowerCase();
        if (!['delivery', 'shop'].includes(beneficiaryType)) {
            return res.status(400).json({ success: false, message: 'Invalid beneficiaryType' });
        }
        const result = beneficiaryType === 'delivery'
            ? await adminService.markAllDeliveryPayoutSettlementsPaid(req.body || {}, req.adminAuth || {})
            : await adminService.markAllShopPayoutSettlementsPaid(req.body || {}, req.adminAuth || {});
        res.status(200).json({ success: true, message: 'Payout settlements marked as paid successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function getPayoutSettlementHistoryBatchDetails(req, res, next) {
    try {
        const beneficiaryType = String(req.query?.beneficiaryType || 'delivery').toLowerCase();
        if (!['delivery', 'shop'].includes(beneficiaryType)) {
            return res.status(400).json({ success: false, message: 'Invalid beneficiaryType' });
        }
        const { batchId } = req.params;
        const data = beneficiaryType === 'delivery'
            ? await adminService.getDeliveryPayoutSettlementHistoryBatchDetails(batchId, req.adminAuth || {})
            : await adminService.getShopPayoutSettlementHistoryBatchDetails(batchId, req.adminAuth || {});
        if (!data) {
            return res.status(404).json({ success: false, message: 'Settlement batch not found' });
        }
        res.status(200).json({ success: true, message: 'Payout settlement batch details fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function getSidebarBadges(req, res, next) {
    try {
        const counts = await adminService.getSidebarBadges();
        res.status(200).json({ success: true, counts });
    } catch (error) {
        next(error);
    }
}

export async function getExpiredFssaiNotifications(req, res, next) {
    try {
        const { listExpiredFssaiShops } = await import('../../shop/services/fssaiExpiry.service.js');
        const items = await listExpiredFssaiShops();
        res.status(200).json({
            success: true,
            message: 'Expired FSSAI notifications fetched successfully',
            data: { items }
        });
    } catch (error) {
        next(error);
    }
}

// ===== STORE PRODUCTS (Admin ? Delivery Boy Shop) =====

export async function getStoreProducts(req, res, next) {
    try {
        const data = await adminService.getStoreProducts(req.query || {});
        res.status(200).json({ success: true, message: 'Store products fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function listAdmins(req, res, next) {
    try {
        const data = await adminService.listAdmins(req.query || {});
        res.status(200).json({
            success: true,
            message: 'Admins fetched successfully',
            data,
        });
    } catch (error) {
        next(error);
    }
}

export async function createAdmin(req, res, next) {
    try {
        const admin = await adminService.createAdmin(req.body || {}, req.adminAuth || {});
        res.status(201).json({
            success: true,
            message: 'Admin created successfully',
            data: { admin },
        });
    } catch (error) {
        next(error);
    }
}

export async function updateAdmin(req, res, next) {
    try {
        const admin = await adminService.updateAdmin(req.params.id, req.body || {}, req.adminAuth || {});
        res.status(200).json({
            success: true,
            message: 'Admin updated successfully',
            data: { admin },
        });
    } catch (error) {
        next(error);
    }
}

export async function updateAdminStatus(req, res, next) {
    try {
        const admin = await adminService.updateAdminStatus(req.params.id, req.body || {}, req.adminAuth || {});
        res.status(200).json({
            success: true,
            message: 'Admin status updated successfully',
            data: { admin },
        });
    } catch (error) {
        next(error);
    }
}

export async function deleteAdmin(req, res, next) {
    try {
        const result = await adminService.deleteAdmin(req.params.id, req.adminAuth || {});
        res.status(200).json({
            success: true,
            message: 'Admin deleted successfully',
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function createStoreProduct(req, res, next) {
    try {
        const product = await adminService.createStoreProduct(req.body || {});
        res.status(201).json({ success: true, message: 'Store product created successfully', data: { product } });
    } catch (error) {
        next(error);
    }
}

export async function updateStoreProduct(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid product id' });
        }
        const updated = await adminService.updateStoreProduct(id, req.body || {});
        if (!updated) return res.status(404).json({ success: false, message: 'Product not found' });
        res.status(200).json({ success: true, message: 'Store product updated successfully', data: { product: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteStoreProduct(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid product id' });
        }
        const deleted = await adminService.deleteStoreProduct(id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Product not found' });
        res.status(200).json({ success: true, message: 'Store product deleted successfully', data: { product: deleted } });
    } catch (error) {
        next(error);
    }
}

export async function updateStoreProductStock(req, res, next) {
    try {
        const { id } = req.params;
        const { variantId, stockDelta } = req.body || {};
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid product id' });
        }
        const updated = await adminService.updateStoreProductStock(id, variantId, stockDelta);
        res.status(200).json({ success: true, message: 'Stock updated successfully', data: { product: updated } });
    } catch (error) {
        next(error);
    }
}

export async function getStoreOrders(req, res, next) {
    try {
        const data = await adminService.getStoreOrders(req.query || {});
        res.status(200).json({ success: true, message: 'Store orders fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function updateStoreOrderStatus(req, res, next) {
    try {
        const order = await adminService.updateStoreOrderStatus(req.params.id, req.body || {});
        res.status(200).json({ success: true, message: 'Store order status updated successfully', data: { order } });
    } catch (error) {
        next(error);
    }
}

// ===== SUBCATEGORIES =====

export async function getSubcategories(req, res, next) {
    try {
        const query = validateSubcategoryListQuery(req.query || {});
        const data = await adminService.getSubcategories(query);
        res.status(200).json({ success: true, message: 'Subcategories fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function createSubcategory(req, res, next) {
    try {
        const body = validateSubcategoryUpsertDto(req.body || {});
        const created = await adminService.createSubcategory(body);
        res.status(201).json({ success: true, message: 'Subcategory created successfully', data: { subcategory: created } });
    } catch (error) {
        next(error);
    }
}

export async function updateSubcategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid subcategory id' });
        }
        const body = validateSubcategoryUpsertDto(req.body || {});
        const updated = await adminService.updateSubcategory(id, body);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Subcategory not found' });
        }
        res.status(200).json({ success: true, message: 'Subcategory updated successfully', data: { subcategory: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteSubcategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid subcategory id' });
        }
        const result = await adminService.deleteSubcategory(id);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Subcategory not found' });
        }
        res.status(200).json({ success: true, message: 'Subcategory deleted successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function toggleSubcategoryStatus(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid subcategory id' });
        }
        const updated = await adminService.toggleSubcategoryStatus(id);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Subcategory not found' });
        }
        res.status(200).json({ success: true, message: 'Subcategory status updated successfully', data: { subcategory: updated } });
    } catch (error) {
        next(error);
    }
}

export async function approveSubcategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid subcategory id' });
        }
        const updated = await adminService.approveSubcategory(id);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Subcategory not found or already approved' });
        }
        res.status(200).json({ success: true, message: 'Subcategory approved successfully', data: { subcategory: updated } });
    } catch (error) {
        next(error);
    }
}

export async function rejectSubcategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid subcategory id' });
        }
        const body = validateSubcategoryRejectDto(req.body || {});
        const updated = await adminService.rejectSubcategory(id, body.reason);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Subcategory not found' });
        }
        res.status(200).json({ success: true, message: 'Subcategory rejected successfully', data: { subcategory: updated } });
    } catch (error) {
        next(error);
    }
}
