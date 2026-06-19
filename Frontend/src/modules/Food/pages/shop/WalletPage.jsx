import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import BottomNavOrders from "@food/components/shop/BottomNavOrders"
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft,
  X,
  CreditCard,
  Building
} from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { restaurantAPI } from "@food/api"
import { formatCurrency } from "@food/utils/currency"
import { initRazorpayPayment } from "@food/utils/razorpay"
import BRAND_THEME from "@/config/brandTheme"

export default function WalletPage() {
  const navigate = useNavigate()
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositAmount, setDepositAmount] = useState("")
  
  // Real data state
  const [walletData, setWalletData] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Fetch real data
  const fetchData = async () => {
    try {
      setLoading(true)
      const walletRes = await restaurantAPI.getWallet()
      if (walletRes.data?.success) {
        const wData = walletRes.data.data
        setWalletData(wData)
        setTransactions(wData.transactions || [])
      }
    } catch (error) {
      console.error("Error fetching wallet data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDeposit = async (e) => {
    e.preventDefault()
    const amt = parseFloat(depositAmount)
    if (!amt || amt <= 0) {
      alert("Please enter a valid amount")
      return
    }
    setSubmitting(true)
    try {
      // 1. Create Order on Backend
      const orderResponse = await restaurantAPI.createWalletTopupOrder(amt)
      const { razorpay } = orderResponse.data.data

      if (!razorpay || !razorpay.orderId || !razorpay.key) {
        throw new Error("Failed to initialize payment order")
      }

      // Close input modal
      setShowDepositModal(false)

      // Fetch restaurant profile details for prefilling checkout
      let restoInfo = {}
      try {
        const profileRes = await restaurantAPI.getCurrentRestaurant()
        restoInfo = profileRes?.data?.data?.restaurant || profileRes?.data?.restaurant || {}
      } catch (profileErr) {
        console.warn("Could not load restaurant profile for prefill", profileErr)
      }

      const restoName = restoInfo.name || restoInfo.restaurantName || "Restaurant Owner"
      const restoEmail = restoInfo.ownerEmail || restoInfo.email || ""
      const restoPhone = restoInfo.ownerPhone || restoInfo.phone || ""

      // 2. Load Checkout modal
      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpay.orderId,
        name: restoName,
        description: `Wallet Deposit - ₹${amt.toFixed(2)}`,
        prefill: {
          name: restoName,
          email: restoEmail,
          contact: restoPhone,
        },
        notes: {
          type: "restaurant_wallet_topup",
          amount: amt.toString(),
        },
        handler: async (response) => {
          try {
            setLoading(true)
            await restaurantAPI.verifyWalletTopupPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              amount: amt,
            })
            alert(`₹${amt} deposited to wallet successfully!`)
            setDepositAmount("")
            await fetchData()
          } catch (verifyErr) {
            console.error(verifyErr)
            alert(verifyErr.response?.data?.message || "Payment verification failed. Please contact support.")
          } finally {
            setLoading(false)
          }
        },
        onError: (err) => {
          console.error(err)
          alert(err.description || "Payment gateway failed. Please try again.")
        }
      })
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.message || err.message || "An error occurred during deposit initialization")
    } finally {
      setSubmitting(false)
    }
  }

  const handleWithdraw = async (e) => {
    e.preventDefault()
    const amt = parseFloat(withdrawAmount)
    if (!amt || amt <= 0) {
      alert("Please enter a valid amount")
      return
    }
    if (amt > (walletData?.availableBalance || 0)) {
      alert("Insufficient available balance in wallet")
      return
    }
    setSubmitting(true)
    try {
      const res = await restaurantAPI.withdrawFromWallet(amt)
      if (res.data?.success) {
        setShowWithdrawModal(false)
        setWithdrawAmount("")
        alert("Withdrawal request submitted successfully! Funds are locked in review pending admin approval.")
        await fetchData()
      } else {
        alert(res.data?.message || "Withdrawal failed")
      }
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.message || "An error occurred during withdrawal")
    } finally {
      setSubmitting(false)
    }
  }

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

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-gray-50"
      style={{ backgroundColor: BRAND_THEME.colors.brand.primarySoft }}
    >
      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-4 pb-20 overflow-x-visible">
        {/* Title */}
        <h1 className="text-lg font-bold text-gray-900 mb-3 text-center sm:text-left tracking-tight">
          Wallet Dashboard
        </h1>

        {/* Unified Wallet Balance Card with Integrated Actions */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl p-4 mb-4 shadow-sm text-white relative overflow-hidden"
          style={{ background: BRAND_THEME.gradients.primary }}
        >
          {/* Subtle background decoration */}
          <div className="absolute right-[-10%] top-[-25%] w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-3.5">
            {/* Top row: Balance information */}
            <div className="flex items-center justify-between gap-2">
              {/* Available balance */}
              <div>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-white/70 block mb-0.5">
                  Available to Withdraw
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black tracking-tight">
                    {formatCurrency(walletData?.availableBalance ?? 0)}
                  </span>
                  <span className="text-[8px] text-white/90 font-bold bg-white/15 px-1 py-0.5 rounded">unlocked</span>
                </div>
              </div>
            </div>

            {/* Middle row: Other stats (Locked & Total Value) */}
            <div className="flex items-center gap-4 pt-2.5 border-t border-white/10 text-white/90">
              <div className="flex-1">
                <span className="text-[8px] uppercase tracking-wider font-bold text-white/60 block mb-0.5">
                  Locked (In Review)
                </span>
                <span className="text-xs font-bold flex items-center gap-1">
                  {walletData?.lockedAmount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
                  {formatCurrency(walletData?.lockedAmount ?? 0)}
                </span>
              </div>
              <div className="w-px h-5 bg-white/15" />
              <div className="flex-1">
                <span className="text-[8px] uppercase tracking-wider font-bold text-white/60 block mb-0.5">
                  Total Wallet Value
                </span>
                <span className="text-xs font-bold">
                  {formatCurrency(walletData?.balance ?? 0)}
                </span>
              </div>
            </div>

            {/* Bottom row: Inline actions inside card */}
            <div className="flex gap-2 pt-2.5 border-t border-white/10">
              <button
                className="flex-1 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white font-bold py-2 rounded-lg text-xs shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 border border-white/10"
                onClick={() => setShowWithdrawModal(true)}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-white" />
                Withdraw
              </button>
              <button
                className="flex-1 bg-white text-gray-900 hover:bg-gray-100 active:bg-gray-200 font-bold py-2 rounded-lg text-xs shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-1"
                onClick={() => setShowDepositModal(true)}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-gray-900" />
                Deposit
              </button>
            </div>
          </div>
        </motion.div>

        {/* Transaction History List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
        >
          <h2 className="text-sm font-bold text-gray-900 mb-3">Recent Transactions</h2>

          {loading ? (
            <div className="py-6 text-center text-xs text-gray-400">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
              <div className="bg-gray-50 p-2.5 rounded-full">
                <CreditCard className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-xs font-semibold text-gray-500">No transactions recorded yet.</p>
              <p className="text-[10px] text-gray-400">Deposit or withdraw above.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {transactions.map((transaction, index) => {
                const isDebit = transaction.type === 'debit' || String(transaction.type).toLowerCase() === 'deduction'
                return (
                  <motion.div
                    key={transaction._id || index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-center justify-between py-2 last:pb-0 first:pt-0"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-full ${isDebit ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                        {isDebit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <p className="text-gray-900 font-bold text-xs">
                          {transaction.description || (isDebit ? 'Withdrawal' : 'Deposit')}
                        </p>
                        <p className="text-gray-400 text-[10px]">
                          {transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className={`font-extrabold text-xs ${isDebit ? 'text-red-500' : 'text-green-500'}`}>
                        {isDebit ? '-' : '+'} {formatCurrency(transaction.amount)}
                      </p>
                      <span className={`inline-block text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full ${
                        String(transaction.status).toLowerCase() === 'completed' || String(transaction.status).toLowerCase() === 'approved'
                          ? 'bg-green-50 text-green-600'
                          : String(transaction.status).toLowerCase() === 'rejected'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {transaction.status}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4"
            style={{ backgroundColor: `${BRAND_THEME.colors.brand.primaryDark}66` }}
            onClick={() => setShowWithdrawModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-xl shadow-xl max-w-xs w-full p-4 md:p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-gray-900">
                  Withdraw to Bank
                </h2>
                <button onClick={() => setShowWithdrawModal(false)} className="p-1 hover:bg-gray-100 rounded-full">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 block mb-0.5">
                    Available to Withdraw
                  </label>
                  <p className="text-xl font-extrabold text-gray-900">
                    {formatCurrency(walletData?.availableBalance || 0)}
                  </p>
                  {walletData?.lockedAmount > 0 && (
                    <p className="text-[9px] text-yellow-600 font-bold mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                      * {formatCurrency(walletData.lockedAmount)} is locked in review
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="withdrawAmount" className="text-xs font-semibold text-gray-700 block mb-1">
                    Withdrawal Amount (₹)
                  </label>
                  <Input
                    id="withdrawAmount"
                    type="number"
                    min="1"
                    step="any"
                    placeholder="Enter amount to transfer"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    required
                    className="w-full text-sm py-1.5 px-3"
                  />
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 flex gap-2 items-center">
                  <div className="p-1.5 bg-white rounded shadow-sm">
                    <Building className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-800">Connected Bank Account</p>
                    <p className="text-[9px] text-gray-500">Subject to admin approval</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 font-bold py-2 rounded-lg text-xs cursor-pointer"
                    onClick={() => setShowWithdrawModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 text-white font-bold py-2 rounded-lg text-xs cursor-pointer"
                    style={{ backgroundColor: BRAND_THEME.colors.brand.primary }}
                    disabled={submitting || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > (walletData?.availableBalance || 0)}
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deposit Modal */}
      <AnimatePresence>
        {showDepositModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4"
            style={{ backgroundColor: `${BRAND_THEME.colors.brand.primaryDark}66` }}
            onClick={() => setShowDepositModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-xl shadow-xl max-w-xs w-full p-4 md:p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-gray-900">
                  Add Money (Razorpay)
                </h2>
                <button onClick={() => setShowDepositModal(false)} className="p-1 hover:bg-gray-100 rounded-full">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleDeposit} className="space-y-4">
                <div>
                  <label htmlFor="depositAmount" className="text-xs font-semibold text-gray-700 block mb-1">
                    Amount to Add (₹)
                  </label>
                  <Input
                    id="depositAmount"
                    type="number"
                    min="1"
                    step="any"
                    placeholder="Enter amount to add"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    required
                    className="w-full text-sm py-1.5 px-3"
                  />
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 flex gap-2 items-center">
                  <div className="p-1.5 bg-white rounded shadow-sm">
                    <CreditCard className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-800">Razorpay Account</p>
                    <p className="text-[9px] text-gray-500">Secure payment gateway load</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 font-bold py-2 rounded-lg text-xs cursor-pointer"
                    onClick={() => setShowDepositModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 text-white font-bold py-2 rounded-lg text-xs cursor-pointer"
                    style={{ backgroundColor: BRAND_THEME.colors.brand.primary }}
                    disabled={submitting || !depositAmount || parseFloat(depositAmount) <= 0}
                  >
                    {submitting ? "Processing..." : "Add Money"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar - Mobile Only */}
      <BottomNavOrders />
    </div>
  )
}
