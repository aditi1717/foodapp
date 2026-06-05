import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Gem,
  LayoutGrid,
  Table,
  Building2,
  Users,
  Award,
  ShieldCheck,
  Heart,
  Zap,
  Gift,
  BadgePercent,
  Truck,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog";
import { adminAPI, uploadAPI } from "@/services/api";

const FEATURE_ICON_OPTIONS = [
  { value: "ShieldCheck", label: "Shield", Icon: ShieldCheck },
  { value: "Heart", label: "Heart", Icon: Heart },
  { value: "Zap", label: "Zap", Icon: Zap },
  { value: "Gift", label: "Gift", Icon: Gift },
  { value: "BadgePercent", label: "Discount", Icon: BadgePercent },
  { value: "Truck", label: "Delivery", Icon: Truck },
];

const defaultFeatures = [
  { icon: "ShieldCheck", text: "Unlimited free deliveries" },
  { icon: "Heart", text: "Exclusive coupons & member savings" },
  { icon: "Zap", text: "Priority support and faster checkout benefits" },
];

const sanitizeDecimalInput = (value) => {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  const [whole = "", ...decimals] = cleaned.split(".");
  return decimals.length > 0 ? `${whole}.${decimals.join("")}` : whole;
};

const preventInvalidNumberKeys = (event) => {
  if (["e", "E", "+", "-"].includes(event.key)) {
    event.preventDefault();
  }
};

function FeatureIconPreview({ icon, className = "w-4 h-4" }) {
  const entry = FEATURE_ICON_OPTIONS.find((item) => item.value === icon) || FEATURE_ICON_OPTIONS[0];
  const Icon = entry.Icon;
  return <Icon className={className} />;
}

function PackageBanner({ pkg }) {
  if (pkg.image) {
    return <img src={pkg.image} alt={pkg.name} className="w-full h-full object-cover" />;
  }

  let gradientClass = "from-slate-400 to-slate-600";
  if (pkg.type === "Resto") {
    gradientClass = pkg.name.toLowerCase().includes("pro")
      ? "from-emerald-500 via-teal-600 to-cyan-700"
      : "from-emerald-400 to-teal-500";
  } else if (pkg.type === "Customer") {
    gradientClass = pkg.name.toLowerCase().includes("gold")
      ? "from-amber-400 via-orange-500 to-yellow-600"
      : "from-blue-400 to-indigo-500";
  }

  return (
    <div className={`w-full h-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-bold opacity-90`}>
      <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
      <span className="text-xs font-extrabold tracking-wide uppercase px-3 py-1 bg-white/10 backdrop-blur-md rounded border border-white/20">
        {pkg.name}
      </span>
    </div>
  );
}

const fallbackPackages = [
  {
    id: 1,
    name: "Pro Resto Boost",
    price: "₹ 1,199.00",
    duration: "365 Days",
    subscribers: 12,
    active: true,
    type: "Resto",
    restoBenefitType: "priority_listing",
    commissionRate: "",
    description:
      "Boost your restaurant visibility. Appears at the top of the restaurant list in your zone for the duration of the subscription.",
    image: null,
  },
  {
    id: 2,
    name: "Basic Resto Commission Save",
    price: "₹ 399.00",
    duration: "120 Days",
    subscribers: 40,
    active: true,
    type: "Resto",
    restoBenefitType: "commission_reduction",
    commissionRate: "5",
    description:
      "Reduce order commission fees down to 5% for all orders during the subscription period.",
    image: null,
  },
  {
    id: 3,
    name: "Gold Customer",
    price: "₹ 49.00",
    duration: "30 Days",
    subscribers: 120,
    active: true,
    type: "Customer",
    freeDeliveryType: "unlimited",
    maxFreeDeliveries: "",
    description:
      "Get unlimited free delivery from your favorite local restaurants, zero delivery fees guaranteed.",
    image: null,
  },
  {
    id: 4,
    name: "Silver Customer",
    price: "₹ 29.00",
    duration: "30 Days",
    subscribers: 350,
    active: true,
    type: "Customer",
    freeDeliveryType: "capped",
    maxFreeDeliveries: "5",
    description: "Capped budget-friendly option offering up to 5 free deliveries per month.",
    image: null,
  },
];

export default function SubscriptionPackages() {
  const [packages, setPackages] = useState(fallbackPackages);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [viewMode, setViewMode] = useState("grid");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [newPkgName, setNewPkgName] = useState("");
  const [newPkgMarkedPrice, setNewPkgMarkedPrice] = useState("");
  const [newPkgPrice, setNewPkgPrice] = useState("");
  const [newPkgDuration, setNewPkgDuration] = useState("");
  const [newPkgDurationUnit, setNewPkgDurationUnit] = useState("Days");
  const [newPkgType, setNewPkgType] = useState("Resto");
  const [newPkgDescription, setNewPkgDescription] = useState("");
  const [newPkgImage, setNewPkgImage] = useState(null);
  const [newPkgImageFile, setNewPkgImageFile] = useState(null);
  const [newPkgFeatures, setNewPkgFeatures] = useState(defaultFeatures);
  const [restoBenefitType, setRestoBenefitType] = useState("commission_reduction");
  const [commissionRate, setCommissionRate] = useState("");
  const [freeDeliveryType, setFreeDeliveryType] = useState("unlimited");
  const [maxFreeDeliveries, setMaxFreeDeliveries] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadPackages = async () => {
      try {
        setIsLoading(true);
        const response = await adminAPI.getSubscriptionPackages();
        const items = response?.data?.data?.packages;
        if (isMounted && Array.isArray(items)) {
          setPackages(items);
        }
      } catch (error) {
        console.error("Error loading subscription packages", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPackages();
    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return packages.filter((pkg) => {
      const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesType = typeFilter === "All" || pkg.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [packages, searchQuery, typeFilter]);

  const stats = useMemo(() => {
    const restoCount = packages.filter((p) => p.type === "Resto").length;
    const customerCount = packages.filter((p) => p.type === "Customer").length;
    const totalSubscribers = packages.reduce((sum, p) => sum + Number(p.subscribers || 0), 0);
    return { restoCount, customerCount, totalSubscribers };
  }, [packages]);

  const isEditMode = Boolean(editingPackageId);

  const resetForm = () => {
    setEditingPackageId(null);
    setNewPkgName("");
    setNewPkgMarkedPrice("");
    setNewPkgPrice("");
    setNewPkgDuration("");
    setNewPkgDurationUnit("Days");
    setNewPkgType("Resto");
    setNewPkgDescription("");
    setNewPkgImage(null);
    setNewPkgImageFile(null);
    setNewPkgFeatures(defaultFeatures);
    setRestoBenefitType("commission_reduction");
    setCommissionRate("");
    setFreeDeliveryType("unlimited");
    setMaxFreeDeliveries("");
  };

  const handleModalOpenChange = (open) => {
    setIsAddOpen(open);
    if (!open) resetForm();
  };

  const toggleStatus = async (id) => {
    const target = packages.find((pkg) => String(pkg.id) === String(id));
    if (!target) return;

    try {
      const response = await adminAPI.updateSubscriptionPackageStatus(id, !target.active);
      const updatedPackage = response?.data?.data?.package;
      if (!updatedPackage) return;
      setPackages((prev) =>
        prev.map((pkg) => (String(pkg.id) === String(id) ? updatedPackage : pkg))
      );
    } catch (error) {
      console.error("Error updating package status", error);
      alert(error?.response?.data?.message || "Failed to update package status");
    }
  };

  const handleDeletePackage = async (pkg) => {
    const confirmed = window.confirm(
      `Delete "${pkg?.name || "this package"}"? This will also remove related subscriptions from user and restaurant sides.`
    );
    if (!confirmed) return;

    try {
      await adminAPI.deleteSubscriptionPackage(pkg.id);
      setPackages((prev) => prev.filter((item) => String(item.id) !== String(pkg.id)));
    } catch (error) {
      console.error("Error deleting subscription package", error);
      alert(error?.response?.data?.message || "Failed to delete subscription package");
    }
  };

  const updateFeature = (index, key, value) => {
    setNewPkgFeatures((prev) =>
      prev.map((feature, featureIndex) =>
        featureIndex === index ? { ...feature, [key]: value } : feature
      )
    );
  };

  const addFeature = () => {
    setNewPkgFeatures((prev) =>
      prev.length >= 6 ? prev : [...prev, { icon: "ShieldCheck", text: "" }]
    );
  };

  const removeFeature = (index) => {
    setNewPkgFeatures((prev) => prev.filter((_, featureIndex) => featureIndex !== index));
  };

  const handleEditPackage = (pkg) => {
    setEditingPackageId(pkg.id);
    setNewPkgName(pkg.name || "");
    setNewPkgMarkedPrice(pkg.markedPriceValue !== undefined && pkg.markedPriceValue !== null ? String(pkg.markedPriceValue) : "");
    setNewPkgPrice(pkg.priceValue !== undefined && pkg.priceValue !== null ? String(pkg.priceValue) : "");
    setNewPkgDuration(pkg.durationValue !== undefined && pkg.durationValue !== null ? String(pkg.durationValue) : "");
    setNewPkgDurationUnit(pkg.durationUnit || "Days");
    setNewPkgType(pkg.type || "Resto");
    setNewPkgDescription(pkg.description || "");
    setNewPkgImage(pkg.image || null);
    setNewPkgImageFile(null);
    setNewPkgFeatures(
      Array.isArray(pkg.features) && pkg.features.length > 0
        ? pkg.features.map((feature) => ({
            icon: feature.icon || "ShieldCheck",
            text: feature.text || "",
          }))
        : defaultFeatures
    );
    setRestoBenefitType(pkg.restoBenefitType || "commission_reduction");
    setCommissionRate(
      pkg.commissionRate !== undefined && pkg.commissionRate !== null && pkg.commissionRate !== ""
        ? String(pkg.commissionRate)
        : ""
    );
    setFreeDeliveryType(pkg.freeDeliveryType || "unlimited");
    setMaxFreeDeliveries(
      pkg.maxFreeDeliveries !== undefined && pkg.maxFreeDeliveries !== null && pkg.maxFreeDeliveries !== ""
        ? String(pkg.maxFreeDeliveries)
        : ""
    );
    setIsAddOpen(true);
  };

  const handleAddPackage = async (e) => {
    e.preventDefault();

    if (!newPkgName || !newPkgMarkedPrice || !newPkgPrice || !newPkgDuration) {
      alert("Please fill all basic fields");
      return;
    }

    if (Number(newPkgMarkedPrice) < Number(newPkgPrice)) {
      alert("Marked price must be greater than or equal to selling price");
      return;
    }

    if (newPkgType === "Resto" && restoBenefitType === "commission_reduction" && !commissionRate) {
      alert("Please enter commission rate");
      return;
    }

    if (newPkgType === "Customer" && freeDeliveryType === "capped" && !maxFreeDeliveries) {
      alert("Please enter max free deliveries");
      return;
    }

    try {
      setIsSubmitting(true);
      let packageImage = newPkgImage || "";

      if (newPkgImageFile) {
        const uploadResponse = await uploadAPI.uploadMedia(newPkgImageFile, {
          folder: "food/subscription-packages",
        });
        packageImage =
          uploadResponse?.data?.data?.url ||
          uploadResponse?.data?.data?.secure_url ||
          uploadResponse?.data?.url ||
          uploadResponse?.data?.secure_url ||
          "";
      }

      const payload = {
        name: newPkgName,
        type: newPkgType,
        markedPriceValue: Number(newPkgMarkedPrice),
        priceValue: Number(newPkgPrice),
        durationValue: Number(newPkgDuration),
        durationUnit: newPkgDurationUnit,
        description: newPkgDescription || "No description provided.",
        image: packageImage,
        features: newPkgFeatures.filter((feature) => feature.text.trim()),
        restoBenefitType: newPkgType === "Resto" ? restoBenefitType : undefined,
        commissionRate:
          newPkgType === "Resto" && restoBenefitType === "commission_reduction"
            ? Number(commissionRate)
            : undefined,
        freeDeliveryType: newPkgType === "Customer" ? freeDeliveryType : undefined,
        maxFreeDeliveries:
          newPkgType === "Customer" && freeDeliveryType === "capped"
            ? Number(maxFreeDeliveries)
            : undefined,
      };

      const response = isEditMode
        ? await adminAPI.updateSubscriptionPackage(editingPackageId, payload)
        : await adminAPI.createSubscriptionPackage(payload);

      const savedPackage = response?.data?.data?.package;
      if (savedPackage) {
        setPackages((prev) =>
          isEditMode
            ? prev.map((pkg) => (String(pkg.id) === String(savedPackage.id) ? savedPackage : pkg))
            : [savedPackage, ...prev]
        );
      }
      resetForm();
      setIsAddOpen(false);
    } catch (error) {
      console.error("Error creating package", error);
      alert(error?.response?.data?.message || "Failed to create subscription package");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Gem className="w-6 h-6 text-brand-600" />
          <span>Subscription Package List</span>
          <span className="inline-flex items-center justify-center text-[11px] font-semibold rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">
            {filtered.length}
          </span>
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-3 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Overview</h2>
            <p className="text-xs text-slate-500 mt-1">See overview of all the packages earnings</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 py-4">
          <OverviewCard title="Resto Packages" amount={`${stats.restoCount} Active`} previous="Resto Tier" bgColor="bg-emerald-50/60" icon={Building2} />
          <OverviewCard title="Customer Packages" amount={`${stats.customerCount} Active`} previous="User Tier" bgColor="bg-blue-50/60" icon={Users} />
          <OverviewCard title="Total Subscribers" amount={`${stats.totalSubscribers}`} previous="Active Plans" bgColor="bg-purple-50/60" icon={Award} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-4 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="pl-3 pr-8 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 appearance-none cursor-pointer pr-10 font-medium text-slate-700"
              >
                <option value="All">All Types</option>
                <option value="Resto">Resto Packages</option>
                <option value="Customer">Customer Packages</option>
              </select>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">▼</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-100/80">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Table View"
              >
                <Table className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => {
                resetForm();
                setIsAddOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-all shadow-md cursor-pointer animate-[fadeIn_0.3s_ease-out]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subscription Package</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {isLoading ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
              Loading subscription packages...
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
              No subscription packages found
            </div>
          ) : (
            filtered.map((pkg) => {
              const isResto = pkg.type === "Resto";

              return (
                <div
                  key={pkg.id}
                  className="bg-white rounded-xl border border-slate-200 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
                >
                  <div className="relative h-28 w-full overflow-hidden bg-slate-100 border-b border-slate-100">
                    <PackageBanner pkg={pkg} />

                    <div className="absolute top-2.5 left-2.5 z-10">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm backdrop-blur-md ${isResto ? "bg-emerald-500/90 text-white border-emerald-400/55" : "bg-blue-500/90 text-white border-blue-400/55"} uppercase tracking-wider`}>
                        {pkg.type}
                      </span>
                    </div>

                    <div className="absolute top-2.5 right-2.5 z-10 bg-white/80 p-0.5 rounded-full backdrop-blur-sm border border-slate-200/40 shadow-sm flex items-center justify-center scale-75 origin-top-right">
                      <ToggleSwitch enabled={pkg.active} onToggle={() => toggleStatus(pkg.id)} />
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 truncate">{pkg.name}</h3>

                      <div className="flex items-baseline gap-2 mt-0.5 mb-2 flex-wrap">
                        {pkg.markedPrice && (
                          <span className="text-xs font-semibold text-slate-400 line-through">{pkg.markedPrice}</span>
                        )}
                        <span className="text-lg font-extrabold text-slate-900">{pkg.price}</span>
                        <span className="text-xs text-slate-500">/ {pkg.duration}</span>
                      </div>

                      <p className="text-xs text-slate-500 mb-3 leading-relaxed line-clamp-2 h-8" title={pkg.description}>
                        {pkg.description || "No description provided."}
                      </p>

                      <div className="space-y-1.5 bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-xs text-slate-600">
                        {isResto ? (
                          <>
                            <div className="flex justify-between items-center">
                              <span>Benefit Type:</span>
                              <span className="font-bold text-emerald-700 uppercase text-[10px]">
                                {pkg.restoBenefitType === "commission_reduction" ? "Commission Reduction" : "Priority Listing Boost"}
                              </span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-1">
                              {pkg.restoBenefitType === "commission_reduction" ? (
                                <div className="flex justify-between text-slate-700">
                                  <span>Commission Rate:</span>
                                  <span className="font-extrabold text-emerald-700">{pkg.commissionRate}%</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-slate-700">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                  </span>
                                  <span className="font-semibold text-slate-800">Top Zone Listing Active</span>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between items-center">
                            <span>Free Delivery:</span>
                            <span className="font-semibold text-slate-800 uppercase text-[10px]">
                              {pkg.freeDeliveryType === "unlimited"
                                ? `Unlimited / ${pkg.duration}`
                                : `Capped (${pkg.maxFreeDeliveries} / ${pkg.duration})`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-950">{pkg.subscribers}</span> Subscribers
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditPackage(pkg)}
                          className="p-1 rounded text-brand-600 hover:bg-brand-50 border border-slate-100 hover:border-brand-200 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePackage(pkg)}
                          className="p-1 rounded text-red-600 hover:bg-red-50 border border-slate-100 hover:border-red-200 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {viewMode === "table" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-6 animate-[fadeIn_0.2s_ease-out]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">SI</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pricing</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subscribers</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Limits & Features</th>
                  <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-xs text-slate-500">
                      Loading subscription packages...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-xs text-slate-500">
                      No subscription packages found
                    </td>
                  </tr>
                ) : (
                  filtered.map((pkg, index) => {
                    const isResto = pkg.type === "Resto";
                    const typeBadge = isResto
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : "bg-blue-50 text-blue-700 border-blue-100";

                    return (
                      <tr key={pkg.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-50 relative flex items-center justify-center">
                              <PackageBanner pkg={pkg} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">{pkg.name}</div>
                              <div className="text-[10px] text-slate-500 max-w-[200px] truncate" title={pkg.description}>
                                {pkg.description || "No description"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeBadge} uppercase tracking-wider`}>
                            {pkg.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            {pkg.markedPrice && (
                              <span className="text-[10px] text-slate-400 line-through">{pkg.markedPrice}</span>
                            )}
                            <span className="text-xs text-slate-900 font-medium">{pkg.price}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">{pkg.duration}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-700">{pkg.subscribers}</td>
                        <td className="px-6 py-4">
                          <div
                            className="text-xs text-slate-500 max-w-[220px] truncate"
                            title={
                              isResto
                                ? pkg.restoBenefitType === "commission_reduction"
                                  ? `Reduced Commission: ${pkg.commissionRate}%`
                                  : "Priority Zone Listing Boost"
                                : `Free Delivery: ${
                                    pkg.freeDeliveryType === "unlimited"
                                      ? `Unlimited for ${pkg.duration}`
                                      : `Max ${pkg.maxFreeDeliveries} for ${pkg.duration}`
                                  }`
                            }
                          >
                            {isResto ? (
                              pkg.restoBenefitType === "commission_reduction" ? (
                                <span className="text-emerald-700 font-semibold">📉 {pkg.commissionRate}% Commission</span>
                              ) : (
                                <span className="text-blue-700 font-semibold">⭐ Priority Zone Listing</span>
                              )
                            ) : (
                              <span>
                                🚀 Free Del:{" "}
                                {pkg.freeDeliveryType === "unlimited"
                                  ? `Unlimited for ${pkg.duration}`
                                  : `Max ${pkg.maxFreeDeliveries} for ${pkg.duration}`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <ToggleSwitch enabled={pkg.active} onToggle={() => toggleStatus(pkg.id)} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-medium">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditPackage(pkg)}
                              className="p-1 rounded text-brand-600 hover:bg-brand-50 border border-slate-100 hover:border-brand-200 transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePackage(pkg)}
                              className="p-1 rounded text-red-600 hover:bg-red-50 border border-slate-100 hover:border-red-200 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-white p-6 rounded-xl border border-slate-200 shadow-xl opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-brand-600" />
              {isEditMode ? "Edit Subscription Package" : "Add Subscription Package"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPackage} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Package Name</label>
                <input
                  type="text"
                  value={newPkgName}
                  onChange={(e) => setNewPkgName(e.target.value)}
                  placeholder="e.g. Premium Resto"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Package Type</label>
                <select
                  value={newPkgType}
                  onChange={(e) => setNewPkgType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="Resto">Resto (Restaurant)</option>
                  <option value="Customer">Customer (User)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Marked Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPkgMarkedPrice}
                  onChange={(e) => setNewPkgMarkedPrice(sanitizeDecimalInput(e.target.value))}
                  onKeyDown={preventInvalidNumberKeys}
                  inputMode="decimal"
                  placeholder="149.00"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                />
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPkgPrice}
                  onChange={(e) => setNewPkgPrice(sanitizeDecimalInput(e.target.value))}
                  onKeyDown={preventInvalidNumberKeys}
                  inputMode="decimal"
                  placeholder="99.00"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                />
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Duration</label>
                <input
                  type="number"
                  min="1"
                  value={newPkgDuration}
                  onChange={(e) => setNewPkgDuration(e.target.value)}
                  placeholder="30"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                />
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                <select
                  value={newPkgDurationUnit}
                  onChange={(e) => setNewPkgDurationUnit(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option>Days</option>
                  <option>Months</option>
                  <option>Years</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Package Photo / Banner</label>
                {!newPkgImage ? (
                  <label className="flex flex-col items-center justify-center w-full h-20 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col items-center justify-center py-2">
                      <svg className="w-5 h-5 text-slate-400 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-[10px] text-slate-500 font-medium">Click to upload photo</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setNewPkgImageFile(file);
                        setNewPkgImage(URL.createObjectURL(file));
                      }}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative w-full h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={newPkgImage} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setNewPkgImage(null);
                        setNewPkgImageFile(null);
                      }}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow transition-colors cursor-pointer"
                      title="Remove image"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={newPkgDescription}
                  onChange={(e) => setNewPkgDescription(e.target.value)}
                  placeholder="e.g. Premium all-in-one restaurant operations plan..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none h-20"
                  required
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Plan Points</h4>
                  <p className="text-[11px] text-slate-500">Add icon + text points to show on user subscription cards.</p>
                </div>
                <button
                  type="button"
                  onClick={addFeature}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Point
                </button>
              </div>

              <div className="space-y-3">
                {newPkgFeatures.map((feature, index) => (
                  <div key={`feature-${index}`} className="grid grid-cols-[120px_1fr_auto] gap-3 items-center">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Icon</label>
                      <div className="relative">
                        <select
                          value={feature.icon}
                          onChange={(e) => updateFeature(index, "icon", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-12 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          {FEATURE_ICON_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                          <FeatureIconPreview icon={feature.icon} className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Point Text</label>
                      <input
                        type="text"
                        value={feature.text}
                        onChange={(e) => updateFeature(index, "text", e.target.value)}
                        placeholder="e.g. Unlimited free deliveries"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      disabled={newPkgFeatures.length <= 1}
                      className="mt-5 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Remove point"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold text-slate-800 mb-3">
                {newPkgType === "Resto" ? "Restaurant Benefits" : "Customer Free Delivery Options"}
              </h4>

              {newPkgType === "Resto" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Restaurant Subscription Benefit Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs font-medium transition-all ${restoBenefitType === "commission_reduction" ? "border-brand-500 bg-brand-50/20 text-brand-900 shadow-sm" : "border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
                        <input
                          type="radio"
                          name="restoBenefitType"
                          value="commission_reduction"
                          checked={restoBenefitType === "commission_reduction"}
                          onChange={(e) => setRestoBenefitType(e.target.value)}
                          className="w-3.5 h-3.5 text-brand-600 border-slate-300 focus:ring-brand-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span>Pay Less Commission</span>
                          <span className="text-[10px] text-slate-500 font-normal">Discounted commission rate</span>
                        </div>
                      </label>

                      <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-xs font-medium transition-all ${restoBenefitType === "priority_listing" ? "border-brand-500 bg-brand-50/20 text-brand-900 shadow-sm" : "border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
                        <input
                          type="radio"
                          name="restoBenefitType"
                          value="priority_listing"
                          checked={restoBenefitType === "priority_listing"}
                          onChange={(e) => setRestoBenefitType(e.target.value)}
                          className="w-3.5 h-3.5 text-brand-600 border-slate-300 focus:ring-brand-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span>Show on Top (SEO)</span>
                          <span className="text-[10px] text-slate-500 font-normal">Priority zone visibility boost</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {restoBenefitType === "commission_reduction" ? (
                    <div className="mt-2 animate-[fadeIn_0.2s_ease-out]">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Commission Rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(e.target.value)}
                        placeholder="e.g. 5"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        required={restoBenefitType === "commission_reduction"}
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Define the custom reduced commission fee rate that applies to this restaurant tier.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-[11px] text-emerald-800 leading-relaxed animate-[fadeIn_0.2s_ease-out]">
                      ✨ <strong>SEO visibility boost enabled:</strong> Restaurants buying this plan will automatically rank at the top of restaurant listings for customers inside their respective zones for the duration of the subscription ({newPkgDuration || "X"} {newPkgDurationUnit || "Days"}).
                    </div>
                  )}
                </div>
              )}

              {newPkgType === "Customer" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Free Delivery Option</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                        <input
                          type="radio"
                          name="freeDeliveryType"
                          value="unlimited"
                          checked={freeDeliveryType === "unlimited"}
                          onChange={(e) => setFreeDeliveryType(e.target.value)}
                          className="w-3.5 h-3.5 text-brand-600 border-slate-300 focus:ring-brand-500"
                        />
                        <span>Unlimited</span>
                      </label>

                      <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                        <input
                          type="radio"
                          name="freeDeliveryType"
                          value="capped"
                          checked={freeDeliveryType === "capped"}
                          onChange={(e) => setFreeDeliveryType(e.target.value)}
                          className="w-3.5 h-3.5 text-brand-600 border-slate-300 focus:ring-brand-500"
                        />
                        <span>Capped</span>
                      </label>
                    </div>
                  </div>

                  {freeDeliveryType === "capped" && (
                    <div className="mt-2 animate-[fadeIn_0.2s_ease-out]">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Max Free Deliveries Count</label>
                      <input
                        type="number"
                        min="1"
                        value={maxFreeDeliveries}
                        onChange={(e) => setMaxFreeDeliveries(e.target.value)}
                        placeholder="e.g. 10 free deliveries"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        required={freeDeliveryType === "capped"}
                      />
                    </div>
                  )}

                  <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg text-[11px] text-blue-800 leading-relaxed mt-2">
                    ℹ️ <strong>Validity Note:</strong> These free delivery benefits are bound directly to the subscription's duration/time. They will automatically expire when the subscription ends.
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleModalOpenChange(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-all shadow-md cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (isEditMode ? "Updating..." : "Adding...") : (isEditMode ? "Update Package" : "Add Package")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverviewCard({ title, amount, previous, bgColor, icon: Icon }) {
  return (
    <div className={`${bgColor} rounded-xl px-5 py-4 flex items-center gap-4 shadow-sm border border-slate-100/60`}>
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-sm text-brand-600 shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-0.5">{title}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-slate-900">{amount}</span>
          <span className="text-[11px] font-semibold text-slate-400">{previous}</span>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center w-11 h-6 rounded-full border transition-all ${
        enabled
          ? "bg-brand-600 border-brand-600 justify-end cursor-pointer"
          : "bg-slate-200 border-slate-300 justify-start cursor-pointer"
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );
}
