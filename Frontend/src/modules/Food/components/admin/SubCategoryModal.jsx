import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Image as ImageIcon, Loader2, X } from "lucide-react"
import { adminAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
import DocumentUploadActions from "@food/components/DocumentUploadActions"

const defaultFormData = {
  name: "",
  image: "",
  isActive: true,
  sortOrder: 0,
  parentCategoryId: "",
}

export default function SubCategoryModal({ isOpen, onClose, onSave, categories = [], editData = null }) {
  const galleryInputRef = useRef(null)
  const [formData, setFormData] = useState(defaultFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState("")

  useEffect(() => {
    if (editData) {
      setFormData({
        name: editData.name || "",
        image: editData.image || "",
        isActive: editData.isActive !== false,
        sortOrder: editData.sortOrder || 0,
        parentCategoryId: editData.parentCategoryId || editData.parentId || "",
      })
      setImagePreview(editData.image || "")
    } else {
      setFormData(defaultFormData)
      setImagePreview("")
      setImageFile(null)
    }
  }, [editData, isOpen])

  const handleImageSelect = (file) => {
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.parentCategoryId) {
      toast.error("Please select a parent category")
      return
    }
    if (!String(formData.name || "").trim()) {
      toast.error("Please enter sub category name")
      return
    }
    if (!imagePreview && !imageFile && !formData.image) {
      toast.error("Sub category image is mandatory")
      return
    }

    try {
      setIsSubmitting(true)
      let imageUrl = formData.image

      if (imageFile) {
        toast.info("Uploading image...")
        const uploadRes = await uploadAPI.uploadMedia(imageFile, { folder: "appzeto/categories" })
        imageUrl = uploadRes?.data?.data?.url || uploadRes?.data?.url || uploadRes?.data?.data
      }

      const selectedParent = categories.find(c => String(c.id || c._id) === String(formData.parentCategoryId))
      const inheritedFoodTypeScope = selectedParent?.foodTypeScope || "Both"

      const payload = {
        name: String(formData.name || "").trim(),
        image: imageUrl,
        isActive: !!formData.isActive,
        status: !!formData.isActive,
        sortOrder: Number(formData.sortOrder || 0),
        foodTypeScope: inheritedFoodTypeScope,
        parentCategoryId: formData.parentCategoryId,
        parentId: formData.parentCategoryId,
        isSubcategory: true,
      }

      let res
      if (editData) {
        res = await adminAPI.updateCategory(editData.id || editData._id, payload)
        toast.success("Sub category updated successfully")
      } else {
        res = await adminAPI.createCategory(payload)
        toast.success("Sub category created successfully")
      }

      onSave(res?.data?.data?.category || res?.data?.category || { ...payload, id: editData?.id || Date.now() })
      onClose()
    } catch (error) {
      toast.error(error?.response?.data?.message || `Failed to ${editData ? 'update' : 'create'} sub category`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-black">{editData ? 'Edit' : 'Add New'} Sub Category</h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">Configure subcategory details and parent link</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-black transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-black text-black ml-1">Parent Category *</label>
                <select
                  value={formData.parentCategoryId}
                  onChange={(e) => setFormData(prev => ({ ...prev, parentCategoryId: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-black focus:border-brand-500 focus:bg-white focus:outline-none transition-all outline-none"
                >
                  <option value="">Select parent category</option>
                  {categories.map((category) => (
                    <option key={category.id || category._id} value={String(category.id || category._id)}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-black ml-1">Sub Category Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Traditional Thali"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-black focus:border-brand-500 focus:bg-white focus:outline-none transition-all outline-none"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-black text-black ml-1">Sub Category Image *</label>
                <div className="group relative flex h-40 w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/30 transition-all">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <p className="text-white text-xs font-bold">Click below to change</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview("")
                          setImageFile(null)
                          setFormData(prev => ({ ...prev, image: "" }))
                        }}
                        className="absolute right-3 top-3 rounded-full bg-rose-500 p-2 text-white shadow-lg hover:scale-110 transition-transform"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-slate-400">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-500">No image selected</p>
                      <p className="text-[10px] text-slate-400 mt-1">Recommended: 500x500px</p>
                    </div>
                  )}
                </div>
                <DocumentUploadActions
                  onFileSelect={handleImageSelect}
                  fileNamePrefix="subcategory"
                  galleryInputRef={galleryInputRef}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-bold text-slate-700">Status</label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isActive ? "bg-brand-600" : "bg-slate-300"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                   <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-brand-200 hover:bg-brand-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isSubmitting ? "Processing..." : (editData ? "Update Sub Category" : "Create Sub Category")}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
