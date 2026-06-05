import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgePercent,
  CheckCircle2,
  ChevronRight,
  Crown,
  Lock,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Button } from "@food/components/ui/button";
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders";
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation";
import { restaurantAPI } from "@/services/api";
import { initRazorpayPayment } from "@food/utils/razorpay";
import { getCompanyNameAsync } from "@food/utils/businessSettings";

const featureIconMap = {
  ShieldCheck,
  BadgePercent,
  Sparkles,
  Star,
  Truck,
};

function FeatureIcon({ icon, className = "w-4 h-4 text-emerald-500" }) {
  const Icon = featureIconMap[icon] || ShieldCheck;
  return <Icon className={className} />;
}

const getFallbackFeatures = (plan) => {
  if (Array.isArray(plan?.features) && plan.features.length > 0) {
    return plan.features;
  }

  if (plan?.restoBenefitType === "commission_reduction") {
    return [
      { icon: "BadgePercent", text: `Reduced commission rate: ${plan.commissionRate}%` },
      { icon: "ShieldCheck", text: "Full restaurant dashboard access" },
      { icon: "Sparkles", text: "Lower per-order charges during plan validity" },
    ];
  }

  return [
    { icon: "Star", text: "Priority listing boost in customer discoverability" },
    { icon: "ShieldCheck", text: "Full restaurant dashboard access" },
    { icon: "Truck", text: "Business visibility benefit for active duration" },
  ];
};

export default function RestaurantSubscriptions() {
  const navigate = useNavigate();
  const goBack = useRestaurantBackNavigation();
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingId, setIsSubmittingId] = useState("");

  const resolveActiveSubscription = async () => {
    let activeSubscription = null;

    try {
      const currentResponse = await restaurantAPI.getCurrentSubscription();
      activeSubscription = currentResponse?.data?.data?.subscription || null;
      if (activeSubscription?.active) {
        return activeSubscription;
      }
    } catch (subscriptionError) {
      console.warn("Error loading current restaurant subscription", subscriptionError);
    }

    try {
      const subscriptionsResponse = await restaurantAPI.getSubscriptions();
      const subscriptions = subscriptionsResponse?.data?.data?.subscriptions || [];
      activeSubscription = subscriptions.find((item) => item?.active === true) || null;
    } catch (fallbackError) {
      console.warn("Error loading restaurant subscriptions fallback", fallbackError);
    }

    return activeSubscription;
  };

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);

        const packagesResponse = await restaurantAPI.getSubscriptionPackages();
        const packageList = packagesResponse?.data?.data?.packages || [];
        const current = await resolveActiveSubscription();

        if (!mounted) return;
        setPlans(packageList);
        setCurrentSubscription(current);
      } catch (error) {
        console.error("Error loading restaurant subscription packages", error);
        if (!mounted) return;
        setPlans([]);
        setCurrentSubscription(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const activePlanId = currentSubscription?.packageId ? String(currentSubscription.packageId) : "";
  const hasActiveSubscription = Boolean(currentSubscription?.active);

  const sortedPlans = useMemo(
    () =>
      [...plans].sort((first, second) => Number(first?.priceValue || 0) - Number(second?.priceValue || 0)),
    [plans],
  );

  const handleActivate = async (plan) => {
    if (!plan?.id) return;

    try {
      setIsSubmittingId(String(plan.id));
      const latestActiveSubscription = await resolveActiveSubscription();
      if (latestActiveSubscription?.active) {
        setCurrentSubscription(latestActiveSubscription);
        toast.error("You already have an active restaurant subscription.");
        setIsSubmittingId("");
        return;
      }

      const orderResponse = await restaurantAPI.createSubscriptionRazorpayOrder({
        packageId: plan.id,
      });
      const razorpay = orderResponse?.data?.data?.razorpay;

      if (!razorpay?.orderId || !razorpay?.key) {
        throw new Error("Failed to initialize Razorpay checkout");
      }

      let restaurantInfo = {};
      try {
        const currentResponse = await restaurantAPI.getCurrentRestaurant();
        restaurantInfo = currentResponse?.data?.data?.restaurant || currentResponse?.data?.restaurant || {};
      } catch (profileError) {
        console.warn("Unable to load restaurant profile for Razorpay prefill", profileError);
      }

      const companyName = await getCompanyNameAsync();

      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpay.orderId,
        name: companyName,
        description: `${plan.name} Restaurant Subscription`,
        prefill: {
          name: restaurantInfo?.ownerName || restaurantInfo?.restaurantName || restaurantInfo?.name || "",
          email: restaurantInfo?.ownerEmail || restaurantInfo?.email || "",
          contact: String(restaurantInfo?.ownerPhone || restaurantInfo?.phone || "").replace(/\D/g, "").slice(-10),
        },
        notes: {
          type: "restaurant_subscription_purchase",
          packageId: plan.id,
        },
        handler: async (response) => {
          try {
            const verifyResponse = await restaurantAPI.verifySubscriptionRazorpayPayment({
              packageId: plan.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            const subscription = verifyResponse?.data?.data?.subscription || null;
            setCurrentSubscription(subscription);
            toast.success(`${plan.name} activated successfully`);
          } catch (verifyError) {
            console.error("Error verifying restaurant subscription payment", verifyError);
            toast.error(verifyError?.response?.data?.message || "Payment verification failed");
          } finally {
            setIsSubmittingId("");
          }
        },
        onError: (error) => {
          toast.error(error?.description || error?.message || "Payment failed");
          setIsSubmittingId("");
        },
        onClose: () => {
          setIsSubmittingId("");
        },
      });
    } catch (error) {
      console.error("Error activating restaurant subscription", error);
      if (String(error?.response?.data?.message || "").toLowerCase().includes("already have an active subscription")) {
        const latestActiveSubscription = await resolveActiveSubscription();
        setCurrentSubscription(latestActiveSubscription);
      }
      toast.error(error?.response?.data?.message || "Failed to activate subscription");
      setIsSubmittingId("");
    }
  };

  return (
    <AnimatedPage className="min-h-screen bg-slate-50 pb-24 text-slate-900">
      <div className="mx-auto max-w-md md:max-w-5xl px-4 py-5">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={goBack}
            className="rounded-lg border border-slate-200 p-1.5 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5 text-slate-700" />
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-extrabold">
              <Crown className="h-5 w-5 text-amber-500" />
              <span>Restaurant Subscription Plans</span>
            </h1>
            <p className="text-xs text-slate-500">Choose from admin-created restaurant subscription packages</p>
          </div>
        </div>

        {hasActiveSubscription ? (
          <div className="mb-6 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm">
            <p className="text-sm font-extrabold uppercase tracking-wide">Subscription already active</p>
            <p className="mt-1 text-xs text-slate-600">
              You already have an active subscription. You can choose another plan after your current plan expires.
            </p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
            Loading subscription packages...
          </div>
        ) : sortedPlans.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
            No restaurant subscription packages created by admin yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedPlans.map((plan) => {
              const isCurrentPlan = activePlanId && String(plan.id) === activePlanId;
              const isLocked = hasActiveSubscription && !isCurrentPlan;
              const features = getFallbackFeatures(plan);

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition ${
                    isLocked ? "border-slate-300 grayscale-[0.15]" : "border-slate-200"
                  }`}
                >
                  <div className="relative h-32 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4 text-white">
                    {plan.image ? (
                      <>
                        <img src={plan.image} alt={plan.name} className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-slate-950/55" />
                      </>
                    ) : null}

                    <div className="relative z-10 flex h-full items-start justify-between gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] backdrop-blur">
                          Restaurant Member
                        </span>
                      </div>
                      {isCurrentPlan ? (
                        <span className="rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
                          Active Plan
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="truncate text-xl font-extrabold text-slate-900">{plan.name}</h2>
                      <p className="shrink-0 text-sm font-medium text-slate-500">{plan.duration}</p>
                    </div>

                    <div className="flex items-end gap-2">
                      {plan.markedPrice && plan.markedPrice !== plan.price ? (
                        <p className="text-sm font-semibold text-slate-400 line-through">{plan.markedPrice}</p>
                      ) : null}
                      <p className="text-2xl font-extrabold text-slate-900">{plan.price}</p>
                    </div>

                    {plan.description ? (
                      <p className="line-clamp-2 text-sm leading-relaxed text-slate-500">{plan.description}</p>
                    ) : null}

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Benefit Type</span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-slate-700">
                          {plan.restoBenefitType === "commission_reduction" ? "Commission" : "Priority Listing"}
                        </span>
                      </div>
                      {plan.restoBenefitType === "commission_reduction" ? (
                        <p className="text-sm font-bold text-slate-900">
                          Reduced Commission: {plan.commissionRate}%
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-slate-900">Priority SEO visibility boost</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {features.map((feature, index) => (
                        <div key={`${plan.id}-feature-${index}`} className="flex items-start gap-2 text-sm text-slate-600">
                          <FeatureIcon icon={feature.icon} className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span>{feature.text}</span>
                        </div>
                      ))}
                    </div>

                    {isLocked ? (
                      <div className="rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-center">
                        <p className="text-sm font-bold text-slate-900">Already have subscription</p>
                        <p className="mt-1 text-xs text-slate-600">
                          This plan will be available after current subscription expiry.
                        </p>
                      </div>
                    ) : null}

                    <Button
                      onClick={() => handleActivate(plan)}
                      disabled={Boolean(isSubmittingId) || isLocked || isCurrentPlan}
                      className={`h-12 w-full rounded-2xl text-sm font-extrabold ${
                        isCurrentPlan
                          ? "bg-emerald-400 text-white hover:bg-emerald-400"
                          : isLocked
                            ? "bg-slate-300 text-slate-600 hover:bg-slate-300"
                            : "bg-brand-600 text-white hover:bg-brand-700"
                      }`}
                    >
                      {isCurrentPlan
                        ? "Currently Active"
                        : isSubmittingId === String(plan.id)
                          ? "Activating..."
                          : isLocked
                            ? "Available After Expiry"
                            : "Choose This Plan"}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => navigate("/food/restaurant/my-subscription")}
          className="mt-6 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm"
        >
          <div>
            <p className="text-sm font-bold text-slate-900">View My Subscription</p>
            <p className="text-xs text-slate-500">See active plan and subscription history</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </button>
      </div>

      <BottomNavOrders />
    </AnimatedPage>
  );
}
