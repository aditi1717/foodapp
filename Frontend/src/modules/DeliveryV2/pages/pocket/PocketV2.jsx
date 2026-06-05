import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ShieldCheck,
  Loader2,
  LayoutGrid,
  X,
  Building,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import BRAND_THEME from '@/config/brandTheme';
import { formatCurrency } from '@food/utils/currency';

const toNumber = (...values) => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
};

export const PocketV2 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [walletState, setWalletState] = useState({
    weeklyEarnings: 0,
    weeklyOrders: 0,
    bankDetailsFilled: false,
    totalEarning: 0,
    adminPaid: 0,
    adminDue: 0,
    cashInHand: 0,
    cashSubmittedToAdmin: 0,
    pocketBalance: 0,
    pendingWithdrawals: 0,
    deliveryWithdrawalLimit: 100,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileRes, earningsRes, walletRes] = await Promise.all([
        deliveryAPI.getProfile(),
        deliveryAPI.getEarnings({ period: 'week' }),
        deliveryAPI.getWallet(),
      ]);

      const profile = profileRes?.data?.data?.profile || {};
      const summary = earningsRes?.data?.data?.summary || {};
      const wallet = walletRes?.data?.data?.wallet || {};

      const bankDetails = profile?.documents?.bankDetails;
      const isFilled = !!bankDetails?.accountNumber;

      const totalEarned = toNumber(wallet.totalEarned, wallet.totalEarning, wallet.totalBalance);
      const totalBonus = toNumber(wallet.totalBonus);
      const totalWithdrawn = toNumber(wallet.totalWithdrawn, wallet.paidAmount);
      const grossBalance = toNumber(wallet.totalBalance, totalEarned + totalBonus);
      const cashInHand = toNumber(wallet.cashInHand);
      const cashSubmittedToAdmin = toNumber(
        wallet.cashSubmittedToAdmin,
        wallet.totalSubmittedToAdmin,
        0,
      );

      setWalletState({
        weeklyEarnings: Number(summary.totalEarnings) || 0,
        weeklyOrders: Number(summary.totalOrders) || 0,
        bankDetailsFilled: isFilled,
        totalEarning: totalEarned,
        adminPaid: totalWithdrawn,
        adminDue: Math.max(0, grossBalance - totalWithdrawn),
        cashInHand,
        cashSubmittedToAdmin,
        pocketBalance: toNumber(wallet.pocketBalance),
        pendingWithdrawals: toNumber(wallet.pendingWithdrawals),
        deliveryWithdrawalLimit: toNumber(wallet.deliveryWithdrawalLimit, 100),
      });
    } catch (err) {
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (amt < walletState.deliveryWithdrawalLimit) {
      toast.error(`Minimum withdrawal amount is ${formatCurrency(walletState.deliveryWithdrawalLimit)}`);
      return;
    }
    if (amt > walletState.pocketBalance) {
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
        fetchData();
      } else {
        toast.error(res.data?.message || "Withdrawal failed");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "An error occurred during withdrawal");
    } finally {
      setSubmitting(false);
    }
  };

  const InfoCard = ({ label, value, className = '' }) => (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-poppins gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" style={{ color: BRAND_THEME.colors.brand.primary }} />
        <p className="text-xs font-medium text-gray-500">Loading Pocket...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-poppins pb-24 relative">
      {!walletState.bankDetailsFilled && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-red-800">Add Bank Details</p>
              <p className="text-[10px] text-red-600 font-medium">Required for payouts</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/food/delivery/profile/details')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-red-600 border border-red-200 shadow-sm active:bg-gray-50"
          >
            Submit
          </button>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Unified Wallet Balance Card with Integrated Actions */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl p-4 shadow-sm text-white relative overflow-hidden"
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
                    {formatCurrency(walletState.pocketBalance)}
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
                  {walletState.pendingWithdrawals > 0 && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
                  {formatCurrency(walletState.pendingWithdrawals)}
                </span>
              </div>
              <div className="w-px h-5 bg-white/15" />
              <div className="flex-1">
                <span className="text-[8px] uppercase tracking-wider font-bold text-white/60 block mb-0.5">
                  Total Wallet Value
                </span>
                <span className="text-xs font-bold">
                  {formatCurrency(walletState.pocketBalance + walletState.pendingWithdrawals)}
                </span>
              </div>
            </div>

            {/* Bottom row: Inline actions inside card */}
            <div className="pt-2.5 border-t border-white/10">
              <button
                className="w-full bg-white text-gray-900 hover:bg-gray-100 active:bg-gray-200 font-bold py-2 rounded-lg text-xs shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-1"
                onClick={() => {
                  if (!walletState.bankDetailsFilled) {
                    toast.error("Please add bank details first!");
                    return;
                  }
                  setShowWithdrawModal(true);
                }}
              >
                Request Payout (Withdraw)
              </button>
            </div>
          </div>
        </motion.div>

        {/* Cash Handling Card */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 mb-2">Cash Handling</p>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Cash In Hand" value={formatCurrency(walletState.cashInHand)} />
            <InfoCard label="Cash Submitted To Admin" value={formatCurrency(walletState.cashSubmittedToAdmin)} />
          </div>
        </div>

        {/* delivered orders payout deep-link */}
        <div
          onClick={() => navigate('/food/delivery/pocket/details')}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 active:bg-gray-50 cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 border border-brand-100">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Delivered Orders Payout</p>
              <p className="text-[11px] text-gray-500 font-medium">View earnings and admin payment status</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>

        {/* payout history deep-link */}
        <div
          onClick={() => navigate('/food/delivery/pocket/payout')}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 active:bg-gray-50 cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 border border-brand-100">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Withdrawal History</p>
              <p className="text-[11px] text-gray-500 font-medium">View past withdrawal requests and statuses</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
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

              <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 block mb-0.5">
                    Available to Withdraw
                  </label>
                  <p className="text-xl font-extrabold text-gray-900">
                    {formatCurrency(walletState.pocketBalance)}
                  </p>
                  {walletState.pendingWithdrawals > 0 && (
                    <p className="text-[9px] text-yellow-600 font-bold mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                      * {formatCurrency(walletState.pendingWithdrawals)} is locked in review
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
                    min={walletState.deliveryWithdrawalLimit}
                    step="any"
                    placeholder={`Min: ₹${walletState.deliveryWithdrawalLimit}`}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    required
                    className="w-full text-sm py-1.5 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                    className="flex-1 text-white font-bold py-2 rounded-lg text-xs cursor-pointer"
                    style={{ backgroundColor: BRAND_THEME.colors.brand.primary }}
                    disabled={submitting || !withdrawAmount || parseFloat(withdrawAmount) < walletState.deliveryWithdrawalLimit || parseFloat(withdrawAmount) > walletState.pocketBalance}
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
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

export default PocketV2;
