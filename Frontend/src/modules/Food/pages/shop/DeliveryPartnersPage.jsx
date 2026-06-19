import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"
import { 
  Search, 
  UserPlus, 
  Send, 
  CheckCircle, 
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
import { Card, CardContent } from "@food/components/ui/card"
import BRAND_THEME from "@/config/brandTheme"
import { toast } from "sonner"
import { restaurantAPI } from "@food/api"

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
      const res = await restaurantAPI.listExclusivityPartners()
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
      const res = await restaurantAPI.searchDeliveryPartner(cleanPhone)
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
      const res = await restaurantAPI.sendExclusivityInvite(driver.phone)
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
      const res = await restaurantAPI.cancelExclusivityInvite(phone)
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
      const res = await restaurantAPI.removeExclusivityRider(phone)
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
    <div
      className="min-h-screen overflow-x-hidden pb-24 md:pb-6 bg-white dark:bg-slate-950"
    >
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-gray-800 py-4 px-4 sticky top-0 z-20 shadow-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-200" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Manage Delivery Fleet</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Invite and manage exclusive delivery partners</p>
            </div>
          </div>
          <div className="bg-[#8B9543]/10 px-3 py-1.5 rounded-full border border-[#8B9543]/20">
            <span className="text-xs font-bold text-[#8B9543]">
              Active: {associatedRiders.length}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Search / Invite Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-800 transition-all duration-300"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#8B9543]/10 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-[#8B9543]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Invite Delivery Partner</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Search by 10-digit phone number to add them to your fleet</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="tel"
                placeholder="Enter phone number (e.g. 9876543210)"
                maxLength={10}
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value.replace(/\D/g, ""))}
                className="pl-10 h-11 rounded-xl border-gray-200 focus:border-[#8B9543] focus:ring-1 focus:ring-[#8B9543] dark:border-gray-800"
              />
            </div>
            <Button
              type="submit"
              disabled={searching}
              className="h-11 px-6 bg-[#8B9543] hover:bg-[#6F7734] text-white font-bold rounded-xl transition-all shadow-md shadow-[#8B9543]/10 flex items-center gap-2"
            >
              {searching ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="h-4.5 w-4.5" />
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
                className="mt-4 overflow-hidden"
              >
                {searchResult ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                        <User className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">{searchResult.name}</h4>
                        <div className="flex items-center gap-2.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> +91 {searchResult.phone}</span>
                          <span className="flex items-center gap-1"><Bike className="h-3 w-3" /> {searchResult.vehicleType}</span>
                          <span className="flex items-center gap-0.5 text-amber-500 font-bold"><Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {searchResult.rating}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      {searchResult.isAlreadyAssociated ? (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-950/20 px-3 py-1.5 rounded-lg border border-green-200/30 text-center">
                            Already Associated
                          </span>
                          <Button
                            variant="destructive"
                            onClick={() => handleRemoveRider(null, searchResult.name, searchResult.phone)}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs h-9 px-3 rounded-lg flex items-center justify-center gap-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      ) : searchResult.isAlreadyPending ? (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 rounded-lg border border-amber-200/30 text-center">
                            Invite Pending
                          </span>
                          <Button
                            variant="outline"
                            onClick={() => handleCancelInvite(null, searchResult.name, searchResult.phone)}
                            className="text-xs h-9 border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold px-3 rounded-lg flex items-center justify-center gap-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : searchResult.associatedWithOther ? (
                        <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-200/30 text-center">
                          Exclusive to another Restaurant
                        </span>
                      ) : (
                        <Button
                          onClick={() => handleSendInvite(searchResult)}
                          className="bg-[#8B9543] hover:bg-[#6F7734] text-white font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Send Invitation
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50/50 dark:bg-red-950/10 rounded-xl border border-red-100/50 dark:border-red-900/20 flex items-center gap-2.5">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <p className="text-xs font-medium text-red-800 dark:text-red-400">
                      No approved delivery partner found with this phone number. Make sure they are registered and approved by Admin.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 mb-6 bg-slate-50/50 dark:bg-slate-950/20 p-1.5 rounded-xl">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg relative transition-all duration-200 ${
              activeTab === "active"
                ? "bg-white dark:bg-slate-900 text-[#8B9543] shadow-sm"
                : "text-gray-400 dark:text-gray-500 hover:text-[#8B9543]"
            }`}
          >
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <Bike className="h-3.5 w-3.5" />
              Active Fleet ({associatedRiders.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg relative transition-all duration-200 ${
              activeTab === "pending"
                ? "bg-white dark:bg-slate-900 text-[#8B9543] shadow-sm"
                : "text-gray-400 dark:text-gray-500 hover:text-[#8B9543]"
            }`}
          >
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Pending ({pendingInvites.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab("rejected")}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg relative transition-all duration-200 ${
              activeTab === "rejected"
                ? "bg-white dark:bg-slate-900 text-[#8B9543] shadow-sm"
                : "text-gray-400 dark:text-gray-500 hover:text-[#8B9543]"
            }`}
          >
            <span className="relative z-10 flex items-center justify-center gap-1.5">
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-[#8B9543] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : associatedRiders.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {associatedRiders.map((rider) => (
                    <motion.div
                      key={rider.id}
                      layoutId={rider.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4 transition-all duration-300"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-[#8B9543]/10 flex items-center justify-center text-[#8B9543]">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{rider.name}</h4>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                            <span className="truncate">+91 {rider.phone}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5"><Bike className="h-3 w-3" /> {rider.vehicleType}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-amber-500 font-bold"><Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {rider.rating}</span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveRider(rider.id, rider.name, rider.phone)}
                        className="w-9 h-9 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-full transition-all"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 p-8 text-center">
                  <div className="w-12 h-12 bg-slate-50 dark:bg-slate-950/40 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-100 dark:border-slate-800">
                    <Bike className="h-6 w-6 text-slate-400" />
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No exclusive delivery boys yet</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
                    Invite delivery boys to join your private fleet to enable manual assignment.
                  </p>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === "pending" && (
            <motion.div
              key="pending-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-[#8B9543] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pendingInvites.length > 0 ? (
                <div className="space-y-3">
                  {pendingInvites.map((invite) => (
                    <motion.div
                      key={invite.id}
                      layoutId={invite.id}
                      className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 transition-all duration-300"
                    >
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{invite.name}</h4>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">+91 {invite.phone} • {invite.vehicleType}</p>
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-200/20 mt-1.5">
                          <Clock className="h-2.5 w-2.5 animate-spin" /> Sent - Awaiting Response
                        </span>
                      </div>
                      
                      <Button
                        variant="outline"
                        onClick={() => handleCancelInvite(invite.id, invite.name, invite.phone)}
                        className="text-xs h-8 border-gray-200 hover:bg-gray-50 font-semibold px-3 rounded-lg dark:border-gray-800"
                      >
                        Cancel
                      </Button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 p-8 text-center animate-fade-in">
                  <div className="w-12 h-12 bg-slate-50 dark:bg-slate-950/40 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-100 dark:border-slate-800">
                    <Clock className="h-6 w-6 text-slate-400" />
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No pending invites</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
                    All your invitations have been processed or resolved.
                  </p>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === "rejected" && (
            <motion.div
              key="rejected-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-[#8B9543] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : rejectedInvites.length > 0 ? (
                <div className="space-y-3">
                  {rejectedInvites.map((invite) => (
                    <motion.div
                      key={invite.id}
                      layoutId={invite.id}
                      className="bg-white dark:bg-slate-900 rounded-xl p-3.5 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 transition-all duration-300"
                    >
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{invite.name}</h4>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">+91 {invite.phone} • {invite.vehicleType}</p>
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded border border-red-200/20 mt-1.5">
                          <XCircle className="h-2.5 w-2.5" /> Declined / Global Status Kept
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleClearRejected(invite.id)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 p-8 text-center animate-fade-in">
                  <div className="w-12 h-12 bg-slate-50 dark:bg-slate-950/40 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-100 dark:border-slate-800">
                    <XCircle className="h-6 w-6 text-slate-400" />
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No rejected invites</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
                    You have no rejected driver invitations at this time.
                  </p>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <BottomNavOrders />
    </div>
  )
}

