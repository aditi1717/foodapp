import { useState, useMemo } from "react"
import { exportToCSV, exportToExcel, exportToPDF, exportToJSON } from "./ordersExportUtils"
import { DEFAULT_FOOD_LOGO as quickSpicyLogo } from "@food/utils/defaultBranding"
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings"
import { formatOrderAddressWithLabels } from "@food/utils/orderAddressFormatter"
import { getFoodOrderStatusLabel } from "@food/utils/foodOrderStatusUnified"
import { getApiOrigin } from "@/services/api/baseUrl"

const debugError = () => {}

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatMoney = (value) => `INR ${toNumber(value).toFixed(2)}`
const formatDisplayText = (value, fallback = "N/A") => {
  if (value === null || value === undefined) return fallback
  const normalized = String(value).trim()
  return normalized || fallback
}

const formatOrderAddress = (address) => {
  const formatted = formatOrderAddressWithLabels(address)
  return formatted === "Address not available" ? "Not available" : formatted
}

const hexToRgb = (hex, fallback = [15, 118, 110]) => {
  if (!hex || typeof hex !== "string") return fallback
  const cleanHex = hex.replace("#", "").trim()
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16)
    const g = parseInt(cleanHex[1] + cleanHex[1], 16)
    const b = parseInt(cleanHex[2] + cleanHex[2], 16)
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b]
  } else if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16)
    const g = parseInt(cleanHex.substring(2, 4), 16)
    const b = parseInt(cleanHex.substring(4, 6), 16)
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b]
  }
  return fallback
}

const getAppThemeRgb = (settings) => {
  let hex = settings?.primaryColor || settings?.themeColor || ""
  if (hex && (hex.toLowerCase().includes("0ea5e9") || hex.toLowerCase().includes("38bdf8") || hex.toLowerCase().includes("0284c7") || hex.toLowerCase().includes("3b82f6"))) {
    hex = "#0f766e"
  }
  if (!hex) hex = "#0f766e"
  return hexToRgb(hex, [15, 118, 110])
}

const getFullImageUrl = (url) => {
  if (!url || typeof url !== "string") return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  if (trimmed.startsWith("/uploads") || trimmed.startsWith("uploads/")) {
    const origin = getApiOrigin() || window.location.origin
    return `${origin.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`
  }
  return `${window.location.origin}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`
}

const imageUrlToDataUrl = async (url) => {
  if (!url) return null
  const trimmed = typeof url === "string" ? url.trim() : (url?.url ? String(url.url).trim() : "")
  if (!trimmed) return null
  if (trimmed.startsWith("data:image/")) return trimmed

  const candidates = []
  const primaryUrl = getFullImageUrl(trimmed)
  if (primaryUrl) candidates.push(primaryUrl)

  candidates.push(`${window.location.origin}/FC - Logo 1.png`)
  candidates.push(`${window.location.origin}/FC%20-%20Logo%201.png`)

  for (const fetchUrl of candidates) {
    if (!fetchUrl) continue
    try {
      const response = await fetch(fetchUrl)
      if (response && response.ok) {
        const blob = await response.blob()
        if (blob && blob.size > 0) {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          if (dataUrl && dataUrl.startsWith("data:image/")) {
            return dataUrl
          }
        }
      }
    } catch (e) {
      // Continue next candidate
    }
  }

  // 2. Fallback to Image element + Canvas
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "Anonymous"
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        const maxDim = 300
        let w = img.naturalWidth || img.width || 120
        let h = img.naturalHeight || img.height || 120
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w)
            w = maxDim
          } else {
            w = Math.round((w * maxDim) / h)
            h = maxDim
          }
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL("image/png"))
      } catch (err) {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = primaryUrl || `${window.location.origin}/FC - Logo 1.png`
  })
}

// Helper to load filters from localStorage
const loadFiltersFromStorage = () => {
  try {
    const stored = localStorage.getItem("admin_orders_filters")
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

// Global filter cache to persist filters per statusKey
const globalFiltersCache = loadFiltersFromStorage()

// Helper to save filters to localStorage
const saveFiltersToStorage = () => {
  try {
    localStorage.setItem("admin_orders_filters", JSON.stringify(globalFiltersCache))
  } catch (e) {
    console.error("Failed to save filters to storage", e)
  }
}

const getItemVariantText = (item) => {
  if (!item) return ""
  if (item.variantLabel) return String(item.variantLabel)
  if (item.variantName) return String(item.variantName)
  if (item.variantTitle) return String(item.variantTitle)
  if (item.variant) {
    if (typeof item.variant === "string") return item.variant
    if (item.variant.name) return String(item.variant.name)
    if (item.variant.title) return String(item.variant.title)
    if (item.variant.label) return String(item.variant.label)
  }
  if (item.selectedVariant) {
    if (typeof item.selectedVariant === "string") return item.selectedVariant
    if (item.selectedVariant.name) return String(item.selectedVariant.name)
    if (item.selectedVariant.title) return String(item.selectedVariant.title)
    if (item.selectedVariant.label) return String(item.selectedVariant.label)
  }
  if (item.variation) {
    if (typeof item.variation === "string") return item.variation
    if (item.variation.name) return String(item.variation.name)
    if (item.variation.type) return String(item.variation.type)
    if (item.variation.title) return String(item.variation.title)
    if (item.variation.label) return String(item.variation.label)
  }
  if (Array.isArray(item.options) && item.options.length > 0) {
    const optNames = item.options.map(opt => typeof opt === "string" ? opt : (opt.name || opt.title || opt.label || "")).filter(Boolean)
    if (optNames.length > 0) return optNames.join(", ")
  }
  return ""
}

export async function generateOrderInvoicePDF(order) {
  try {
    const { default: jsPDF } = await import("jspdf")
    const { default: autoTable } = await import("jspdf-autotable")

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const orderId = order.orderId || order.id || order.subscriptionId || "N/A"
    const orderDate = order.date && order.time
      ? `${order.date}, ${order.time}`
      : (order.date || new Date().toLocaleDateString())

    const settings = getCachedSettings() || await loadBusinessSettings()
    const companyName = settings?.companyName || "FreshCut Local"
    const logoUrl = settings?.logo?.url || settings?.logoUrl || settings?.logo || quickSpicyLogo || "/FC%20-%20Logo%201.png"
    const logoDataUrl = await imageUrlToDataUrl(logoUrl)

    const themeRgb = getAppThemeRgb(settings)

    const items = Array.isArray(order.items) ? order.items : []
    const itemsSubtotal = items.reduce((sum, item) => {
      const qty = toNumber(item?.quantity || 1)
      const unitPrice = toNumber(item?.price || item?.unitPrice)
      return sum + (qty * unitPrice)
    }, 0)

    const subtotal = itemsSubtotal > 0
      ? itemsSubtotal
      : toNumber(
          order.totalItemAmount ??
          order.subtotal ??
          order.pricing?.subtotal ??
          order.totalAmount
        )
    const deliveryFee = toNumber(
      order.deliveryCharge ??
      order.deliveryFee ??
      order.pricing?.deliveryFee ??
      order.delivery?.fee
    )
    const platformFee = toNumber(
      order.platformFee ??
      order.pricing?.platformFee ??
      order.feeSettings?.platformFee
    )
    const taxAmount = toNumber(
      order.vatTax ??
      order.taxAmount ??
      order.tax ??
      order.pricing?.tax
    )
    const discountAmount = toNumber(
      order.couponDiscount ??
      order.discountAmount ??
      order.discount ??
      order.pricing?.discount
    )
    const totalAmount = toNumber(
      order.totalAmount ??
      order.orderAmount ??
      order.pricing?.total ??
      (subtotal + deliveryFee + platformFee + taxAmount - discountAmount)
    )

    const couponCode = order.couponCode || order.pricing?.appliedCoupon?.code || ""

    // Format Order Status & Payment Status
    const rawOrderStatus = order.orderStatus || order.displayStatus || order.status || ""
    const normOrderStatus = String(rawOrderStatus).toLowerCase().trim()
    let formattedOrderStatus = "Delivered"
    if (["captured", "settled", "completed", "paid", "delivered"].includes(normOrderStatus)) {
      formattedOrderStatus = "Delivered"
    } else if (normOrderStatus.includes("cancel")) {
      formattedOrderStatus = "Cancelled"
    } else if (normOrderStatus.includes("refund")) {
      formattedOrderStatus = "Refunded"
    } else if (rawOrderStatus) {
      formattedOrderStatus = getFoodOrderStatusLabel(rawOrderStatus) || "Delivered"
    }

    const rawPaymentStatus = order.paymentStatus || (["captured", "settled", "completed", "paid"].includes(normOrderStatus) ? "Paid" : order.status) || "Paid"
    const normPaymentStatus = String(rawPaymentStatus).toLowerCase().trim()
    let formattedPaymentStatus = "Paid"
    if (["captured", "settled", "completed", "paid"].includes(normPaymentStatus)) {
      formattedPaymentStatus = "Paid"
    } else if (["pending", "created", "cod_pending"].includes(normPaymentStatus)) {
      formattedPaymentStatus = "Pending"
    } else if (normPaymentStatus.includes("failed")) {
      formattedPaymentStatus = "Failed"
    } else if (normPaymentStatus.includes("refund")) {
      formattedPaymentStatus = "Refunded"
    } else {
      formattedPaymentStatus = formatDisplayText(rawPaymentStatus, "Paid")
    }

    const paymentType = formatDisplayText(
      order.paymentType || order.paymentMethod || order.payment?.method,
      "Online Payment"
    )

    // Customer info
    const customerName = order.customerName && order.customerName !== "Guest" && order.customerName !== "Invalid Customer Data" && order.customerName !== "Customer"
      ? order.customerName
      : (order.customer?.name || order.user?.name || order.userId?.name || order.customerAddress?.name || order.address?.name || order.deliveryAddress?.name || "Customer")

    const customerPhone = order.customerPhone && order.customerPhone !== "N/A"
      ? order.customerPhone
      : (order.customer?.phone || order.user?.phone || order.userId?.phone || order.customerAddress?.phone || order.address?.phone || order.deliveryAddress?.phone || order.customerAddress?.contactNumber || "N/A")

    const customerAddressStr = formatOrderAddress(
      order.address || order.customerAddress || order.deliveryAddress
    )

    // Shop info
    const shopName = formatDisplayText(
      typeof order.shop === "string" ? order.shop : (order.shop?.name || order.shopId?.shopName || order.restaurantName || order.vendorName),
      "Shop"
    )
    const shopPhone = formatDisplayText(
      order.shopPhone || order.shop?.phone || order.shopId?.phone || order.shopId?.ownerPhone || order.shop?.contactNumber || order.vendorPhone || order.restaurantPhone || order.shopDetails?.phone,
      "N/A"
    )
    const shopAddressStr = formatOrderAddress(
      order.shopAddress || order.shop?.address || order.shopId?.formattedAddress || order.shopId?.address || order.shopId?.location || order.vendorAddress
    )

    // Layout PDF
    let currentY = 14

    // Top Accent Bar
    doc.setFillColor(...themeRgb)
    doc.rect(0, 0, pageWidth, 5, "F")

    // Render Logo
    if (logoDataUrl) {
      try {
        let imgType = "PNG"
        if (logoDataUrl.startsWith("data:image/jpeg") || logoDataUrl.startsWith("data:image/jpg")) {
          imgType = "JPEG"
        } else if (logoDataUrl.startsWith("data:image/webp")) {
          imgType = "WEBP"
        }
        doc.addImage(logoDataUrl, imgType, 14, 9, 20, 20)
      } catch (err) {
        try {
          doc.addImage(logoDataUrl, 14, 9, 20, 20)
        } catch (e2) {
          debugError("Failed to render logo in invoice PDF", e2)
        }
      }
    }

    const titleLeft = logoDataUrl ? 38 : 14
    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.setTextColor(...themeRgb)
    doc.text(companyName, titleLeft, 17)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text("Order Tax Invoice & Summary", titleLeft, 23)

    // Right-aligned Invoice Meta Block
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(30, 41, 59)
    doc.text("INVOICE", pageWidth - 14, 17, { align: "right" })

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(`Order ID: #${orderId}`, pageWidth - 14, 23, { align: "right" })
    doc.text(`Date: ${orderDate}`, pageWidth - 14, 28, { align: "right" })

    // Divider Line
    currentY = 34
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(14, currentY, pageWidth - 14, currentY)

    // Key Status Badges Bar
    currentY += 6
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(14, currentY, pageWidth - 28, 10, 2, 2, "F")

    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(71, 85, 105)

    doc.text("Status: ", 18, currentY + 6.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...themeRgb)
    doc.text(formattedOrderStatus, 32, currentY + 6.5)

    doc.setFont("helvetica", "normal")
    doc.setTextColor(71, 85, 105)
    doc.text("Payment: ", 90, currentY + 6.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...themeRgb)
    doc.text(`${formattedPaymentStatus} (${paymentType})`, 107, currentY + 6.5)

    currentY += 16

    // Customer & Shop Info Cards Side by Side
    const cardWidth = (pageWidth - 34) / 2
    const cardHeight = 36

    // Customer Card (Left)
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(14, currentY, cardWidth, cardHeight, 2, 2, "FD")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(...themeRgb)
    doc.text("Customer Details", 18, currentY + 7)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(30, 41, 59)
    doc.text(customerName, 18, currentY + 14)

    doc.setFont("helvetica", "normal")
    doc.setTextColor(71, 85, 105)
    doc.text(`Phone: ${customerPhone}`, 18, currentY + 20)
    
    // Wrapped Customer Address
    const splitCustAddr = doc.splitTextToSize(`Address: ${customerAddressStr}`, cardWidth - 8)
    doc.text(splitCustAddr.slice(0, 2), 18, currentY + 26)

    // Shop Card (Right)
    const shopCardX = 14 + cardWidth + 6
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(shopCardX, currentY, cardWidth, cardHeight, 2, 2, "FD")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(...themeRgb)
    doc.text("Shop Details", shopCardX + 4, currentY + 7)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(30, 41, 59)
    doc.text(shopName, shopCardX + 4, currentY + 14)

    doc.setFont("helvetica", "normal")
    doc.setTextColor(71, 85, 105)
    doc.text(`Phone: ${shopPhone}`, shopCardX + 4, currentY + 20)

    const splitShopAddr = doc.splitTextToSize(`Address: ${shopAddressStr}`, cardWidth - 8)
    doc.text(splitShopAddr.slice(0, 2), shopCardX + 4, currentY + 26)

    currentY += cardHeight + 10

    // Itemized Table
    const tableData = items.map((item, idx) => {
      const qty = toNumber(item?.quantity || 1)
      const unitPrice = toNumber(item?.price || item?.unitPrice)
      const total = qty * unitPrice
      const baseName = item?.name || item?.itemName || item?.foodName || "Item"
      const variantText = getItemVariantText(item)
      const fullTitle = variantText ? `${baseName} (${variantText})` : baseName

      return [
        String(idx + 1),
        fullTitle,
        `${qty} x ${formatMoney(unitPrice)}`,
        formatMoney(total)
      ]
    })

    autoTable(doc, {
      startY: currentY,
      head: [["#", "Item Description", "Qty x Price", "Total"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: themeRgb,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9.5,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      styles: {
        cellPadding: 3.2,
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 14 },
        1: { cellWidth: 98 },
        2: { halign: "right", cellWidth: 36 },
        3: { halign: "right", cellWidth: 34 },
      },
      margin: { left: 14, right: 14 },
    })

    // Summary Card Block
    const summaryRows = [
      ["Subtotal", formatMoney(subtotal)],
      ["Delivery Fee", formatMoney(deliveryFee)],
      ["Platform Fee", formatMoney(platformFee)],
      ["Tax / GST", formatMoney(taxAmount)],
      ["Discount" + (couponCode ? ` (${couponCode})` : ""), `- ${formatMoney(discountAmount)}`],
      ["Grand Total", formatMoney(totalAmount)],
    ]

    const summaryCardHeight = (summaryRows.length * 5.8) + 6
    const summaryCardWidth = 84
    const summaryLeftMargin = pageWidth - summaryCardWidth - 14

    const summaryStartY = (doc.lastAutoTable?.finalY || currentY + 30) + 8
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(summaryLeftMargin - 4, summaryStartY - 4, summaryCardWidth, summaryCardHeight, 2, 2, "FD")
    
    autoTable(doc, {
      startY: summaryStartY,
      body: summaryRows,
      theme: "plain",
      styles: {
        fontSize: 9.5,
        textColor: [30, 41, 59],
        cellPadding: 1.8,
      },
      columnStyles: {
        0: { cellWidth: 44, fontStyle: "bold" },
        1: { cellWidth: 32, halign: "right" },
      },
      margin: { left: summaryLeftMargin },
      didParseCell: (hookData) => {
        if (hookData.row.index === summaryRows.length - 1) {
          hookData.cell.styles.fontStyle = "bold"
          hookData.cell.styles.fontSize = 10.5
          hookData.cell.styles.textColor = themeRgb
        }
      },
    })

    // Footer
    const footerY = Math.max((doc.lastAutoTable?.finalY || summaryStartY) + 18, 268)
    doc.setDrawColor(226, 232, 240)
    doc.line(14, footerY - 6, pageWidth - 14, footerY - 6)
    doc.setFontSize(8.5)
    doc.setTextColor(100, 116, 139)
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, footerY)
    doc.text("Includes customer, shop, and delivery partner details.", pageWidth - 14, footerY, { align: "right" })

    const filename = `Invoice_${orderId}_${new Date().toISOString().split("T")[0]}.pdf`
    doc.save(filename)
  } catch (error) {
    debugError("Error generating PDF invoice:", error)
    alert("Failed to download PDF invoice. Please try again.")
  }
}

export function useOrdersManagement(orders, statusKey, title) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOrderOpen, setIsViewOrderOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  
  // Initialize from cache or default
  const [filters, setFiltersState] = useState(globalFiltersCache[statusKey] || {
    paymentStatus: "",
    minAmount: "",
    maxAmount: "",
    fromDate: "",
    toDate: "",
    shop: "",
  })

  const setFilters = (updater) => {
    setFiltersState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      globalFiltersCache[statusKey] = next
      saveFiltersToStorage()
      return next
    })
  }

  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    orderId: true,
    orderDate: true,
    customer: true,
    shop: true,
    foodItems: true,
    totalAmount: true,
    paymentType: true,
    paymentCollectionStatus: true,
    orderStatus: true,
    actions: true,
  })

  // Get unique shops from orders
  const shops = useMemo(() => {
    return [...new Set(orders.map(o => o.shop))]
  }, [orders])

  // Apply search and filters
  const filteredOrders = useMemo(() => {
    let result = [...orders]

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(order => {
        const safeTotal =
          order.totalAmount ??
          order.total ??
          order.pricing?.total ??
          0
        const totalStr = String(safeTotal)
        return (
          String(order.orderId || "")
            .toLowerCase()
            .includes(query) ||
          String(order.customerName || "")
            .toLowerCase()
            .includes(query) ||
          String(order.shop || "")
            .toLowerCase()
            .includes(query) ||
          String(order.customerPhone || "").includes(query) ||
          totalStr.includes(query)
        )
      })
    }

    // Apply filters
    if (filters.paymentStatus) {
      const wanted = filters.paymentStatus.toLowerCase()
      result = result.filter((order) => {
        const paymentStatus = String(order.paymentStatus || "").toLowerCase()
        const collectionStatus = String(order.paymentCollectionStatus || "").toLowerCase()
        return paymentStatus === wanted || collectionStatus === wanted
      })
    }

    if (filters.minAmount) {
      const min = parseFloat(filters.minAmount)
      result = result.filter(order => {
        const amount =
          order.totalAmount ??
          order.total ??
          order.pricing?.total ??
          0
        return Number(amount) >= min
      })
    }

    if (filters.maxAmount) {
      const max = parseFloat(filters.maxAmount)
      result = result.filter(order => {
        const amount =
          order.totalAmount ??
          order.total ??
          order.pricing?.total ??
          0
        return Number(amount) <= max
      })
    }

    if (filters.shop) {
      result = result.filter(order => order.shop === filters.shop)
    }

    // Helper function to parse date format "16 JUL 2025"
    const parseOrderDate = (dateStr) => {
      const months = {
        "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
        "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12"
      }
      const parts = dateStr.split(" ")
      if (parts.length === 3) {
        const day = parts[0].padStart(2, "0")
        const month = months[parts[1].toUpperCase()] || "01"
        const year = parts[2]
        return new Date(`${year}-${month}-${day}`)
      }
      return new Date(dateStr)
    }

    if (filters.fromDate) {
      result = result.filter(order => {
        const orderDate = parseOrderDate(order.date)
        const fromDate = new Date(filters.fromDate)
        return orderDate >= fromDate
      })
    }

    if (filters.toDate) {
      result = result.filter(order => {
        const orderDate = parseOrderDate(order.date)
        const toDate = new Date(filters.toDate)
        toDate.setHours(23, 59, 59, 999) // Include entire day
        return orderDate <= toDate
      })
    }

    return result
  }, [orders, searchQuery, filters])

  const count = filteredOrders.length

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(value => value !== "").length
  }, [filters])

  const handleApplyFilters = () => {
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    setFilters({
      paymentStatus: "",
      minAmount: "",
      maxAmount: "",
      fromDate: "",
      toDate: "",
      shop: "",
    })
  }

  const handleExport = (format) => {
    const filename = title.toLowerCase().replace(/\s+/g, "_")
    switch (format) {
      case "csv":
        exportToCSV(filteredOrders, filename)
        break
      case "excel":
        exportToExcel(filteredOrders, filename)
        break
      case "pdf":
        exportToPDF(filteredOrders, filename)
        break
      case "json":
        exportToJSON(filteredOrders, filename)
        break
      default:
        break
    }
  }

  const handleViewOrder = (order) => {
    setSelectedOrder(order)
    setIsViewOrderOpen(true)
  }

  const handlePrintOrder = (order) => generateOrderInvoicePDF(order)

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      orderId: true,
      orderDate: true,
      customer: true,
      shop: true,
      foodItems: true,
      totalAmount: true,
      paymentType: true,
      paymentCollectionStatus: true,
      orderStatus: true,
      actions: true,
    })
  }

  return {
    searchQuery,
    setSearchQuery,
    isFilterOpen,
    setIsFilterOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isViewOrderOpen,
    setIsViewOrderOpen,
    selectedOrder,
    filters,
    setFilters,
    visibleColumns,
    filteredOrders,
    count,
    activeFiltersCount,
    shops,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
    resetColumns,
  }
}
