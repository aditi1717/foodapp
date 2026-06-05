import { useMemo, useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Search, Loader2, RefreshCw, Users, Store } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu";
import {
  exportReportsToCSV,
  exportReportsToExcel,
  exportReportsToJSON,
  exportReportsToPDF,
} from "@food/components/admin/reports/reportsExportUtils";
import { adminAPI } from "@food/api";
import { toast } from "sonner";

const formatCurrency = (value) =>
  `₹ ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
};

const getBenefitLabel = (subscriber) => {
  if (subscriber.ownerType === "RESTAURANT" || subscriber.ownerType === "resto") {
    if (subscriber.restoBenefitType === "commission_reduction") {
      return subscriber.commissionRate != null
        ? `${subscriber.commissionRate}% Commission Reduction`
        : "Commission Reduction";
    }
    if (subscriber.restoBenefitType === "priority_listing") return "Priority Listing";
    return subscriber.restoBenefitType || "—";
  }
  // Customer
  if (subscriber.freeDeliveryType === "unlimited") return "Unlimited Free Delivery";
  if (subscriber.freeDeliveryType === "capped") {
    return subscriber.maxFreeDeliveries
      ? `${subscriber.maxFreeDeliveries} Free Deliveries`
      : "Capped Free Deliveries";
  }
  return subscriber.freeDeliveryType || "—";
};

const tabConfig = {
  resto: {
    title: "Restaurant Subscription Report",
    listTitle: "Restaurant Subscription History",
    emptyLabel: "No restaurant subscription records found",
    searchPlaceholder: "Search by restaurant name or package",
    entityLabel: "Restaurant",
    columnEntity: "Restaurant Name",
    columnBenefit: "Benefit Type",
    exportName: "restaurant_subscription_report",
    exportTitle: "Restaurant Subscription Report",
    totalLabel: "Total Restaurant Revenue",
    periodYearLabel: "Restaurant Revenue This Year",
    periodMonthLabel: "Restaurant Revenue This Month",
    periodWeekLabel: "Restaurant Revenue This Week",
    totalSubtext: "B2B subscription collection",
    apiType: "resto",
  },
  customer: {
    title: "Customer Subscription Report",
    listTitle: "Customer Subscription History",
    emptyLabel: "No customer subscription records found",
    searchPlaceholder: "Search by customer name or package",
    entityLabel: "Customer",
    columnEntity: "Customer Name",
    columnBenefit: "Free Delivery Benefit",
    exportName: "customer_subscription_report",
    exportTitle: "Customer Subscription Report",
    totalLabel: "Total Customer Revenue",
    periodYearLabel: "Customer Revenue This Year",
    periodMonthLabel: "Customer Revenue This Month",
    periodWeekLabel: "Customer Revenue This Week",
    totalSubtext: "B2C subscription collection",
    apiType: "customer",
  },
};

const isThisYear = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear();
};

const isThisMonth = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

const isThisWeek = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
};

const timeFilters = ["All", "This Year", "This Month", "This Week"];
const PAGE_SIZE = 10;

export default function SubscriptionReport() {
  const [activeTab, setActiveTab] = useState("resto");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [packageFilter, setPackageFilter] = useState("All");
  const [zoneFilter, setZoneFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [subscribers, setSubscribers] = useState([]);
  const [summary, setSummary] = useState({ totalSubscriptions: 0, activeSubscriptions: 0, totalRevenue: 0 });
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentTab = tabConfig[activeTab];

  const fetchSubscribers = useCallback(async (tabType) => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminAPI.getSubscriptionSubscribers({ type: tabType });
      if (response?.data?.success && response.data.data) {
        const { subscribers: subs = [], summary: sum = {}, zones: zoneList = [] } = response.data.data;
        setSubscribers(subs);
        setSummary(sum);
        setZones(zoneList);
      } else {
        setSubscribers([]);
        setSummary({ totalSubscriptions: 0, activeSubscriptions: 0, totalRevenue: 0 });
        setZones([]);
      }
    } catch (err) {
      console.error("Failed to fetch subscription subscribers:", err);
      setError("Failed to load subscription data. Please try again.");
      toast.error("Failed to load subscription data");
      setSubscribers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscribers(currentTab.apiType);
  }, [activeTab, fetchSubscribers, currentTab.apiType]);

  // Derived package options from real data
  const packageOptions = useMemo(() => {
    const names = [...new Set(subscribers.map((s) => s.packageName).filter(Boolean))];
    return names;
  }, [subscribers]);

  // Filtered revenue — recomputed whenever filters change (via filteredSubscriptions)
  // NOTE: filteredRevenue is computed inside the render from filteredSubscriptions (defined below).

  const filteredSubscriptions = useMemo(() => {
    let result = [...subscribers];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          String(s.name || "").toLowerCase().includes(query) ||
          String(s.packageName || "").toLowerCase().includes(query) ||
          String(s.phone || "").toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "All") {
      result = result.filter((s) => s.status === statusFilter.toLowerCase());
    }

    // Package filter
    if (packageFilter !== "All") {
      result = result.filter((s) => s.packageName === packageFilter);
    }

    // Zone filter (only for restaurant tab)
    if (activeTab === "resto" && zoneFilter !== "All") {
      result = result.filter((s) => s.zoneId === zoneFilter);
    }

    // Time filter based on purchaseDate
    if (timeFilter === "This Year") {
      result = result.filter((s) => isThisYear(s.purchaseDate));
    } else if (timeFilter === "This Month") {
      result = result.filter((s) => isThisMonth(s.purchaseDate));
    } else if (timeFilter === "This Week") {
      result = result.filter((s) => isThisWeek(s.purchaseDate));
    }

    return result;
  }, [subscribers, searchQuery, statusFilter, packageFilter, zoneFilter, activeTab, timeFilter]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchQuery("");
    setTimeFilter("All");
    setStatusFilter("All");
    setPackageFilter("All");
    setZoneFilter("All");
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setStatusFilter("All");
    setPackageFilter("All");
    setZoneFilter("All");
    setTimeFilter("All");
    setSearchQuery("");
    setCurrentPage(1);
  };

  // Reset to page 1 whenever filters or search change
  const handleSearchChange = (val) => { setSearchQuery(val); setCurrentPage(1); };
  const handleStatusChange = (val) => { setStatusFilter(val); setCurrentPage(1); };
  const handlePackageChange = (val) => { setPackageFilter(val); setCurrentPage(1); };
  const handleZoneChange = (val) => { setZoneFilter(val); setCurrentPage(1); };
  const handleTimeFilterChange = (val) => { setTimeFilter(val); setCurrentPage(1); };

  const handleExport = (format) => {
    if (filteredSubscriptions.length === 0) {
      toast.warning("No data to export");
      return;
    }

    const exportData = filteredSubscriptions.map((s) => ({
      ...s,
      benefitLabel: getBenefitLabel(s),
      purchaseDateFormatted: formatDate(s.purchaseDate),
      expiryDateFormatted: formatDate(s.expiryDate),
      priceFormatted: s.price || formatCurrency(s.priceValue),
    }));

    const headers = [
      { key: "name", label: currentTab.columnEntity },
      { key: "packageName", label: "Package Name" },
      { key: "benefitLabel", label: currentTab.columnBenefit },
      { key: "duration", label: "Duration" },
      { key: "priceFormatted", label: "Pricing" },
      { key: "status", label: "Status" },
      { key: "purchaseDateFormatted", label: "Purchase Date" },
      { key: "expiryDateFormatted", label: "Expiry Date" },
      { key: "daysLeft", label: "Days Left" },
      ...(activeTab === "resto" ? [{ key: "zoneLabel", label: "Zone" }] : []),
    ];

    switch (format) {
      case "csv":
        exportReportsToCSV(exportData, headers, currentTab.exportName);
        break;
      case "excel":
        exportReportsToExcel(exportData, headers, currentTab.exportName);
        break;
      case "pdf":
        exportReportsToPDF(exportData, headers, currentTab.exportName, currentTab.exportTitle);
        break;
      case "json":
        exportReportsToJSON(exportData, currentTab.exportName);
        break;
      default:
        break;
    }
  };

  const activeFiltersCount =
    (statusFilter !== "All" ? 1 : 0) +
    (packageFilter !== "All" ? 1 : 0) +
    (activeTab === "resto" && zoneFilter !== "All" ? 1 : 0) +
    (timeFilter !== "All" ? 1 : 0);

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filteredSubscriptions.length / PAGE_SIZE));
  const pagedSubscriptions = filteredSubscriptions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 p-4 lg:p-6">
      <div className="w-full max-w-full">
        {/* Header */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 lg:text-2xl">
            <span>Subscription Report</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View customer and restaurant subscription transactions in separate tabs.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-6 rounded-lg border border-slate-200/60 bg-white p-3 shadow-sm">
          <button
            onClick={() => handleTabChange("resto")}
            className={`relative cursor-pointer px-1 pb-2.5 text-xs font-bold transition-all ${
              activeTab === "resto" ? "text-brand-600" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5" />
              Restaurant Subscriptions
            </span>
            {activeTab === "resto" && (
              <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-brand-600" />
            )}
          </button>
          <button
            onClick={() => handleTabChange("customer")}
            className={`relative cursor-pointer px-1 pb-2.5 text-xs font-bold transition-all ${
              activeTab === "customer" ? "text-brand-600" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Customer Subscriptions
            </span>
            {activeTab === "customer" && (
              <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-brand-600" />
            )}
          </button>
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              <p className="text-sm text-slate-500">Loading subscription data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white shadow-sm">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => fetchSubscribers(currentTab.apiType)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Single Revenue Card — reflects current filters */}
            {(() => {
              const filteredRevenue = filteredSubscriptions.reduce((sum, s) => sum + Number(s.priceValue || 0), 0);
              const filteredActive = filteredSubscriptions.filter((s) => s.status === "active").length;
              return (
                <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Total Revenue */}
                  <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-5 py-4 shadow-sm">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {currentTab.totalLabel}
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900">{formatCurrency(filteredRevenue)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{currentTab.totalSubtext}</p>
                  </div>
                  {/* Total Subscribers */}
                  <div className="rounded-xl border border-purple-100 bg-purple-50/60 px-5 py-4 shadow-sm">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Subscribers</p>
                    <p className="text-2xl font-extrabold text-slate-900">{filteredSubscriptions.length}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Matching current filters</p>
                  </div>
                  {/* Active */}
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-5 py-4 shadow-sm">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Subscribers</p>
                    <p className="text-2xl font-extrabold text-emerald-600">{filteredActive}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Currently active plans</p>
                  </div>
                </div>
              );
            })()}

            {/* Filters */}
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">Filter Reports</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  Filters {activeFiltersCount}
                </span>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex flex-1 flex-wrap gap-3">
                  {/* Status Filter */}
                  <SelectFilter
                    label="Status"
                    value={statusFilter}
                    options={["All", "Active", "Expired", "Cancelled"]}
                    onChange={handleStatusChange}
                  />

                  {/* Package Filter */}
                  <SelectFilter
                    label="Package"
                    value={packageFilter}
                    options={["All", ...packageOptions]}
                    onChange={handlePackageChange}
                  />

                  {/* Zone Filter - only for restaurants */}
                  {activeTab === "resto" && zones.length > 0 && (
                    <SelectFilter
                      label="Zone"
                      value={zoneFilter}
                      options={["All", ...zones.map((z) => z.id)]}
                      optionLabels={["All Zones", ...zones.map((z) => z.label)]}
                      onChange={handleZoneChange}
                    />
                  )}
                </div>

                <button
                  onClick={handleResetFilters}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset
                </button>
              </div>
            </div>

            {/* Time Filter Tabs */}
            <div className="mb-4 flex gap-6 rounded-lg border border-slate-200/60 bg-white p-3 shadow-sm">
              {timeFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => handleTimeFilterChange(filter)}
                  className={`relative cursor-pointer px-1 pb-2.5 text-xs font-bold transition-all ${
                    timeFilter === filter ? "text-brand-600" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {filter === "All" ? "All Transactions" : filter}
                  {timeFilter === filter && (
                    <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-brand-600" />
                  )}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">{currentTab.listTitle}</h2>
                  <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-700">
                    {filteredSubscriptions.length}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                    <input
                      type="text"
                      placeholder={currentTab.searchPlaceholder}
                      value={searchQuery}
                      onChange={(event) => handleSearchChange(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50">
                        <Download className="h-4 w-4" />
                        <span>Export</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-50 w-52 rounded-lg border border-slate-200 bg-white shadow-lg">
                      <DropdownMenuLabel className="text-xs">Export Format</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer text-xs">
                        Export as CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer text-xs">
                        Export as Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer text-xs">
                        Export as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("json")} className="cursor-pointer text-xs">
                        Export as JSON
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">SI</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Transaction ID</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{currentTab.columnEntity}</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Package Name</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{currentTab.columnBenefit}</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Duration</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Pricing</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Purchase Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {pagedSubscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-xs text-slate-500">
                          {currentTab.emptyLabel}
                        </td>
                      </tr>
                    ) : (
                      pagedSubscriptions.map((sub, index) => (
                        <tr key={sub.id} className="transition-colors hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-900">
                            {(currentPage - 1) * PAGE_SIZE + index + 1}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              title={sub.transactionId || sub.id}
                              className="block max-w-[160px] truncate font-mono text-xs font-bold text-slate-900"
                            >
                              {sub.transactionId || sub.id || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {sub.image ? (
                                <img
                                  src={sub.image}
                                  alt={sub.name}
                                  className="h-7 w-7 rounded-full object-cover"
                                  onError={(e) => { e.target.style.display = "none"; }}
                                />
                              ) : (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                                  {String(sub.name || "?").charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="whitespace-nowrap text-xs font-bold text-slate-900">{sub.name}</p>
                                {sub.phone && <p className="text-[10px] text-slate-600">{sub.phone}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-900">{sub.packageName}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-900">{getBenefitLabel(sub)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-900">{sub.duration}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-extrabold text-slate-900">
                            {sub.price || formatCurrency(sub.priceValue)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <StatusBadge status={sub.status} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-900">{formatDate(sub.purchaseDate)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500">
                    Showing{" "}
                    <span className="font-semibold text-slate-900">
                      {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredSubscriptions.length)}
                    </span>
                    {" "}–{" "}
                    <span className="font-semibold text-slate-900">
                      {Math.min(currentPage * PAGE_SIZE, filteredSubscriptions.length)}
                    </span>
                    {" "}of{" "}
                    <span className="font-semibold text-slate-900">{filteredSubscriptions.length}</span>
                    {" "}results
                  </p>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 2) return true;
                        return false;
                      })
                      .reduce((acc, page, idx, arr) => {
                        if (idx > 0 && page - arr[idx - 1] > 1) {
                          acc.push("...");
                        }
                        acc.push(page);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === "..." ? (
                          <span key={`ellipsis-${idx}`} className="flex h-8 w-8 items-center justify-center text-xs text-slate-400">
                            …
                          </span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => setCurrentPage(item)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-all ${
                              currentPage === item
                                ? "border-brand-500 bg-brand-500 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    active: "border-green-100 bg-green-50 text-green-700",
    expired: "border-red-100 bg-red-50 text-red-700",
    cancelled: "border-slate-100 bg-slate-50 text-slate-600",
  };
  const label = {
    active: "Active",
    expired: "Expired",
    cancelled: "Cancelled",
  };
  const cls = cfg[status] || "border-slate-100 bg-slate-50 text-slate-600";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>
      {label[status] || status}
    </span>
  );
}

function SelectFilter({ label, value, options, optionLabels, onChange }) {
  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 sm:w-48"
      >
        {options.map((option, i) => (
          <option key={option} value={option}>
            {optionLabels ? optionLabels[i] : option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute bottom-2.5 right-2.5 h-3.5 w-3.5 text-slate-400" />
    </div>
  );
}
