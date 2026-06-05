import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgePercent,
  Calendar,
  CheckCircle2,
  Crown,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders";
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation";
import { Button } from "@food/components/ui/button";
import { restaurantAPI } from "@/services/api";

const featureIconMap = {
  ShieldCheck,
  BadgePercent,
  Sparkles,
  Star,
  Truck,
};

function FeatureIcon({ icon, className = "w-3.5 h-3.5 text-emerald-500" }) {
  const Icon = featureIconMap[icon] || ShieldCheck;
  return <Icon className={className} />;
}

const getFeatureList = (subscription) => {
  if (Array.isArray(subscription?.features) && subscription.features.length > 0) {
    return subscription.features;
  }

  if (subscription?.restoBenefitType === "commission_reduction") {
    return [
      { icon: "BadgePercent", text: `Reduced commission rate: ${subscription.commissionRate}%` },
      { icon: "ShieldCheck", text: "Full restaurant dashboard access" },
      { icon: "Sparkles", text: "Lower per-order charges during plan validity" },
    ];
  }

  return [
    { icon: "Star", text: "Priority listing boost in customer discoverability" },
    { icon: "ShieldCheck", text: "Full restaurant dashboard access" },
    { icon: "Truck", text: "Business visibility benefit during plan validity" },
  ];
};

export default function RestaurantMySubscription() {
  const navigate = useNavigate();
  const goBack = useRestaurantBackNavigation();
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSubscriptions = async () => {
      try {
        setIsLoading(true);
        const response = await restaurantAPI.getSubscriptions();
        const items = response?.data?.data?.subscriptions || [];
        if (mounted) setSubscriptions(items);
      } catch (error) {
        console.error("Error loading restaurant subscriptions", error);
        if (mounted) setSubscriptions([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadSubscriptions();
    return () => {
      mounted = false;
    };
  }, []);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((item) => item?.active === true),
    [subscriptions],
  );
  const inactiveSubscriptions = useMemo(
    () => subscriptions.filter((item) => item?.active !== true),
    [subscriptions],
  );

  const formatDate = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysLeftLabel = (subscription) => {
    const daysLeft = Number(subscription?.daysLeft || 0);
    if (daysLeft <= 0) return "Ends today";
    if (daysLeft === 1) return "1 day left";
    return `${daysLeft} days left`;
  };

  return (
    <AnimatedPage className="min-h-screen bg-slate-50 pb-24 text-slate-900">
      <div className="mx-auto max-w-md md:max-w-4xl px-4 py-5">
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
              <span>My Subscription</span>
            </h1>
            <p className="text-xs text-slate-500">Track your active restaurant plan and past subscriptions</p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="mb-3 px-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Active Subscription
          </h2>

          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              Loading subscriptions...
            </div>
          ) : activeSubscriptions.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Crown className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Active Subscription</h3>
              <p className="mt-1 text-xs text-slate-500">
                Choose a restaurant subscription plan to unlock business benefits.
              </p>
              <Button
                onClick={() => navigate("/food/restaurant/subscriptions")}
                className="mt-4 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white hover:bg-brand-700"
              >
                Browse Plans
              </Button>
            </div>
          ) : (
            activeSubscriptions.map((subscription) => (
              <motion.div
                key={subscription.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"
              >
                <div className="relative h-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-3.5 text-white">
                  {subscription.image ? (
                    <>
                      <img
                        src={subscription.image}
                        alt={subscription.name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-950/45" />
                    </>
                  ) : null}

                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <span className="rounded-full bg-white/20 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider backdrop-blur">
                        Restaurant Member
                      </span>
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[9px] font-extrabold uppercase">
                        <CheckCircle2 className="h-3 w-3" />
                        Active Plan
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-3.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="truncate text-lg font-extrabold text-slate-900">{subscription.name}</h3>
                      <span className="shrink-0 text-xs font-semibold text-slate-600">{subscription.duration}</span>
                    </div>
                    <p className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Calendar className="h-3 w-3" />
                      Expires {formatDate(subscription.expiryDate)}
                    </p>
                    <p className="text-[11px] font-semibold text-amber-600">{getDaysLeftLabel(subscription)}</p>
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-2xl font-extrabold leading-none text-slate-900">{subscription.price}</p>
                        {subscription.markedPrice && subscription.markedPrice !== subscription.price ? (
                          <p className="text-xs font-semibold text-slate-400 line-through">{subscription.markedPrice}</p>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      {subscription.restoBenefitType === "commission_reduction" ? "Commission" : "Priority"}
                    </span>
                  </div>

                  {subscription.description ? (
                    <p className="text-xs leading-relaxed text-slate-500">{subscription.description}</p>
                  ) : null}

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">Perk Status:</span>
                      <span className="rounded bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold capitalize text-brand-700">
                        {subscription.restoBenefitType === "commission_reduction"
                          ? `Commission ${subscription.commissionRate}%`
                          : "Priority Listing"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-slate-100 pt-3">
                    {getFeatureList(subscription).map((feature, index) => (
                      <div key={`${subscription.id}-feature-${index}`} className="flex items-start gap-2 text-[12px] text-slate-500">
                        <FeatureIcon icon={feature.icon} />
                        <span>{feature.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {inactiveSubscriptions.length > 0 ? (
          <div>
            <h2 className="mb-3 px-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Purchase History
            </h2>

            <div className="space-y-3">
              {inactiveSubscriptions.map((subscription) => (
                <div
                  key={subscription.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs opacity-80"
                >
                  <div className="flex items-center gap-3">
                    {subscription.image ? (
                      <img
                        src={subscription.image}
                        alt={subscription.name}
                        className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                      />
                    ) : null}
                    <div className="space-y-1">
                      <h3 className="flex items-center gap-1.5 font-bold text-slate-900">
                        <span>{subscription.name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                          {subscription.status === "cancelled" ? "Cancelled" : "Expired"}
                        </span>
                      </h3>
                      <p className="text-[10px] text-slate-500">
                        Active: {formatDate(subscription.purchaseDate)} - {formatDate(subscription.expiryDate)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {subscription.markedPrice && subscription.markedPrice !== subscription.price ? (
                      <p className="text-[10px] text-slate-400 line-through">{subscription.markedPrice}</p>
                    ) : null}
                    <p className="font-extrabold text-slate-900">{subscription.price}</p>
                    <p className="text-[9px] text-slate-400">{subscription.duration}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <BottomNavOrders />
    </AnimatedPage>
  );
}
