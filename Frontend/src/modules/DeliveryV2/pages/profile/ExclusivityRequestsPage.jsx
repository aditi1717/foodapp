import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, 
  Store, 
  Check, 
  X, 
  Phone, 
  MapPin, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  XCircle,
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { toast } from "sonner"
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation"
import { deliveryAPI } from "@food/api"
import { getOrderSocket } from "@/core/services/orderSocket"

export default function ExclusivityRequestsPage() {
  const goBack = useDeliveryBackNavigation()

  // States managed with backend integration
  const [requests, setRequests] = useState([])
  const [currentAssociation, setCurrentAssociation] = useState(null)
  const [rejectedRequests, setRejectedRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInfoDetails, setShowInfoDetails] = useState(false)

  const fetchExclusivityData = async () => {
    try {
      setLoading(true)
      const res = await deliveryAPI.getExclusivityRequests()
      if (res.data?.success && res.data?.data) {
        const { currentAssociation, requests, rejectedRequests } = res.data.data
        setCurrentAssociation(currentAssociation)
        setRequests(requests || [])
        setRejectedRequests(rejectedRequests || [])
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error("Failed to load exclusivity requests")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExclusivityData()

    const deliveryToken = localStorage.getItem("delivery_access_token") || localStorage.getItem("accessToken")
    if (deliveryToken) {
      const socket = getOrderSocket(deliveryToken)
      if (socket) {
        const handleRealtimeInvite = (payload) => {
          if (payload?.title) {
            toast.info(`${payload.title}: ${payload.body || 'Exclusivity update'}`)
          }
          fetchExclusivityData()
        }

        socket.on("exclusivity_invite", handleRealtimeInvite)
        socket.on("exclusivity_removed", handleRealtimeInvite)

        return () => {
          socket.off("exclusivity_invite", handleRealtimeInvite)
          socket.off("exclusivity_removed", handleRealtimeInvite)
        }
      }
    }
  }, [])

  const handleAccept = async (req) => {
    if (currentAssociation) {
      toast.error("You are already exclusive to another shop. Please leave that partnership first.")
      return
    }

    try {
      const res = await deliveryAPI.acceptExclusivityRequest(req.id)
      if (res.data?.success) {
        toast.success(res.data.message || `Exclusivity request from ${req.shopName} accepted!`)
        fetchExclusivityData()
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.message || "Failed to accept request")
      }
    }
  }

  const handleReject = async (req) => {
    try {
      const res = await deliveryAPI.rejectExclusivityRequest(req.id)
      if (res.data?.success) {
        toast.error(res.data.message || `Exclusivity request from ${req.shopName} declined.`)
        fetchExclusivityData()
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.message || "Failed to decline request")
      }
    }
  }

  const handleLeavePartnership = async () => {
    if (!currentAssociation) return
    const shopName = currentAssociation.shopName
    
    try {
      const res = await deliveryAPI.leaveExclusivityPartnership()
      if (res.data?.success) {
        toast.info(res.data.message || `You have left your partnership with ${shopName}. You are now a global rider.`)
        fetchExclusivityData()
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.message || "Failed to leave partnership")
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] text-gray-900 dark:text-white font-poppins pb-8">
      {/* Sleek Compact Header */}
      <header className="bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md px-3.5 h-14 flex items-center justify-between fixed top-0 w-full z-50 shadow-xs border-b border-gray-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <button 
            onClick={goBack}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg transition-all active:scale-95 shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white truncate">Exclusivity Requests</h1>
        </div>

        {/* Rider Status Badge in Header */}
        <span
          className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
            currentAssociation
              ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800/40"
              : "text-slate-700 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-700/50"
          }`}
        >
          {currentAssociation ? "Exclusive" : "Global"}
        </span>
      </header>

      {/* Main Content Container */}
      <main className="pt-16 px-3.5 space-y-3.5 max-w-md mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2.5">
            <div className="w-8 h-8 border-3 border-[#8B9543] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">Loading requests...</p>
          </div>
        ) : (
          <>
            {/* Compact Info Banner with Accordion Toggle */}
            <div className="bg-amber-50/90 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 rounded-xl p-3 text-amber-900 dark:text-amber-300">
              <div 
                onClick={() => setShowInfoDetails(!showInfoDetails)}
                className="flex items-center justify-between cursor-pointer select-none gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200 truncate">
                    Partnership Info
                  </h3>
                </div>
                <button 
                  type="button" 
                  className="text-amber-700 dark:text-amber-400 p-0.5 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 rounded"
                >
                  {showInfoDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              <AnimatePresence>
                {showInfoDetails ? (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-[11px] text-amber-800/90 dark:text-amber-400/90 mt-2 leading-relaxed border-t border-amber-200/50 dark:border-amber-900/40 pt-2"
                  >
                    Accepting an invitation binds you exclusively to that shop. You can only work for <strong>one shop at a time</strong> and won't receive orders from other vendors.
                  </motion.p>
                ) : (
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-1 truncate">
                    Tap to read how single-shop exclusivity works.
                  </p>
                )}
              </AnimatePresence>
            </div>

            {/* Current Active Exclusivity Card */}
            <section className="space-y-2">
              <h2 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider pl-1">
                Active Partnership
              </h2>

              {currentAssociation ? (
                <motion.div
                  initial={{ scale: 0.99, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-xs border border-emerald-100 dark:border-emerald-500/20 relative overflow-hidden"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800/30">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <h3 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {currentAssociation.shopName}
                        </h3>
                        <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded shrink-0 border border-emerald-200/60 dark:border-emerald-800/30">
                          Active
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-[11px] text-gray-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 shrink-0" />
                          <span>+91 {currentAssociation.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 shrink-0" />
                          <span className="truncate">{currentAssociation.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500 text-[10px]">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>Joined: {currentAssociation.associatedAt ? new Date(currentAssociation.associatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleLeavePartnership}
                    className="w-full mt-3 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-bold text-[11px] uppercase tracking-wider rounded-lg transition-all border border-red-100 dark:border-red-900/30 active:scale-[0.99]"
                  >
                    Leave Partnership
                  </button>
                </motion.div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-gray-100 dark:border-slate-800/80 text-center">
                  <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-slate-950 text-gray-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-2 border border-gray-100 dark:border-slate-800/50">
                    <Store className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300">No Active Partnership</h3>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5 leading-tight max-w-xs mx-auto">
                    You are a Global Rider and can receive orders from any shop.
                  </p>
                </div>
              )}
            </section>

            {/* Incoming Exclusivity Requests */}
            <section className="space-y-2">
              <div className="flex items-center justify-between pl-1">
                <h2 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  Pending Requests ({requests.length})
                </h2>
                {currentAssociation && (
                  <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Max 1 shop
                  </span>
                )}
              </div>

              <AnimatePresence mode="popLayout">
                {requests.length > 0 ? (
                  <div className="space-y-2.5">
                    {requests.map((req) => (
                      <motion.div
                        key={req.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-xs border border-gray-100 dark:border-slate-800/80"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-slate-950 text-gray-550 dark:text-slate-400 flex items-center justify-center shrink-0 border border-gray-100 dark:border-slate-800/50">
                            <Store className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {req.shopName}
                              </h3>
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/50 shrink-0">
                                Invite
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                              {req.location}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-slate-800/60 flex items-center gap-2">
                          <button
                            onClick={() => handleAccept(req)}
                            disabled={currentAssociation !== null}
                            className={`flex-1 py-2 font-bold text-[11px] uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1 active:scale-[0.99] ${
                              currentAssociation !== null
                                ? "bg-gray-100 dark:bg-slate-800/40 text-gray-400 dark:text-slate-600 cursor-not-allowed border border-gray-200/50 dark:border-slate-800/40"
                                : "bg-[#8B9543] hover:bg-[#6F7734] text-white shadow-xs"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleReject(req)}
                            className="py-2 px-3 bg-gray-50 hover:bg-gray-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 font-bold text-[11px] uppercase tracking-wider rounded-lg transition-all border border-gray-200 dark:border-slate-800 flex items-center justify-center gap-1 active:scale-[0.99]"
                          >
                            <X className="w-3.5 h-3.5" />
                            Decline
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 pl-1">No pending invitations.</p>
                )}
              </AnimatePresence>
            </section>

            {/* Declined Requests */}
            {rejectedRequests.length > 0 && (
              <section className="space-y-2 pt-1">
                <h2 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider pl-1 flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-gray-400" />
                  Declined ({rejectedRequests.length})
                </h2>
                <div className="space-y-1.5">
                  {rejectedRequests.map((req) => (
                    <div 
                      key={req.id}
                      className="bg-white dark:bg-slate-900 rounded-lg p-2.5 border border-gray-100 dark:border-slate-800/60 flex items-center justify-between gap-3 text-[11px]"
                    >
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-700 dark:text-slate-300 truncate">{req.shopName}</h4>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">+91 {req.phone}</p>
                      </div>
                      <span className="text-[9px] font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-full border border-red-100 dark:border-red-900/30 shrink-0">
                        Declined
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
