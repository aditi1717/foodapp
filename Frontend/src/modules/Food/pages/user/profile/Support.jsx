import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Textarea } from "@food/components/ui/textarea"
import { Card, CardContent } from "@food/components/ui/card"
import { orderAPI, shopAPI, supportAPI, authAPI } from "@food/api"
import { toast } from "sonner"
import { ArrowLeft, Building2, HelpCircle, ShoppingBag, ChevronRight } from "lucide-react"
import BRAND_THEME from "@/config/brandTheme"

export default function Support() {
  const [step, setStep] = useState("pick")
  const [type, setType] = useState("")
  const [orders, setOrders] = useState([])
  const [shops, setShops] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedShop, setSelectedShop] = useState(null)
  const [issueType, setIssueType] = useState("")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [orderSearch, setOrderSearch] = useState("")
  const [shopSearch, setShopSearch] = useState("")
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketMessages, setTicketMessages] = useState([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [replyMessage, setReplyMessage] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [updatingTicketStatus, setUpdatingTicketStatus] = useState(false)

  const loadTickets = useCallback(async () => {
    const res = await supportAPI.getMyTickets()
    const list = res?.data?.data?.tickets || res?.data?.tickets || []
    setTickets(list)
  }, [])

  useEffect(() => {
    setLoadingTickets(true)
    authAPI
      .getCurrentUser()
      .catch(() => null)
      .finally(async () => {
        try {
          await loadTickets()
        } catch (_) {}
        setLoadingTickets(false)
      })
  }, [loadTickets])

  const orderIssues = ["Item missing", "Wrong item", "Not delivered", "Payment issue"]
  const shopIssues = ["Bad service", "Wrong info", "Other"]

  const fetchOrders = async () => {
    try {
      const res = await orderAPI.getOrders({ limit: 10, page: 1 })
      const list = res?.data?.data?.orders || res?.data?.orders || []
      setOrders(list)
    } catch {
      toast.error("Failed to load orders")
    }
  }

  const fetchShops = async () => {
    try {
      const res = await shopAPI.getShops({ limit: 20, page: 1 })
      const list = res?.data?.data?.shops || res?.data?.shops || []
      setShops(list)
    } catch {
      toast.error("Failed to load shops")
    }
  }

  const handlePick = (t) => {
    setType(t)
    setOrderSearch("")
    setShopSearch("")
    if (t === "order") {
      fetchOrders()
      setStep("choose_order")
    } else if (t === "shop") {
      fetchShops()
      setStep("choose_shop")
    } else {
      setStep("other_form")
    }
  }

  const submitTicket = async (payload) => {
    if (!String(payload?.description || "").trim()) {
      toast.error("Please describe the issue")
      return
    }
    setSubmitting(true)
    try {
      const res = await supportAPI.createTicket(payload)
      const data = res?.data
      if (!data?.success) throw new Error(data?.message || "Failed")
      toast.success("Ticket created")
      await loadTickets()
      setStep("pick")
      setType("")
      setSelectedOrder(null)
      setSelectedShop(null)
      setIssueType("")
      setSubject("")
      setDescription("")
    } catch (e) {
      const message =
        e?.response?.data?.message ||
        e?.message ||
        "Failed to create ticket"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const statusClasses = (status) => {
    const s = String(status || "").toLowerCase()
    if (s === "resolved" || s === "closed") return "bg-green-100 text-green-700"
    if (s === "open") return "bg-brand-100 text-brand-700"
    return "bg-slate-100 text-slate-700"
  }

  const getOrderLabel = (order) => {
    const shopName =
      order?.shopName ||
      order?.shop?.shopName ||
      order?.shopId?.shopName ||
      order?.shopId?.name ||
      "Shop"
    const dateValue = order?.createdAt || order?.date
    const dateLabel = dateValue ? new Date(dateValue).toLocaleDateString("en-IN") : "No date"
    const amount = Number(order?.pricing?.total ?? order?.totalAmount ?? order?.total ?? 0)
    const orderCode = order?.displayOrderId || order?.orderId || String(order?._id || order?.id || "").slice(-6)
    return `${shopName} | ${dateLabel} | #${orderCode} | Rs ${amount.toFixed(0)}`
  }
  const getOrderSubmitId = (order) =>
    order?.mongoId ||
    order?._id ||
    (String(order?.id || "").match(/^[a-f\d]{24}$/i) ? order.id : "") ||
    order?.orderMongoId ||
    order?.orderId ||
    order?.displayOrderId ||
    ""

  const getShopLabel = (shop) => {
    const name = shop?.shopName || shop?.name || "Shop"
    const location = shop?.city || shop?.area || ""
    return `${name}${location ? ` | ${location}` : ""}`
  }

  const getTicketTitle = (ticket) => {
    const id = String(ticket?._id || ticket?.id || "").slice(-6)
    const typeLabel = String(ticket?.type || "other").replace(/_/g, " ")
    const issueLabel = ticket?.issueType || "Issue"
    const shopName =
      ticket?.shopId?.shopName ||
      ticket?.shop?.shopName ||
      ticket?.orderId?.shopId?.shopName ||
      ""
    const orderCode = ticket?.orderId?.displayOrderId || ticket?.orderId?.orderId || ""
    const context =
      ticket?.type === "order" && orderCode
        ? `Order #${orderCode}`
        : ticket?.type === "shop" && shopName
        ? shopName
        : shopName

    return `#${id} | ${typeLabel}${context ? ` | ${context}` : ""} | ${issueLabel}`
  }

  const formatMessageTime = (value) => {
    if (!value) return "-"
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("en-IN")
  }

  const openTicketChat = async (ticketId) => {
    setLoadingThread(true)
    setReplyMessage("")
    try {
      const res = await supportAPI.getMyTicketById(ticketId)
      const data = res?.data?.data || {}
      setSelectedTicket(data.ticket || null)
      setTicketMessages(Array.isArray(data.messages) ? data.messages : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to open ticket")
    } finally {
      setLoadingThread(false)
    }
  }

  const closeTicketChat = () => {
    setSelectedTicket(null)
    setTicketMessages([])
    setReplyMessage("")
  }

  const sendReply = async () => {
    if (!selectedTicket?._id) return
    if (!replyMessage.trim()) {
      toast.error("Please enter a message")
      return
    }
    setSendingReply(true)
    try {
      const res = await supportAPI.sendMyTicketMessage(selectedTicket._id, {
        message: replyMessage.trim(),
      })
      const data = res?.data?.data || {}
      if (data.message) {
        setTicketMessages((prev) => [...prev, data.message])
      }
      if (data.ticket) {
        setSelectedTicket(data.ticket)
      }
      setReplyMessage("")
      await loadTickets()
      toast.success("Message sent")
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send message")
    } finally {
      setSendingReply(false)
    }
  }

  const updateTicketStatus = async (nextStatus) => {
    if (!selectedTicket?._id) return
    setUpdatingTicketStatus(true)
    try {
      const res = await supportAPI.updateMyTicketStatus(selectedTicket._id, {
        status: nextStatus,
      })
      const data = res?.data?.data || {}
      if (data.ticket) {
        setSelectedTicket(data.ticket)
      }
      if (Array.isArray(data.messages)) {
        setTicketMessages(data.messages)
      }
      await loadTickets()
      toast.success(nextStatus === "closed" ? "Ticket closed" : "Ticket reopened")
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update ticket")
    } finally {
      setUpdatingTicketStatus(false)
    }
  }

  const filteredOrders = orders.filter((order) => {
    const q = orderSearch.trim().toLowerCase()
    if (!q) return true
    const shopName = String(
      order?.shopName ||
        order?.shop?.shopName ||
        order?.shopId?.shopName ||
        order?.shopId?.name ||
        "",
    ).toLowerCase()
    const orderId = String(order?._id || order?.id || order?.orderId || "").toLowerCase()
    return shopName.includes(q) || orderId.includes(q)
  })

  const filteredShops = shops.filter((shop) => {
    const q = shopSearch.trim().toLowerCase()
    if (!q) return true
    const name = String(shop?.shopName || shop?.name || "").toLowerCase()
    const city = String(shop?.city || shop?.area || "").toLowerCase()
    const id = String(shop?._id || shop?.id || "").toLowerCase()
    return name.includes(q) || city.includes(q) || id.includes(q)
  })

  const handleOrderSearchChange = (value) => {
    setOrderSearch(value)
    const normalized = value.trim().toLowerCase()
    if (!normalized) return
    const selected = filteredOrders.find((o) => getOrderLabel(o).toLowerCase() === normalized)
    if (selected) {
      setSelectedOrder(selected)
      setStep("order_issue")
    }
  }

  const handleShopSearchChange = (value) => {
    setShopSearch(value)
    const normalized = value.trim().toLowerCase()
    if (!normalized) return
    const selected = filteredShops.find((r) => getShopLabel(r).toLowerCase() === normalized)
    if (selected) {
      setSelectedShop(selected)
      setStep("shop_issue")
    }
  }

  const TicketList = () => (
    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-slate-200 dark:border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">My Tickets</h3>
          <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {tickets.length}
          </span>
        </div>

        {loadingTickets ? (
          <p className="text-sm text-slate-500">Loading tickets...</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-slate-500">No tickets yet</p>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <div key={t._id || t.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-[#171717]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {getTicketTitle(t)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${statusClasses(t.status)}`}>
                    {t.status}
                  </span>
                </div>
                {t.lastMessage ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-wrap">
                    Latest: {t.lastMessage}
                  </p>
                ) : t.adminResponse ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">Reply: {t.adminResponse}</p>
                ) : t.description ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-wrap">
                    Description: {t.description}
                  </p>
                ) : null}
                <div className="mt-3 flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => openTicketChat(t._id || t.id)}>
                    Open Chat
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <AnimatedPage className={`min-h-screen ${BRAND_THEME.tokens.profile.pageBackground}`}>
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 sm:py-6 md:py-8 pb-20">
        <div className="mb-4">
          <Link to="/food/user/profile">
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
              <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
            </Button>
          </Link>
        </div>

        <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 mb-3">
          <CardContent className="p-4">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Help & Support</h1>
            <p className="text-sm text-slate-500 mt-1">Raise a support ticket and track updates in one place.</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 mb-3">
          <CardContent className="p-4 space-y-4">
            {step === "pick" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button onClick={() => handlePick("order")} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <ShoppingBag className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-3 font-semibold text-slate-900 dark:text-white">Order Issue</p>
                  <p className="text-xs text-slate-500 mt-1">Missing item, wrong item, delivery issue</p>
                </button>

                <button onClick={() => handlePick("shop")} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <Building2 className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-3 font-semibold text-slate-900 dark:text-white">Shop Issue</p>
                  <p className="text-xs text-slate-500 mt-1">Service, listing info, behavior report</p>
                </button>

                <button onClick={() => handlePick("other")} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <HelpCircle className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-3 font-semibold text-slate-900 dark:text-white">Other Issue</p>
                  <p className="text-xs text-slate-500 mt-1">Account, app, payment or general query</p>
                </button>
              </div>
            )}

            {step === "choose_order" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">Select an order</h3>
                {orders.length > 0 ? (
                  <div className="space-y-2">
                    <Input
                      list="support-order-options"
                      value={orderSearch}
                      onChange={(e) => handleOrderSearchChange(e.target.value)}
                      placeholder="Select/search order"
                    />
                    <datalist id="support-order-options">
                      {filteredOrders.map((o) => (
                        <option key={o._id || o.id} value={getOrderLabel(o)}>
                          {getOrderLabel(o)}
                        </option>
                      ))}
                    </datalist>
                    {filteredOrders.length === 0 ? <p className="text-sm text-slate-500">No matching orders found</p> : null}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No recent orders found</p>
                )}
                <Button variant="outline" onClick={() => setStep("pick")}>Back</Button>
              </div>
            )}

            {step === "order_issue" && selectedOrder && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">Issue type</h3>
                <div className="grid grid-cols-2 gap-2">
                  {orderIssues.map((it) => (
                    <Button key={it} variant={issueType === it ? "default" : "outline"} className={issueType === it ? BRAND_THEME.tokens.profile.primaryButton : ""} onClick={() => setIssueType(it)}>{it}</Button>
                  ))}
                </div>
                <Textarea placeholder="Describe the issue" value={description} onChange={(e) => setDescription(e.target.value)} required />
                <div className="flex gap-2">
                  <Button className={BRAND_THEME.tokens.profile.primaryButton} onClick={() => submitTicket({ type: "order", orderId: getOrderSubmitId(selectedOrder), issueType: issueType || "Order issue", description })} disabled={!description.trim() || submitting}>
                    {submitting ? "Submitting..." : "Submit Ticket"}
                  </Button>
                  <Button variant="outline" onClick={() => setStep("pick")}>Cancel</Button>
                </div>
              </div>
            )}

            {step === "choose_shop" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">Select a shop</h3>
                {shops.length > 0 ? (
                  <div className="space-y-2">
                    <Input
                      list="support-shop-options"
                      value={shopSearch}
                      onChange={(e) => handleShopSearchChange(e.target.value)}
                      placeholder="Select/search shop"
                    />
                    <datalist id="support-shop-options">
                      {filteredShops.map((r) => (
                        <option key={r._id || r.id} value={getShopLabel(r)}>
                          {getShopLabel(r)}
                        </option>
                      ))}
                    </datalist>
                    {filteredShops.length === 0 ? <p className="text-sm text-slate-500">No matching shops found</p> : null}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No shops found</p>
                )}
                <Button variant="outline" onClick={() => setStep("pick")}>Back</Button>
              </div>
            )}

            {step === "shop_issue" && selectedShop && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">Issue type</h3>
                <div className="grid grid-cols-2 gap-2">
                  {shopIssues.map((it) => (
                    <Button key={it} variant={issueType === it ? "default" : "outline"} className={issueType === it ? BRAND_THEME.tokens.profile.primaryButton : ""} onClick={() => setIssueType(it)}>{it}</Button>
                  ))}
                </div>
                <Textarea placeholder="Describe the issue" value={description} onChange={(e) => setDescription(e.target.value)} required />
                <div className="flex gap-2">
                  <Button className={BRAND_THEME.tokens.profile.primaryButton} onClick={() => submitTicket({ type: "shop", shopId: selectedShop._id || selectedShop.id, issueType: issueType || "Shop issue", description })} disabled={!description.trim() || submitting}>
                    {submitting ? "Submitting..." : "Submit Ticket"}
                  </Button>
                  <Button variant="outline" onClick={() => setStep("pick")}>Cancel</Button>
                </div>
              </div>
            )}

            {step === "other_form" && (
              <div className="space-y-3">
                <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <Textarea placeholder="Describe your issue" value={description} onChange={(e) => setDescription(e.target.value)} required />
                <div className="flex gap-2">
                  <Button className={BRAND_THEME.tokens.profile.primaryButton} onClick={() => submitTicket({ type: "other", issueType: subject || "Other", description })} disabled={!subject || !description.trim() || submitting}>
                    {submitting ? "Submitting..." : "Submit Ticket"}
                  </Button>
                  <Button variant="outline" onClick={() => setStep("pick")}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <TicketList />
      </div>

      {selectedTicket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col">
            <div className="border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  #{String(selectedTicket._id || "").slice(-6)} Support Ticket
                </p>
                <h3 className="text-base font-semibold text-slate-900 mt-1">{getTicketTitle(selectedTicket)}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Status: {selectedTicket.status} | Created {formatMessageTime(selectedTicket.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeTicketChat}
                className="rounded-full w-9 h-9 grid place-items-center border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="Close ticket chat"
              >
                x
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50">
              {loadingThread ? (
                <p className="text-sm text-slate-500">Loading conversation...</p>
              ) : ticketMessages.length === 0 ? (
                <p className="text-sm text-slate-500">No messages yet</p>
              ) : (
                ticketMessages.map((message) => {
                  const isUser = message.senderType === "user"
                  const isSystem = message.isSystemMessage === true
                  return (
                    <div
                      key={message._id}
                      className={`flex ${isSystem ? "justify-center" : isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                          isSystem
                            ? "bg-slate-200 text-slate-600 text-xs"
                            : isUser
                              ? "bg-brand-600 text-white"
                              : "bg-white border border-slate-200 text-slate-800"
                        }`}
                      >
                        {!isSystem ? (
                          <p className="text-[11px] font-semibold mb-1 opacity-80">
                            {isUser ? "You" : "Admin"}
                          </p>
                        ) : null}
                        <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                        <p className={`mt-1 text-[10px] ${isUser && !isSystem ? "text-white/80" : "text-slate-500"}`}>
                          {formatMessageTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="border-t border-slate-200 px-5 py-4 space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateTicketStatus(selectedTicket.status === "closed" ? "open" : "closed")}
                  disabled={updatingTicketStatus}
                >
                  {updatingTicketStatus
                    ? "Updating..."
                    : selectedTicket.status === "closed"
                      ? "Reopen Ticket"
                      : "Close Ticket"}
                </Button>
              </div>
              <Textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={3}
                placeholder={
                  selectedTicket.status === "closed"
                    ? "Reopen the ticket to continue the conversation"
                    : "Write your message"
                }
                disabled={selectedTicket.status === "closed" || sendingReply}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  className={BRAND_THEME.tokens.profile.primaryButton}
                  onClick={sendReply}
                  disabled={selectedTicket.status === "closed" || !replyMessage.trim() || sendingReply}
                >
                  {sendingReply ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AnimatedPage>
  )
}

