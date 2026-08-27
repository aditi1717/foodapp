import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, Copy, Gift, Link as LinkIcon, Share2, Sparkles, Ticket } from "lucide-react";
import { toast } from "sonner";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Button } from "@food/components/ui/button";
import { Card, CardContent } from "@food/components/ui/card";
import apiClient, { authAPI } from "@food/api";
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings";
import BRAND_THEME from "@/config/brandTheme";
import { getErrorMessage } from "@/utils/errorUtils";

const normalizeReferralCode = (value) =>
  String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

export default function ReferralLanding() {
  const { code } = useParams();
  const navigate = useNavigate();
  const referralCode = useMemo(() => normalizeReferralCode(code), [code]);
  const [companyName, setCompanyName] = useState(BRAND_THEME.brandName);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    referralRewardUser: 0,
    referralRewardReferredUser: 0,
    referralLimitUser: 0,
    isActive: true,
  });
  const [validation, setValidation] = useState({
    loading: true,
    valid: false,
    message: "",
    referrerName: "",
    referrerReward: 0,
    referredUserReward: 0,
  });

  useEffect(() => {
    const syncBranding = async () => {
      try {
        const cached = getCachedSettings();
        if (cached?.companyName) setCompanyName(cached.companyName);
        const live = await loadBusinessSettings();
        if (live?.companyName) setCompanyName(live.companyName);
      } catch (_) {}
    };
    syncBranding();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPublicSettings = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get("/food/landing/referral-settings");
        const next = res?.data?.data?.referralSettings || {};
        if (!cancelled) {
          setSettings({
            referralRewardUser: Number(next?.referralRewardUser) || 0,
            referralRewardReferredUser: Number(next?.referralRewardReferredUser) || 0,
            referralLimitUser: Number(next?.referralLimitUser) || 0,
            isActive: next?.isActive !== undefined ? Boolean(next.isActive) : true,
          });
        }
      } catch (_) {
        if (!cancelled) {
          setSettings((prev) => ({ ...prev }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPublicSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const validateCode = async () => {
      if (!referralCode) {
        setValidation({
          loading: false,
          valid: false,
          message: "Referral code is missing from this link.",
          referrerName: "",
          referrerReward: 0,
          referredUserReward: 0,
        });
        return;
      }

      try {
        setValidation((prev) => ({ ...prev, loading: true }));
        const res = await authAPI.validateReferralCode(referralCode);
        const next = res?.data?.data || {};
        if (!cancelled) {
          setValidation({
            loading: false,
            valid: Boolean(next?.valid),
            message: next?.valid ? "Referral code is verified and active!" : "Unable to validate referral code.",
            referrerName: String(next?.referrerName || "").trim(),
            referrerReward: Number(next?.referrerReward) || 0,
            referredUserReward: Number(next?.referredUserReward) || 0,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setValidation({
            loading: false,
            valid: false,
            message: getErrorMessage(error, "Invalid referral code"),
            referrerName: "",
            referrerReward: 0,
            referredUserReward: 0,
          });
        }
      }
    };

    validateCode();
    return () => {
      cancelled = true;
    };
  }, [referralCode]);

  const loginUrl = referralCode ? `/user/auth/login?ref=${encodeURIComponent(referralCode)}` : "/user/auth/login";
  const displayReferredReward = validation.referredUserReward || settings.referralRewardReferredUser;
  const displayReferrerReward = validation.referrerReward || settings.referralRewardUser;

  const copyCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      toast.success("Referral code copied to clipboard!");
    } catch (_) {
      toast.error("Unable to copy referral code");
    }
  };

  const copyLink = async () => {
    if (!referralCode) return;
    const shareUrl = `${window.location.origin}/food/refer/${encodeURIComponent(referralCode)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Referral link copied to clipboard!");
    } catch (_) {
      toast.error("Unable to copy referral link");
    }
  };

  const shareInvite = async () => {
    if (!referralCode) return;
    const shareUrl = `${window.location.origin}/food/refer/${encodeURIComponent(referralCode)}`;
    const text = `Use my referral code ${referralCode} and join ${companyName}!`;
    const sharePayload = `${text} ${shareUrl}`;
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: `${companyName} Referral`, text, url: shareUrl });
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Referral link copied to clipboard");
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(sharePayload)}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      try {
        window.open(`https://wa.me/?text=${encodeURIComponent(sharePayload)}`, "_blank", "noopener,noreferrer");
      } catch (_) {
        toast.error("Unable to share invite");
      }
    }
  };

  return (
    <AnimatedPage className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#8B9543]/15 dark:bg-[#8B9543]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[460px] relative z-10 my-auto space-y-4">
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between">
          <Link to="/food" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-white/80 dark:bg-[#1a1a1a]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6F7734] dark:text-[#8B9543] bg-[#E7EBCD] dark:bg-[#8B9543]/20 px-3 py-1 rounded-full">
            <Sparkles className="h-3 w-3" />
            Special Invite
          </span>
        </div>

        {/* Main Card Container */}
        <Card className="overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#1a1a1a] shadow-2xl transition-all">
          <CardContent className="p-0">
            {/* Header Hero Banner */}
            <div 
              className="p-6 text-white relative overflow-hidden"
              style={{ background: BRAND_THEME.gradients?.primary || "linear-gradient(135deg, #8B9543 0%, #6F7734 100%)" }}
            >
              {/* Decorative Circle overlay */}
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex items-start justify-between gap-3 relative z-10">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">Referral Code</p>
                  <p className="mt-1.5 font-mono text-3xl font-black tracking-[0.2em] drop-shadow-sm">
                    {referralCode || "------"}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/20 backdrop-blur-md p-3 shadow-inner">
                  <Ticket className="h-6 w-6 text-amber-200" />
                </div>
              </div>

              {validation.valid && validation.referrerName && (
                <div className="mt-3 inline-flex items-center gap-1.5 bg-black/20 backdrop-blur-sm text-white/90 text-xs px-3 py-1 rounded-lg">
                  <Sparkles className="h-3 w-3 text-amber-300" />
                  <span>Invited by <strong>{validation.referrerName}</strong></span>
                </div>
              )}
            </div>

            {/* Card Content Body */}
            <div className="p-6 space-y-5">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Join {companyName}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Sign up with this referral code to claim your bonus and enjoy fresh food delivered fast.
                </p>
              </div>

              {/* Rewards Summary Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    <Gift className="h-3.5 w-3.5" />
                    You Get
                  </div>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                    ₹{displayReferredReward}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Welcome bonus</p>
                </div>

                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    <Share2 className="h-3.5 w-3.5" />
                    Friend Gets
                  </div>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                    ₹{displayReferrerReward}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Referral reward</p>
                </div>
              </div>

              {/* Validation Status Pill */}
              <div
                className={`rounded-xl border p-3.5 text-xs transition-all ${
                  validation.valid
                    ? "border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {validation.valid ? (
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  )}
                  <div className="space-y-0.5">
                    <p className="font-semibold">
                      {validation.loading ? "Checking referral code..." : validation.message}
                    </p>
                    {!validation.loading && !validation.valid && settings.isActive ? (
                      <p className="text-[11px] opacity-90">
                        You can still sign up, but rewards apply when code is verified.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Main Action Call To Action */}
              <Button
                type="button"
                onClick={() => navigate(loginUrl)}
                className="w-full h-12 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: BRAND_THEME.gradients?.primary || "linear-gradient(135deg, #8B9543 0%, #6F7734 100%)" }}
              >
                <span>Continue to Sign Up</span>
                <ArrowRight className="h-4 w-4" />
              </Button>

              {/* Secondary Actions (Copy Code / Copy Link / Share) */}
              <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyCode}
                  disabled={!referralCode}
                  className="h-10 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy Code
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyLink}
                  disabled={!referralCode}
                  className="h-10 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                  Copy Link
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
