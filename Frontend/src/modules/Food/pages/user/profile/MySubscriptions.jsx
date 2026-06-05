import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  Sparkles,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Zap,
  ShieldCheck,
  Heart,
  Gift,
  BadgePercent,
  Truck,
} from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Button } from "@food/components/ui/button";
import { userAPI } from "@/services/api";

const featureIconMap = {
  ShieldCheck,
  Heart,
  Zap,
  Gift,
  BadgePercent,
  Truck,
};

function PackageFeatureIcon({ icon, className = "w-3.5 h-3.5 text-emerald-500" }) {
  const Icon = featureIconMap[icon] || ShieldCheck;
  return <Icon className={className} />;
}

export default function MySubscriptions() {
  const navigate = useNavigate();
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [inactiveSubscriptions, setInactiveSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      setIsLoading(true);
      const response = await userAPI.getSubscriptions();
      const subs = response?.data?.data?.subscriptions || [];
      const active = subs.filter((sub) => sub.active === true);
      const inactive = subs.filter((sub) => sub.active !== true);
      setActiveSubscriptions(active);
      setInactiveSubscriptions(inactive);
    } catch (error) {
      console.error("Error loading subscriptions", error);
      setActiveSubscriptions([]);
      setInactiveSubscriptions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getProgressDetails = (purchaseStr, expiryStr) => {
    try {
      const purchase = new Date(purchaseStr).getTime();
      const expiry = new Date(expiryStr).getTime();
      const now = Date.now();
      const total = expiry - purchase;
      const elapsed = now - purchase;

      if (total <= 0) return { percent: 100, daysLeft: 0 };

      const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
      const daysLeft = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));
      return { percent, daysLeft };
    } catch (error) {
      return { percent: 0, daysLeft: 30 };
    }
  };

  const getGradient = (name = "") => {
    const lowercaseName = name.toLowerCase();
    if (lowercaseName.includes("gold") || lowercaseName.includes("pro")) {
      return "from-amber-400 via-orange-500 to-yellow-600";
    }
    if (lowercaseName.includes("silver") || lowercaseName.includes("basic")) {
      return "from-slate-400 via-slate-600 to-indigo-700";
    }
    return "from-rose-500 via-pink-600 to-purple-700";
  };

  const getFeatureList = (sub) => {
    if (Array.isArray(sub.features) && sub.features.length > 0) {
      return sub.features;
    }

    return [
      {
        icon: "ShieldCheck",
        text:
          sub.freeDeliveryType === "unlimited"
            ? "Unlimited free deliveries"
            : `${sub.maxFreeDeliveries || 0} free deliveries included`,
      },
      { icon: "Heart", text: "Exclusive coupons & member savings" },
      { icon: "Zap", text: "Priority support and faster checkout benefits" },
    ];
  };

  return (
    <AnimatedPage className="min-h-screen bg-slate-50 dark:bg-[#0c0c0c] pb-24 text-slate-900 dark:text-slate-100">
      <div className="max-w-md md:max-w-lg mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/food/profile")}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-colors border border-slate-200 dark:border-slate-800"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold flex items-center gap-1.5">
              <Award className="w-5 h-5 text-emerald-500" />
              <span>My Subscriptions</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage your active plans and purchase history</p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 px-1">
            Active Subscription
          </h2>

          {isLoading ? (
            <div className="bg-white dark:bg-[#141414] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 text-center shadow-sm text-sm text-slate-500">
              Loading subscriptions...
            </div>
          ) : activeSubscriptions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-[#141414] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 text-center shadow-sm"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 mb-3.5">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Active Subscriptions</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[85%] mx-auto leading-relaxed">
                Subscribe to our premium tiers to enjoy zero delivery fees, priority rank, and member benefits.
              </p>
              <Button
                onClick={() => navigate("/food/profile/subscriptions")}
                className="mt-4 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-5 rounded-xl text-xs flex items-center gap-1.5 mx-auto cursor-pointer"
              >
                <span>Browse Plans</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          ) : (
            activeSubscriptions.map((sub) => {
              const { percent, daysLeft } = getProgressDetails(sub.purchaseDate, sub.expiryDate);
              const gradientClass = getGradient(sub.name);

              return (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141414] shadow-md"
                >
                  <div className={`h-24 bg-gradient-to-br ${gradientClass} relative p-4 flex flex-col justify-between text-white`}>
                    {sub.image ? (
                      <>
                        <img src={sub.image} alt={sub.name} className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-slate-950/35" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
                    )}

                    <div className="flex justify-between items-start z-10">
                      <span className="flex items-center gap-1 text-[9px] font-extrabold bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse shadow-sm">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Active
                      </span>

                      <span className="text-[9px] font-bold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 uppercase">
                        Member Plan
                      </span>
                    </div>

                    <div className="z-10">
                      <h3 className="text-base font-extrabold tracking-wide">{sub.name}</h3>
                      <p className="text-[10px] text-white/85 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        Expires {formatDate(sub.expiryDate)}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        {sub.markedPrice && sub.markedPrice !== sub.price && (
                          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 line-through">
                            {sub.markedPrice}
                          </p>
                        )}
                        <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{sub.price}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub.duration}</p>
                      </div>
                    </div>

                    {sub.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{sub.description}</p>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-500 dark:text-slate-400">Duration Elapsed</span>
                        <span className="text-slate-900 dark:text-white font-bold">{daysLeft} days left</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className="bg-brand-500 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/40 space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-ping" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Perk Status:</span>
                        <span className="capitalize font-bold text-brand-600 bg-brand-500/10 px-2 py-0.5 rounded text-[10px]">
                          {sub.freeDeliveryType === "unlimited" ? "Unlimited Free Deliveries" : "Capped Deliveries Limit"}
                        </span>
                      </div>

                      {sub.freeDeliveryType === "capped" && (
                        <div className="space-y-1 pt-1.5 border-t border-slate-200/50 dark:border-slate-800">
                          <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            <span>Free Deliveries Used:</span>
                            <span>
                              {sub.deliveriesUsed || 0} / {sub.maxFreeDeliveries}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  ((sub.deliveriesUsed || 0) / parseInt(sub.maxFreeDeliveries || 1, 10)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-slate-800">
                        {getFeatureList(sub).map((feature, featureIndex) => (
                          <div
                            key={`${sub.id}-feature-${featureIndex}`}
                            className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400"
                          >
                            <PackageFeatureIcon
                              icon={feature.icon}
                              className={`mt-0.5 w-3.5 h-3.5 shrink-0 ${
                                feature.icon === "Heart"
                                  ? "text-rose-500"
                                  : feature.icon === "Zap"
                                    ? "text-amber-500"
                                    : feature.icon === "BadgePercent"
                                      ? "text-blue-500"
                                      : feature.icon === "Truck"
                                        ? "text-cyan-500"
                                        : feature.icon === "Gift"
                                          ? "text-fuchsia-500"
                                          : "text-emerald-500"
                              }`}
                            />
                            <span>{feature.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {inactiveSubscriptions.length > 0 && (
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 px-1">
              Purchase History
            </h2>

            <div className="space-y-3">
              {inactiveSubscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex justify-between items-center text-xs opacity-75"
                >
                  <div className="flex items-center gap-3">
                    {sub.image ? (
                      <img
                        src={sub.image}
                        alt={sub.name}
                        className="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-slate-800"
                      />
                    ) : null}
                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{sub.name}</span>
                        <span className="text-[9px] font-semibold bg-slate-100 dark:bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded">
                          {sub.status === "cancelled" ? "Cancelled" : "Expired"}
                        </span>
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Active: {formatDate(sub.purchaseDate)} - {formatDate(sub.expiryDate)}
                      </p>
                      {sub.description && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{sub.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {sub.markedPrice && sub.markedPrice !== sub.price && (
                      <p className="text-[10px] text-slate-400 line-through">{sub.markedPrice}</p>
                    )}
                    <span className="font-extrabold text-slate-900 dark:text-white">{sub.price}</span>
                    <p className="text-[9px] text-slate-400">{sub.duration}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
