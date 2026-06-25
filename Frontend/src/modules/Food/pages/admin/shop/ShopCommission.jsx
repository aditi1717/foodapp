import { useEffect, useMemo, useState } from "react"
import { Search, Plus, Edit, Trash2, ArrowUpDown, Loader2, Building2 } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { adminAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { toast } from "sonner"

const EMPTY_BULK_COMMISSION = {
  enabled: false,
  type: "percentage",
  value: "10",
}

const getDefaultFormData = () => ({
  shopId: "",
  defaultCommission: {
    type: "percentage",
    value: "10",
  },
  bulkOrderCommission: { ...EMPTY_BULK_COMMISSION },
})

const normalizeBulkCommissionForForm = (bulkOrderCommission) => {
  if (!bulkOrderCommission) {
    return { ...EMPTY_BULK_COMMISSION }
  }

  return {
    enabled: true,
    type: bulkOrderCommission?.type || "percentage",
    value: bulkOrderCommission?.value?.toString() || "10",
  }
}

export default function ShopCommission() {
  const [searchQuery, setSearchQuery] = useState("")
  const [commissions, setCommissions] = useState([])
  const [approvedShops, setApprovedShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isAddEditOpen, setIsAddEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isShopSelectOpen, setIsShopSelectOpen] = useState(false)
  const [selectedCommission, setSelectedCommission] = useState(null)
  const [selectedShop, setSelectedShop] = useState(null)
  const [formData, setFormData] = useState(getDefaultFormData)
  const [formErrors, setFormErrors] = useState({})
  const [visibleColumns] = useState({
    si: true,
    shop: true,
    shopId: true,
    defaultCommission: true,
    bulkOrderCommission: true,
    activeCommission: true,
    status: true,
    actions: true,
  })

  const filteredCommissions = useMemo(() => {
    if (!searchQuery.trim()) {
      return commissions
    }

    const query = searchQuery.toLowerCase().trim()
    return commissions.filter((commission) =>
      commission.shopName?.toLowerCase().includes(query) ||
      commission.shopId?.toLowerCase().includes(query) ||
      commission.shop?.name?.toLowerCase().includes(query)
    )
  }, [commissions, searchQuery])

  const filteredShops = useMemo(() => {
    if (!searchQuery.trim()) {
      return approvedShops
    }

    const query = searchQuery.toLowerCase().trim()
    return approvedShops.filter((shop) =>
      shop.name?.toLowerCase().includes(query) ||
      shop.shopId?.toLowerCase().includes(query) ||
      shop.ownerName?.toLowerCase().includes(query)
    )
  }, [approvedShops, searchQuery])

  useEffect(() => {
    fetchBootstrap()
  }, [])

  const fetchBootstrap = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getShopCommissionBootstrap()
      const data = response?.data?.data
      setCommissions(Array.isArray(data?.commissions) ? data.commissions : [])
      setApprovedShops(Array.isArray(data?.shops) ? data.shops : [])
    } catch (error) {
      if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
        toast.error(`Cannot connect to backend server. Please ensure the backend is running on ${API_BASE_URL.replace("/api", "")}`)
      } else {
        toast.error(error.response?.data?.message || "Failed to fetch commissions")
      }
      setCommissions([])
      setApprovedShops([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCommissions = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getShopCommissions({})

      let commissionsData = null
      if (response?.data?.success && response?.data?.data?.commissions) {
        commissionsData = response.data.data.commissions
      } else if (response?.data?.data?.commissions) {
        commissionsData = response.data.data.commissions
      } else if (response?.data?.commissions) {
        commissionsData = response.data.commissions
      }

      setCommissions(Array.isArray(commissionsData) ? commissionsData : [])
    } catch (error) {
      if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
        toast.error(`Cannot connect to backend server. Please ensure the backend is running on ${API_BASE_URL.replace("/api", "")}`)
      } else {
        toast.error(error.response?.data?.message || "Failed to fetch commissions")
      }
      setCommissions([])
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (commission) => {
    try {
      await adminAPI.toggleShopCommissionStatus(commission._id)
      await fetchCommissions()
      toast.success("Commission status updated successfully")
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status")
    }
  }

  const handleAdd = () => {
    setSelectedCommission(null)
    setSelectedShop(null)
    setFormData(getDefaultFormData())
    setFormErrors({})
    setIsShopSelectOpen(true)
  }

  const handleSelectShop = (shop) => {
    setSelectedShop(shop)
    setFormData((prev) => ({
      ...prev,
      shopId: shop._id,
    }))
    setIsShopSelectOpen(false)
    setIsAddEditOpen(true)
  }

  const handleEdit = async (commission) => {
    try {
      setLoading(true)
      const response = await adminAPI.getShopCommissionById(commission._id)

      let commissionData = null
      if (response?.data?.success && response?.data?.data?.commission) {
        commissionData = response.data.data.commission
      } else if (response?.data?.data?.commission) {
        commissionData = response.data.data.commission
      } else if (response?.data?.commission) {
        commissionData = response.data.commission
      }

      if (!commissionData) return

      setSelectedCommission(commissionData)
      setSelectedShop(commissionData.shop)

      let shopId = ""
      if (commissionData.shop) {
        if (typeof commissionData.shop === "object" && commissionData.shop._id) {
          shopId = commissionData.shop._id
        } else if (typeof commissionData.shop === "string") {
          shopId = commissionData.shop
        } else {
          shopId = commissionData.shopId || commissionData.shop?._id || ""
        }
      } else {
        shopId = commissionData.shopId || commissionData.shop || ""
      }

      setFormData({
        shopId,
        defaultCommission: {
          type: commissionData.defaultCommission?.type || "percentage",
          value: commissionData.defaultCommission?.value?.toString() || "10",
        },
        bulkOrderCommission: normalizeBulkCommissionForForm(commissionData.bulkOrderCommission),
      })
      setFormErrors({})
      setIsAddEditOpen(true)
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load commission")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (commission) => {
    setSelectedCommission(commission)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedCommission) return

    try {
      setDeleting(true)
      await adminAPI.deleteShopCommission(selectedCommission._id)
      await fetchCommissions()
      toast.success("Commission deleted successfully")
      setIsDeleteOpen(false)
      setSelectedCommission(null)
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete commission")
    } finally {
      setDeleting(false)
    }
  }

  const validateForm = () => {
    const errors = {}

    if (!formData.shopId) {
      errors.shopId = "Shop is required"
    }

    if (!formData.defaultCommission.value || parseFloat(formData.defaultCommission.value) < 0) {
      errors.defaultCommission = "Default commission value is required"
    }

    if (
      formData.defaultCommission.type === "percentage" &&
      (parseFloat(formData.defaultCommission.value) < 0 || parseFloat(formData.defaultCommission.value) > 100)
    ) {
      errors.defaultCommission = "Percentage must be between 0-100"
    }

    if (formData.bulkOrderCommission?.enabled) {
      if (!formData.bulkOrderCommission.value || parseFloat(formData.bulkOrderCommission.value) < 0) {
        errors.bulkOrderCommission = "Bulk order commission value is required"
      }

      if (
        formData.bulkOrderCommission.type === "percentage" &&
        (parseFloat(formData.bulkOrderCommission.value) < 0 || parseFloat(formData.bulkOrderCommission.value) > 100)
      ) {
        errors.bulkOrderCommission = "Percentage must be between 0-100"
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Please fix the errors in the form")
      return
    }

    try {
      setSaving(true)

      const payload = {
        shopId: formData.shopId,
        defaultCommission: {
          type: formData.defaultCommission.type,
          value: parseFloat(formData.defaultCommission.value),
        },
        bulkOrderCommission: formData.bulkOrderCommission?.enabled
          ? {
              type: formData.bulkOrderCommission.type,
              value: parseFloat(formData.bulkOrderCommission.value),
            }
          : null,
      }

      if (selectedCommission) {
        await adminAPI.updateShopCommission(selectedCommission._id, payload)
        toast.success("Commission updated successfully")
      } else {
        await adminAPI.createShopCommission(payload)
        toast.success("Commission created successfully")
      }

      await fetchCommissions()
      setIsAddEditOpen(false)
      setSelectedCommission(null)
      setSelectedShop(null)
      setFormData(getDefaultFormData())
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save commission")
    } finally {
      setSaving(false)
    }
  }

  const formatCommission = (commission) => {
    if (!commission) return "-"
    if (commission?.type === "percentage") return `${commission.value}%`
    return `\u20B9${commission.value}`
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Shop Commission</h1>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                {filteredCommissions.length}
              </span>
            </div>

            <button
              onClick={handleAdd}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Add Commission
            </button>
          </div>

          <div className="mb-4 flex items-center gap-3">
            <div className="relative min-w-[300px] flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder="Search by shop name or ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {visibleColumns.si && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        <div className="flex items-center gap-2">
                          <span>S.No</span>
                          <ArrowUpDown className="h-3 w-3 cursor-pointer text-slate-400 hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.shop && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        Shop Name
                      </th>
                    )}
                    {visibleColumns.shopId && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        Shop ID
                      </th>
                    )}
                    {visibleColumns.defaultCommission && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        Default Commission
                      </th>
                    )}
                    {visibleColumns.bulkOrderCommission && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        Bulk Order Commission
                      </th>
                    )}
                    {visibleColumns.activeCommission && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        Active Commission
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        Status
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredCommissions.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-6 py-8 text-center text-slate-500">
                        No commissions found
                      </td>
                    </tr>
                  ) : (
                    filteredCommissions.map((commission) => (
                      <tr key={commission._id} className="transition-colors hover:bg-slate-50">
                        {visibleColumns.si && (
                          <td className="whitespace-nowrap px-6 py-4">
                            <span className="text-sm font-medium text-slate-700">{commission.sl || "-"}</span>
                          </td>
                        )}
                        {visibleColumns.shop && (
                          <td className="whitespace-nowrap px-6 py-4">
                            <span className="text-sm font-medium text-brand-600">
                              {commission.shopName || commission.shop?.name || "-"}
                            </span>
                          </td>
                        )}
                        {visibleColumns.shopId && (
                          <td className="whitespace-nowrap px-6 py-4">
                            <span className="text-sm text-slate-700">{commission.shopId || "-"}</span>
                          </td>
                        )}
                        {visibleColumns.defaultCommission && (
                          <td className="whitespace-nowrap px-6 py-4">
                            <span className="text-sm font-medium text-slate-900">
                              {formatCommission(commission.defaultCommission)}
                            </span>
                          </td>
                        )}
                        {visibleColumns.bulkOrderCommission && (
                          <td className="whitespace-nowrap px-6 py-4">
                            <span className="text-sm font-medium text-slate-900">
                              {formatCommission(commission.bulkOrderCommission)}
                            </span>
                          </td>
                        )}
                        {visibleColumns.activeCommission && (
                          <td className="px-6 py-4">
                            {commission.activeCommission ? (
                              <div className="space-y-1">
                                <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                  {formatCommission(commission.activeCommission)}
                                </span>
                                <p className="text-[10px] text-slate-500">
                                  Via {commission.activeSubscription?.packageName || "subscription"}
                                </p>
                                <p className="text-[10px] font-medium text-amber-600">
                                  {Number(commission.activeSubscription?.daysLeft || 0) > 0
                                    ? `${commission.activeSubscription?.daysLeft} days left`
                                    : "Subscription ending soon"}
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="text-sm font-medium text-slate-500">No active subscription</span>
                                <p className="text-[10px] text-slate-400">Default commission applies</p>
                              </div>
                            )}
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="whitespace-nowrap px-6 py-4">
                            <button
                              onClick={() => handleToggleStatus(commission)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                                commission.status ? "bg-brand-600" : "bg-slate-300"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  commission.status ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="whitespace-nowrap px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEdit(commission)}
                                className="rounded p-1.5 text-brand-600 transition-colors hover:bg-brand-50"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(commission)}
                                className="rounded p-1.5 text-red-600 transition-colors hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isShopSelectOpen} onOpenChange={setIsShopSelectOpen}>
        <DialogContent className="max-w-xl bg-white p-0">
          <DialogHeader className="border-b border-slate-200 px-6 pb-4 pt-6">
            <DialogTitle className="text-lg font-semibold text-slate-900">Select Shop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search shops..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {filteredShops
                .filter((shop) => !shop.hasCommissionSetup)
                .map((shop) => (
                  <button
                    key={shop._id || shop.id}
                    onClick={() => handleSelectShop(shop)}
                    className="w-full rounded-lg border border-slate-200 p-3 text-left transition-all hover:border-brand-300 hover:bg-brand-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{shop.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{shop.shopId}</p>
                      </div>
                      <Building2 className="h-4 w-4 text-slate-400" />
                    </div>
                  </button>
                ))}
              {filteredShops.filter((shop) => !shop.hasCommissionSetup).length === 0 && (
                <p className="py-4 text-center text-sm text-slate-500">No shops available</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto bg-white p-0">
          <DialogHeader className="border-b border-slate-200 px-6 pb-4 pt-6">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              {selectedCommission ? "Edit Shop Commission" : "Add Shop Commission"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            {selectedShop && (
              <div className="rounded-lg border border-brand-100 bg-brand-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{selectedShop.name}</p>
                <p className="mt-0.5 text-xs text-slate-600">{selectedShop.shopId}</p>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Default Commission <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={formData.defaultCommission.type}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      defaultCommission: { ...prev.defaultCommission, type: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="amount">Fixed Amount</option>
                </select>
                <div>
                  <input
                    type="number"
                    step={formData.defaultCommission.type === "percentage" ? "0.1" : "0.01"}
                    value={formData.defaultCommission.value}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        defaultCommission: { ...prev.defaultCommission, value: e.target.value },
                      }))
                    }
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      formErrors.defaultCommission ? "border-red-500" : "border-slate-300"
                    }`}
                    placeholder={formData.defaultCommission.type === "percentage" ? "e.g., 10" : "e.g., 5.00"}
                  />
                  {formErrors.defaultCommission && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.defaultCommission}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Bulk Order Commission</label>
                  <p className="mt-1 text-xs text-slate-500">
                    Enable a separate commission for bulk orders. If disabled, default commission will be used.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      bulkOrderCommission: prev.bulkOrderCommission?.enabled
                        ? { ...EMPTY_BULK_COMMISSION }
                        : {
                            enabled: true,
                            type: prev.bulkOrderCommission?.type || "percentage",
                            value: prev.bulkOrderCommission?.value || "10",
                          },
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                    formData.bulkOrderCommission?.enabled ? "bg-brand-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.bulkOrderCommission?.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {formData.bulkOrderCommission?.enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={formData.bulkOrderCommission.type}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        bulkOrderCommission: { ...prev.bulkOrderCommission, type: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="amount">Fixed Amount</option>
                  </select>
                  <div>
                    <input
                      type="number"
                      step={formData.bulkOrderCommission.type === "percentage" ? "0.1" : "0.01"}
                      value={formData.bulkOrderCommission.value}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          bulkOrderCommission: { ...prev.bulkOrderCommission, value: e.target.value },
                        }))
                      }
                      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                        formErrors.bulkOrderCommission ? "border-red-500" : "border-slate-300"
                      }`}
                      placeholder={formData.bulkOrderCommission.type === "percentage" ? "e.g., 8" : "e.g., 15.00"}
                    />
                    {formErrors.bulkOrderCommission && (
                      <p className="mt-1 text-xs text-red-500">{formErrors.bulkOrderCommission}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              onClick={() => setIsAddEditOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {selectedCommission ? "Update" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Delete Shop Commission</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete commission for "{selectedCommission?.shopName || selectedCommission?.shop?.name}"? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsDeleteOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
