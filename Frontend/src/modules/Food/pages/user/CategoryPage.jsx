import { useState, useMemo, useRef, useEffect, startTransition, useDeferredValue } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Star, Clock, Search, SlidersHorizontal, ChevronDown, Bookmark, BadgePercent, MapPin, ArrowDownUp, Timer, IndianRupee, UtensilsCrossed, ShieldCheck, X, Loader2, Grid2x2, BookmarkCheck } from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import {
  CategoryChipRowSkeleton,
  LoadingSkeletonRegion,
  RestaurantGridSkeleton,
} from "@food/components/ui/loading-skeletons"

// Import shared food images - prevents duplication
import { foodImages } from "@food/constants/images"
import api from "@food/api"
import { restaurantAPI, adminAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { useProfile } from "@food/context/ProfileContext"
import { useLocation } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"
import { useDelayedLoading } from "@food/hooks/useDelayedLoading"
import { getMenuFromResponse } from "@food/utils/menuItems"
import BRAND_THEME from "@/config/brandTheme"

// Filter options
const filterOptions = [
  { id: 'under-30-mins', label: 'Under 30 mins' },
  { id: 'price-match', label: 'Price Match', hasIcon: true },
  { id: 'flat-50-off', label: 'Flat 50% OFF', hasIcon: true },
  { id: 'under-250', label: 'Under ₹250' },
  { id: 'rating-4-plus', label: 'Rating 4.0+' },
]

const CATEGORY_PAGE_FILTERS_STORAGE_KEY = "food-category-page-filters-v1"

const debugError = (...args) => console.error('[CategoryPage]', ...args)
const debugWarn = (...args) => console.warn('[CategoryPage]', ...args)

export default function CategoryPage() {
  const { category } = useParams()
  const navigate = useNavigate()
  const { vegMode } = useProfile()
  const { location } = useLocation()
  const { zoneId, isOutOfService } = useZone(location)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(category?.toLowerCase() || 'all')
  const [selectedSubCategory, setSelectedSubCategory] = useState(null)
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [favorites, setFavorites] = useState(new Set())
  const [sortBy, setSortBy] = useState(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [activeFilterTab, setActiveFilterTab] = useState('sort')
  const [activeScrollSection, setActiveScrollSection] = useState('sort')
  const [isLoadingFilterResults, setIsLoadingFilterResults] = useState(false)
  const filterSectionRefs = useRef({})
  const rightContentRef = useRef(null)
  const categoryScrollRef = useRef(null)
  const menuEnrichmentRequestRef = useRef(0)
  const approvedFoodsCacheRef = useRef(null)
  const approvedFoodsInFlightRef = useRef(null)
  const hasRestoredCategoryFiltersRef = useRef(false)

  // State for categories from admin
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)

  const [restaurantsData, setRestaurantsData] = useState([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [isEnrichingMenus, setIsEnrichingMenus] = useState(false)
  const [approvedFoodsData, setApprovedFoodsData] = useState([])
  const [categoryKeywords, setCategoryKeywords] = useState({})
  const showCategorySkeleton = useDelayedLoading(loadingCategories)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const BACKEND_ORIGIN = useMemo(() => API_BASE_URL.replace(/\/api\/?$/, ""), [])
  const slugify = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const normalizeCategoryToken = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  const matchesCategoryText = (value, keywords) => {
    const normalizedValue = normalizeCategoryToken(value)
    if (!normalizedValue) return false

    return keywords.some((keyword) => {
      const normalizedKeyword = normalizeCategoryToken(keyword)
      if (!normalizedKeyword) return false
      return (
        normalizedValue === normalizedKeyword ||
        normalizedValue.includes(normalizedKeyword) ||
        slugify(normalizedValue) === slugify(normalizedKeyword)
      )
    })
  }
  const uniqueByRestaurant = (list) => {
    const seen = new Set()
    return list.filter((row) => {
      const key = row.dishId ? `dish-${row.dishId}` : (row.restaurantId || row.id || `raw-${slugify(row.name)}`)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const toArray = (value) => {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== "object") return []
    return Object.values(value).filter((entry) => entry && typeof entry === "object")
  }

  const normalizeMenu = (menu) => {
    const rawSections = toArray(menu?.sections)
    return {
      ...menu,
      sections: rawSections.map((section, sectionIndex) => ({
        ...section,
        id: String(section?.id || section?._id || `section-${sectionIndex}`),
        name: section?.name || section?.title || "Unnamed Section",
        items: toArray(section?.items).map((item, itemIndex) => ({
          ...item,
          id: String(item?.id || item?._id || `${sectionIndex}-${itemIndex}`),
        })),
        subsections: toArray(section?.subsections).map((subsection, subsectionIndex) => ({
          ...subsection,
          id: String(subsection?.id || subsection?._id || `subsection-${sectionIndex}-${subsectionIndex}`),
          name: subsection?.name || "Unnamed Subsection",
          items: toArray(subsection?.items).map((item, itemIndex) => ({
            ...item,
            id: String(item?.id || item?._id || `${sectionIndex}-${subsectionIndex}-${itemIndex}`),
          })),
        })),
      })),
    }
  }

  const fetchApprovedFoods = async () => {
    if (Array.isArray(approvedFoodsCacheRef.current)) {
      return approvedFoodsCacheRef.current
    }

    if (approvedFoodsInFlightRef.current) {
      return approvedFoodsInFlightRef.current
    }

    approvedFoodsInFlightRef.current = (async () => {
      try {
        const response = await adminAPI.getFoods({ limit: 1000 })
        const list = response?.data?.data?.foods || []
        const approvedFoods = Array.isArray(list)
          ? list.filter((food) =>
              String(food?.approvalStatus || "").toLowerCase() === "approved" &&
              food?.isAvailable !== false
            )
          : []

        approvedFoodsCacheRef.current = approvedFoods
        return approvedFoods
      } catch {
        approvedFoodsCacheRef.current = []
        return []
      } finally {
        approvedFoodsInFlightRef.current = null
      }
    })()

    return approvedFoodsInFlightRef.current
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const foods = await fetchApprovedFoods()
      if (!cancelled) {
        setApprovedFoodsData(Array.isArray(foods) ? foods : [])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const buildFallbackMenuFromFoods = (foods, restaurant) => {
    const restaurantIds = new Set(
      [
        restaurant?.restaurantId,
        restaurant?.id,
        restaurant?.mongoId,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim())
    )

    const restaurantName = String(restaurant?.name || "").trim().toLowerCase()
    const matchingFoods = foods.filter((food) => {
      const foodRestaurantId = String(food?.restaurantId || "").trim()
      const foodRestaurantName = String(food?.restaurantName || "").trim().toLowerCase()
      return (
        (foodRestaurantId && restaurantIds.has(foodRestaurantId)) ||
        (restaurantName && foodRestaurantName === restaurantName)
      )
    })

    if (matchingFoods.length === 0) {
      return null
    }

    const sectionsMap = new Map()
    matchingFoods.forEach((food, index) => {
      const sectionName = String(food?.categoryName || food?.category || "Varieties").trim() || "Varieties"
      const sectionKey = slugify(sectionName)
      if (!sectionsMap.has(sectionKey)) {
        sectionsMap.set(sectionKey, {
          id: sectionKey || `section-${index}`,
          name: sectionName,
          items: [],
          subsections: [],
        })
      }

      sectionsMap.get(sectionKey).items.push({
        id: String(food?.id || food?._id || `${sectionKey}-${index}`),
        _id: food?._id,
        name: food?.name || "Unnamed Item",
        description: food?.description || "",
        price: Number(food?.price || 0),
        originalPrice: Number(food?.originalPrice || food?.price || 0),
        image: normalizeImageUrl(food?.image),
        foodType: food?.foodType || "Non-Veg",
        isAvailable: food?.isAvailable !== false,
        categoryName: food?.categoryName || sectionName,
        category: food?.categoryName || sectionName,
        preparationTime: food?.preparationTime || "",
        approvalStatus: food?.approvalStatus || "approved",
      })
    })

    return {
      sections: Array.from(sectionsMap.values()),
    }
  }

  const getCategoryFallbackDishesFromApprovedFoods = (categoryId, restaurants) => {
    const keywords = getCategoryKeywords(categoryId)
    if (keywords.length === 0 || !Array.isArray(approvedFoodsData) || approvedFoodsData.length === 0) {
      return []
    }

    const restaurantsById = new Map()
    const restaurantsByName = new Map()
    ;(Array.isArray(restaurants) ? restaurants : []).forEach((restaurant) => {
      const idCandidates = [
        restaurant?.restaurantId,
        restaurant?.id,
        restaurant?.mongoId,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim())

      idCandidates.forEach((value) => {
        if (!restaurantsById.has(value)) {
          restaurantsById.set(value, restaurant)
        }
      })

      const normalizedName = String(restaurant?.name || "").trim().toLowerCase()
      if (normalizedName && !restaurantsByName.has(normalizedName)) {
        restaurantsByName.set(normalizedName, restaurant)
      }
    })

    return approvedFoodsData
      .filter((food) => {
        if (food?.isAvailable === false) return false
        if (String(food?.approvalStatus || "").toLowerCase() !== "approved") return false

        const categoryName = String(food?.categoryName || food?.category || "").toLowerCase()
        const foodName = String(food?.name || "").toLowerCase()
        return (
          matchesCategoryText(categoryName, keywords) ||
          matchesCategoryText(foodName, keywords)
        )
      })
      .map((food, index) => {
        const restaurantId = String(food?.restaurantId || "").trim()
        const restaurantName = String(food?.restaurantName || "").trim()
        const matchedRestaurant =
          restaurantsById.get(restaurantId) ||
          restaurantsByName.get(restaurantName.toLowerCase()) ||
          null

        const fallbackRestaurantName = restaurantName || "Restaurant"
        const fallbackSlug = slugify(fallbackRestaurantName)
        const fallbackImage = normalizeImageUrl(food?.image)

        return {
          ...(matchedRestaurant || {}),
          id: `${restaurantId || fallbackSlug || "restaurant"}-${String(food?.id || food?._id || index)}`,
          restaurantId: restaurantId || matchedRestaurant?.restaurantId || matchedRestaurant?.id || null,
          mongoId: matchedRestaurant?.mongoId || matchedRestaurant?.id || null,
          slug: matchedRestaurant?.slug || fallbackSlug,
          name: matchedRestaurant?.name || fallbackRestaurantName,
          image: matchedRestaurant?.image || fallbackImage,
          images: Array.isArray(matchedRestaurant?.images) && matchedRestaurant.images.length > 0
            ? matchedRestaurant.images
            : (fallbackImage ? [fallbackImage] : []),
          cuisine: matchedRestaurant?.cuisine || null,
          rating: matchedRestaurant?.rating || null,
          deliveryTime: matchedRestaurant?.deliveryTime || null,
          distance: matchedRestaurant?.distance || null,
          offer: matchedRestaurant?.offer || null,
          featuredDish: matchedRestaurant?.featuredDish || food?.name || null,
          featuredPrice: matchedRestaurant?.featuredPrice || Number(food?.price || 0),
          menu: matchedRestaurant?.menu || null,
          dishId: String(food?.id || food?._id || `${restaurantId}-${index}`),
          categoryDish: food,
          categoryDishName: food?.name || "Unnamed Item",
          categoryDishPrice: Number(food?.price || 0),
          categoryDishImage: fallbackImage,
          categoryDishFoodType: food?.foodType || "Non-Veg",
        }
      })
  }

  const normalizeImageUrl = (value) => {
    if (!value) return ""

    const raw =
      typeof value === "string"
        ? value
        : typeof value === "object"
          ? (value.url || value.secure_url || value.imageUrl || value.image || value.src || value.path || "")
          : ""

    if (typeof raw !== "string") return ""
    const trimmed = raw.trim()
    if (!trimmed) return ""
    if (/^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed

    const appProtocol = typeof window !== "undefined" ? window.location?.protocol : ""
    const appHost = typeof window !== "undefined" ? window.location?.hostname : ""
    let normalized = trimmed
      .replace(/\\/g, "/")
      .replace(/^(https?):\/(?!\/)/i, "$1://")
      .replace(/^(https?:\/\/)(https?:\/\/)/i, "$1")

    if (/^\/\//.test(normalized)) {
      normalized = `${appProtocol || "https:"}${normalized}`
    }

    const hasSignedParams = (url) =>
      /[?&](X-Amz-|Signature=|Expires=|AWSAccessKeyId=|GoogleAccessId=|token=|sig=|se=|sp=|sv=)/i.test(url)

    if (/^https?:\/\//i.test(normalized)) {
      try {
        const parsed = new URL(normalized, window.location.origin)
        if (
          appHost &&
          appHost !== "localhost" &&
          appHost !== "127.0.0.1" &&
          /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname)
        ) {
          try {
            const backendUrl = new URL(BACKEND_ORIGIN)
            parsed.protocol = backendUrl.protocol
            parsed.hostname = backendUrl.hostname
            parsed.port = backendUrl.port
          } catch {
            parsed.protocol = window.location.protocol
            parsed.hostname = window.location.hostname
            if (window.location.port) parsed.port = window.location.port
          }
        }
        if (appProtocol === "https:" && parsed.protocol === "http:") {
          parsed.protocol = "https:"
        }
        const finalUrl = parsed.toString()
        return hasSignedParams(finalUrl) ? finalUrl : encodeURI(finalUrl)
      } catch {
        return normalized
      }
    }

    const absolutePath = normalized.startsWith("/")
      ? `${BACKEND_ORIGIN}${normalized}`
      : `${BACKEND_ORIGIN}/${normalized.replace(/^\.?\/*/, "")}`

    try {
      const parsed = new URL(absolutePath, window.location.origin)
      if (appProtocol === "https:" && parsed.protocol === "http:") {
        parsed.protocol = "https:"
      }
      const finalUrl = parsed.toString()
      return hasSignedParams(finalUrl) ? finalUrl : encodeURI(finalUrl)
    } catch {
      return absolutePath
    }
  }

  const currentFilterStorageKey = useMemo(
    () => slugify(selectedCategory || category || "all") || "all",
    [selectedCategory, category]
  )

  const parseFirstNumber = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value
    const match = String(value || "").match(/(\d+(?:\.\d+)?)/)
    return match ? Number(match[1]) : null
  }

  const getComparableDeliveryTime = (row) => parseFirstNumber(row?.deliveryTime)

  const getComparableDistance = (row) => {
    const raw = String(row?.distance || "").trim().toLowerCase()
    if (!raw) return null

    const parsed = parseFirstNumber(raw)
    if (parsed == null) return null
    if (raw.includes("m") && !raw.includes("km")) {
      return parsed / 1000
    }
    return parsed
  }

  const getComparablePrice = (row) => {
    const raw = row?.categoryDishPrice ?? row?.featuredPrice ?? null
    const parsed = typeof raw === "number" ? raw : parseFirstNumber(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  const getComparableRating = (row) => {
    const parsed = typeof row?.rating === "number" ? row.rating : parseFirstNumber(row?.rating)
    return Number.isFinite(parsed) ? parsed : null
  }

  const matchesOfferText = (value, pattern) => pattern.test(String(value || ""))

  const applyFiltersAndSorting = (rows) => {
    let nextRows = Array.isArray(rows) ? [...rows] : []

    if (activeFilters.has('under-30-mins')) {
      nextRows = nextRows.filter((row) => {
        const time = getComparableDeliveryTime(row)
        return time != null && time <= 30
      })
    }

    if (activeFilters.has('delivery-under-45')) {
      nextRows = nextRows.filter((row) => {
        const time = getComparableDeliveryTime(row)
        return time != null && time <= 45
      })
    }

    if (activeFilters.has('rating-35-plus')) {
      nextRows = nextRows.filter((row) => {
        const rating = getComparableRating(row)
        return rating != null && rating >= 3.5
      })
    }

    if (activeFilters.has('rating-4-plus')) {
      nextRows = nextRows.filter((row) => {
        const rating = getComparableRating(row)
        return rating != null && rating >= 4.0
      })
    }

    if (activeFilters.has('rating-45-plus')) {
      nextRows = nextRows.filter((row) => {
        const rating = getComparableRating(row)
        return rating != null && rating >= 4.5
      })
    }

    if (activeFilters.has('distance-under-1km')) {
      nextRows = nextRows.filter((row) => {
        const distance = getComparableDistance(row)
        return distance != null && distance <= 1
      })
    }

    if (activeFilters.has('distance-under-2km')) {
      nextRows = nextRows.filter((row) => {
        const distance = getComparableDistance(row)
        return distance != null && distance <= 2
      })
    }

    if (activeFilters.has('price-under-200')) {
      nextRows = nextRows.filter((row) => {
        const price = getComparablePrice(row)
        return price != null && price <= 200
      })
    }

    if (activeFilters.has('under-250')) {
      nextRows = nextRows.filter((row) => {
        const price = getComparablePrice(row)
        return price != null && price <= 250
      })
    }

    if (activeFilters.has('price-under-500')) {
      nextRows = nextRows.filter((row) => {
        const price = getComparablePrice(row)
        return price != null && price <= 500
      })
    }

    if (activeFilters.has('flat-50-off')) {
      nextRows = nextRows.filter((row) => matchesOfferText(row?.offer, /50\s*%/i))
    }

    if (activeFilters.has('price-match')) {
      nextRows = nextRows.filter((row) =>
        matchesOfferText(row?.offer, /price\s*match/i) ||
        matchesOfferText(row?.priceRange, /price\s*match/i) ||
        matchesOfferText(row?.categoryDish?.description, /price\s*match/i)
      )
    }

    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase()
      nextRows = nextRows.filter((row) =>
        row.name?.toLowerCase().includes(query) ||
        row.cuisine?.toLowerCase().includes(query) ||
        row.featuredDish?.toLowerCase().includes(query) ||
        row.categoryDishName?.toLowerCase().includes(query)
      )
    }

    if (sortBy) {
      nextRows.sort((left, right) => {
        if (sortBy === 'price-low' || sortBy === 'price-high') {
          const leftPrice = getComparablePrice(left)
          const rightPrice = getComparablePrice(right)
          if (leftPrice == null && rightPrice == null) return 0
          if (leftPrice == null) return 1
          if (rightPrice == null) return -1
          return sortBy === 'price-low' ? leftPrice - rightPrice : rightPrice - leftPrice
        }

        if (sortBy === 'rating-high' || sortBy === 'rating-low') {
          const leftRating = getComparableRating(left)
          const rightRating = getComparableRating(right)
          if (leftRating == null && rightRating == null) return 0
          if (leftRating == null) return 1
          if (rightRating == null) return -1
          return sortBy === 'rating-high' ? rightRating - leftRating : leftRating - rightRating
        }

        return 0
      })
    }

    return uniqueByRestaurant(nextRows)
  }

  // Fetch categories from admin API
  useEffect(() => {
    let isCancelled = false;

    const fetchCategories = async () => {
      try {
        setLoadingCategories(true)
        const response = await adminAPI.getPublicCategories(zoneId ? { zoneId } : {})

        if (isCancelled) return;

        if (response.data && response.data.success && response.data.data && response.data.data.categories) {
          const categoriesArray = response.data.data.categories

          // Transform API categories to match expected format
          const transformedCategories = [
            { id: 'all', name: "All", image: null, slug: 'all' },
            ...categoriesArray.map((cat) => ({
              id: cat.slug || cat.id,
              name: cat.name,
              image: cat.image || foodImages[0],
              slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
              type: cat.type,
              parentId: cat.parentCategoryId || cat.parentId || cat.subCategoryOf || null,
              mongoId: cat._id || cat.id,
            }))
          ]

          setCategories(transformedCategories)

          // Generate category keywords dynamically from category names
          const keywordsMap = {}
          categoriesArray.forEach((cat) => {
            const categoryId = cat.slug || cat.id
            const categoryName = cat.name.toLowerCase()

            // Generate keywords from category name
            const words = categoryName.split(/[\s-]+/).filter(w => w.length > 0)
            keywordsMap[categoryId] = [categoryName, ...words]
          })

          setCategoryKeywords(keywordsMap)
        } else {
          setCategories([{ id: 'all', name: "All", image: null, slug: 'all' }])
        }
      } catch (error) {
        if (isCancelled) return;
        debugError('Error fetching categories:', error)
        setCategories([{ id: 'all', name: "All", image: null, slug: 'all' }])
      } finally {
        if (!isCancelled) setLoadingCategories(false)
      }
    }

    fetchCategories()

    return () => {
      isCancelled = true;
    }
  }, [zoneId])

  const getCategoryKeywords = (categoryId) => {
    const raw = String(categoryId || "").trim().toLowerCase()
    const fromAdmin = categoryKeywords[raw]
    let keywords = []
    if (Array.isArray(fromAdmin) && fromAdmin.length > 0) {
      keywords = [...fromAdmin]
    } else {
      const parts = raw.split(/[\s-]+/).filter(Boolean)
      keywords = parts.length > 0 ? Array.from(new Set([raw, ...parts])) : []
    }

    if (keywords.includes('samosha') || keywords.includes('samosa')) {
      if (!keywords.includes('samosa')) keywords.push('samosa')
      if (!keywords.includes('samosha')) keywords.push('samosha')
    }

    return keywords
  }

  const checkCategoryInMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return false
    }

    const keywords = getCategoryKeywords(categoryId)
    if (keywords.length === 0) {
      return false
    }

    for (const section of menu.sections) {
      const sectionNameLower = (section.name || '').toLowerCase()
      if (matchesCategoryText(sectionNameLower, keywords)) {
        return true
      }

      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          const itemNameLower = (item.name || '').toLowerCase()
          const itemCategoryLower = (item.categoryName || item.category || '').toLowerCase()

          if (
            matchesCategoryText(itemNameLower, keywords) ||
            matchesCategoryText(itemCategoryLower, keywords)
          ) {
            return true
          }
        }
      }

      if (section.subsections && Array.isArray(section.subsections)) {
        for (const subsection of section.subsections) {
          const subsectionNameLower = (subsection?.name || "").toLowerCase()
          if (matchesCategoryText(subsectionNameLower, keywords)) {
            return true
          }

          const subItems = Array.isArray(subsection?.items) ? subsection.items : []
          for (const item of subItems) {
            const itemNameLower = (item?.name || "").toLowerCase()
            const itemCategoryLower = (item?.categoryName || item?.category || "").toLowerCase()
            if (
              matchesCategoryText(itemNameLower, keywords) ||
              matchesCategoryText(itemCategoryLower, keywords)
            ) {
              return true
            }
          }
        }
      }
    }

    return false
  }

  const getAllCategoryDishesFromMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return []
    }

    const keywords = getCategoryKeywords(categoryId)
    if (keywords.length === 0) {
      return []
    }

    const matchingDishes = []

    for (const section of menu.sections) {
      const sectionNameLower = (section?.name || "").toLowerCase()
      const sectionMatches = matchesCategoryText(sectionNameLower, keywords)

      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          const itemNameLower = (item.name || '').toLowerCase()
          const itemCategoryLower = (item.categoryName || item.category || '').toLowerCase()

          const itemMatches =
            matchesCategoryText(itemNameLower, keywords) ||
            matchesCategoryText(itemCategoryLower, keywords)

          if (sectionMatches || itemMatches) {
            const originalPrice = item.originalPrice || item.price || 0
            const discountPercent = item.discountPercent || 0
            const finalPrice = discountPercent > 0
              ? Math.round(originalPrice * (1 - discountPercent / 100))
              : originalPrice

            const dishImage = normalizeImageUrl(item.image?.url || item.image || section.image?.url || section.image)

            matchingDishes.push({
              name: item.name,
              price: finalPrice,
              image: dishImage,
              originalPrice: originalPrice,
              itemId: item._id || item.id || `${item.name}-${finalPrice}`,
              foodType: item.foodType,
              subCategoryId: item.subCategoryId || null,
              subCategoryName: item.subCategoryName || null,
            })
          }
        }
      }

      if (section.subsections && Array.isArray(section.subsections)) {
        for (const subsection of section.subsections) {
          const subsectionNameLower = (subsection?.name || "").toLowerCase()
          const subsectionMatches = matchesCategoryText(subsectionNameLower, keywords)
          const subItems = Array.isArray(subsection?.items) ? subsection.items : []

          for (const item of subItems) {
            const itemNameLower = (item?.name || "").toLowerCase()
            const itemCategoryLower = (item?.categoryName || item?.category || "").toLowerCase()
            const itemMatches =
              matchesCategoryText(itemNameLower, keywords) ||
              matchesCategoryText(itemCategoryLower, keywords)

            if (sectionMatches || subsectionMatches || itemMatches) {
              const originalPrice = item?.originalPrice || item?.price || 0
              const discountPercent = item?.discountPercent || 0
              const finalPrice = discountPercent > 0
                ? Math.round(originalPrice * (1 - discountPercent / 100))
                : originalPrice

              const dishImage = normalizeImageUrl(
                item?.image?.url || item?.image || subsection?.image?.url || subsection?.image || section?.image?.url || section?.image
              )

              matchingDishes.push({
                name: item?.name,
                price: finalPrice,
                image: dishImage,
                originalPrice: originalPrice,
                itemId: item?._id || item?.id || `${item?.name}-${finalPrice}`,
                foodType: item?.foodType,
                subCategoryId: item?.subCategoryId || null,
                subCategoryName: item?.subCategoryName || null,
              })
            }
          }
        }
      }
    }

    return matchingDishes
  }

  // Fetch restaurants from API
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoadingRestaurants(true)
        const params = {}
        const response = await restaurantAPI.getRestaurants(params)

        if (response.data && response.data.success && response.data.data && response.data.data.restaurants) {
          const restaurantsArray = response.data.data.restaurants

          const isDefaultValue = (value, fieldName) => {
            if (!value) return false
            const defaultOffers = ["Flat ₹50 OFF above ₹199", "Flat 50% OFF", "Flat ₹40 OFF above ₹149"]
            const defaultDeliveryTimes = ["25-30 mins", "20-25 mins", "30-35 mins"]
            const defaultDistances = ["1.2 km", "1 km", "0.8 km"]
            const defaultFeaturedPrice = 249
            if (fieldName === 'offer' && defaultOffers.includes(value)) return true
            if (fieldName === 'deliveryTime' && defaultDeliveryTimes.includes(value)) return true
            if (fieldName === 'distance' && defaultDistances.includes(value)) return true
            if (fieldName === 'featuredPrice' && value === defaultFeaturedPrice) return true
            return false
          }

          const restaurantsWithIds = restaurantsArray
            .filter((restaurant) => {
              const displayName = String(restaurant.restaurantName || restaurant.name || "").trim()
              return displayName.length > 0
            })
            .map((restaurant) => {
              let deliveryTime = restaurant.estimatedDeliveryTime || null
              let distance = restaurant.distance || null
              let offer = restaurant.offer || null
              if (isDefaultValue(deliveryTime, 'deliveryTime')) deliveryTime = null
              if (isDefaultValue(distance, 'distance')) distance = null
              if (isDefaultValue(offer, 'offer')) offer = null
              const cuisine = restaurant.cuisines && restaurant.cuisines.length > 0 ? restaurant.cuisines.join(", ") : null
              const coverImages = restaurant.coverImages && restaurant.coverImages.length > 0 ? restaurant.coverImages.map(img => normalizeImageUrl(img.url || img)).filter(Boolean) : []
              const allImages = coverImages.length > 0 ? coverImages : (restaurant.profileImage?.url ? [normalizeImageUrl(restaurant.profileImage.url)] : [])
              const image = allImages[0] || null
              const restaurantId = restaurant.restaurantId || restaurant._id
              let featuredDish = restaurant.featuredDish || null
              let featuredPrice = restaurant.featuredPrice || null
              if (featuredPrice && isDefaultValue(featuredPrice, 'featuredPrice')) featuredPrice = null
              return {
                id: restaurantId,
                name: restaurant.restaurantName || restaurant.name,
                cuisine,
                rating: restaurant.rating || null,
                deliveryTime,
                distance,
                image,
                images: allImages,
                priceRange: restaurant.priceRange || null,
                featuredDish,
                featuredPrice,
                offer,
                slug: restaurant.slug || (restaurant.restaurantName || restaurant.name)?.toLowerCase().replace(/\s+/g, '-'),
                restaurantId,
                mongoId: restaurant._id || null,
                hasPaneer: false,
                category: 'all',
              }
            }).filter(Boolean)

          startTransition(() => {
            setRestaurantsData(restaurantsWithIds)
          })

          setIsEnrichingMenus(true)
          const enrichmentRequestId = ++menuEnrichmentRequestRef.current
          void (async () => {
            try {
              const transformedRestaurants = []
              for (let index = 0; index < restaurantsWithIds.length; index += 4) {
                const batchRestaurants = restaurantsWithIds.slice(index, index + 4)
                const batchResults = await Promise.all(
                  batchRestaurants.map(async (restaurant) => {
                    try {
                      const lookupIds = [restaurant.restaurantId, restaurant.id, restaurant.mongoId, restaurant.slug]
                        .filter(Boolean)
                        .map((value) => String(value).trim())
                        .filter((value, idx, arr) => arr.indexOf(value) === idx)

                      let menu = null
                      for (const lookupId of lookupIds) {
                        try {
                          const menuResponse = await restaurantAPI.getMenuByRestaurantId(lookupId, { noCache: true })
                          const rawMenu = getMenuFromResponse(menuResponse)
                          const normalizedMenu = normalizeMenu(rawMenu)
                          if (menuResponse?.data?.success && normalizedMenu?.sections?.length > 0) {
                            menu = normalizedMenu
                            break
                          }
                        } catch (lookupError) {
                          if (lookupError?.response?.status !== 404) throw lookupError
                        }
                      }
                      if (!menu || menu.sections.length === 0) {
                        const approvedFoods = await fetchApprovedFoods()
                        menu = buildFallbackMenuFromFoods(approvedFoods, restaurant)
                      }
                      if (menu?.sections?.length > 0) {
                        let featuredDish = restaurant.featuredDish
                        let featuredPrice = restaurant.featuredPrice
                        if (!featuredDish || !featuredPrice) {
                          for (const section of (menu.sections || [])) {
                            if (section.items && section.items.length > 0) {
                              const firstItem = section.items[0]
                              if (!featuredDish) featuredDish = firstItem.name
                              if (!featuredPrice) {
                                const originalPrice = firstItem.originalPrice || firstItem.price || 0
                                const discountPercent = firstItem.discountPercent || 0
                                featuredPrice = discountPercent > 0 ? Math.round(originalPrice * (1 - discountPercent / 100)) : originalPrice
                              }
                              break
                            }
                          }
                        }
                        return { ...restaurant, menu, featuredDish: featuredDish || null, featuredPrice: featuredPrice || null }
                      }
                    } catch (error) {
                      debugWarn(`Failed to fetch menu for restaurant ${restaurant.restaurantId}:`, error)
                    }
                    return { ...restaurant, menu: null }
                  })
                )
                if (enrichmentRequestId !== menuEnrichmentRequestRef.current) return
                transformedRestaurants.push(...batchResults)
              }
              if (enrichmentRequestId === menuEnrichmentRequestRef.current) {
                startTransition(() => {
                  setRestaurantsData(transformedRestaurants)
                })
              }
            } finally {
              if (enrichmentRequestId === menuEnrichmentRequestRef.current) {
                setIsEnrichingMenus(false)
              }
            }
          })()
        } else {
          setRestaurantsData([])
        }
      } catch (error) {
        debugError('Error fetching restaurants:', error)
        setRestaurantsData([])
      } finally {
        setLoadingRestaurants(false)
      }
    }
    fetchRestaurants()
  }, [zoneId, isOutOfService])

  useEffect(() => {
    if (category && categories && categories.length > 0) {
      const categorySlug = category.toLowerCase()
      const matchedCategory = categories.find(cat =>
        cat.slug === categorySlug ||
        cat.id === categorySlug ||
        cat.name.toLowerCase().replace(/\s+/g, '-') === categorySlug
      )
      if (matchedCategory) {
        setSelectedCategory(matchedCategory.slug || matchedCategory.id)
      } else {
        setSelectedCategory(categorySlug)
      }
    } else if (category) {
      setSelectedCategory(category.toLowerCase())
    }
  }, [category, categories])

  useEffect(() => {
    if (typeof window === "undefined" || !currentFilterStorageKey) return
    hasRestoredCategoryFiltersRef.current = false
    try {
      const raw = window.localStorage.getItem(CATEGORY_PAGE_FILTERS_STORAGE_KEY)
      if (!raw) return
      const stored = JSON.parse(raw)
      const categoryState = stored?.[currentFilterStorageKey]
      if (!categoryState || typeof categoryState !== "object") return
      setSortBy(categoryState.sortBy || null)
      setActiveFilters(new Set(Array.isArray(categoryState.activeFilters) ? categoryState.activeFilters : []))
    } catch {
      setSortBy(null)
      setActiveFilters(new Set())
    } finally {
      hasRestoredCategoryFiltersRef.current = true
    }
  }, [currentFilterStorageKey])

  useEffect(() => {
    if (typeof window === "undefined" || !currentFilterStorageKey) return
    if (!hasRestoredCategoryFiltersRef.current) return
    try {
      const raw = window.localStorage.getItem(CATEGORY_PAGE_FILTERS_STORAGE_KEY)
      const stored = raw ? JSON.parse(raw) : {}
      stored[currentFilterStorageKey] = {
        sortBy,
        activeFilters: Array.from(activeFilters),
      }
      window.localStorage.setItem(CATEGORY_PAGE_FILTERS_STORAGE_KEY, JSON.stringify(stored))
    } catch {}
  }, [currentFilterStorageKey, sortBy, activeFilters])

  useEffect(() => {
    const rail = categoryScrollRef.current
    if (!rail) return
    const selectedButton = rail.querySelector("[data-category-selected='true']")
    if (!selectedButton || typeof selectedButton.scrollIntoView !== "function") return
    selectedButton.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    })
  }, [selectedCategory, categories])

  const toggleFilter = (filterId) => {
    setActiveFilters(prev => {
      const newSet = new Set(prev)
      if (newSet.has(filterId)) {
        newSet.delete(filterId)
      } else {
        newSet.add(filterId)
      }
      return newSet
    })
    setIsLoadingFilterResults(true)
    setTimeout(() => {
      setIsLoadingFilterResults(false)
    }, 500)
  }

  useEffect(() => {
    if (!isFilterOpen || !rightContentRef.current) return
    const observerOptions = {
      root: rightContentRef.current,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id')
          if (sectionId) {
            setActiveScrollSection(sectionId)
            setActiveFilterTab(sectionId)
          }
        }
      })
    }, observerOptions)
    Object.values(filterSectionRefs.current).forEach(ref => {
      if (ref) observer.observe(ref)
    })
    return () => observer.disconnect()
  }, [isFilterOpen])

  const toggleFavorite = (id) => {
    setFavorites(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  const [expandedSubCategories, setExpandedSubCategories] = useState(new Set())

  const toggleSubCategoryExpand = (subId) => {
    setExpandedSubCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(subId)) newSet.delete(subId)
      else newSet.add(subId)
      return newSet
    })
  }

  const effectiveCategory = selectedSubCategory || selectedCategory

  const filteredRecommended = useMemo(() => {
    const sourceData = restaurantsData.length > 0 ? restaurantsData : []
    let filtered = [...sourceData]
    if (effectiveCategory && effectiveCategory !== 'all') {
      const expandedDishes = []
      filtered.forEach(r => {
        if (r.menu) {
          const hasCategoryItem = checkCategoryInMenu(r.menu, effectiveCategory)
          if (hasCategoryItem) {
            const categoryDishes = getAllCategoryDishesFromMenu(r.menu, effectiveCategory)
            if (categoryDishes.length > 0) {
              const validDishes = vegMode ? categoryDishes.filter((dish) => dish.foodType === "Veg") : categoryDishes;
              validDishes.forEach((dishForCard) => {
                expandedDishes.push({
                  ...r,
                  id: `${r.id || r.restaurantId}-${dishForCard.itemId}`,
                  dishId: dishForCard.itemId || `${r.id}-dish`,
                  categoryDish: dishForCard,
                  categoryDishName: dishForCard.name,
                  categoryDishPrice: dishForCard.price,
                  categoryDishImage: dishForCard.image,
                  subCategoryId: dishForCard.subCategoryId,
                  subCategoryName: dishForCard.subCategoryName,
                })
              })
            }
          }
        }
      })
      filtered = expandedDishes
      if (filtered.length === 0) {
        const fallbackDishes = getCategoryFallbackDishesFromApprovedFoods(effectiveCategory, sourceData)
        filtered = vegMode ? fallbackDishes.filter((dish) => dish.categoryDishFoodType === "Veg") : fallbackDishes
      }
    }
    return applyFiltersAndSorting(filtered)
  }, [effectiveCategory, activeFilters, deferredSearchQuery, restaurantsData, categoryKeywords, vegMode, approvedFoodsData, sortBy])

  const filteredAllRestaurants = useMemo(() => {
    const sourceData = restaurantsData.length > 0 ? restaurantsData : []
    let filtered = [...sourceData]
    if (effectiveCategory && effectiveCategory !== 'all') {
      const expandedDishes = []
      filtered.forEach(r => {
        if (r.menu) {
          const hasCategoryItem = checkCategoryInMenu(r.menu, effectiveCategory)
          if (hasCategoryItem) {
            const categoryDishes = getAllCategoryDishesFromMenu(r.menu, effectiveCategory)
            if (categoryDishes.length > 0) {
              const validDishes = vegMode ? categoryDishes.filter((dish) => dish.foodType === "Veg") : categoryDishes;
              validDishes.forEach((dishForCard) => {
                expandedDishes.push({
                  ...r,
                  id: `${r.id || r.restaurantId}-${dishForCard.itemId}`,
                  dishId: dishForCard.itemId || `${r.id}-dish`,
                  categoryDish: dishForCard,
                  categoryDishName: dishForCard.name,
                  categoryDishPrice: dishForCard.price,
                  categoryDishImage: dishForCard.image,
                  subCategoryId: dishForCard.subCategoryId,
                  subCategoryName: dishForCard.subCategoryName,
                })
              })
            }
          }
        }
      })
      filtered = expandedDishes
      if (filtered.length === 0) {
        const fallbackDishes = getCategoryFallbackDishesFromApprovedFoods(effectiveCategory, sourceData)
        filtered = vegMode ? fallbackDishes.filter((dish) => dish.categoryDishFoodType === "Veg") : fallbackDishes
      }
    }
    return applyFiltersAndSorting(filtered)
  }, [effectiveCategory, activeFilters, deferredSearchQuery, restaurantsData, categoryKeywords, vegMode, approvedFoodsData, sortBy])

  const showRestaurantSkeleton = useDelayedLoading(
    isLoadingFilterResults || loadingRestaurants || (isEnrichingMenus && effectiveCategory !== 'all' && filteredRecommended.length === 0),
    { delay: 140, minDuration: 360 }
  )

  const handleCategorySelect = (category) => {
    const categorySlug = category.slug || category.id
    setSelectedCategory(categorySlug)
    setSelectedSubCategory(null)
    if (categorySlug === 'all') navigate('/user/category/all')
    else navigate(`/user/category/${categorySlug}`)
  }

  const currentCategoryObj = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'all') return null
    return categories.find(c => (c.slug || c.id) === selectedCategory)
  }, [selectedCategory, categories])

  const subCategories = useMemo(() => {
    if (!currentCategoryObj) return []
    const parentMongoId = String(currentCategoryObj.mongoId || currentCategoryObj.id)
    return categories.filter(c => {
      const pId = c.parentId || c.parentCategoryId || c.subCategoryOf;
      return pId && String(pId) === parentMongoId;
    })
  }, [currentCategoryObj, categories])

  const topLevelCategories = useMemo(() => {
    return categories.filter(c => c.id === 'all' || !c.parentId);
  }, [categories])

  const shouldShowGrayscale = isOutOfService
  const isCategoryView = selectedCategory && selectedCategory !== 'all'

  return (
    <div className={`min-h-screen bg-white dark:bg-[#0a0a0a] ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 px-3 md:px-6 py-3 border-b border-gray-100 dark:border-gray-800">
            <button onClick={() => navigate('/user')} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0">
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="flex-1 relative max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Restaurant name or a dish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-11 md:h-12 rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] focus:bg-white dark:focus:bg-[#2a2a2a] focus:border-gray-500 dark:focus:border-gray-600 text-sm md:text-base dark:text-white placeholder:text-gray-600 dark:placeholder:text-gray-400"
              />
            </div>
          </div>
          <div ref={categoryScrollRef} className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide px-4 md:px-6 py-3 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {showCategorySkeleton ? <CategoryChipRowSkeleton className="py-3" /> : (
              topLevelCategories && topLevelCategories.length > 0 ? topLevelCategories.map((cat) => {
                const categorySlug = cat.slug || cat.id
                const isSelected = selectedCategory === categorySlug || selectedCategory === cat.id
                const isAllCategory = categorySlug === "all" || cat.id === "all"
                return (
                  <button key={cat.id} onClick={() => handleCategorySelect(cat)} data-category-selected={isSelected ? "true" : "false"} className={`flex flex-col items-center gap-1.5 flex-shrink-0 pb-2 transition-all ${isSelected ? 'border-b-2 border-[#EB590E]' : ''}`}>
                    {isAllCategory ? (
                      <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full border-2 transition-all flex items-center justify-center ${isSelected ? 'border-[#EB590E] shadow-lg bg-[#FFF2EB] dark:bg-[#EB590E]/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#222222]'}`}>
                        <Grid2x2 className={`h-6 w-6 md:h-7 md:w-7 ${isSelected ? 'text-[#EB590E]' : 'text-gray-500 dark:text-gray-400'}`} />
                      </div>
                    ) : (
                      <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 transition-all ${isSelected ? 'border-[#EB590E] shadow-lg' : 'border-transparent'}`}>
                        <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                      </div>
                    )}
                    <span className={`text-xs md:text-sm font-medium whitespace-nowrap ${isSelected ? 'text-[#EB590E] dark:text-[#EB590E]' : 'text-gray-600 dark:text-gray-400'}`}>{cat.name}</span>
                  </button>
                )
              }) : <div className="flex items-center justify-center py-4"><span className="text-sm text-gray-600 dark:text-gray-400">No categories available</span></div>
            )}
          </div>
          {/* Subcategory Row */}
          {subCategories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 md:px-6 py-3 bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-gray-800" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              <button onClick={() => setSelectedSubCategory(null)} className={`h-8 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all ${!selectedSubCategory ? 'bg-[#EB590E] text-white' : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'}`}>
                All {currentCategoryObj?.name || 'Items'}
              </button>
              {subCategories.map((sub) => {
                const isActive = selectedSubCategory === (sub.slug || sub.id)
                return (
                  <button key={sub.id} onClick={() => setSelectedSubCategory(sub.slug || sub.id)} className={`h-8 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all ${isActive ? 'bg-[#EB590E] text-white' : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'}`}>
                    {sub.name}
                  </button>
                )
              })}
            </div>
          )}
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:flex-wrap gap-2 px-4 md:px-6 py-2.5">
            <div className="flex items-center gap-2 overflow-x-auto md:overflow-x-visible scrollbar-hide pb-1 md:pb-0" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              <Button variant="outline" onClick={() => setIsFilterOpen(true)} className="h-7 md:h-8 px-2 md:px-3 rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0 transition-all bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="text-[11px] md:text-xs font-bold text-black dark:text-white">Filters</span>
              </Button>
              {[{ id: 'under-30-mins', label: 'Under 30m' }, { id: 'rating-4-plus', label: '4.0+' }, { id: 'rating-45-plus', label: '4.5+' }].map((filter) => {
                const isActive = activeFilters.has(filter.id)
                return (
                  <Button key={filter.id} variant="outline" onClick={() => toggleFilter(filter.id)} className={`h-7 md:h-8 px-2.5 md:px-3 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${isActive ? 'bg-[#EB590E] text-white border border-[#EB590E]' : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800'}`}>
                    <span className={`text-[11px] md:text-xs font-bold ${isActive ? 'text-white' : 'text-black dark:text-white'}`}>{filter.label}</span>
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Content Area */}
          <main className="flex-1 min-w-0 space-y-4 md:space-y-6">
            {isCategoryView && !selectedSubCategory && subCategories.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {subCategories.map((sub) => {
                  const subId = String(sub.mongoId || sub.id);
                  const isExpanded = expandedSubCategories.has(subId);
                  const subRecommended = filteredRecommended.filter(
                    (r) => 
                      String(r.subCategoryId || "") === subId || 
                      String(r.categoryDish?.subCategoryId || "") === subId ||
                      String(r.subCategoryName || "").toLowerCase() === String(sub.name).toLowerCase()
                  );
                  const subAll = filteredAllRestaurants.filter(
                    (r) => 
                      String(r.subCategoryId || "") === subId || 
                      String(r.categoryDish?.subCategoryId || "") === subId ||
                      String(r.subCategoryName || "").toLowerCase() === String(sub.name).toLowerCase()
                  );

                  if (subRecommended.length === 0 && subAll.length === 0) return null;

                  return (
                    <div key={sub.id} className="py-2 transition-all">
                      <button 
                        onClick={() => toggleSubCategoryExpand(subId)}
                        className="w-full flex items-center justify-between py-3 md:py-4 text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <h2 className="text-base md:text-lg font-semibold text-gray-800 dark:text-gray-200 group-hover:text-[#EB590E] transition-colors">
                            {sub.name}
                          </h2>
                          <span className="text-[10px] md:text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-full">
                            {subRecommended.length + subAll.length}
                          </span>
                        </div>
                        <div className={`transition-all ${isExpanded ? 'text-[#EB590E] rotate-180' : 'text-slate-400'}`}>
                          <ChevronDown className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                      </button>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                          >
                            <div className="pt-2 pb-6 space-y-6">
                              <CategoryResultsSection 
                                recommended={subRecommended}
                                allRestaurants={subAll}
                                isCategoryView={isCategoryView}
                                favorites={favorites}
                                toggleFavorite={toggleFavorite}
                                shouldShowGrayscale={shouldShowGrayscale}
                                showRestaurantSkeleton={showRestaurantSkeleton}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            ) : (
              <CategoryResultsSection 
                recommended={filteredRecommended}
                allRestaurants={filteredAllRestaurants}
                isCategoryView={isCategoryView}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                shouldShowGrayscale={shouldShowGrayscale}
                showRestaurantSkeleton={showRestaurantSkeleton}
                hideRecommended={selectedCategory === 'all'}
              />
            )}
            
            {/* Empty State */}
            {filteredAllRestaurants.length === 0 && (
              <div className="text-center py-12 md:py-20 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <UtensilsCrossed className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-bold">
                  {searchQuery ? `No matches for "${searchQuery}"` : "No restaurants found in this category"}
                </p>
                <Button variant="ghost" className="mt-4 text-[#EB590E] font-black" onClick={() => { setActiveFilters(new Set()); setSearchQuery(""); setSortBy(null); }}>
                  Clear Filters
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Filter Modal Portal */}
      {typeof window !== "undefined" && createPortal(
        <AnimatePresence>
          {isFilterOpen && (
            <div className="fixed inset-0 z-[100]">
              <div className="absolute inset-0 bg-black/50" onClick={() => setIsFilterOpen(false)} />
              <div className="absolute bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-4xl bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl max-h-[85vh] md:max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Filters and sorting</h2>
                  <button onClick={() => { setActiveFilters(new Set()); setSortBy(null); }} className="text-[#EB590E] font-medium text-sm md:text-base hover:underline">Clear all</button>
                </div>
                {/* ... other filter body content ... */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                  <Button className="w-full bg-[#EB590E] hover:bg-[#D94F0C] text-white py-6 text-lg font-bold rounded-xl" onClick={() => setIsFilterOpen(false)}>Apply Filters</Button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

function CategoryResultsSection({ 
  recommended, 
  allRestaurants, 
  isCategoryView, 
  favorites, 
  toggleFavorite,
  shouldShowGrayscale, 
  showRestaurantSkeleton,
  hideRecommended = false
}) {
  return (
    <div className="space-y-10">
      {recommended.length > 0 && !hideRecommended && (
        <section>
          <h2 className="text-xs sm:text-sm md:text-base font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4 md:mb-6">RECOMMENDED FOR YOU</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
            {(isCategoryView ? recommended : recommended.slice(0, 6)).map((restaurant) => (
              <Link key={restaurant.id} to={`/user/restaurants/${restaurant.slug || restaurant.name.toLowerCase().replace(/\s+/g, '-')}`} className="block">
                <div className={`group ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
                  <div className="relative aspect-square rounded-xl md:rounded-2xl overflow-hidden mb-2">
                    <img src={restaurant.categoryDishImage || restaurant.image} alt={restaurant.categoryDishName || restaurant.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {restaurant.offer && <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-[#EB590E] to-[#D94F0C] text-white text-[10px] md:text-xs font-semibold px-1.5 py-0.5 rounded shadow-sm">{restaurant.offer}</div>}
                    <div className="absolute bottom-0 left-0 bg-green-600 border-[4px] rounded-md border-white text-white text-[11px] md:text-xs font-bold px-1.5 py-0.5 flex items-center gap-0.5">
                      {restaurant.rating}
                      <Star className="h-2.5 w-2.5 md:h-3 md:w-3 fill-white" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-xs md:text-sm line-clamp-1">{restaurant.categoryDishName || restaurant.featuredDish || restaurant.name}</h3>
                  <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{restaurant.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="relative">
        <h2 className="text-xs sm:text-sm md:text-base font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4 md:mb-6">ALL RESTAURANTS</h2>
        {showRestaurantSkeleton && (
          <div className="absolute inset-0 z-10 rounded-lg bg-white/92 backdrop-blur-sm dark:bg-[#1a1a1a]/92">
            <LoadingSkeletonRegion label="Loading restaurants" className="h-full p-1 sm:p-2">
              <RestaurantGridSkeleton count={4} compact />
            </LoadingSkeletonRegion>
          </div>
        )}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 lg:gap-6 xl:gap-7 items-stretch ${showRestaurantSkeleton ? 'opacity-50' : 'opacity-100'} transition-opacity duration-300`}>
          {allRestaurants.map((restaurant) => {
            const isFavorite = favorites.has(restaurant.id)
            return (
              <Link key={restaurant.id} to={`/user/restaurants/${restaurant.slug || restaurant.name.toLowerCase().replace(/\s+/g, '-')}`} className="h-full flex">
                <Card className={`overflow-hidden cursor-pointer gap-0 border-0 dark:border-gray-800 group bg-white dark:bg-[#1a1a1a] shadow-md hover:shadow-xl transition-all duration-300 py-0 rounded-md h-full flex flex-col w-full ${shouldShowGrayscale ? 'grayscale opacity-75' : ''}`}>
                  <div className="relative h-44 sm:h-52 md:h-60 lg:h-64 xl:h-72 w-full overflow-hidden rounded-t-md flex-shrink-0">
                    <img src={restaurant.categoryDishImage || restaurant.image} alt={restaurant.categoryDishName || restaurant.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    {restaurant.offer && <div className="absolute bottom-4 left-0 bg-[#2563eb] text-white px-3 py-1.5 font-bold text-sm rounded-r-lg shadow-lg z-10">{restaurant.offer}</div>}
                    <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-9 w-9 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-[#2a2a2a]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(restaurant.id); }}>
                      <Bookmark className={`h-5 w-5 ${isFavorite ? "fill-gray-800 text-gray-800" : "text-gray-600"}`} />
                    </Button>
                  </div>
                  <CardContent className="p-4 flex-grow flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-[#EB590E] transition-colors line-clamp-1">{restaurant.name}</h3>
                        <div className="flex items-center gap-1 bg-green-600 text-white px-1.5 py-0.5 rounded text-sm font-bold shadow-sm">
                          {restaurant.rating}
                          <Star className="h-3 w-3 fill-white" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-3">
                        <span className="truncate">{restaurant.cuisine || 'Cuisines'}</span>
                        <span>•</span>
                        <span className="whitespace-nowrap">{restaurant.distance || '0 km'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
