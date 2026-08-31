import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from './logger.js';

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    const { emailHost, emailPort, emailUser, emailPass } = config;
    if (!emailHost || !emailUser || !emailPass) {
        logger.warn('Email not configured: EMAIL_HOST, EMAIL_USER, EMAIL_PASS required');
        return null;
    }
    transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort || 587,
        secure: emailPort === 465,
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });
    return transporter;
}

/**
 * Send OTP email for admin forgot password.
 * @param {string} to - Recipient email
 * @param {string} otp - 6-digit OTP
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
export async function sendAdminResetOtpEmail(to, otp) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Admin OTP email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const subject = 'Your password reset code – FreshCut Local Admin';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Password reset code</h2>
  <p>Use the code below to reset your admin password. It is valid for 10 minutes.</p>
  <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; background: #f5f5f5; padding: 12px 16px; border-radius: 8px;">${otp}</p>
  <p style="color: #666; font-size: 14px;">If you did not request this, you can ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">FreshCut Local Admin</p>
</body>
</html>`;
    const text = `Your password reset code is: ${otp}. It is valid for 10 minutes. If you did not request this, ignore this email.`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `FreshCut Local <${from}>`,
            to,
            subject,
            text,
            html
        });
        logger.info(`Admin reset OTP email sent to ${to}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send admin OTP email to ${to}:`, err.message);
        return false;
    }
}

/**
 * Send order delivered email with attached invoice PDF.
 * @param {string} toEmail - Customer email address
 * @param {Object} order - Populated food order object
 * @param {Buffer} pdfBuffer - Binary buffer of the generated PDF invoice
 * @returns {Promise<boolean>}
 */
export async function sendOrderDeliveryInvoiceEmail(toEmail, order, pdfBuffer) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Delivery invoice email skipped: SMTP not configured');
        return false;
    }

    const orderId = order.orderId || order._id || 'N/A';
    const customerName = order.customerName || order.userId?.name || 'Customer';
    const shopName = order.shopName || order.shop || order.shopId?.shopName || 'FreshCut Local Restaurant';
    const paymentType = order.paymentType || order.payment?.method || 'Online Payment';
    const addressObj = order.customerAddress || order.deliveryAddress || order.address;
    const deliveryAddress = typeof addressObj === 'string'
        ? addressObj
        : [addressObj?.street, addressObj?.city, addressObj?.zipCode].filter(Boolean).join(', ') || 'N/A';
    const items = Array.isArray(order.items) ? order.items : [];
    
    let itemsSubtotalSum = 0;
    const itemsRowsHtml = items.map((item) => {
        const qty = Number(item.quantity || 1);
        const name = item.name || item.itemName || 'Food Item';
        const price = Number(item.price || 0);
        const lineTotal = qty * price;
        itemsSubtotalSum += lineTotal;
        return `
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155;">
              <span style="display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 6px;">${qty}x</span>
              ${name}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; text-align: right; font-weight: 500;">
              INR ${lineTotal.toFixed(2)}
            </td>
          </tr>`;
    }).join('');

    const pricing = order.pricing || {};
    const subtotal = itemsSubtotalSum > 0
        ? itemsSubtotalSum
        : Number(order.subtotal ?? order.totalItemAmount ?? pricing.subtotal ?? 0);
    const deliveryFee = Number(order.deliveryFee ?? order.deliveryCharge ?? pricing.deliveryFee ?? 0);
    const platformFee = Number(order.platformFee ?? pricing.platformFee ?? 0);
    const taxAmount = Number(order.taxAmount ?? order.vatTax ?? pricing.tax ?? 0);
    const discountAmount = Number(order.discountAmount ?? order.couponDiscount ?? pricing.discount ?? 0);
    const computedTotal = subtotal + deliveryFee + platformFee + taxAmount - discountAmount;
    const totalAmount = Number(order.totalAmount ?? pricing.total ?? computedTotal);

    const subject = `Your order #${orderId} from ${shopName} has been delivered! 😋 Receipt & Invoice Attached`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px 10px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    
    <!-- Top Brand Header -->
    <div style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">FreshCut Local</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #ccfbf1; font-weight: 500;">Fresh & Fast Food Delivery</p>
    </div>

    <!-- Order Delivered Banner -->
    <div style="background: #f0fdf4; border-bottom: 1px solid #dcfce7; padding: 18px 24px; text-align: center;">
      <div style="display: inline-block; background: #22c55e; color: #ffffff; border-radius: 50px; padding: 4px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
        ✓ Order Delivered
      </div>
      <h2 style="margin: 0; font-size: 18px; color: #14532d; font-weight: 700;">Hope you enjoy your meal, ${customerName}! 🎉</h2>
    </div>

    <!-- Main Content Body -->
    <div style="padding: 24px;">
      
      <!-- Metadata Grid -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px;">
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; width: 50%;">
            <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; display: block;">Order ID</span>
            <strong style="color: #0f766e; font-size: 14px;">#${orderId}</strong>
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; width: 50%;">
            <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; display: block;">Restaurant</span>
            <strong style="color: #1e293b;">${shopName}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; display: block;">Payment Method</span>
            <strong style="color: #1e293b;">${paymentType}</strong>
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; display: block;">Delivery Address</span>
            <strong style="color: #1e293b;">${deliveryAddress}</strong>
          </td>
        </tr>
      </table>

      <!-- Items Ordered Table -->
      <h3 style="font-size: 14px; font-weight: 700; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px 0;">Items Ordered</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left;">
            <th style="padding: 10px 12px; font-size: 12px; color: #475569; font-weight: 700;">Item</th>
            <th style="padding: 10px 12px; font-size: 12px; color: #475569; font-weight: 700; text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml || '<tr><td style="padding: 10px 12px;" colspan="2">Order items summary</td></tr>'}
        </tbody>
      </table>

      <!-- Billing Breakdown Box -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Item Subtotal:</td>
            <td style="padding: 4px 0; text-align: right; color: #1e293b; font-weight: 600;">INR ${subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Delivery Fee:</td>
            <td style="padding: 4px 0; text-align: right; color: #1e293b; font-weight: 600;">INR ${deliveryFee.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Platform Fee:</td>
            <td style="padding: 4px 0; text-align: right; color: #1e293b; font-weight: 600;">INR ${platformFee.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Tax / GST:</td>
            <td style="padding: 4px 0; text-align: right; color: #1e293b; font-weight: 600;">INR ${taxAmount.toFixed(2)}</td>
          </tr>
          ${discountAmount > 0 ? `
          <tr>
            <td style="padding: 4px 0; color: #16a34a;">Discount Applied:</td>
            <td style="padding: 4px 0; text-align: right; color: #16a34a; font-weight: 600;">- INR ${discountAmount.toFixed(2)}</td>
          </tr>` : ''}
          <tr style="border-top: 1px solid #cbd5e1;">
            <td style="padding: 10px 0 4px 0; font-size: 15px; font-weight: 700; color: #0f766e;">Total Paid:</td>
            <td style="padding: 10px 0 4px 0; text-align: right; font-size: 16px; font-weight: 800; color: #0f766e;">INR ${totalAmount.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <!-- Attachment Note Banner -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px; text-align: center; color: #1e40af; font-size: 13px; font-weight: 500;">
        📄 <strong>Official Tax Invoice Attached</strong><br>
        We have attached your PDF invoice file (<strong>Invoice_${orderId}.pdf</strong>) to this email for your accounting records.
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
      <p style="margin: 0 0 6px 0;">Need help with your order? Open the app and visit <strong>Help & Support</strong>.</p>
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">© ${new Date().getFullYear()} FreshCut Local. All rights reserved.</p>
    </div>

  </div>
</body>
</html>`;

    const text = `Hi ${customerName}, Your order #${orderId} from ${shopName} has been delivered. Total Paid: INR ${totalAmount.toFixed(2)}. Please find your item details in this email and official PDF invoice attached.`;

    try {
        await trans.sendMail({
            from: typeof config.emailFrom === 'string' && config.emailFrom.includes('<')
                ? config.emailFrom
                : `FreshCut Local <${config.emailFrom || config.emailUser}>`,
            to: toEmail,
            subject,
            text,
            html,
            attachments: [
                {
                    filename: `Invoice_${orderId}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf',
                },
            ],
        });
        logger.info(`Delivery invoice email sent to ${toEmail} for order ${orderId}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send delivery email to ${toEmail}:`, err.message);
        return false;
    }
}


