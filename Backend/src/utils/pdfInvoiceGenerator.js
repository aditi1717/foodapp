import PDFDocument from 'pdfkit';

/**
 * Generate a PDF invoice buffer for a food order.
 * @param {Object} order - Populated food order object
 * @returns {Promise<Buffer>} PDF binary buffer
 */
export function generateInvoicePDFBuffer(order = {}) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 36, size: 'A4' });
            const buffers = [];

            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const orderId = order.orderId || order._id || 'N/A';
            const orderDate = order.createdAt
                ? new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : new Date().toLocaleDateString();

            // Palette
            const primaryColor = '#0f766e';
            const textDark = '#1e293b';
            const textMuted = '#64748b';
            const tableBg = '#f8fafc';

            // Header Banner
            doc.rect(0, 0, doc.page.width, 64).fill(primaryColor);
            doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('FreshCut Local', 36, 16);
            doc.fontSize(10).font('Helvetica').text('Official Tax Invoice & Order Breakdown', 36, 42);

            doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text(`Invoice #: ${orderId}`, doc.page.width - 220, 16, { align: 'right', width: 184 });
            doc.fontSize(9.5).font('Helvetica').text(`Date: ${orderDate}`, doc.page.width - 220, 34, { align: 'right', width: 184 });

            doc.y = 82;

            // Details Section
            const customerName = order.customerName || order.userId?.name || 'Customer';
            const customerPhone = order.customerPhone || order.userId?.phone || 'N/A';
            const addressObj = order.customerAddress || order.deliveryAddress || order.address;
            const deliveryAddress = typeof addressObj === 'string'
                ? addressObj
                : [addressObj?.street, addressObj?.city, addressObj?.zipCode].filter(Boolean).join(', ') || 'N/A';
            const shopName = order.shopName || order.shop || order.shopId?.shopName || 'FreshCut Local Restaurant';

            doc.fillColor(textDark).fontSize(10.5).font('Helvetica-Bold').text('CUSTOMER DETAILS', 36, doc.y);
            doc.fontSize(9).font('Helvetica').fillColor(textMuted);
            doc.text(`Name: ${customerName}`, 36, doc.y + 4);
            doc.text(`Phone: ${customerPhone}`);
            doc.text(`Address: ${deliveryAddress}`, { width: 240 });

            const rightColY = 82;
            doc.fillColor(textDark).fontSize(10.5).font('Helvetica-Bold').text('SHOP / ORDER DETAILS', 320, rightColY);
            doc.fontSize(9).font('Helvetica').fillColor(textMuted);
            doc.text(`Shop: ${shopName}`, 320, rightColY + 18);
            doc.text(`Payment: ${order.paymentType || order.payment?.method || 'Paid'}`);
            doc.text(`Status: Delivered`);

            doc.y = Math.max(doc.y, rightColY + 60) + 12;

            // Items Table
            doc.fillColor(textDark).fontSize(11).font('Helvetica-Bold').text('ORDER ITEMS', 36, doc.y);
            doc.moveDown(0.4);

            const tableTop = doc.y;
            const pageWidth = doc.page.width - 72;
            doc.rect(36, tableTop, pageWidth, 20).fill(tableBg);

            doc.fillColor(textDark).fontSize(9).font('Helvetica-Bold');
            doc.text('Qty', 44, tableTop + 5, { width: 30 });
            doc.text('Item Description', 84, tableTop + 5, { width: 260 });
            doc.text('Unit Price', 360, tableTop + 5, { width: 90, align: 'right' });
            doc.text('Line Total', 460, tableTop + 5, { width: 95, align: 'right' });

            let y = tableTop + 24;
            const items = Array.isArray(order.items) ? order.items : [];
            let itemsSubtotalSum = 0;

            if (items.length > 0) {
                items.forEach((item) => {
                    const qty = Number(item.quantity || 1);
                    const name = item.name || item.itemName || 'Food Item';
                    const price = Number(item.price || 0);
                    const lineTotal = qty * price;
                    itemsSubtotalSum += lineTotal;

                    doc.fillColor(textDark).fontSize(9).font('Helvetica');
                    doc.text(String(qty), 44, y, { width: 30 });
                    doc.text(name, 84, y, { width: 260 });
                    doc.text(`INR ${price.toFixed(2)}`, 360, y, { width: 90, align: 'right' });
                    doc.text(`INR ${lineTotal.toFixed(2)}`, 460, y, { width: 95, align: 'right' });
                    y += 18;
                });
            } else {
                itemsSubtotalSum = Number(order.totalAmount || order.pricing?.total || 0);
                doc.fillColor(textDark).fontSize(9).font('Helvetica').text('Order Total', 84, y);
                doc.text(`INR ${itemsSubtotalSum.toFixed(2)}`, 460, y, { width: 95, align: 'right' });
                y += 18;
            }

            doc.moveTo(36, y).lineTo(doc.page.width - 36, y).strokeColor('#e2e8f0').stroke();
            y += 14;

            // Billing Calculations
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

            const drawSummaryRow = (label, val, isBold = false) => {
                doc.fontSize(isBold ? 10.5 : 9).font(isBold ? 'Helvetica-Bold' : 'Helvetica');
                doc.fillColor(isBold ? primaryColor : textDark);
                doc.text(label, 340, y, { width: 110, align: 'left' });
                doc.text(val, 460, y, { width: 95, align: 'right' });
                y += 16;
            };

            drawSummaryRow('Subtotal:', `INR ${subtotal.toFixed(2)}`);
            drawSummaryRow('Delivery Fee:', `INR ${deliveryFee.toFixed(2)}`);
            drawSummaryRow('Platform Fee:', `INR ${platformFee.toFixed(2)}`);
            drawSummaryRow('Tax / GST:', `INR ${taxAmount.toFixed(2)}`);
            if (discountAmount > 0) {
                drawSummaryRow('Discount:', `- INR ${discountAmount.toFixed(2)}`);
            }
            drawSummaryRow('Grand Total:', `INR ${totalAmount.toFixed(2)}`, true);

            // Footer
            const footerY = doc.page.height - 40;
            doc.moveTo(36, footerY - 10).lineTo(doc.page.width - 36, footerY - 10).strokeColor('#e2e8f0').stroke();
            doc.fontSize(8.5).fillColor(textMuted).text('Thank you for ordering with FreshCut Local!', 36, footerY, { align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}
