import { useEffect, useMemo, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft, Image as ImageIcon, Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import SubCategoryModal from "../../../components/admin/SubCategoryModal"

export default function SubCategoryPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editData, setEditData] = useState(null)

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true)
      const res = await adminAPI.getCategories({ limit: 1000 })
      const list = res?.data?.data?.categories || res?.data?.categories || []
      setCategories(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load categories")
      setCategories([])
    } finally {
      setLoadingCategories(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  // Sync modal state with URL
  useEffect(() => {
    if (location.pathname.endsWith("/add")) {
      setIsModalOpen(true)
      setEditData(null)
    } else if (location.pathname.includes("/edit/")) {
       const id = location.pathname.split("/edit/")[1]
       const sub = categories.find(c => String(c.id || c._id) === id)
       if (sub) {
         setEditData(sub)
         setIsModalOpen(true)
       }
    } else {
      setIsModalOpen(false)
      setEditData(null)
    }
  }, [location.pathname, categories])

  const parentCategories = useMemo(
    () => categories.filter((category) => {
      const parentRef = String(
        category?.parentCategoryId || category?.parentId || category?.parentCategory || category?.subCategoryOf || "",
      ).trim()
      const isExplicitSub = Boolean(category?.isSubcategory || category?.isSubCategory) || String(category?.type || "").toLowerCase().includes("sub")
      return !isExplicitSub && !parentRef
    }),
    [categories],
  )

  const parentNameById = useMemo(() => {
    const map = new Map()
    parentCategories.forEach((category) => {
      map.set(String(category?.id || category?._id), category?.name || "-")
    })
    return map
  }, [parentCategories])

  const subCategories = useMemo(
    () =>
      categories.filter((category) => {
        const parentRef = String(
          category?.parentCategoryId || category?.parentId || category?.parentCategory || category?.subCategoryOf || "",
        ).trim()
        const isSub = Boolean(category?.isSubcategory || category?.isSubCategory) || String(category?.type || "").toLowerCase().includes("sub")
        return isSub || Boolean(parentRef)
      }),
    [categories],
  )

  const handleBack = () => navigate("/admin/food/categories")

  const handleAddClick = () => {
    navigate("/admin/food/categories/subcategory/add")
  }

  const handleEditClick = (subcategory) => {
    setEditData(subcategory)
    setIsModalOpen(true)
  }

  const handleToggleStatus = async (id) => {
    try {
      const response = await adminAPI.toggleCategoryStatus(String(id))
      if (response?.data?.success) {
        toast.success("Status updated successfully")
        fetchCategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update status")
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this subcategory?")) return
    try {
      const response = await adminAPI.deleteCategory(String(id))
      if (response?.data?.success) {
        toast.success("Subcategory deleted successfully")
        fetchCategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete subcategory")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="rounded-xl p-2 transition-all hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5 text-black" />
            </button>
            <div>
              <h1 className="text-xl font-black text-black tracking-tight">Sub Categories</h1>
              <p className="text-xs font-medium text-slate-500">Manage nested food categories</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddClick}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-brand-100 hover:bg-brand-700 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add Subcategory
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loadingCategories ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              <p className="mt-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading</p>
            </div>
          ) : subCategories.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                <ImageIcon className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-black">No sub categories found</h3>
              <p className="mt-1 text-xs font-medium text-slate-500 max-w-xs mx-auto">Create your first subcategory to start organizing your menu items better.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-100 bg-slate-50/30">
                  <tr>
                    <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Sub Category</th>
                    <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Parent</th>
                    <th className="px-5 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                    <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {subCategories.map((subcategory) => {
                    const parentId = String(
                      subcategory?.parentCategoryId || subcategory?.parentId || subcategory?.parentCategory || subcategory?.subCategoryOf || "",
                    )
                    const isActive = subcategory?.isActive !== false && subcategory?.status !== false
                    
                    return (
                      <tr key={subcategory?.id || subcategory?._id} className="group hover:bg-slate-50/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 overflow-hidden rounded-xl border border-slate-100 bg-slate-100 flex-shrink-0 shadow-sm">
                              {subcategory?.image ? (
                                <img src={subcategory.image} alt={subcategory?.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-slate-300">
                                  <ImageIcon className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <p className="text-sm font-bold text-black">{subcategory?.name || "-"}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600 uppercase">
                            {parentNameById.get(parentId) || "Unknown"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => handleToggleStatus(subcategory.id || subcategory._id)}
                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all ${isActive ? "bg-emerald-500 shadow-sm" : "bg-slate-200"}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? "translate-x-5.5" : "translate-x-1"}`} />
                          </button>
                        </td>
                        <td className="px-5 py-3">
                           <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEditClick(subcategory)}
                              className="rounded-lg p-2 text-black hover:bg-slate-100 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(subcategory.id || subcategory._id)}
                              className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <SubCategoryModal 
        isOpen={isModalOpen}
        onClose={() => {
          navigate("/admin/food/categories/subcategory")
          setIsModalOpen(false)
          setEditData(null)
        }}
        onSave={() => fetchCategories()}
        categories={parentCategories}
        editData={editData}
      />
    </div>
  )
}
