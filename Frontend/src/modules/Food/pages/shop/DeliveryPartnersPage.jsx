import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import BottomNavOrders from "@food/components/shop/BottomNavOrders"
import { 
  Search, 
  UserPlus, 
  Send, 
  XCircle, 
  Clock, 
  Bike, 
  Star, 
  User, 
  Phone, 
  Trash2, 
  AlertCircle,
  ArrowLeft
} from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Card } from "@food/components/ui/card"
import { toast } from "sonner"
import { shopAPI } from "@food/api"
import { getOrderSocket } from "@/core/services/orderSocket"

export default function DeliveryPartnersPage() {
  const navigate = useNavigate()
  const [searchPhone, setSearchPhone] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState(null)
  const [searched, setSearched] = useState(false)
  const [activeTab, setActiveTab] = useState("active") // "active" | "pending" | "rejected"
  
  const [associatedRiders, setAssociatedRiders] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [rejectedInvites, setRejectedInvites] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPartners = async () => {
    try {
      setLoading(true)
      const res = await shopAPI.listExclusivityPartners()
      if (res.data?.success && res.data?.data) {
        const { associatedRiders, pendingInvites, rejectedInvites } = res.data.data
        setAssociatedRiders(associatedRiders || [])
        setPendingInvites(pendingInvites || [])
        setRejectedInvites(rejectedInvites || [])
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error("Failed to load delivery partners")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPartners()

    const shopToken = localStorage.getItem("shop_access_token") || localStorage.getItem("accessToken")
    if (shopToken) {
      const socket = getOrderSocket(shopToken)
      if (socket) {
        const handleRealtimeUpdate = (payload) => {
          if (payload?.title) {
            toast.info(`${payload.title}: ${payload.body || 'Fleet updated'}`)
          }
          fetchPartners()
        }

        socket.on("exclusivity_accepted", handleRealtimeUpdate)
        socket.on("exclusivity_rejected", handleRealtimeUpdate)
        socket.on("exclusivity_left", handleRealtimeUpdate)

        return () => {
          socket.off("exclusivity_accepted", handleRealtimeUpdate)
          socket.off("exclusivity_rejected", handleRealtimeUpdate)
          socket.off("exclusivity_left", handleRealtimeUpdate)
        }
      }
    }
  }, [])

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    const cleanPhone = searchPhone.trim().replace(/\D/g, "")
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number")
      return
    }

    setSearching(true)
    setSearched(false)
    setSearchResult(null)

    try {
      const res = await shopAPI.searchDeliveryPartner(cleanPhone)
      if (res.data?.success && res.data?.data) {
        const partner = res.data.data
        const isAssociated = associatedRiders.some(r => r.phone === cleanPhone)
        const isPending = pendingInvites.some(i => i.phone === cleanPhone)
        
        setSearchResult({
          ...partner,
          isAlreadyAssociated: isAssociated || partner.isAlreadyAssociated,
          isAlreadyPending: isPending || partner.isAlreadyPending
        })
      } else {
        setSearchResult(null)
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setSearchResult(null)
      } else if (err.response?.status !== 401) {
        toast.error(err.response?.data?.message || "Search failed")
      }
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }

  const handleSendInvite = async (driver) => {
    if (driver.isAlreadyAssociated || driver.isAlreadyPending) return

    try {
      const res = await shopAPI.sendExclusivityInvite(driver.phone)
      if (res.data?.success) {
        toast.success(res.data.message || `Invitation sent to ${driver.name}`)
        fetchPartners()
        setSearchPhone("")
        setSearchResult(null)
        setSearched(false)
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.message || "Failed to send invitation")
      }
    }
  }

  const handleCancelInvite = async (id, name, phone) => {
    try {
      const res = await shopAPI.cancelExclusivityInvite(phone)
      if (res.data?.success) {
        toast.info(res.data.message || `Invitation to ${name} cancelled`)
        fetchPartners()
        if (phone) {
          setSearchResult(prev => prev && prev.phone === phone ? { ...prev, isAlreadyPending: false } : prev)
        }
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.message || "Failed to cancel invitation")
      }
    }
  }

  const handleRemoveRider = async (id, name, phone) => {
    try {
      const res = await shopAPI.removeExclusivityRider(phone)
      if (res.data?.success) {
        toast.error(res.data.message || `${name} has been removed from your delivery fleet`)
        fetchPartners()
        if (phone) {
          setSearchResult(prev => prev && prev.phone === phone ? { ...prev, isAlreadyAssociated: false } : prev)
        }
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.message || "Failed to remove rider")
      }
    }
  }

  const handleClearRejected = (id) => {
    setRejectedInvites(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="min-h-screen overflow-x-hidden pb-24 md:pb-6 bg-gray-50 dark:bg-slate-950 font-poppins">
      {/* Sleek Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-100 dark:border-slate-800/80 py-2.5 px-3.5 sticky top-0 z-20 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95 shrink-0 text-gray-700 dark:text-slate-200"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate">Manage Delivery Fleet</h1>
            </div>
          </div>
          <div className="bg-[#8B9543]/10 dark:bg-[#8B9543]/20 px-2 py-0.5 rounded-full border border-[#8B9543]/20 shrink-0">
            <span className="text-[10px] font-bold text-[#8B9543]">
              Active: {associatedRiders.length}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-3.5 py-3.5 space-y-3">
        
        {/* Compact Search / Invite Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-xs border border-gray-100 dark:border-slate-800"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#8B9543]/10 text-[#8B9543] flex items-center justify-center shrink-0">
              <UserPlus className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-gray-900 dark:text-white">Invite Delivery Partner</h2>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">Search by 10-digit phone number</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                type="tel"
                placeholder="10-digit phone number"
                maxLength={10}
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value.replace(/\D/g, ""))}
                className="pl-8 h-9 text-xs rounded-lg border-gray-200 focus:border-[#8B9543] focus:ring-1 focus:ring-[#8B9543] dark:border-slate-800"
              />
            </div>
            <Button
              type="submit"
              disabled={searching}
              className="h-9 px-3.5 text-xs bg-[#8B9543] hover:bg-[#6F7734] text-white font-bold rounded-lg transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              {searching ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              Search
            </Button>
          </form>

          {/* Search Result */}
          <AnimatePresence mode="wait">
            {searched && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden"
              >
                {searchResult ? (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
                        <User className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-white text-xs truncate">{searchResult.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap">
                          <span>+91 {searchResult.phone}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5"><Bike className="h-2.5 w-2.5" /> {searchResult.vehicleType}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-amber-500 font-bold"><Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> {searchResult.rating}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {searchResult.isAlreadyAssociated ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-green-700 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-md border border-green-200/40 text-center">
                            Associated
                          </span>
                          <Button
                            variant="destructive"
                            onClick={() => handleRemoveRider(null, searchResult.name, searchResult.phone)}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] h-7 px-2 rounded-md flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </Button>
                        </div>
                      ) : searchResult.isAlreadyPending ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md border border-amber-200/40 text-center">
                            Pending
                          </span>
                          <Button
                            variant="outline"
                            onClick={() => handleCancelInvite(null, searchResult.name, searchResult.phone)}
                            className="text-[10px] h-7 border-gray-200 hover:bg-gray-100 font-semibold px-2 rounded-md"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : searchResult.associatedWithOther ? (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded-md border border-red-200/40 text-center">
                          Exclusive to another
                        </span>
                      ) : (
                        <Button
                          onClick={() => handleSendInvite(searchResult)}
                          className="bg-[#8B9543] hover:bg-[#6F7734] text-white font-bold text-[11px] h-8 px-3 rounded-lg flex items-center gap-1 shadow-xs active:scale-95"
                        >
                          <Send className="h-3 w-3" />
                          Invite
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50/70 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-[11px] font-medium text-red-800 dark:text-red-300 leading-tight">
                      No approved delivery partner found with this phone number.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Compact Tabs */}
        <div className="flex bg-slate-100/80 dark:bg-slate-900/90 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all duration-200 ${
              activeTab === "active"
                ? "bg-white dark:bg-slate-800 text-[#8B9543] shadow-xs"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              <Bike className="h-3.5 w-3.5" />
              Active ({associatedRiders.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all duration-200 ${
              activeTab === "pending"
                ? "bg-white dark:bg-slate-800 text-[#8B9543] shadow-xs"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Pending ({pendingInvites.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab("rejected")}
            className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all duration-200 ${
              activeTab === "rejected"
                ? "bg-white dark:bg-slate-800 text-[#8B9543] shadow-xs"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              Rejected ({rejectedInvites.length})
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "active" && (
            <motion.div
              key="active-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-2.5"
            >
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-3 border-[#8B9543] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : associatedRiders.length > 0 ? (
                <div className="space-y-2">
                  {associatedRiders.map((rider) => (
                    <motion.div
                      key={rider.id}
                      layoutId={rider.id}
                      className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-xs border border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#8B9543]/10 text-[#8B9543] flex items-center justify-center shrink-0">
                          <User className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900 dark:text-white text-xs truncate">{rider.name}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                            <span className="truncate">+91 {rider.phone}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5"><Bike className="h-2.5 w-2.5" /> {rider.vehicleType}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-amber-500 font-bold"><Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> {rider.rating}</span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveRider(rider.id, rider.name, rider.phone)}
                        className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all shrink-0"
                        title="Remove rider"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="border-0 shadow-xs bg-white dark:bg-slate-900 p-6 text-center">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-950 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-2 border border-slate-100 dark:border-slate-800">
                    <Bike className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs">No exclusive delivery boys yet</h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-xs mx-auto leading-tight">
                    Invite delivery boys to join your private fleet to enable manual assignment.
                  </p>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === "pending" && (
            <motion.div
              key="pending-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-2.5"
            >
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-3 border-[#8B9543] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pendingInvites.length > 0 ? (
                <div className="space-y-2">
                  {pendingInvites.map((invite) => (
                    <motion.div
                      key={invite.id}
                      layoutId={invite.id}
                      className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-xs border border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-white text-xs truncate">{invite.name}</h4>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">+91 {invite.phone} • {invite.vehicleType}</p>
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200/40 mt-1">
                          <Clock className="h-2.5 w-2.5 animate-spin" /> Sent - Awaiting Response
                        </span>
                      </div>
                      
                      <Button
                        variant="outline"
                        onClick={() => handleCancelInvite(invite.id, invite.name, invite.phone)}
                        className="text-[11px] h-7 border-gray-200 hover:bg-gray-50 font-semibold px-2.5 rounded-lg dark:border-slate-800 shrink-0"
                      >
                        Cancel
                      </Button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="border-0 shadow-xs bg-white dark:bg-slate-900 p-6 text-center">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-950 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-2 border border-slate-100 dark:border-slate-800">
                    <Clock className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs">No pending invites</h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-xs mx-auto leading-tight">
                    All your invitations have been processed or resolved.
                  </p>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === "rejected" && (
            <motion.div
              key="rejected-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-2.5"
            >
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-3 border-[#8B9543] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : rejectedInvites.length > 0 ? (
                <div className="space-y-2">
                  {rejectedInvites.map((invite) => (
                    <motion.div
                      key={invite.id}
                      layoutId={invite.id}
                      className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-xs border border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-white text-xs truncate">{invite.name}</h4>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">+91 {invite.phone} • {invite.vehicleType}</p>
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded border border-red-200/30 mt-1">
                          <XCircle className="h-2.5 w-2.5" /> Declined / Global Status Kept
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleClearRejected(invite.id)}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all shrink-0"
                        title="Dismiss"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="border-0 shadow-xs bg-white dark:bg-slate-900 p-6 text-center">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-950 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-2 border border-slate-100 dark:border-slate-800">
                    <XCircle className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs">No rejected invites</h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-xs mx-auto leading-tight">
                    You have no rejected driver invitations at this time.
                  </p>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Bottom Navigation Bar */}
      <BottomNavOrders />
    </div>
  )
}
