import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import {
  ArrowLeft,
  ShoppingBag,
  Phone,
  Copy,
  Download,
  User,
  CreditCard,
  Calendar,
  MapPin,
  RotateCcw,
  RefreshCw,
  FileText,
} from "lucide-react"
import { orderAPI, shopAPI } from "@food/api"
import { useCart } from "@food/context/CartContext"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { getCompanyNameAsync } from "@food/utils/businessSettings"
import BRAND_THEME from "@/config/brandTheme"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}
const getNormalizedFoodType = (item = {}) =>
  String(item?.foodType || item?.type || item?.category || "")
    .trim()
    .toLowerCase()

const isItemVeg = (item = {}) => {
  const normalizedFoodType = getNormalizedFoodType(item)
  if (normalizedFoodType === "veg" || normalizedFoodType === "vegetarian") return true
  if (
    normalizedFoodType === "non-veg" ||
    normalizedFoodType === "non veg" ||
    normalizedFoodType === "nonveg" ||
    normalizedFoodType === "egg"
  ) {
    return false
  }
  if (item?.isVeg === true) return true
  if (item?.isVeg === false) return false
  return false
}

function isOnlineRefundablePaymentMethod(methodRaw) {
  const method = String(methodRaw || "").trim().toLowerCase()
  return ["razorpay", "online", "card", "upi", "netbanking"].includes(method)
}

function isCancelledStatus(statusRaw) {
  const status = String(statusRaw || "").toLowerCase()
  return status === "cancelled" || status.includes("cancelled")
}

function getRefundDisplayInfo(orderLike) {
  if (!orderLike || !isCancelledStatus(orderLike.orderStatus || orderLike.status)) return null

  const paymentMethod = orderLike.payment?.method || orderLike.paymentMethod
  if (!isOnlineRefundablePaymentMethod(paymentMethod)) return null

  const refund = orderLike.payment?.refund || orderLike.refund || {}
  const paymentStatus = String(orderLike.payment?.status || orderLike.paymentStatus || "").toLowerCase()
  const rawStatus = String(refund.status || "").toLowerCase()
  const status = rawStatus && rawStatus !== "none"
    ? rawStatus
    : paymentStatus === "refunded"
      ? "processed"
      : "pending"
  const amount = Number(refund.amount || orderLike.payment?.amountDue || orderLike.pricing?.total || 0)

  const label =
    status === "processed" ? "Refund has been credited" :
    status === "failed" ? "Refund failed" :
    "Refund in process"

  return { status, label, amount }
}


export default function UserOrderDetails() {
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const { replaceCart } = useCart()
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true)
        // Fetch using the ID from params (which will now be the MongoDB _id)
        const response = await orderAPI.getOrderDetails(orderId)

        let orderData = null
        if (response?.data?.success && response.data.data?.order) {
          orderData = response.data.data.order
        } else if (response?.data?.order && typeof response.data.order === 'object') {
          orderData = response.data.order
        } else {
          toast.error("Order not found")
          navigate("/user/orders")
          return
        }

        setOrder(orderData)

        // If shopId/shopId is just a string (not populated), fetch shop details separately
        const shopId = orderData.shopId || orderData.shopId
        if (shopId && typeof shopId === 'string' && !orderData.shop) {
          try {
            const shopResponse = await shopAPI.getShopById(shopId)
            if (shopResponse?.data?.success && (shopResponse.data.data?.shop || shopResponse.data.data?.shop)) {
              setShop(shopResponse.data.data.shop || shopResponse.data.data?.shop)
            } else if (shopResponse?.data?.shop || shopResponse?.data?.shop) {
              setShop(shopResponse.data.shop || shopResponse.data.shop)
            }
          } catch (shopError) {
            debugWarn("Failed to fetch shop details:", shopError)
            // Don't show error toast, just log it - order details can still be shown
          }
        }
      } catch (error) {
        debugError("Error fetching order details:", error)
        toast.error(
          error?.response?.data?.message || "Failed to load order details"
        )
        navigate("/user/orders")
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId, navigate])

  const handleCopyOrderId = async () => {
    if (!order) return
    const id = order.orderId || order._id || orderId
    try {
      await navigator.clipboard.writeText(String(id))
      toast.success("Order ID copied")
    } catch {
      toast.error("Failed to copy Order ID")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600 text-sm">Loading order details...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-700 text-sm font-medium">Order not found</p>
          <button
            onClick={() => navigate("/user/orders")}
            className={`px-4 py-2 rounded-lg ${BRAND_THEME.tokens.orders.primaryButton} text-sm font-semibold`}
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  const orderIdDisplay = order.orderId || order._id || orderId
  const refundInfo = getRefundDisplayInfo(order)
  // Use fetched shop data if available, otherwise use order.shopId || order.shopId or order.shop || {}
  const shopObj = shop || order.shopId || order.shopId || order.shop || {}
  const shopName =
    order.shopName || order.shopName || shopObj.name || "Shop"

  // Build shop address (try shop fields first, then fall back)
  const shopLocation = (() => {
    const loc = shopObj.location || {}

    // Priority 1: direct address on shop object
    if (shopObj.address) return shopObj.address

    // Priority 2: formattedAddress from location
    if (loc.formattedAddress) return loc.formattedAddress

    // Priority 3: generic address / street-style fields
    if (loc.address) return loc.address

    if (loc.street || loc.city) {
      const parts = [
        loc.street,
        loc.area,
        loc.city,
        loc.state,
        loc.zipCode || loc.pincode || loc.postalCode,
      ].filter(Boolean)
      if (parts.length) return parts.join(", ")
    }

    // Priority 4: addressLine1 / addressLine2 style
    if (loc.addressLine1) {
      const parts = [
        loc.addressLine1,
        loc.addressLine2,
        loc.city,
        loc.state,
      ].filter(Boolean)
      if (parts.length) return parts.join(", ")
    }

    // Priority 5: order-level shopAddress/shopAddress if present
    if (order.shopAddress || order.shopAddress) return order.shopAddress || order.shopAddress

    // Don't fallback to user delivery address - show empty or "Address not available"
    return "Address not available"
  })()

  const items = Array.isArray(order.items) ? order.items : []
  const pricing = order.pricing || {}
  const sendsCutlery = order.sendCutlery !== false

  const userName = order.userName || ""
  const userPhone = order.userPhone || ""
  const paymentMethod = order.payment?.method || "Online"
  const paymentDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString("en-IN", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    : ""

  const addressText =
    order.address?.formattedAddress ||
    [order.address?.street, order.address?.city, order.address?.state, order.address?.zipCode]
      .filter(Boolean)
      .join(", ")

  const savings =
    (pricing.discount || 0) +
    (pricing.originalItemTotal || 0) -
    (pricing.subtotal || 0)

  // Shop phone (multiple fallbacks) - use fetched shop data first
  const shopPhone =
    shopObj.primaryContactNumber ||
    shopObj.phone ||
    shopObj.contactNumber ||
    order.shopPhone ||
    order.shopPhone ||
    ""

  const handleCallShop = () => {
    if (!shopPhone) {
      toast.error("Shop phone number not available")
      return
    }
    window.location.href = `tel:${shopPhone}`
  }

  const handleDownloadSummary = async () => {
    try {
      const companyName = await getCompanyNameAsync()
      // Create new PDF document
      const doc = new jsPDF()

      // Title
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(`${companyName} Order: Summary and Receipt`, 105, 20, { align: 'center' })

      // Order details section
      let yPos = 35
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')

      // Order ID
      doc.setFont('helvetica', 'bold')
      doc.text('Order ID:', 20, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(orderIdDisplay, 60, yPos)
      yPos += 7

      // Order Time
      doc.setFont('helvetica', 'bold')
      doc.text('Order Time:', 20, yPos)
      doc.setFont('helvetica', 'normal')
      const orderTimeLines = doc.splitTextToSize(paymentDate || 'N/A', 130)
      doc.text(orderTimeLines, 60, yPos)
      yPos += orderTimeLines.length * 7

      // Customer Name
      doc.setFont('helvetica', 'bold')
      doc.text('Customer Name:', 20, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(userName || 'Customer', 60, yPos)
      yPos += 7

      // Delivery Address / Takeaway
      if (order?.fulfillmentType === 'takeaway') {
        doc.setFont('helvetica', 'bold')
        doc.text('Fulfillment:', 20, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text('Takeaway (Self Pickup)', 60, yPos)
        yPos += 7
      } else {
        doc.setFont('helvetica', 'bold')
        doc.text('Delivery Address:', 20, yPos)
        doc.setFont('helvetica', 'normal')
        const addressLines = doc.splitTextToSize(addressText || 'N/A', 130)
        doc.text(addressLines, 60, yPos)
        yPos += addressLines.length * 7
      }

      // Shop Name
      doc.setFont('helvetica', 'bold')
      doc.text('Shop Name:', 20, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(shopName, 60, yPos)
      yPos += 7

      // Shop Address
      doc.setFont('helvetica', 'bold')
      doc.text('Shop Address:', 20, yPos)
      doc.setFont('helvetica', 'normal')
      const shopAddressLines = doc.splitTextToSize(shopLocation || 'N/A', 130)
      doc.text(shopAddressLines, 60, yPos)
      yPos += shopAddressLines.length * 7 + 5

      // Items table
      const tableData = items.map(item => [
        item.variantName ? `${item.name || 'Item'} (${item.variantName})` : (item.name || 'Item'),
        String(item.quantity || item.qty || 1),
        `?${Number(item.price || 0).toFixed(2)}`,
        `?${Number((item.price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}`
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['Item', 'Quantity', 'Unit Price', 'Total Price']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', fontSize: 10 },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
        }
      })

      // Get final Y position after table (autoTable adds lastAutoTable property)
      const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : yPos + (tableData.length * 8) + 20

      // Total
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Total:', 145, finalY + 10, { align: 'right' })
      doc.text(`?${Number(pricing.total || 0).toFixed(2)}`, 195, finalY + 10, { align: 'right' })

      // Save PDF instantly
      const fileName = `Order_Summary_${orderIdDisplay}_${Date.now()}.pdf`
      doc.save(fileName)

      toast.success("Summary downloaded successfully!")
    } catch (error) {
      debugError("Error generating PDF:", error)
      toast.error("Failed to download summary")
    }
  }

  const handleReorder = (currentOrder) => {
    const shopTarget =
      shopObj.slug ||
      shopObj._id ||
      shopObj.shopId ||
      shopObj.shopId ||
      (typeof currentOrder?.shopId === "string" ? currentOrder.shopId : currentOrder?.shopId?._id)

    if (!shopTarget || !items.length) {
      toast.error("Order items or shop information not available")
      return
    }

    const reorderItems = items
      .map((item, index) => {
        const itemId = item.id || item.itemId || item._id
        if (!itemId) return null

        return {
          id: itemId,
          name: item.name || item.foodName || "Item",
          price: Number(item.price) || 0,
          image: item.image || "",
          shop: shopName,
          shopId: shopObj._id || shopObj.shopId || shopObj.shopId || currentOrder?.shopId,
          shopId: shopObj._id || shopObj.shopId || shopObj.shopId || currentOrder?.shopId,
          description: item.description || "",
          isVeg: isItemVeg(item),
          quantity: Math.max(1, Number(item.quantity || item.qty) || 1),
          reorderIndex: index,
        }
      })
      .filter(Boolean)

    if (!reorderItems.length) {
      toast.error("No reorderable items found in this order")
      return
    }

    replaceCart(reorderItems)
    toast.success("Items added to cart")
    navigate(`/food/user/shops/${shopTarget}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans relative">
      {/* Header */}
      <div className="bg-white p-4 flex items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700 cursor-pointer" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Order Details</h1>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="p-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <div className="bg-gray-100 p-2 rounded-lg">
            <ShoppingBag className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">
              {order.status === "delivered"
                ? (order?.fulfillmentType === 'takeaway' ? "Order was picked up" : "Order was delivered")
                : order.status === "scheduled"
                ? (order?.fulfillmentType === 'takeaway' ? "Pickup Scheduled" : "Delivery Scheduled")
                : "Order status: " + (order.status || "Processing")}
            </h2>
            {order.status === "scheduled" && order.scheduledAt && (
              <p className="text-xs text-gray-500 mt-1 font-medium">
                Scheduled for {new Date(order.scheduledAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} at {new Date(order.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {order.status && String(order.status).toLowerCase().includes("cancel") && order.cancellationReason && (
              <p className="text-red-600 text-xs mt-1 font-medium italic">
                Reason: {order.cancellationReason}
              </p>
            )}
            {refundInfo && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>
                  {refundInfo.label}
                  {refundInfo.amount > 0 ? `: \u20B9${refundInfo.amount.toFixed(2)}` : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Shop Info Card */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img
                src={
                  // Prefer the food image from the first ordered item
                  (Array.isArray(items) && items[0]?.image) ||
                  shopObj.profileImage?.url ||
                  shopObj.profileImage ||
                  order.shopImage ||
                  order.shopImage ||
                  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80"
                }
                alt={shopName}
                className="w-10 h-10 rounded-lg object-cover"
              />
              <div>
                <h3 className="font-semibold text-gray-800">{shopName}</h3>
                <p className="text-xs text-gray-500">{shopLocation}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCallShop}
              className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-brand-50"
              style={{ color: BRAND_THEME.tokens.orders.primaryText }}
            >
              <Phone className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Order ID: #{orderIdDisplay}
            </span>
            <button type="button" onClick={handleCopyOrderId}>
              <Copy className="w-3 h-3 text-gray-400 cursor-pointer" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${sendsCutlery
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-brand-50 text-brand-700 border border-brand-200"
                }`}
            >
              {sendsCutlery ? "Send cutlery" : "Don't send cutlery"}
            </span>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          {/* Items */}
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-start mt-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 border ${isItemVeg(item) ? "border-green-600" : "border-red-600"
                    } flex items-center justify-center p-[1px]`}
                >
                  <div
                    className={`w-full h-full rounded-full ${isItemVeg(item) ? "bg-green-600" : "bg-red-600"
                      }`}
                  />
                </div>
                <span className="text-sm text-gray-700 font-medium">
                  {item.quantity || item.qty || 1} x {item.name}{item.variantName ? ` (${item.variantName})` : ""}
                </span>
              </div>
              <span className="text-sm text-gray-800 font-medium">
                ₹{(item.price || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Bill Summary Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 flex justify-between items-center border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-800">Bill Summary</h3>
            </div>
            <button
              type="button"
              onClick={handleDownloadSummary}
              className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center hover:bg-brand-100"
              style={{ color: BRAND_THEME.tokens.orders.primaryText }}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Item total</span>
              <div>
                {pricing.originalItemTotal && (
                  <span className="text-gray-400 line-through mr-1">
                    ₹{Number(pricing.originalItemTotal).toFixed(2)}
                  </span>
                )}
                <span className="text-gray-800">
                  ₹{Number(pricing.subtotal || pricing.total || 0).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">GST (govt. taxes)</span>
              <span className="text-gray-800">
                ₹{Number(pricing.tax || 0).toFixed(2)}
              </span>
            </div>
            {order?.fulfillmentType !== 'takeaway' && (
              <div className="flex justify-between">
                <span className="text-gray-400 font-medium">Delivery fee</span>
                {pricing.deliveryFee === 0 && (
                  <span className="text-[10px] font-bold border px-1 rounded ml-1" style={{ color: BRAND_THEME.tokens.orders.primaryText, borderColor: BRAND_THEME.tokens.orders.primaryText }}>
                    FREE
                  </span>
                )}
                <span className="font-medium uppercase" style={{ color: BRAND_THEME.tokens.orders.primaryText }}>
                  {pricing.deliveryFee ? `₹${Number(pricing.deliveryFee).toFixed(2)}` : "Free"}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Platform fee</span>
              <span className="text-gray-800">
                ₹{Number(pricing.platformFee || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Subscription / other fees</span>
              <span className="text-gray-800">
                ₹{Number(pricing.subscriptionFee || 0).toFixed(2)}
              </span>
            </div>

            <div className="border-t border-gray-100 my-2 pt-2 flex justify-between items-center">
              <span className="font-bold text-gray-800">Paid</span>
              <span className="font-bold text-gray-800">
                ₹{Number(pricing.total || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Savings Banner */}
          {savings > 0 && (
            <div className="relative bg-brand-50 p-3 pb-4 mt-2">
              <div className="absolute -top-1.5 left-0 w-full overflow-hidden leading-none">
                <svg
                  className="relative block w-[calc(100%+1.3px)] h-[8px]"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 1200 120"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,0V46.29c47,0,47,69.5,94,69.5s47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5V0Z"
                    fill="#ffffff"
                    className="fill-white"
                  />
                </svg>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1 font-bold text-sm" style={{ color: BRAND_THEME.tokens.orders.primaryText }}>
                <span>??</span>
                <span>
                  You saved ₹{Number(savings).toFixed(2)} on this order!
                </span>
              </div>
            </div>
          )}
        </div>

        {/* User & Delivery Details */}
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-5">
          {/* User */}
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-sm">
                {userName || "Customer"}
              </h4>
              <p className="text-gray-500 text-xs">{userPhone}</p>
            </div>
          </div>

          {/* Payment */}
          <div className="flex gap-3">
            <div className="mt-0.5">
              <CreditCard className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-sm">
                Payment method
              </h4>
              <p className="text-gray-500 text-xs mt-0.5">
                Paid via: {paymentMethod.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Date */}
          <div className="flex gap-3">
            <div className="mt-0.5">
              <Calendar className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-sm">
                Payment date
              </h4>
              <p className="text-gray-500 text-xs mt-0.5">{paymentDate}</p>
            </div>
          </div>

          {/* Address */}
          <div className="flex gap-3">
            <div className="mt-0.5">
              <MapPin className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-sm">
                {order?.fulfillmentType === 'takeaway' ? "Pickup address" : "Delivery address"}
              </h4>
              <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
                {order?.fulfillmentType === 'takeaway' ? shopLocation : (addressText || "Address not available")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 p-4 flex gap-3 z-20">
        <button
          type="button"
          onClick={() => handleReorder(order)}
          className={`flex-1 ${BRAND_THEME.tokens.orders.primaryButton} py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors`}
        >
          <RotateCcw className="w-4 h-4" />
          Reorder
        </button>
        <button
          type="button"
          onClick={handleDownloadSummary}
          className={`flex-1 ${BRAND_THEME.tokens.orders.primaryButtonAlt} py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors`}
        >
          <Download className="w-4 h-4" />
          Invoice
        </button>
      </div>

      {/* Shop Complaint Button - Below Order Details */}
      {order && (
        <div className="p-4 pb-24">
          <button
            type="button"
            onClick={() => {
              // Use MongoDB _id (ObjectId) for the API call - backend complaint controller expects ObjectId
              // Priority: order._id (MongoDB ObjectId) > orderId from route params
              const orderMongoId = order._id || orderId

              if (!orderMongoId) {
                debugError("Order ID not available:", {
                  order: order ? { _id: order._id, orderId: order.orderId } : null,
                  routeOrderId: orderId
                })
                toast.error("Order ID not available. Please refresh the page.")
                return
              }

              // Convert to string if it's an ObjectId object
              const orderIdString = typeof orderMongoId === 'object' && orderMongoId.toString
                ? orderMongoId.toString()
                : String(orderMongoId)

              debugLog("Navigating to complaint page with orderId:", orderIdString)
              navigate(`/user/complaints/submit/${encodeURIComponent(orderIdString)}`)
            }}
            className="w-full bg-brand-50 border border-brand-200 text-brand-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-brand-100 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Shop Complaint
          </button>
        </div>
      )}
    </div>
  )
}



