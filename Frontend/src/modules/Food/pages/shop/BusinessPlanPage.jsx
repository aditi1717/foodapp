import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation";
import Lenis from "lenis";
import { ArrowLeft, CheckCircle } from "lucide-react";
import BRAND_THEME from "@/config/brandTheme";
import { Card, CardContent } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders";
import { toast } from "sonner";
import { restaurantAPI } from "@/services/api";

const defaultActivePlan = {
  id: "default-commission",
  name: "Commission Base Plan",
  price: "10.0 % Commission",
  duration: "Unlimited",
  features: ["10.0% standard commission rate", "Access to all panels & apps"],
  restoBenefitType: "commission_reduction",
  commissionRate: "10.0",
  description:
    "Restaurant will pay 10.0% commission to StackFood from each order. You will get access of all the features and options in restaurant panel, app and interaction with user.",
};

export default function BusinessPlanPage() {
  const navigate = useNavigate();
  const goBack = useRestaurantBackNavigation();
  const [showPlans, setShowPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPlans = async () => {
      try {
        setIsLoading(true);
        const [plansResponse, currentResponse] = await Promise.all([
          restaurantAPI.getSubscriptionPackages(),
          restaurantAPI.getCurrentSubscription(),
        ]);

        const restoPlans = plansResponse?.data?.data?.packages || [];
        const currentSubscription = currentResponse?.data?.data?.subscription;

        const mappedPlans = restoPlans.map((p) => {
          const isCommission = p.restoBenefitType === "commission_reduction";
          const isPriority = p.restoBenefitType === "priority_listing";
          const features = [];
          if (isCommission) {
            features.push(`Reduced Commission: ${p.commissionRate}%`);
          } else if (isPriority) {
            features.push("Priority Zone SEO Boost");
          }
          features.push("Full App Dashboard Access");
          features.push("Menu and Operations Manager");

          return {
            id: String(p.id),
            name: p.name,
            price: p.price,
            duration: p.duration,
            features,
            restoBenefitType: p.restoBenefitType,
            commissionRate: p.commissionRate,
            description: p.description,
          };
        });

        if (!isMounted) return;

        setPlans(mappedPlans);

        if (currentSubscription?.packageId) {
          const found = mappedPlans.find((plan) => String(plan.id) === String(currentSubscription.packageId));
          const active = found || {
            id: currentSubscription.packageId,
            name: currentSubscription.name,
            price: currentSubscription.price,
            duration: currentSubscription.duration,
            features: currentSubscription.restoBenefitType === "commission_reduction"
              ? [`Reduced Commission: ${currentSubscription.commissionRate}%`, "Full App Dashboard Access", "Menu and Operations Manager"]
              : ["Priority Zone SEO Boost", "Full App Dashboard Access", "Menu and Operations Manager"],
            restoBenefitType: currentSubscription.restoBenefitType,
            commissionRate: currentSubscription.commissionRate,
            description: currentSubscription.description,
          };
          setActivePlan(active);
          setSelectedPlanId(String(active.id));
        } else if (mappedPlans[0]) {
          setActivePlan(mappedPlans[0]);
          setSelectedPlanId(String(mappedPlans[0].id));
        } else {
          setActivePlan(defaultActivePlan);
          setSelectedPlanId(defaultActivePlan.id);
        }
      } catch (error) {
        console.error("Error loading restaurant plans", error);
        if (isMounted) {
          setPlans([]);
          setActivePlan(defaultActivePlan);
          setSelectedPlanId(defaultActivePlan.id);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPlans();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleShiftPlan = async (newPlan) => {
    try {
      setIsSubmitting(true);
      const response = await restaurantAPI.activateSubscription({
        packageId: newPlan.id,
        paymentMethod: "manual",
      });
      const subscription = response?.data?.data?.subscription;
      setActivePlan({
        ...newPlan,
        id: subscription?.packageId || newPlan.id,
      });
      setSelectedPlanId(String(subscription?.packageId || newPlan.id));
      setShowPlans(false);
      toast.success(`Business plan shifted to ${newPlan.name} successfully!`);
    } catch (error) {
      console.error("Error shifting restaurant plan", error);
      toast.error(error?.response?.data?.message || "Failed to change business plan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6] pb-24 md:pb-6">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1 text-center -ml-8">My Business Plan</h1>
      </div>

      <div className="px-4 py-6 flex justify-center">
        <Card className="w-full max-w-md bg-white shadow-sm border-0">
          <CardContent className="pt-10 pb-16 px-6 text-center">
            <h2 className="text-base font-semibold text-[#008069] mb-4">
              {isLoading ? "Loading..." : activePlan?.name || defaultActivePlan.name}
            </h2>
            <p className="text-4xl font-extrabold text-[#008069] mb-6">
              {activePlan?.restoBenefitType === "commission_reduction"
                ? `${activePlan.commissionRate}%`
                : activePlan?.restoBenefitType === "priority_listing"
                ? "Top SEO Rank"
                : "10.0%"}
            </p>
            <p className="text-sm leading-relaxed text-gray-600 max-w-xs mx-auto">
              {activePlan?.description || defaultActivePlan.description}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-40 space-y-2">
        <Button
          variant="outline"
          className="w-full border-[#ff8100] text-[#ff8100] hover:bg-[#ff8100]/5 font-semibold py-2.5 rounded-xl text-sm"
          onClick={() => setShowPlans(true)}
        >
          Plans
        </Button>
        <Button
          className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-xl text-base"
          onClick={() => setShowPlans(true)}
        >
          Change Business Plan
        </Button>
      </div>

      <BottomNavOrders />

      <AnimatePresence>
        {showPlans && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[70]"
              style={{ backgroundColor: `${BRAND_THEME.colors.brand.primaryDark}66` }}
              onClick={() => setShowPlans(false)}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 25 }}
              className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[80] max-h-[85vh] overflow-hidden"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>

              <div className="px-4 pb-3 text-center border-b border-gray-100">
                <h2 className="text-base md:text-lg font-semibold text-gray-900">Change Subscription Plan</h2>
                <p className="mt-1 text-xs md:text-sm text-gray-500">
                  Renew or shift your plan to get a better experience
                </p>
              </div>

              <div className="px-4 py-5 overflow-x-auto scrollbar-hide -mx-2">
                <div className="flex gap-3 px-2 min-w-max pb-2">
                  {plans.length === 0 ? (
                    <div className="w-full text-sm text-gray-500 px-2">No restaurant plans available yet.</div>
                  ) : (
                    plans.map((p, index) => {
                      const isActive = String(p.id) === String(selectedPlanId);
                      return (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, y: 30, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.3, delay: 0.05 + index * 0.05 }}
                          className="w-60 flex-shrink-0"
                        >
                          <div
                            onClick={() => setSelectedPlanId(String(p.id))}
                            className={`w-full rounded-3xl overflow-hidden shadow-md border transition-all cursor-pointer ${
                              isActive ? "bg-[#243447] border-[#243447]" : "bg-white border-gray-200"
                            }`}
                          >
                            <div className="px-5 pt-5 pb-6 text-left">
                              <p className={`text-sm font-semibold mb-3 ${isActive ? "text-white" : "text-gray-800"}`}>
                                {p.name}
                              </p>
                              <p className={`text-3xl font-extrabold mb-1 ${isActive ? "text-white" : "text-gray-900"}`}>
                                {p.price}
                              </p>
                              <p className={`text-xs mb-4 ${isActive ? "text-gray-200" : "text-gray-500"}`}>
                                {p.duration}
                              </p>

                              <div className="space-y-2 mb-5">
                                {p.features.map((feature) => (
                                  <div key={feature} className="flex items-center gap-2 text-xs text-gray-100">
                                    <CheckCircle className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-[#ff8100]"}`} />
                                    <span className={isActive ? "text-gray-100" : "text-gray-700"}>{feature}</span>
                                  </div>
                                ))}
                              </div>

                              <Button
                                className={`w-full rounded-xl py-2.5 text-sm font-semibold ${
                                  isActive
                                    ? "bg-[#ff8100] hover:bg-[#e67300] text-white"
                                    : "bg-white text-[#ff8100] border border-[#ff8100] hover:bg-[#ff8100]/5"
                                }`}
                                variant={isActive ? "default" : "outline"}
                                disabled={isSubmitting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShiftPlan(p);
                                }}
                              >
                                {isSubmitting && String(selectedPlanId) === String(p.id) ? "Shifting..." : "Shift This Plan"}
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
