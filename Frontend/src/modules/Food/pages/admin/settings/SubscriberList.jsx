import { useEffect, useMemo, useState } from "react";
import { Search, Download, ChevronDown, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu";
import { adminAPI } from "@food/api";

const formatCurrency = (value) => `₹ ${Number(value || 0).toFixed(2)}`;

const formatExpiryDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDaysLeft = (value, status) => {
  const days = Number(value || 0);
  if (String(status || "").toLowerCase() !== "active") return "Expired";
  if (days <= 0) return "Ends today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
};

const getStatusLabel = (status) => {
  if (String(status || "").toLowerCase() === "active") return "Active";
  if (String(status || "").toLowerCase() === "expired") return "Expired";
  if (String(status || "").toLowerCase() === "cancelled") return "Cancelled";
  return "Unknown";
};

export default function SubscriberList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("resto");
  const [zoneFilter, setZoneFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
  });
  const [zones, setZones] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchSubscribers = async () => {
      try {
        setLoading(true);
        const response = await adminAPI.getSubscriptionSubscribers({
          type: activeTab === "resto" ? "Resto" : "Customer",
          search: searchQuery.trim(),
          ...(activeTab === "resto" && zoneFilter ? { zoneId: zoneFilter } : {}),
        });

        if (!isMounted) return;

        setRows(response?.data?.data?.subscribers || []);
        setSummary(
          response?.data?.data?.summary || {
            totalSubscriptions: 0,
            activeSubscriptions: 0,
            totalRevenue: 0,
          },
        );
        setZones(response?.data?.data?.zones || []);
      } catch (error) {
        if (!isMounted) return;
        setRows([]);
        setSummary({
          totalSubscriptions: 0,
          activeSubscriptions: 0,
          totalRevenue: 0,
        });
        setZones([]);
        console.error("Failed to load subscription subscribers", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSubscribers();

    return () => {
      isMounted = false;
    };
  }, [activeTab, searchQuery, zoneFilter]);

  const filteredRows = useMemo(() => rows, [rows]);

  const handleExport = (format) => {
    if (!filteredRows.length) {
      alert("No data to export");
      return;
    }
    console.log(`Exporting as ${format}`, filteredRows);
  };

  const resetTab = (tab) => {
    setActiveTab(tab);
    setSearchQuery("");
    setZoneFilter("");
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <span>👥</span>
          <span>{activeTab === "resto" ? "Subscribed Restaurant List" : "Subscribed Customer List"}</span>
        </h1>

        {activeTab === "resto" && (
          <div className="relative">
            <select
              value={zoneFilter}
              onChange={(event) => setZoneFilter(event.target.value)}
              className="pl-3 pr-8 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 appearance-none"
            >
              <option value="">All Zones</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label}
                </option>
              ))}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
              ▼
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <StatsCard
          title={activeTab === "resto" ? "Total Restaurant Subscriptions" : "Total Customer Subscriptions"}
          value={summary.totalSubscriptions}
          subtext="Total package subscriptions"
          icon="👥"
          bg="bg-sky-50/60"
          border="border-sky-100"
          textColor="text-sky-800"
        />
        <StatsCard
          title="Active Subscriptions"
          value={summary.activeSubscriptions}
          subtext="Currently active plans"
          icon="✅"
          bg="bg-emerald-50/60"
          border="border-emerald-100"
          textColor="text-emerald-800"
        />
        <StatsCard
          title="Total Earning"
          value={formatCurrency(summary.totalRevenue)}
          subtext={activeTab === "resto" ? "Cumulative B2B revenue" : "Cumulative B2C pass sales"}
          icon="₹"
          bg="bg-purple-50/60"
          border="border-purple-100"
          textColor="text-purple-800"
        />
      </div>

      <div className="flex border-b border-slate-200 mb-4 gap-6 bg-white p-3 rounded-lg shadow-sm border border-slate-200/60">
        <button
          onClick={() => resetTab("resto")}
          className={`pb-2.5 text-xs font-bold transition-all relative px-1 cursor-pointer ${activeTab === "resto" ? "text-brand-600" : "text-slate-500 hover:text-slate-800"}`}
        >
          Restaurant Subscriptions
          {activeTab === "resto" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600 rounded-full"></span>
          )}
        </button>
        <button
          onClick={() => resetTab("customer")}
          className={`pb-2.5 text-xs font-bold transition-all relative px-1 cursor-pointer ${activeTab === "customer" ? "text-brand-600" : "text-slate-500 hover:text-slate-800"}`}
        >
          Customer Subscriptions
          {activeTab === "customer" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600 rounded-full"></span>
          )}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {activeTab === "resto" ? "Restaurant Subscribers" : "Customer Subscribers"}
            </h2>
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 px-2">
              {filteredRows.length}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder={activeTab === "resto" ? "Search by restaurant name" : "Search by customer name"}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-4 py-2.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all cursor-pointer">
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                <DropdownMenuLabel className="text-xs">Export Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer text-xs">Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer text-xs">Export as Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer text-xs">Export as PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")} className="cursor-pointer text-xs">Export as JSON</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50 border-b border-slate-200">
              {activeTab === "resto" ? (
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">SI</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Restaurant Info</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Zone</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Package Details</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Benefit Type</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pricing</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">End Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Days Left</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">SI</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer Info</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Package Details</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Free Delivery Benefit</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pricing</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">End Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Days Left</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              )}
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={activeTab === "resto" ? 11 : 10} className="px-6 py-8 text-center text-xs text-slate-500">
                    Loading subscribers...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === "resto" ? 11 : 10} className="px-6 py-8 text-center text-xs text-slate-500">
                    No subscribers found
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => {
                  const statusLabel = getStatusLabel(row.status);
                  const statusBadge =
                    statusLabel === "Active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : "bg-rose-50 text-rose-700 border-rose-100";

                  if (activeTab === "resto") {
                    return (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                              {row.image ? (
                                <img src={row.image} alt={row.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[11px] font-bold text-slate-500">{row.name?.slice(0, 2)?.toUpperCase() || "R"}</span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900">{row.name}</span>
                              <span className="text-[10px] text-slate-500 font-medium">{row.phone || "N/A"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-700">{row.zoneLabel || "N/A"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-950 font-semibold">{row.packageName}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {row.restoBenefitType === "commission_reduction" ? (
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">📉 {row.commissionRate}% Commission</span>
                          ) : (
                            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">⭐ Priority Listing</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-900 font-medium">{row.price}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-900">{formatExpiryDate(row.purchaseDate)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-900">{formatExpiryDate(row.expiryDate)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-900">{formatDaysLeft(row.daysLeft, row.status)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusBadge}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-xs">
                          <button className="p-1.5 rounded text-brand-600 hover:bg-brand-50 border border-slate-100 hover:border-brand-200 transition-colors cursor-default" title="Live subscriber">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                            {row.image ? (
                              <img src={row.image} alt={row.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[11px] font-bold text-slate-500">{row.name?.slice(0, 2)?.toUpperCase() || "U"}</span>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900">{row.name}</span>
                            <span className="text-[10px] text-slate-500 font-medium">{row.phone || "N/A"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-950 font-semibold">{row.packageName}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {row.freeDeliveryType === "unlimited" ? (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">🚚 Unlimited Free Delivery</span>
                        ) : (
                          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">📦 Capped ({row.usageLabel || `0/${row.maxFreeDeliveries || 0}`})</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-900 font-medium">{row.price}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-900">{formatExpiryDate(row.purchaseDate)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-900">{formatExpiryDate(row.expiryDate)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-900">{formatDaysLeft(row.daysLeft, row.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusBadge}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-xs">
                        <button className="p-1.5 rounded text-brand-600 hover:bg-brand-50 border border-slate-100 hover:border-brand-200 transition-colors cursor-default" title="Live subscriber">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, subtext, icon, bg, border, textColor }) {
  return (
    <div className={`p-4 rounded-xl border ${border} ${bg} shadow-sm flex items-center justify-between transition-all duration-350 hover:shadow-md`}>
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block">
          {title}
        </span>
        <div className="text-xl font-extrabold text-slate-900">
          {value}
        </div>
        <span className="text-[10px] text-slate-500 font-medium block">
          {subtext}
        </span>
      </div>
      <div className={`w-10 h-10 rounded-full bg-white/90 shadow-sm border border-white/50 flex items-center justify-center font-bold text-base ${textColor} shrink-0`}>
        {icon}
      </div>
    </div>
  );
}
