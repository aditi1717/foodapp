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
  ShieldAlert
} from "lucide-react"
import { toast } from "sonner"
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation"
import BRAND_THEME from "@/config/brandTheme"
import { deliveryAPI } from "@food/api"

export default function ExclusivityRequestsPage() {
  const goBack = useDeliveryBackNavigation()

  // States managed with backend integration
  const [requests, setRequests] = useState([])
  const [currentAssociation, setCurrentAssociation] = useState(null)
  const [rejectedRequests, setRejectedRequests] = useState([])
  const [loading, setLoading] = useState(true)

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
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] text-gray-900 dark:text-white font-poppins pb-10">
      {/* Top Header - White/Light with Dark Mode support */}
      <div className="bg-white dark:bg-[#0f172a]/95 backdrop-blur-md px-4 py-5 flex items-center gap-4 fixed top-0 w-full z-50 shadow-sm border-b border-gray-100 dark:border-slate-800/80 transition-colors">
        <button 
          onClick={goBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold tracking-tight text-gray-900 dark:text-white">Exclusivity Requests</h1>
      </div>

      <div className="pt-24 px-4 space-y-6 max-w-md mx-auto">
        <div className="flex items-center justify-end">
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
              currentAssociation
                ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800/40"
                : "text-slate-700 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-900 dark:border-slate-700/50"
            }`}
          >
            {currentAssociation ? "Exclusive Rider" : "Global Rider"}
          </span>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-[#8B9543] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">Loading exclusivity requests...</p>
          </div>
        ) : (
          <>
            {/* Info Banner - Light Orange with Dark mode support */}
            <div className="bg-orange-50 dark:bg-amber-950/20 border border-orange-100 dark:border-amber-900/30 rounded-2xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-orange-500 dark:text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-orange-850 dark:text-amber-300">Exclusivity Partnership Info</h3>
                <p className="text-[11px] text-orange-700/90 dark:text-amber-400/80 mt-1 leading-relaxed">
                  Accepting an invitation binds you exclusively to that shop. You can only work for **one shop at a time** and won't receive orders from any other vendor. Both you or the shop can end this partnership at any time.
                </p>
              </div>
            </div>

            {/* Current Active Exclusivity Card */}
            <div className="space-y-3">
              <h2 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest pl-1">
                Active Partnership
              </h2>

              {currentAssociation ? (
                <motion.div
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm dark:shadow-xl border border-gray-100 dark:border-emerald-500/20 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-6 -mt-6 blur-lg" />
                  
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800/30">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {currentAssociation.shopName}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-650 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/45 px-2 py-0.5 rounded mt-1.5 border border-emerald-100 dark:border-emerald-800/20">
                        Exclusive Rider • Active
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800/60 space-y-3">
                    <div className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-slate-300">
                      <Phone className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <span>+91 {currentAssociation.phone}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-slate-300">
                      <MapPin className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <span className="truncate">{currentAssociation.location}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-gray-450 dark:text-slate-400">
                      <Clock className="w-4 h-4 text-gray-300 dark:text-slate-600" />
                      <span>Started today at {currentAssociation.associatedAt ? new Date(currentAssociation.associatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : "N/A"}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleLeavePartnership}
                    className="w-full mt-5 py-3.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-red-100 dark:border-red-900/30"
                  >
                    Leave Partnership
                  </button>
                </motion.div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm dark:shadow-xl border border-gray-100 dark:border-slate-800/80 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-slate-950 text-gray-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-3 border border-gray-100 dark:border-slate-800/50">
                    <Store className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300">No Active Partnership</h3>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                    You are currently a Global Rider and can accept orders from any shop.
                  </p>
                </div>
              )}
            </div>

            {/* Incoming Exclusivity Requests */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pl-1">
                <h2 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                  Pending Requests ({requests.length})
                </h2>
                {currentAssociation && (
                  <span className="text-[9px] font-semibold text-gray-400 dark:text-slate-500 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-amber-500" /> Max 1 partnership
                  </span>
                )}
              </div>

              <AnimatePresence mode="popLayout">
                {requests.length > 0 ? (
                  <div className="space-y-4">
                    {requests.map((req) => (
                      <motion.div
                        key={req.id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm dark:shadow-xl border border-gray-100 dark:border-slate-800/80 relative overflow-hidden"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-gray-50 dark:bg-slate-950 text-gray-550 dark:text-slate-400 flex items-center justify-center shrink-0 border border-gray-100 dark:border-slate-800/50">
                            <Store className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                              {req.shopName}
                            </h3>
                            <p className="text-[11px] text-gray-450 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600" />
                              {req.location}
                            </p>
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/30 px-2 py-0.5 rounded mt-1 border border-amber-200/60 dark:border-amber-800/50">
                              Pending Invite
                            </span>
                          </div>
                        </div>

                        <div className="mt-5 pt-3.5 border-t border-gray-100 dark:border-slate-800/55 flex items-center gap-2">
                          <button
                            onClick={() => handleAccept(req)}
                            disabled={currentAssociation !== null}
                            className={`flex-1 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                              currentAssociation !== null
                                ? "bg-gray-100 dark:bg-slate-800/40 text-gray-400 dark:text-slate-600 cursor-not-allowed border border-gray-200/50 dark:border-slate-800/40"
                                : "bg-[#8B9543] hover:bg-[#6F7734] text-white shadow-md shadow-[#8B9543]/10"
                            }`}
                          >
                            <Check className="w-4 h-4" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleReject(req)}
                            className="py-3 px-4 bg-gray-50 hover:bg-gray-100 dark:bg-slate-950 dark:hover:bg-slate-850 text-gray-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-gray-200 dark:border-slate-800 flex items-center justify-center"
                          >
                            <X className="w-4 h-4" />
                            Decline
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-slate-500 pl-1">No pending invitations.</p>
                )}
              </AnimatePresence>
            </div>

            {/* Declined Requests */}
            {rejectedRequests.length > 0 && (
              <div className="space-y-3 pt-2">
                <h2 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                  Declined Requests
                </h2>
                <div className="space-y-3">
                  {rejectedRequests.map((req) => (
                    <div 
                      key={req.id}
                      className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm dark:shadow-md border border-gray-100 dark:border-slate-800/60 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 truncate">{req.shopName}</h4>
                        <p className="text-[10px] text-gray-450 dark:text-slate-500 mt-0.5 truncate">+91 {req.phone}</p>
                      </div>
                      <span className="text-[9px] font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2.5 py-1 rounded-full border border-red-100 dark:border-red-900/30 shrink-0">
                        Declined
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

