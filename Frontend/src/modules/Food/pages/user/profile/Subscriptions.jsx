import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Gem, Check, ShieldCheck, Heart, Zap, Gift, BadgePercent, Truck } from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { Card, CardContent } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { Dialog, DialogContent } from "@food/components/ui/dialog";
import { initRazorpayPayment } from "@food/utils/razorpay";
import { getCompanyNameAsync } from "@food/utils/businessSettings";
import BRAND_THEME from "@/config/brandTheme";
import { toast } from "sonner";
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

export default function Subscriptions() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [activePlanId, setActivePlanId] = useState(null);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const packagesResponse = await userAPI.getSubscriptionPackages();
        const customerPlans = packagesResponse?.data?.data?.packages;

        let currentSubscription = null;
        try {
          const subscriptionResponse = await userAPI.getCurrentSubscription();
          currentSubscription = subscriptionResponse?.data?.data?.subscription || null;
        } catch (subscriptionError) {
          console.warn("Error loading current subscription", subscriptionError);
          try {
            const subscriptionsResponse = await userAPI.getSubscriptions();
            const subscriptions = subscriptionsResponse?.data?.data?.subscriptions || [];
            currentSubscription =
              subscriptions.find((subscription) => subscription?.active === true) || null;
          } catch (subscriptionsError) {
            console.warn("Error loading subscriptions fallback", subscriptionsError);
          }
        }

        if (!isMounted) return;

        setPackages(Array.isArray(customerPlans) ? customerPlans : []);
        setActivePlanId(currentSubscription?.packageId || null);
        setCurrentSubscription(currentSubscription || null);
      } catch (error) {
        console.error("Error loading customer subscription packages", error);
        if (isMounted) {
          setPackages([]);
          setActivePlanId(null);
          setCurrentSubscription(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenConfirm = (plan) => {
    if (currentSubscription?.active) {
      if (String(activePlanId || "") === String(plan.id)) {
        toast.info(`You are already subscribed to the ${plan.name} plan!`);
      } else {
        toast.info(`Your ${currentSubscription?.name || "current"} plan is still active.`);
      }
      return;
    }
    setSelectedPlan(plan);
    setIsConfirmOpen(true);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;

    try {
      setIsSubmitting(true);
      const orderResponse = await userAPI.createSubscriptionRazorpayOrder({
        packageId: selectedPlan.id,
      });
      const razorpay = orderResponse?.data?.data?.razorpay;

      if (!razorpay?.orderId || !razorpay?.key) {
        throw new Error("Failed to initialize Razorpay checkout");
      }

      let userInfo = {};
      try {
        const userResponse = await userAPI.getProfile();
        userInfo = userResponse?.data?.data?.user || userResponse?.data?.user || {};
      } catch (profileError) {
        console.warn("Unable to load user profile for Razorpay prefill", profileError);
      }

      const companyName = await getCompanyNameAsync();

      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpay.orderId,
        name: companyName,
        description: `${selectedPlan.name} Subscription`,
        prefill: {
          name: userInfo?.name || "",
          email: userInfo?.email || "",
          contact: String(userInfo?.phone || "").replace(/\D/g, "").slice(-10),
        },
        notes: {
          type: "subscription_purchase",
          packageId: selectedPlan.id,
        },
        handler: async (response) => {
          try {
            const verifyResponse = await userAPI.verifySubscriptionRazorpayPayment({
              packageId: selectedPlan.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            const subscription = verifyResponse?.data?.data?.subscription;
            setActivePlanId(subscription?.packageId || selectedPlan.id);
            setCurrentSubscription(subscription || null);
            setIsConfirmOpen(false);
            setIsSuccessOpen(true);
            toast.success(`Subscribed to ${selectedPlan.name} successfully!`);
          } catch (verifyError) {
            console.error("Error verifying subscription payment", verifyError);
            toast.error(verifyError?.response?.data?.message || "Payment verification failed");
          } finally {
            setIsSubmitting(false);
          }
        },
        onError: (error) => {
          toast.error(error?.description || error?.message || "Payment failed");
          setIsSubmitting(false);
        },
        onClose: () => {
          setIsSubmitting(false);
        },
      });
    } catch (error) {
      console.error("Error activating subscription", error);
      toast.error(error?.response?.data?.message || "Failed to activate subscription");
      setIsSubmitting(false);
    }
  };

  const getGradient = (name = "", index = 0) => {
    const lowercaseName = name.toLowerCase();
    if (lowercaseName.includes("gold") || lowercaseName.includes("pro")) {
      return "from-amber-400 via-orange-500 to-yellow-600";
    }
    if (lowercaseName.includes("silver") || lowercaseName.includes("basic")) {
      return "from-slate-400 via-slate-600 to-indigo-700";
    }
    const alternateGradients = [
      "from-rose-500 via-pink-600 to-purple-700",
      "from-teal-400 via-emerald-600 to-cyan-700",
      "from-blue-500 via-indigo-600 to-violet-700",
    ];
    return alternateGradients[index % alternateGradients.length];
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
              <Gem className="w-5 h-5 text-brand-500 animate-bounce" />
              <span>Subscription Plans</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pick a plan to get exclusive benefits</p>
          </div>
        </div>

        {currentSubscription?.active && (
          <div className="mb-6 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm">
            <p className="text-sm font-extrabold uppercase tracking-wide">Subscription already active</p>
            <p className="mt-1 text-xs text-slate-600">
              You already have an active subscription. You can choose another plan after your current plan expires.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              Loading plans...
            </div>
          ) : packages.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              No subscription packages created by admin yet.
            </div>
          ) : (
            packages.map((pkg, idx) => {
              const isSubscribed = String(activePlanId || "") === String(pkg.id);
              const hasAnyActivePlan = Boolean(currentSubscription?.active);
              const gradientClass = getGradient(pkg.name, idx);

              return (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.1 }}
                  whileHover={{ y: -3 }}
                  className="relative"
                >
                  {(pkg.name.toLowerCase().includes("gold") || pkg.name.toLowerCase().includes("pro")) && (
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-2xl blur opacity-30 transition duration-1000" />
                  )}

                  <Card className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141414] shadow-sm flex flex-col justify-between gap-0 py-0">
                    <div className={`h-28 bg-gradient-to-br ${gradientClass} relative p-4 flex flex-col justify-between overflow-hidden`}>
                      {pkg.image ? (
                        <>
                          <img src={pkg.image} alt={pkg.name} className="absolute inset-0 h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-slate-950/35" />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
                      )}

                      <div className="flex justify-between items-start z-10">
                        <span className="text-[9px] font-bold bg-white/25 backdrop-blur-md text-white border border-white/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Customer Member
                        </span>

                        {isSubscribed && (
                          <span className="flex items-center gap-1 text-[9px] font-extrabold bg-emerald-500 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse shadow-sm">
                            <Check className="w-2.5 h-2.5" />
                            Active Plan
                          </span>
                        )}
                      </div>

                      <div className="z-10">
                        <h3 className="text-base font-extrabold text-white tracking-wide truncate">{pkg.name}</h3>
                      </div>
                    </div>

                    <CardContent className="p-4">
                      {hasAnyActivePlan && !isSubscribed && (
                        <div className="mb-4 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-center">
                          <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-900">
                            Already have subscription
                          </p>
                          <p className="mt-1 text-[11px] text-slate-600">
                            This plan will be available after current subscription expiry.
                          </p>
                        </div>
                      )}

                      <div className="flex items-end justify-between mb-3">
                        <div>
                          {pkg.markedPrice && pkg.markedPrice !== pkg.price && (
                            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 line-through">
                              {pkg.markedPrice}
                            </p>
                          )}
                          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{pkg.price}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{pkg.duration}</p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                        {pkg.description}
                      </p>

                      <div className="space-y-2.5 mb-5 text-xs">
                        {(Array.isArray(pkg.features) && pkg.features.length > 0
                          ? pkg.features
                          : [
                              {
                                icon: "ShieldCheck",
                                text:
                                  pkg.freeDeliveryType === "unlimited"
                                    ? "Unlimited free deliveries"
                                    : `${pkg.maxFreeDeliveries} free deliveries included`,
                              },
                              { icon: "Heart", text: "Exclusive coupons & member savings" },
                              { icon: "Zap", text: "Priority support and faster checkout benefits" },
                            ]).map((feature, featureIndex) => (
                          <div
                            key={`${pkg.id}-feature-${featureIndex}`}
                            className="flex items-center gap-2 text-slate-700 dark:text-slate-300"
                          >
                            <PackageFeatureIcon
                              icon={feature.icon}
                              className={`w-3.5 h-3.5 ${
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

                      <Button
                        onClick={() => handleOpenConfirm(pkg)}
                        disabled={hasAnyActivePlan}
                        className={`w-full rounded-xl text-sm font-bold py-3 ${
                          isSubscribed
                            ? "bg-emerald-500 hover:bg-emerald-500 text-white cursor-not-allowed"
                            : hasAnyActivePlan
                              ? "bg-slate-200 hover:bg-slate-200 text-slate-500 cursor-not-allowed"
                              : "bg-brand-600 hover:bg-brand-700 text-white cursor-pointer"
                        }`}
                      >
                        {isSubscribed
                          ? "Currently Active"
                          : hasAnyActivePlan
                            ? "Available After Expiry"
                            : "Choose This Plan"}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>

        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogContent className="max-w-sm rounded-2xl bg-white dark:bg-[#141414] border border-slate-200 dark:border-slate-800 p-5 shadow-xl text-slate-900 dark:text-slate-100">
            {selectedPlan && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold">Confirm Subscription</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Subscribe to <span className="font-bold">{selectedPlan.name}</span>.
                  </p>
                  <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
                    {selectedPlan.image && (
                      <img
                        src={selectedPlan.image}
                        alt={selectedPlan.name}
                        className="mb-3 h-28 w-full rounded-lg object-cover"
                      />
                    )}
                    {selectedPlan.markedPrice && selectedPlan.markedPrice !== selectedPlan.price && (
                      <p className="text-xs text-slate-400 line-through">{selectedPlan.markedPrice}</p>
                    )}
                    <p className="text-lg font-extrabold text-slate-900 dark:text-white">{selectedPlan.price}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{selectedPlan.duration}</p>
                    {Array.isArray(selectedPlan.features) && selectedPlan.features.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedPlan.features.map((feature, index) => (
                          <div key={`confirm-feature-${index}`} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                            <PackageFeatureIcon icon={feature.icon} className="w-3.5 h-3.5 text-brand-500" />
                            <span>{feature.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Payment Method</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Razorpay (UPI/Card/Netbanking)</p>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => setIsConfirmOpen(false)}
                    className="flex-1 rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubscribe}
                    disabled={isSubmitting}
                    className="flex-1 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs cursor-pointer"
                  >
                    {isSubmitting ? "Processing..." : "Confirm"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
          <DialogContent className="max-w-sm rounded-2xl bg-white dark:bg-[#141414] border border-slate-200 dark:border-slate-800 p-5 shadow-xl text-center text-slate-900 dark:text-slate-100">
            <div className="space-y-3">
              <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600">
                <Check className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold">Subscription Activated</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Your new plan is live now.
                </p>
              </div>
              <Button
                onClick={() => navigate("/food/profile/my-subscriptions")}
                className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm cursor-pointer"
                style={{ backgroundColor: BRAND_THEME.colors.brand.primary }}
              >
                View My Subscription
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AnimatedPage>
  );
}
