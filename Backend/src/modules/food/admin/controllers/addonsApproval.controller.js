import mongoose from 'mongoose';
import * as adminService from '../services/admin.service.js';
import { validateAddonAdminListQuery, validateAddonRejectDto } from '../validators/addonApproval.validator.js';

export async function getShopAddons(req, res, next) {
    try {
        const query = validateAddonAdminListQuery(req.query || {});
        const data = await adminService.getShopAddonsAdmin(query);
        res.status(200).json({ success: true, message: 'Shop add-ons fetched successfully', data });
    } catch (error) {
        next(error);
    }
}

export async function approveShopAddon(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid add-on id' });
        }
        const updated = await adminService.approveShopAddon(id);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Add-on not found' });
        }
        res.status(200).json({ success: true, message: 'Add-on approved successfully', data: { addon: updated } });
    } catch (error) {
        next(error);
    }
}

export async function rejectShopAddon(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid add-on id' });
        }
        const { reason } = validateAddonRejectDto(req.body || {});
        const updated = await adminService.rejectShopAddon(id, reason);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Add-on not found' });
        }
        res.status(200).json({ success: true, message: 'Add-on rejected successfully', data: { addon: updated } });
    } catch (error) {
        next(error);
    }
}

export async function updateShopAddon(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid add-on id' });
        }
        const updated = await adminService.updateShopAddonAdmin(id, req.body || {});
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Add-on not found' });
        }
        res.status(200).json({ success: true, message: 'Add-on updated successfully', data: { addon: updated } });
    } catch (error) {
        next(error);
    }
}
