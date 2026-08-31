import React, { useEffect, useState } from "react"
import { adminAPI, uploadAPI } from "@food/api"
import {
  Boxes,
  Edit2,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Plus,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react"
import { toast } from "sonner"

export default function ProductSkeletons() {
  const [skeletons, setSkeletons] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("")

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    image: "",
    description: "",
    categoryId: "",
    subcategoryId: "",
    foodType: "Non-Veg"
  })

  // Modal Subcategories
  const [modalSubcategories, setModalSubcategories] = useState([])

  const fetchCategories = async () => {
    try {
      const res = await adminAPI.getCategories({ limit: 500 })
      const list = res?.data?.data?.categories || res?.data?.categories || res?.data?.data || []
      setCategories(Array.isArray(list) ? list : [])
    } catch {
      setCategories([])
    }
  }

  const fetchSkeletons = async () => {
    try {
      setLoading(true)
      const params = {}
      if (search.trim()) params.search = search.trim()
      if (filterCategory) params.categoryId = filterCategory

      const res = await adminAPI.getProductSkeletons(params)
      const list = res?.data?.data?.items || []
      setSkeletons(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load product skeletons")
      setSkeletons([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchSkeletons()
  }, [search, filterCategory])

  const fetchSubcategoriesForCategory = async (catId) => {
    if (!catId) {
      setModalSubcategories([])
      return
    }
    try {
      const res = await adminAPI.getSubcategories({ categoryId: catId, limit: 500 })
      const list = res?.data?.data?.subcategories || res?.data?.subcategories || res?.data?.data || []
      setModalSubcategories(Array.isArray(list) ? list : [])
    } catch {
      setModalSubcategories([])
    }
  }

  const getFoodTypeFromCategory = (catId) => {
    if (!catId) return "Non-Veg"
    const cat = categories.find((c) => String(c._id) === String(catId))
    if (!cat) return "Non-Veg"
    const scope = (cat.foodTypeScope || cat.foodType || "").trim()
    if (scope === "Veg") return "Veg"
    if (scope === "Non-Veg") return "Non-Veg"
    const nameLower = (cat.name || "").toLowerCase()
    if (nameLower.includes("veg") && !nameLower.includes("non-veg") && !nameLower.includes("non veg")) return "Veg"
    if (nameLower.includes("chicken") || nameLower.includes("mutton") || nameLower.includes("meat") || nameLower.includes("fish") || nameLower.includes("egg") || nameLower.includes("non-veg")) return "Non-Veg"
    return "Veg"
  }

  const handleCategoryChangeInForm = (catId) => {
    const derivedFoodType = getFoodTypeFromCategory(catId)
    setFormData((prev) => ({
      ...prev,
      categoryId: catId,
      subcategoryId: "",
      foodType: derivedFoodType
    }))
    fetchSubcategoriesForCategory(catId)
  }

  const openCreateModal = () => {
    setEditingItem(null)
    const firstCatId = categories[0]?._id || ""
    const initialFoodType = getFoodTypeFromCategory(firstCatId)
    setFormData({
      name: "",
      image: "",
      description: "",
      categoryId: firstCatId,
      subcategoryId: "",
      foodType: initialFoodType
    })
    if (firstCatId) {
      fetchSubcategoriesForCategory(firstCatId)
    }
    setShowModal(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setFormData({
      name: item.name || "",
      image: item.image || "",
      description: item.description || "",
      categoryId: item.categoryId || "",
      subcategoryId: item.subcategoryId || "",
      foodType: item.foodType || "Non-Veg"
    })
    if (item.categoryId) {
      fetchSubcategoriesForCategory(item.categoryId)
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return toast.error("Skeleton name is required")
    if (!formData.image.trim()) return toast.error("Image URL is required")
    if (!formData.categoryId) return toast.error("Please select a category")
    if (modalSubcategories.length > 0 && !formData.subcategoryId) {
      return toast.error("Please select a subcategory")
    }

    try {
      setSaving(true)
      if (editingItem) {
        await adminAPI.updateProductSkeleton(editingItem._id, formData)
        toast.success("Product Skeleton updated! Linked shop items synced in real-time.")
      } else {
        await adminAPI.createProductSkeleton(formData)
        toast.success("Product Skeleton created successfully")
      }
      setShowModal(false)
      fetchSkeletons()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save product skeleton")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Product Skeleton?")) return
    try {
      await adminAPI.deleteProductSkeleton(id)
      toast.success("Product Skeleton deleted")
      fetchSkeletons()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete skeleton")
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Boxes className="h-6 w-6 text-brand-600" />
            <h1 className="text-2xl font-bold text-slate-900">Product Skeletons (Parent Food Structures)</h1>
          </div>
          <p className="text-sm text-slate-500">
            Define master product templates. When selected by shops, Name, Image, and Description are locked for uniformity.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4" /> Create Product Skeleton
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search skeletons by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 transition-all"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          <p className="text-sm font-medium">Loading Product Skeletons...</p>
        </div>
      ) : skeletons.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-100 p-8 space-y-3">
          <Boxes className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">No Product Skeletons Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Create product skeletons to standardize product names, images, and descriptions across all shops.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 text-center w-12">SL</th>
                  <th className="py-3.5 px-4">Product Skeleton</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Subcategory</th>
                  <th className="py-3.5 px-4 text-center">Food Type</th>
                  <th className="py-3.5 px-4 text-center">Linked Products</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {skeletons.map((item, index) => (
                  <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 text-center font-medium text-slate-400 text-xs">
                      {index + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 line-clamp-1">{item.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {item.categoryName || "-"}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {item.subcategoryName ? (
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                          {item.subcategoryName}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          item.foodType === "Veg"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {item.foodType || "Non-Veg"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
                        {item.linkedProductsCount || 0} shop items
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs text-xs text-slate-500">
                      <p className="line-clamp-2">{item.description || "No description provided."}</p>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-2 text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Edit Skeleton"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item._id)}
                          className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Skeleton"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-bold text-slate-900 text-lg">
                {editingItem ? "Edit Product Skeleton" : "Create Product Skeleton"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Skeleton Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Classic Crispy Veg Burger"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 focus:bg-white transition-all"
                />
              </div>

              <div className={`grid ${modalSubcategories.length > 0 ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Category *</label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => handleCategoryChangeInForm(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 focus:bg-white transition-all"
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {modalSubcategories.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Subcategory *</label>
                    <select
                      required
                      value={formData.subcategoryId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, subcategoryId: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 focus:bg-white transition-all font-semibold"
                    >
                      <option value="">Select Subcategory</option>
                      {modalSubcategories.map((sub) => (
                        <option key={sub._id} value={sub._id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Food Type (Auto from Category)</label>
                  <select
                    value={formData.foodType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, foodType: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 focus:bg-white transition-all font-semibold"
                  >
                    <option value="Veg">Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Image Upload *</label>
                  <label className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer transition-all">
                    <Upload className="h-4 w-4 text-brand-600" />
                    <span>{formData.image ? "Change Image" : "Upload Image File"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error("Image file size must be less than 5MB")
                            return
                          }
                          try {
                            const uploadRes = await uploadAPI.uploadMedia(file, { folder: "appzeto/product_skeletons" })
                            const url = uploadRes?.data?.data?.url || uploadRes?.data?.url
                            if (url) {
                              setFormData((prev) => ({ ...prev, image: url }))
                              toast.success("Image uploaded successfully")
                              return
                            }
                          } catch {
                            // Fallback to FileReader base64
                          }
                          const reader = new FileReader()
                          reader.onloadend = () => {
                            setFormData((prev) => ({ ...prev, image: reader.result }))
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {formData.image ? (
                <div className="relative h-36 w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group">
                  <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, image: "" }))}
                    className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg shadow-md hover:bg-rose-700 transition-all"
                    title="Remove Image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={3}
                  placeholder="Master product description for all shops..."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingItem ? "Update Skeleton" : "Create Skeleton"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
