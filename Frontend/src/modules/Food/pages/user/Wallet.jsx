import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  IndianRupee,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Loader2,
  Gift,
  CreditCard,
  ChevronRight,
  Sparkles,
  History,
  Wifi,
  AlertCircle,
  Clock
} from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Card, CardContent } from "@food/components/ui/card"
import AnimatedPage from "@food/components/user/AnimatedPage"
import AddMoneyModal from "@food/components/user/AddMoneyModal"
import { userAPI } from "@food/api"
import { toast } from "sonner"
import { useCompanyName } from "@food/hooks/useCompanyName"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import { useProfile } from "@food/context/ProfileContext"
import BRAND_THEME from "@/config/brandTheme"

const TRANSACTION_TYPES = {
  ALL: "all",
  ADDITIONS: "additions",
  DEDUCTIONS: "deductions",
  REFUNDS: "refunds",
}

export default function Wallet() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const { userProfile } = useProfile()
  
  const [selectedFilter, setSelectedFilter] = useState(TRANSACTION_TYPES.ALL)
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [addMoneyModalOpen, setAddMoneyModalOpen] = useState(false)
  const [initialAmount, setInitialAmount] = useState("")
  const [expandedTransactionId, setExpandedTransactionId] = useState(null)

  const displayName = userProfile?.name || "Loyal Customer"

  const fetchWalletData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await userAPI.getWallet({ noCache: true })
      const walletData = response?.data?.data?.wallet || response?.data?.wallet

      if (walletData) {
        setWallet(walletData)
        setTransactions(walletData.transactions || [])
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load wallet")
      toast.error("Failed to load wallet data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWalletData()
  }, [])

  const currentBalance = wallet?.balance || 0

  const referralEarnings = useMemo(() => {
    if (wallet?.referralEarnings != null) {
      return Number(wallet.referralEarnings) || 0
    }

    return transactions
      .filter(
        (transaction) =>
          transaction.type === "addition" &&
          transaction.status === "Completed" &&
          (transaction?.metadata?.source === "referral_signup" ||
            String(transaction.description || "").toLowerCase().startsWith("referral reward"))
      )
      .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0)
  }, [wallet, transactions])

  const filteredTransactions = useMemo(() => {
    if (selectedFilter === TRANSACTION_TYPES.ALL) {
      return transactions
    }

    return transactions.filter((transaction) => {
      if (selectedFilter === TRANSACTION_TYPES.ADDITIONS) {
        return transaction.type === "addition"
      }
      if (selectedFilter === TRANSACTION_TYPES.DEDUCTIONS) {
        return transaction.type === "deduction"
      }
      if (selectedFilter === TRANSACTION_TYPES.REFUNDS) {
        return transaction.type === "refund"
      }
      return true
    })
  }, [selectedFilter, transactions])

  const formatAmount = (amount) => {
    const numeric = Number(amount ?? 0)
    const safe = Number.isFinite(numeric) ? numeric : 0
    return `${"\u20B9"}${safe.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"

    const date = new Date(dateString)
    const formattedDate = date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })
    const formattedTime = date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })

    return `${formattedDate} • ${formattedTime}`
  }

  const handlePresetClick = (amount) => {
    setInitialAmount(amount.toString())
    setAddMoneyModalOpen(true)
  }

  return (
    <AnimatedPage className="min-h-screen bg-slate-50/50 dark:bg-[#07090e] pb-12 transition-colors duration-300">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-[#0c0f17]/80 backdrop-blur-lg border-b border-slate-100 dark:border-slate-900 transition-colors duration-300">
        <div className="max-w-3xl mx-auto px-3 sm:px-4">
          <div className="flex items-center gap-2.5 py-3">
            <button
              onClick={goBack}
              className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-slate-700 dark:text-slate-200" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">{companyName} Money</h1>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold block mt-0.5">Secure Payments & Wallet</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4 sm:space-y-5">
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 animate-pulse">
            {/* Card Skeleton */}
            <div className="md:col-span-3 aspect-[1.6/1] bg-slate-200 dark:bg-slate-800/80 rounded-3xl" />
            {/* Action Skeleton */}
            <div className="md:col-span-2 space-y-4 flex flex-col justify-between">
              <div className="h-[46%] bg-slate-200 dark:bg-slate-800/80 rounded-3xl" />
              <div className="h-[48%] bg-slate-200 dark:bg-slate-800/80 rounded-3xl" />
            </div>
            {/* Filter Skeleton */}
            <div className="col-span-full h-12 bg-slate-200 dark:bg-slate-800/80 rounded-2xl max-w-md mt-4" />
            {/* List Skeleton */}
            <div className="col-span-full space-y-3 mt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800/80 rounded-2xl" />
              ))}
            </div>
          </div>
        )}

        {error && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 sm:p-5 flex items-start gap-3"
          >
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-400 text-sm">Failed to Load Wallet</h3>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">{error}</p>
            </div>
          </motion.div>
        )}

        {!loading && !error && (
          <>
            {/* Main Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-stretch">
              {/* Virtual Wallet Card */}
              <div className="md:col-span-3">
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="relative w-full aspect-[1.7/1] rounded-2xl overflow-hidden shadow-lg p-4 sm:p-4 flex flex-col justify-between text-white select-none group border border-white/10 dark:border-white/5"
                  style={{
                    background: "linear-gradient(135deg, #8B9543 0%, #6F7734 50%, #474C23 100%)"
                  }}
                >
                  {/* Glassmorphic overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.18),transparent_60%)] pointer-events-none" />
                  <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.1)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                  {/* Top row */}
                  <div className="flex justify-between items-start z-10">
                    <div className="flex flex-col">
                      <span className="text-[10px] tracking-[0.2em] text-white/70 font-bold uppercase">Digital Card</span>
                      <span className="text-sm sm:text-base font-extrabold tracking-tight mt-0.5">{companyName} Money</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-sm">
                      <Sparkles className="h-3 w-3 text-amber-300 animate-pulse" />
                      <span className="text-[9px] font-bold tracking-wider text-amber-200">PREMIUM</span>
                    </div>
                  </div>

                  {/* Mid row: Chip and Contactless logo */}
                  <div className="flex items-center justify-between mt-2 z-10">
                    <div className="w-9 h-6.5 rounded-md bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 border border-amber-300/30 shadow-inner relative overflow-hidden">
                      <div className="absolute inset-y-0 left-1/3 w-px bg-black/10" />
                      <div className="absolute inset-y-0 right-1/3 w-px bg-black/10" />
                      <div className="absolute inset-x-0 top-1/2 h-px bg-black/10" />
                    </div>
                    <Wifi className="h-4.5 w-4.5 text-white/70 rotate-90" />
                  </div>

                  {/* Balance Display */}
                  <div className="mt-3 z-10">
                    <span className="text-[10px] tracking-wider text-white/60 block uppercase font-bold">Balance Available</span>
                    <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-0.5 flex items-baseline">
                      <span className="text-xl sm:text-2xl font-semibold mr-0.5">₹</span>
                      <span>{currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Bottom Row */}
                  <div className="flex justify-between items-end mt-3 z-10">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-white/50 uppercase tracking-widest font-bold">Card Holder</span>
                      <span className="text-xs sm:text-sm font-bold tracking-wide text-white/90 truncate max-w-[150px] sm:max-w-[200px]">
                        {displayName}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-white/50 uppercase tracking-widest font-bold">Wallet ID</span>
                      <span className="text-xs sm:text-sm font-mono tracking-wider text-white/90">
                        •••• {wallet?.id ? wallet.id.slice(-4) : "8842"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Side Panels: Rewards & Quick Add */}
              <div className="md:col-span-2 flex flex-col justify-between gap-3">
                {/* Referral Earnings Card */}
                <motion.div
                  whileHover={{ y: -2 }}
                  className="relative bg-gradient-to-br from-green-500/[0.04] via-transparent to-transparent dark:from-green-500/[0.02] border border-green-500/10 dark:border-green-500/5 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between flex-1 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-950/20 flex items-center justify-center border border-green-100 dark:border-green-900/40">
                        <Gift className="h-4.5 w-4.5 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">Referral Earnings</h3>
                      <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mt-0.5 max-w-[150px]">
                        Invite friends to {companyName} and win rewards.
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 block uppercase font-bold">Total Earned</span>
                      <span className="text-lg sm:text-xl font-extrabold text-green-600 dark:text-green-400 block mt-0.5">
                        {formatAmount(referralEarnings)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate("/food/profile/refer-earn")}
                    className="mt-3 w-full py-1.5 bg-green-50/70 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50 text-green-700 dark:text-green-300 rounded-lg text-[11px] font-bold border border-green-200/40 dark:border-green-900/20 transition-all flex items-center justify-center gap-0.5"
                  >
                    Invite Friends
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </motion.div>

                {/* Quick Recharge */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between flex-1 shadow-sm transition-colors duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-[#8B9543] dark:text-[#8B9543]" />
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">Quick Recharge</h3>
                  </div>

                  <div className="grid grid-cols-4 gap-1 mb-3">
                    {[100, 500, 1000, 2000].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handlePresetClick(preset)}
                        className="py-1 rounded-lg border border-slate-200/70 dark:border-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-[#8B9543]/5 dark:hover:bg-[#8B9543]/5 hover:border-[#8B9543]/30 dark:hover:border-[#8B9543]/30 transition-all text-center"
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={() => {
                      setInitialAmount("")
                      setAddMoneyModalOpen(true)
                    }}
                    className="w-full h-8.5 bg-[#8B9543] hover:bg-[#6F7734] text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1 shadow-md shadow-[#8B9543]/10"
                  >
                    <Plus className="h-4.5 w-4.5" />
                    Add Money
                  </Button>
                </div>
              </div>
            </div>

            {/* Transaction History Section */}
            <div className="space-y-3 pt-2 sm:pt-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-slate-400 dark:text-slate-500" />
                  <h2 className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                    Transaction History
                  </h2>
                </div>

                {/* iOS-Style Segmented Filter Tabs */}
                <div className="flex p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/80 rounded-xl w-full md:max-w-md shadow-inner transition-colors duration-300">
                  {[
                    { id: TRANSACTION_TYPES.ALL, label: "All" },
                    { id: TRANSACTION_TYPES.ADDITIONS, label: "Additions" },
                    { id: TRANSACTION_TYPES.DEDUCTIONS, label: "Deductions" },
                    { id: TRANSACTION_TYPES.REFUNDS, label: "Refunds" },
                  ].map((filter) => {
                    const isSelected = selectedFilter === filter.id
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setSelectedFilter(filter.id)}
                        className="relative flex-1 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all duration-200 focus:outline-none"
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="activeFilter"
                            className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200/30 dark:border-slate-700/20"
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          />
                        )}
                        <span className={`relative z-10 ${isSelected ? "text-[#8B9543] dark:text-[#8B9543]" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                          {filter.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Transactions List */}
              {filteredTransactions.length > 0 ? (
                <div className="space-y-2.5">
                  <AnimatePresence mode="popLayout">
                    {filteredTransactions.map((transaction, index) => {
                      const isExpanded = expandedTransactionId === transaction.id
                      const isAddition = transaction.type === "addition"
                      const isRefund = transaction.type === "refund"
                      
                      return (
                        <motion.div
                          key={transaction.id}
                          layout="position"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
                          className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                            isExpanded 
                              ? "border-[#8B9543]/40 dark:border-[#8B9543]/40 bg-slate-50/50 dark:bg-slate-900/30 shadow-md"
                              : "border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-900 hover:border-slate-200/80 dark:hover:border-slate-800/80 shadow-sm"
                          }`}
                        >
                          <div 
                            onClick={() => setExpandedTransactionId(isExpanded ? null : transaction.id)}
                            className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isAddition 
                                  ? "bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-100/40 dark:border-green-900/20"
                                  : isRefund
                                    ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100/40 dark:border-blue-900/20"
                                    : "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100/40 dark:border-red-900/20"
                              }`}>
                                {isAddition ? (
                                  <ArrowDownLeft className="h-4 w-4" />
                                ) : isRefund ? (
                                  <RefreshCw className="h-4 w-4" />
                                ) : (
                                  <ArrowUpRight className="h-4 w-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">
                                  {transaction.description}
                                </h4>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  {formatDate(transaction.date || transaction.createdAt)}
                                </p>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <span className={`font-extrabold text-sm ${
                                isAddition 
                                  ? "text-green-600 dark:text-green-400"
                                  : isRefund
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-red-600 dark:text-red-400"
                              }`}>
                                {isAddition || isRefund ? "+" : "-"}
                                {formatAmount(transaction.amount)}
                              </span>
                              <span className="block text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 font-bold uppercase tracking-wider">
                                {transaction.status || "Completed"}
                              </span>
                            </div>
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/20 dark:bg-slate-950/20 p-3 sm:p-3.5"
                              >
                                <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                                  <div>
                                    <span className="text-slate-400 dark:text-slate-500 block font-semibold uppercase tracking-wider text-[9px]">Transaction ID</span>
                                    <span className="font-mono text-slate-700 dark:text-slate-300 select-all block mt-0.5">{transaction.id}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 dark:text-slate-500 block font-semibold uppercase tracking-wider text-[9px]">Status</span>
                                    <span className={`font-bold flex items-center gap-1.5 mt-1 ${
                                      transaction.status === "Failed" 
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-green-600 dark:text-green-400"
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        transaction.status === "Failed" ? "bg-red-500" : "bg-green-500"
                                      }`} />
                                      {transaction.status || "Completed"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 dark:text-slate-500 block font-semibold uppercase tracking-wider text-[9px]">Type</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300 capitalize block mt-0.5">{transaction.type}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 dark:text-slate-500 block font-semibold uppercase tracking-wider text-[9px]">Method</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300 block mt-0.5">
                                      {transaction.metadata?.source === "referral_signup"
                                        ? "Referral Reward"
                                        : transaction.metadata?.source || "Razorpay Gateway"}
                                    </span>
                                  </div>
                                  {transaction.metadata?.orderId && (
                                    <div className="col-span-2">
                                      <span className="text-slate-400 dark:text-slate-500 block font-semibold uppercase tracking-wider text-[9px]">Linked Order ID</span>
                                      <span className="font-mono text-slate-700 dark:text-slate-300 block mt-0.5">{transaction.metadata.orderId}</span>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12 sm:py-14 px-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-900 rounded-2xl shadow-sm transition-colors duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center mx-auto mb-3 border border-slate-100/50 dark:border-slate-800">
                    <History className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                  </div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm sm:text-base">No transactions found</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto mt-1.5">
                    Your transactions will appear here when you load your wallet or order meals with {companyName} Money.
                  </p>
                </motion.div>
              )}
            </div>
          </>
        )}
      </div>

      <AddMoneyModal
        open={addMoneyModalOpen}
        onOpenChange={setAddMoneyModalOpen}
        onSuccess={fetchWalletData}
        initialAmount={initialAmount}
      />
    </AnimatedPage>
  )
}

