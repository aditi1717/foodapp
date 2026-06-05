import { useEffect, useState, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Loader2,
  Upload,
  Image as ImageIcon,
  X,
  ChevronDown,
} from "lucide-react"
import { adminAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
import DocumentUploadActions from "@food/components/DocumentUploadActions"

const defaultFormData = {
  name: "",
  categoryId: "",
  type: "",
  image: "",
  isActive: true,
}

export default function EditSubcategoryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = !!id

  const [formData, setFormData] = useState(defaultFormData)
  const [loading, setLoading] = useState(isEditing)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState("")
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false)
  const fileInputRef = useRef(null)
  const [categories, setCategories] = useState([])
  const [categorySearch, setCategorySearch] = useState("")
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)

  useEffect(() => {
    fetchCategories()
    if (isEditing) {
      fetchSubcategory()
    }
  }, [id])

  const fetchCategories = async () => {
    try {
      const response = await adminAPI.getCategories({ limit: 1000 })
      const list = response?.data?.data?.categories || response?.data?.categories || []
      setCategories(Array.isArray(list) ? list : [])
    } catch (error) {
      console.error("Error fetching categories:", error)
      toast.error("Failed to load categories")
    }
  }

  const fetchSubcategory = async () => {
    try {
      setLoading(true)
      const res = await adminAPI.getSubcategories()
      const list = res?.data?.data?.subcategories || res?.data?.subcategories || []
      const subcategory = list.find(c => String(c.id || c._id) === id)

      if (subcategory) {
        setFormData({
          name: subcategory.name || "",
          categoryId: String(subcategory.categoryId?._id || subcategory.categoryId || ""),
          type: subcategory.type || "",
          image: subcategory.image || "",
          isActive: subcategory.isActive ?? subcategory.status ?? true,
        })
        setImagePreview(subcategory.image || "")
      } else {
        toast.error("Subcategory not found")
        navigate("/admin/food/subcategories")
      }
    } catch (error) {
      console.error("Error fetching subcategory:", error)
      toast.error("Failed to load subcategory details")
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    navigate("/admin/food/subcategories")
  }

  const handleImageSelect = (file) => {
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleImageCapture = (base64) => {
    if (base64) {
      setImagePreview(base64)
      setImageFile(null)
    }
  }

  const filteredCategories = categories.filter((cat) => {
    const query = String(categorySearch || "").trim().toLowerCase()
    if (!query) return true
    return String(cat.name || "").toLowerCase().includes(query)
  })

  const handleCategorySelect = (category) => {
    setFormData(prev => ({
      ...prev,
      categoryId: String(category.id || category._id)
    }))
    setCategorySearch("")
    setCategoryPopoverOpen(false)
  }

  const selectedCategory = categories.find(c => String(c.id || c._id) === formData.categoryId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error("Please enter subcategory name")
      return
    }
    if (!formData.categoryId) {
      toast.error("Please select a category")
      return
    }
    if (!imagePreview && !imageFile && !formData.image) {
      toast.error("Subcategory image is mandatory")
      return
    }

    try {
      setIsSubmitting(true)
      let imageUrl = formData.image

      if (imageFile || (imagePreview && imagePreview.startsWith("data:"))) {
        toast.info("Uploading image...")
        let uploadRes
        if (imageFile) {
          uploadRes = await uploadAPI.uploadMedia(imageFile, { folder: "appzeto/subcategories" })
        } else {
          uploadRes = await uploadAPI.uploadMedia(imagePreview, { folder: "appzeto/subcategories" })
        }
        imageUrl = uploadRes?.data?.data?.url || uploadRes?.data?.url || uploadRes?.data?.data
      }

      const payload = {
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        type: formData.type.trim(),
        image: imageUrl,
        status: formData.isActive,
        isActive: formData.isActive,
        visibilityStartTime: "00:00",
        visibilityEndTime: "23:59",
      }

      if (isEditing) {
        await adminAPI.updateSubcategory(id, payload)
        toast.success("Subcategory updated successfully")
      } else {
        await adminAPI.createSubcategory(payload)
        toast.success("Subcategory created successfully")
      }

      handleBack()
    } catch (error) {
      console.error("Error saving subcategory:", error)
      toast.error(error?.response?.data?.message || "Failed to save subcategory")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-brand-600 mx-auto" />
          <p className="mt-4 text-slate-600 font-medium">Loading subcategory details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={handleBack} className="rounded-full p-2 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="h-6 w-6 text-slate-700" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {isEditing ? "Edit Subcategory" : "Add New Subcategory"}
            </h1>
            <p className="text-sm text-slate-500">Manage subcategory details</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {/* Image Upload Section */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 ml-1">Subcategory Image *</label>
              
              <div className="flex flex-col items-center">
                <div
                  className="relative h-40 w-full sm:w-64 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden transition-all"
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} className="h-full w-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => {
                          setImagePreview("")
                          setImageFile(null)
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Click to upload image</p>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageSelect(e.target.files?.[0])}
                  onClick={() => setImagePreview("")}
                  hidden
                />
              </div>

              <div className="flex gap-2 justify-center flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
                {isImagePickerOpen && (
                  <DocumentUploadActions
                    onSelectFile={handleImageSelect}
                    onCapture={handleImageCapture}
                  />
                )}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-sm font-bold text-slate-700 ml-1">Subcategory Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter subcategory name"
                className="w-full mt-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Category Selection */}
            <div className="relative">
              <label className="text-sm font-bold text-slate-700 ml-1">Category *</label>
              <button
                type="button"
                onClick={() => setCategoryPopoverOpen(!categoryPopoverOpen)}
                className="w-full mt-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 flex items-center justify-between"
              >
                <span>{selectedCategory?.name || "Select category"}</span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {categoryPopoverOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-lg shadow-lg z-50">
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Search categories..."
                    className="w-full px-4 py-2 border-b border-slate-200 focus:outline-none text-sm"
                  />
                  <div className="max-h-64 overflow-y-auto">
                    {filteredCategories.map((category) => (
                      <button
                        key={category._id}
                        type="button"
                        onClick={() => handleCategorySelect(category)}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 border-b border-slate-100 last:border-b-0"
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="text-sm font-bold text-slate-700 ml-1">Type</label>
              <input
                type="text"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                placeholder="Enter type (optional)"
                className="w-full mt-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                Mark as Active
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? "Update Subcategory" : "Create Subcategory"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
