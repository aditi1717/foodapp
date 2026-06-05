import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, X, CreditCard, Building, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import BRAND_THEME from '@/config/brandTheme';
import { formatCurrency } from '@food/utils/currency';
import { initRazorpayPayment } from '@food/utils/razorpay';
import useDeliveryBackNavigation from '../../hooks/useDeliveryBackNavigation';

export const ProfileWalletV2 = () => {
  const navigate = useNavigate();
  const goBack = useDeliveryBackNavigation();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchWalletAndProfile = async () => {
    try {
      const [profileRes, walletRes] = await Promise.all([
        deliveryAPI.getProfile().catch(() => null),
        deliveryAPI.getWallet().catch(() => null)
      ]);

      if (profileRes?.data?.success && profileRes?.data?.data?.profile) {
        setProfile(profileRes.data.data.profile);
      }
      if (walletRes?.data?.success && walletRes?.data?.data?.wallet) {
        setWallet(walletRes.data.data.wallet);
      }
    } catch (e) {
      toast.error("Failed to load wallet details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletAndProfile();
  }, []);

  const handleDeposit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setSubmitting(true);
    try {
      const orderResponse = await deliveryAPI.createDepositOrder(amt);
      const { razorpay } = orderResponse.data.data;

      if (!razorpay || !razorpay.orderId || !razorpay.key) {
        throw new Error("Failed to initialize payment order");
      }

      setShowDepositModal(false);

      const devName = profile?.name || "Delivery Partner";
      const devEmail = profile?.email || "";
      const devPhone = profile?.phone || "";

      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpay.orderId,
        name: devName,
        description: `Cash Deposit - ₹${amt.toFixed(2)}`,
        prefill: {
          name: devName,
          email: devEmail,
          contact: devPhone,
        },
        notes: {
          type: "delivery_cash_deposit",
          amount: amt.toString(),
        },
        handler: async (response) => {
          try {
            setLoading(true);
            await deliveryAPI.verifyDepositPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: amt,
            });
            toast.success(`₹${amt} deposited successfully!`);
            setDepositAmount("");
            await fetchWalletAndProfile();
          } catch (verifyErr) {
            console.error(verifyErr);
            toast.error(verifyErr.response?.data?.message || "Payment verification failed.");
          } finally {
            setLoading(false);
          }
        },
        onError: (err) => {
          console.error(err);
          toast.error(err.description || "Payment failed. Please try again.");
        }
      });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    const pocketBalance = Number(wallet?.pocketBalance) || 0;
    const limit = Number(wallet?.deliveryWithdrawalLimit) || 100;

    if (!amt || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (amt < limit) {
      toast.error(`Minimum withdrawal amount is ${formatCurrency(limit)}`);
      return;
    }
    if (amt > pocketBalance) {
      toast.error("Insufficient available balance");
      return;
    }

    setSubmitting(true);
    try {
      const res = await deliveryAPI.createWithdrawalRequest({ amount: amt });
      if (res.data?.success) {
        setShowWithdrawModal(false);
        setWithdrawAmount("");
        toast.success("Withdrawal request submitted successfully! Pending admin approval.");
        await fetchWalletAndProfile();
      } else {
        toast.error(res.data?.message || "Withdrawal failed");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 font-poppins">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND_THEME.colors.brand.primary }} />
      </div>
    );
  }

  const isBankConfigured = !!profile?.documents?.bankDetails?.accountNumber;
  const transactions = (wallet?.transactions || []).filter(
    (t) => t.type === 'withdrawal' || t.type === 'deposit'
  );

  return (
    <div className="min-h-screen bg-gray-50 font-poppins pb-10">
      {/* Header bar */}
      <div className="bg-white px-4 py-5 flex items-center gap-4 fixed top-0 left-0 right-0 z-50 shadow-sm max-w-md mx-auto">
        <button onClick={goBack} className="p-1 hover:bg-gray-50 rounded-lg cursor-pointer">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-black">Wallet Options</h1>
      </div>

      <div className="pt-20 max-w-md mx-auto px-4 space-y-4">
        {/* Balance Card */}
        {wallet && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 shadow-sm text-white relative overflow-hidden"
            style={{ background: BRAND_THEME.gradients.primary }}
          >
            <div className="absolute right-[-10%] top-[-25%] w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col gap-3.5">
              <div>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-white/70 block mb-0.5">
                  Available to Withdraw
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black tracking-tight">
                    {formatCurrency(wallet.pocketBalance)}
                  </span>
                  <span className="text-[8px] text-white/90 font-bold bg-white/15 px-1 py-0.5 rounded">unlocked</span>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2.5 border-t border-white/10 text-white/90">
                <div className="flex-1">
                  <span className="text-[8px] uppercase tracking-wider font-bold text-white/60 block mb-0.5">
                    Locked (In Review)
                  </span>
                  <span className="text-xs font-bold flex items-center gap-1">
                    {wallet.pendingWithdrawals > 0 && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
                    {formatCurrency(wallet.pendingWithdrawals)}
                  </span>
                </div>
                <div className="w-px h-5 bg-white/15" />
                <div className="flex-1">
                  <span className="text-[8px] uppercase tracking-wider font-bold text-white/60 block mb-0.5">
                    Total Wallet Value
                  </span>
                  <span className="text-xs font-bold">
                    {formatCurrency(wallet.pocketBalance + wallet.pendingWithdrawals)}
                  </span>
                </div>
              </div>

              {/* Bottom row: Inline actions inside card */}
              <div className="flex gap-2 pt-2.5 border-t border-white/10">
                <button
                  className="flex-1 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white font-bold py-2 rounded-lg text-xs shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 border border-white/10"
                  onClick={() => {
                    if (!isBankConfigured) {
                      toast.error("Please configure bank details first!");
                      navigate("/food/delivery/profile/details");
                      return;
                    }
                    setShowWithdrawModal(true);
                  }}
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
        )}


        {/* Transaction History List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
        >
          <h2 className="text-sm font-bold text-gray-900 mb-3">Recent Transactions</h2>

          {transactions.length === 0 ? (
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
                const isDebit = transaction.type === 'withdrawal';
                return (
                  <motion.div
                    key={transaction.id || index}
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
                        <p className="text-gray-900 font-bold text-xs leading-snug">
                          {transaction.description || (isDebit ? 'Withdrawal' : 'Deposit')}
                        </p>
                        <p className="text-gray-400 text-[10px]">
                          {transaction.date ? new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
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
              className="bg-white rounded-xl shadow-xl max-w-xs w-full p-4 md:p-5 mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-gray-900">
                  Withdraw to Bank
                </h2>
                <button onClick={() => setShowWithdrawModal(false)} className="p-1 hover:bg-gray-100 rounded-full cursor-pointer">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 block mb-0.5">
                    Available to Withdraw
                  </label>
                  <p className="text-xl font-extrabold text-gray-900">
                    {formatCurrency(wallet?.pocketBalance || 0)}
                  </p>
                  {wallet?.pendingWithdrawals > 0 && (
                    <p className="text-[9px] text-yellow-600 font-bold mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                      * {formatCurrency(wallet.pendingWithdrawals)} is locked in review
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="withdrawAmount" className="text-xs font-semibold text-gray-700 block mb-1">
                    Withdrawal Amount (₹)
                  </label>
                  <input
                    id="withdrawAmount"
                    type="number"
                    min={Number(wallet?.deliveryWithdrawalLimit) || 100}
                    step="any"
                    placeholder={`Min: ₹${Number(wallet?.deliveryWithdrawalLimit) || 100}`}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    required
                    className="w-full text-sm py-2 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 font-bold"
                  />
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 flex gap-2 items-center">
                  <div className="p-1.5 bg-white rounded shadow-sm">
                    <Building className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-800">Connected Bank Account</p>
                    <p className="text-[9px] text-gray-500 truncate">
                      Acc: **** {profile?.documents?.bankDetails?.accountNumber?.slice(-4) || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    className="flex-1 bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 font-bold py-2 rounded-lg text-xs cursor-pointer"
                    onClick={() => setShowWithdrawModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 text-white font-bold py-2 rounded-lg text-xs cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: BRAND_THEME.colors.brand.primary }}
                    disabled={submitting || !withdrawAmount || parseFloat(withdrawAmount) < (Number(wallet?.deliveryWithdrawalLimit) || 100) || parseFloat(withdrawAmount) > (wallet?.pocketBalance || 0)}
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
                  </button>
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
              className="bg-white rounded-xl shadow-xl max-w-xs w-full p-4 md:p-5 mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-gray-900">
                  Add Money (Razorpay)
                </h2>
                <button onClick={() => setShowDepositModal(false)} className="p-1 hover:bg-gray-100 rounded-full cursor-pointer">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleDeposit} className="space-y-4">
                <div>
                  <label htmlFor="depositAmount" className="text-xs font-semibold text-gray-700 block mb-1">
                    Amount to Add (₹)
                  </label>
                  <input
                    id="depositAmount"
                    type="number"
                    min="1"
                    step="any"
                    placeholder="Enter amount to add"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    required
                    className="w-full text-sm py-2 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 font-bold"
                  />
                  {wallet && (
                    <p className="text-[9px] text-gray-400 font-bold mt-1">
                      Current cash in hand: {formatCurrency(wallet.cashInHand)}
                    </p>
                  )}
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 flex gap-2 items-center">
                  <div className="p-1.5 bg-white rounded shadow-sm">
                    <CreditCard className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-800">Razorpay Account</p>
                    <p className="text-[9px] text-gray-500">Secure payment gateway</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    className="flex-1 bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 font-bold py-2 rounded-lg text-xs cursor-pointer"
                    onClick={() => setShowDepositModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 text-white font-bold py-2 rounded-lg text-xs cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: BRAND_THEME.colors.brand.primary }}
                    disabled={submitting || !depositAmount || parseFloat(depositAmount) <= 0}
                  >
                    {submitting ? "Processing..." : "Add Money"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileWalletV2;
