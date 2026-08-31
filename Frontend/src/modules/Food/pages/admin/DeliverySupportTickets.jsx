import { useEffect, useMemo, useState } from "react"
import { CheckCircle, Clock, Eye, Loader2, MessageSquare, Search, XCircle } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"]

const getStatusLabel = (status) =>
  String(status || "open")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())

const formatDateTime = (value) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("en-IN")
}

const getStatusIcon = (status) => {
  switch (status) {
    case "resolved":
      return <CheckCircle className="h-4 w-4 text-emerald-600" />
    case "closed":
      return <XCircle className="h-4 w-4 text-slate-500" />
    case "in_progress":
      return <Clock className="h-4 w-4 text-brand-600" />
    default:
      return <Clock className="h-4 w-4 text-amber-500" />
  }
}

const getStatusBadge = (status) => {
  switch (status) {
    case "resolved":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200"
    case "closed":
      return "bg-slate-100 text-slate-700 border border-slate-200"
    case "in_progress":
      return "bg-brand-50 text-brand-700 border border-brand-200"
    default:
      return "bg-amber-50 text-amber-700 border border-amber-200"
  }
}

const getPartnerName = (ticket) =>
  ticket?.deliveryPartner?.name ||
  ticket?.deliveryPartnerName ||
  ticket?.deliveryBoyName ||
  "-"

const getPartnerPhone = (ticket) =>
  ticket?.deliveryPartner?.phone ||
  ticket?.deliveryPartnerPhone ||
  ticket?.deliveryBoyPhone ||
  "-"

export default function DeliverySupportTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [stats, setStats] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [threadMessages, setThreadMessages] = useState([])
  const [modalDraft, setModalDraft] = useState({ status: "open", message: "" })
  const [loadingThread, setLoadingThread] = useState(false)
  const [saving, setSaving] = useState(false)

  const computedStats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((ticket) => ticket.status === "open").length
    const inProgress = tickets.filter((ticket) => ticket.status === "in_progress").length
    const resolved = tickets.filter((ticket) => ticket.status === "resolved").length
    const closed = tickets.filter((ticket) => ticket.status === "closed").length
    return { total, open, inProgress, resolved, closed }
  }, [tickets])

  const summaryStats = stats || computedStats

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const response = await adminAPI.getDeliverySupportTickets(params)
      const list = response?.data?.data?.tickets || []
      setTickets(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load tickets")
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await adminAPI.getDeliverySupportTicketStats()
      if (response?.data?.success && response?.data?.data) {
        setStats(response.data.data)
      }
    } catch {}
  }

  useEffect(() => {
    fetchTickets()
  }, [statusFilter, priorityFilter])

  useEffect(() => {
    fetchStats()
  }, [])

  const openTicketModal = async (ticket) => {
    setSelectedTicket(ticket)
    setThreadMessages([])
    setModalDraft({
      status: ticket.status || "open",
      message: "",
    })
    setLoadingThread(true)

    try {
      const response = await adminAPI.getDeliverySupportTicketThread(ticket._id)
      const data = response?.data?.data || {}
      if (data.ticket) {
        setSelectedTicket(data.ticket)
        setModalDraft((prev) => ({
          ...prev,
          status: data.ticket.status || prev.status,
        }))
      }
      setThreadMessages(Array.isArray(data.messages) ? data.messages : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load conversation")
    } finally {
      setLoadingThread(false)
    }
  }

  const closeTicketModal = () => {
    setSelectedTicket(null)
    setThreadMessages([])
    setModalDraft({ status: "open", message: "" })
    setLoadingThread(false)
    setSaving(false)
  }

  const syncTicketState = (updatedTicket) => {
    if (!updatedTicket?._id) return
    setSelectedTicket(updatedTicket)
    setTickets((prev) =>
      prev.map((ticket) =>
        String(ticket._id) === String(updatedTicket._id)
          ? { ...ticket, ...updatedTicket }
          : ticket,
      ),
    )
  }

  const refreshListData = async () => {
    await fetchTickets()
    await fetchStats()
  }

  const saveModalChanges = async () => {
    if (!selectedTicket?._id) return

    const trimmedMessage = modalDraft.message.trim()
    const statusChanged = modalDraft.status !== selectedTicket.status

    if (!trimmedMessage && !statusChanged) {
      closeTicketModal()
      return
    }

    try {
      setSaving(true)

      if (statusChanged) {
        const statusResponse = await adminAPI.updateDeliverySupportTicket(selectedTicket._id, {
          status: modalDraft.status,
        })
        const updatedTicket =
          statusResponse?.data?.data?.ticket ||
          statusResponse?.data?.ticket ||
          null

        if (updatedTicket) {
          syncTicketState(updatedTicket)
        }

        if (Array.isArray(statusResponse?.data?.data?.messages)) {
          setThreadMessages(statusResponse.data.data.messages)
        }
      }

      if (trimmedMessage) {
        const messageResponse = await adminAPI.sendDeliverySupportTicketMessage(selectedTicket._id, {
          message: trimmedMessage,
        })
        const data = messageResponse?.data?.data || {}
        if (data.ticket) {
          syncTicketState(data.ticket)
          setModalDraft((prev) => ({
            ...prev,
            status: data.ticket.status || prev.status,
          }))
        }
        if (data.message) {
          setThreadMessages((prev) => [...prev, data.message])
        }
      }

      await refreshListData()
      toast.success(trimmedMessage ? "Reply sent" : "Ticket updated")
      closeTicketModal()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update ticket")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-slate-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Delivery Support Tickets</h1>
              <p className="mt-1 text-sm text-slate-600">
                Review delivery partner conversations and reply from admin.
              </p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{summaryStats.total}</p>
              <p className="mt-1 text-xs text-slate-600">Total</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{summaryStats.open}</p>
              <p className="mt-1 text-xs text-amber-600">Open</p>
            </div>
            <div className="rounded-lg bg-brand-50 p-4 text-center">
              <p className="text-2xl font-bold text-brand-700">{summaryStats.inProgress}</p>
              <p className="mt-1 text-xs text-brand-600">In Progress</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{summaryStats.resolved}</p>
              <p className="mt-1 text-xs text-emerald-600">Resolved</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-4 text-center">
              <p className="text-2xl font-bold text-slate-700">{summaryStats.closed}</p>
              <p className="mt-1 text-xs text-slate-600">Closed</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") fetchTickets()
                  }}
                  placeholder="Search by subject, message, ticket ID, or partner..."
                  className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <button
              type="button"
              onClick={fetchTickets}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Search
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-14 text-center text-slate-500">No tickets found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3">Ticket ID</th>
                    <th className="px-4 py-3">Delivery Boy Name</th>
                    <th className="px-4 py-3">Mobile Number</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Ticket Status</th>
                    <th className="px-4 py-3">Last Activity</th>
                    <th className="px-4 py-3 text-center">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tickets.map((ticket) => (
                    <tr key={ticket._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        #{ticket.ticketId || String(ticket._id).slice(-6)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        {getPartnerName(ticket)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {getPartnerPhone(ticket)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div className="max-w-[320px]">
                          <p className="font-medium text-slate-900">
                            {ticket.subject || "Delivery Support Ticket"}
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                            {ticket.lastMessage || ticket.description || "No message yet"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadge(ticket.status)}`}>
                          {getStatusIcon(ticket.status)}
                          {getStatusLabel(ticket.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDateTime(ticket.lastMessageAt || ticket.updatedAt || ticket.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => openTicketModal(ticket)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                          title="View ticket"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedTicket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  Delivery Ticket #{selectedTicket.ticketId || String(selectedTicket._id).slice(-6)}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {selectedTicket.subject || "Delivery Support Ticket"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Created {formatDateTime(selectedTicket.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeTicketModal}
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="Close ticket modal"
              >
                x
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {getPartnerName(selectedTicket)}
                    </span>
                    <span className="text-sm text-slate-500">{getPartnerPhone(selectedTicket)}</span>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadge(selectedTicket.status)}`}>
                      {getStatusLabel(selectedTicket.status)}
                    </span>
                  </div>
                  {selectedTicket.description ? (
                    <p className="mt-2 text-sm text-slate-600">
                      {selectedTicket.description}
                    </p>
                  ) : null}
                </div>

                <div className="max-h-[420px] space-y-3 overflow-y-auto bg-slate-50 p-4">
                  {loadingThread ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading conversation...
                    </div>
                  ) : threadMessages.length === 0 ? (
                    <p className="text-sm text-slate-500">No messages yet</p>
                  ) : (
                    threadMessages.map((message) => {
                      const isSystem = message.isSystemMessage === true
                      const isAdmin = !isSystem && message.senderType === "admin"

                      if (isSystem) {
                        return (
                          <div key={message._id} className="flex justify-center my-2">
                            <div className="text-center px-3 py-1 text-xs font-medium text-slate-500">
                              <span>{message.message}</span>
                              <span className="ml-2 text-[10px] text-slate-400">
                                {formatDateTime(message.createdAt)}
                              </span>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div
                          key={message._id}
                          className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                              isAdmin
                                ? "bg-slate-900 text-white"
                                : "border border-slate-200 bg-white text-slate-800"
                            }`}
                          >
                            <p className={`mb-1 text-[11px] font-semibold ${isAdmin ? "text-white/80" : "text-slate-500"}`}>
                              {isAdmin ? "Admin" : "Delivery Partner"}
                            </p>
                            <p className="whitespace-pre-wrap text-sm">{message.message}</p>
                            <p className={`mt-2 text-[10px] ${isAdmin ? "text-white/80" : "text-slate-500"}`}>
                              {formatDateTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="grid gap-4 border-t border-slate-200 p-4">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
                    <select
                      value={modalDraft.status}
                      onChange={(e) => setModalDraft((prev) => ({ ...prev, status: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {getStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold uppercase text-slate-500">Reply</span>
                    <textarea
                      value={modalDraft.message}
                      onChange={(e) => setModalDraft((prev) => ({ ...prev, message: e.target.value }))}
                      rows={5}
                      className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder={
                        modalDraft.status === "closed"
                          ? "Add a closing note for this ticket"
                          : "Write a reply for the delivery partner"
                      }
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      This message will be added to the delivery support conversation.
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeTicketModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveModalChanges}
                disabled={saving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
