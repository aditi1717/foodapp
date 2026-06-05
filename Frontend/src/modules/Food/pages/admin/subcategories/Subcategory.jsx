import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  BadgeCheck,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload
} from "lucide-react"
import { adminAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const approvalBadgeClass = (status) => {
  const value = String(status || "pending").toLowerCase()
  if (value === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (value === "rejected") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

export default function Subcategory() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [subcategories, setSubcategories] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const adminToken = localStorage.getItem("admin_accessToken")
    if (!adminToken) {
      toast.error("Please login to access subcategories")
      setLoading(false)
      return
    }
    fetchSubcategories()
    fetchCategories()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchSubcategories()
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const filteredSubcategories = useMemo(() => {
    const query = String(searchQuery || "").trim().toLowerCase()
    if (!query) return subcategories
    return subcategories.filter((subcategory) => {
      const categoryName = subcategory?.categoryName || subcategory?.categoryId?.name || ""
      return (
        String(subcategory?.name || "").toLowerCase().includes(query) ||
        String(categoryName || "").toLowerCase().includes(query) ||
        String(subcategory?.id || "").toLowerCase().includes(query)
      )
    })
  }, [subcategories, searchQuery])

  const fetchSubcategories = async () => {
    try {
      setLoading(true)
      const params = {}
      if (searchQuery) params.search = searchQuery

      const response = await adminAPI.getSubcategories(params)
      const list = response?.data?.data?.subcategories || response?.data?.subcategories || []
      setSubcategories(Array.isArray(list) ? list : [])
    } catch (error) {
      if (error?.response?.status === 401) {
        toast.error("Authentication required. Please login again.")
      } else if (error?.response?.status === 403) {
        toast.error("Access denied. You do not have permission.")
      } else if (error?.response?.status === 404) {
        toast.error("Subcategories endpoint not found. Please check backend server.")
      } else if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
        toast.error("Cannot connect to server. Please check if backend is running on " + API_BASE_URL.replace("/api", ""))
      } else {
        toast.error(error?.response?.data?.message || "Failed to load subcategories")
      }
      setSubcategories([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await adminAPI.getCategories({ limit: 1000 })
      const list = response?.data?.data?.categories || response?.data?.categories || []
      setCategories(Array.isArray(list) ? list : [])
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  const getCategoryName = (categoryId) => {
    if (categoryId && typeof categoryId === "object") {
      return categoryId?.name || "N/A"
    }
    const category = categories.find((c) => String(c.id || c._id) === String(categoryId))
    return category?.name || "N/A"
  }

  const handleAddNew = () => {
    navigate("/admin/food/subcategories/add")
  }

  const handleEdit = (subcategory) => {
    navigate(`/admin/food/subcategories/edit/${subcategory.id || subcategory._id}`)
  }

  const handleToggleStatus = async (id) => {
    try {
      const response = await adminAPI.toggleSubcategoryStatus(String(id))
      if (response?.data?.success) {
        toast.success("Subcategory status updated successfully")
        fetchSubcategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update subcategory status")
    }
  }

  const handleApprove = async (id) => {
    try {
      const response = await adminAPI.approveSubcategory(String(id))
      if (response?.data?.success) {
        toast.success("Subcategory approved successfully")
        fetchSubcategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to approve subcategory")
    }
  }

  const handleReject = async (subcategory) => {
    const reason = window.prompt(`Reject "${subcategory?.name}" with a reason:`)
    if (reason == null) return
    if (!String(reason).trim()) {
      toast.error("Rejection reason is required")
      return
    }

    try {
      const response = await adminAPI.rejectSubcategory(String(subcategory?.id || subcategory?._id), reason)
      if (response?.data?.success) {
        toast.success("Subcategory rejected successfully")
        fetchSubcategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reject subcategory")
    }
  }

  const handleDelete = async (id) => {
    const subcategoryName = subcategories.find((subcategory) => String(subcategory?.id) === String(id))?.name || "this subcategory"
    if (!window.confirm(`Delete "${subcategoryName}"? This action cannot be undone.`)) return

    try {
      const response = await adminAPI.deleteSubcategory(String(id))
      if (response?.data?.success) {
        toast.success("Subcategory deleted successfully")
        fetchSubcategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete subcategory")
    }
  }

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.setTextColor(30, 30, 30)
      doc.text("Subcategory List", 14, 20)
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Generated on: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 14, 28)

      const tableData = filteredSubcategories.map((subcategory, index) => [
        index + 1,
        subcategory?.name || "N/A",
        getCategoryName(subcategory?.categoryId || subcategory?.categoryName) || "N/A",
        subcategory?.approvalStatus || "pending",
      ])

      autoTable(doc, {
        startY: 35,
        head: [["SL", "Subcategory", "Category", "Approval"]],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 10,
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [30, 30, 30],
        },
      })

      doc.save(`Subcategories_${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("PDF exported successfully!")
    } catch {
      toast.error("Failed to export PDF")
    }
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-brand-600 mx-auto" />
          <p className="mt-4 text-slate-600 font-medium">Loading subcategories...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="w-2 h-2 bg-white rounded-sm"></div>
              <div className="w-2 h-2 bg-white rounded-sm"></div>
              <div className="w-2 h-2 bg-white rounded-sm"></div>
              <div className="w-2 h-2 bg-white rounded-sm"></div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Subcategory</h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Subcategory List</h2>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {filteredSubcategories.length}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={filteredSubcategories.length === 0}
              className="px-4 py-2.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={handleAddNew}
              className="px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subcategory</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <AnimatePresence>
          {filteredSubcategories.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-xl border border-slate-200 p-12 text-center"
            >
              <p className="text-slate-500 text-lg">No subcategories found</p>
            </motion.div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Subcategory</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Approval</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredSubcategories.map((subcategory, index) => (
                    <motion.tr
                      key={subcategory.id || subcategory._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-md bg-slate-100 flex-shrink-0">
                            {subcategory?.image ? (
                              <img src={subcategory.image} alt={subcategory.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-slate-400">
                                <Upload className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-slate-900">{subcategory?.name || "-"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {subcategory?.categoryName || getCategoryName(subcategory?.categoryId)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${approvalBadgeClass(subcategory?.approvalStatus)}`}>
                          {subcategory?.approvalStatus || "pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(subcategory?.id || subcategory?._id)}
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                            subcategory?.status !== false
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-700 border-slate-300"
                          }`}
                        >
                          {subcategory?.status !== false ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {subcategory?.approvalStatus !== "approved" && (
                            <>
                              <button
                                onClick={() => handleApprove(subcategory?.id || subcategory?._id)}
                                className="px-2.5 py-1.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 border border-emerald-200 inline-flex items-center gap-1"
                              >
                                <BadgeCheck className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(subcategory)}
                                className="px-2.5 py-1.5 rounded-md bg-rose-50 text-rose-700 text-xs font-medium hover:bg-rose-100 border border-rose-200"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleEdit(subcategory)}
                            className="px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 border border-blue-200 inline-flex items-center gap-1"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>

                          <button
                            onClick={() => handleDelete(subcategory?.id || subcategory?._id)}
                            className="px-2.5 py-1.5 rounded-md bg-rose-50 text-rose-700 text-xs font-medium hover:bg-rose-100 border border-rose-200 inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
