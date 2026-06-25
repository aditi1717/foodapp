import { useState, useCallback, useEffect } from 'react';
import { shopAPI } from "@food/api";
import { normalizeImageUrl, extractImages, calculateDistance, slugify } from "@food/utils/common";
import BRAND_THEME from "@/config/brandTheme";

export const useHomeData = (location, zoneId) => {
  const homepageDefaults = BRAND_THEME.tokens.homepage.defaults;
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [landingCategories, setLandingCategories] = useState([]);
  const [exploreMoreItems, setExploreMoreItems] = useState([]);
  const [exploreMoreHeading, setExploreMoreHeading] = useState(homepageDefaults.exploreMoreHeading);
  
  const [loadingBanners, setLoadingBanners] = useState(true);
  const [heroBannerImages, setHeroBannerImages] = useState([]);
  const [heroBannersData, setHeroBannersData] = useState([]);

  const [loadingShops, setLoadingShops] = useState(true);
  const [shopsData, setShopsData] = useState([]);
  const [recommendedShops, setRecommendedShops] = useState([]);
  
  const [menuCategories, setMenuCategories] = useState([]);
  const [loadingMenuCategories, setLoadingMenuCategories] = useState(false);
  const [shopDietMeta, setShopDietMeta] = useState({});

  // Old backend endpoints (hero banners / landing config) are not used anymore.
  // Keep UI stable by setting safe defaults once.
  const initLandingConfig = useCallback(() => {
    setLoadingConfig(true);
    setLandingCategories([]);
    setExploreMoreItems([]);
    setExploreMoreHeading(homepageDefaults.exploreMoreHeading);
    setRecommendedShops([]);
    setLoadingConfig(false);
  }, [homepageDefaults.exploreMoreHeading]);

  const initBanners = useCallback(() => {
    setLoadingBanners(true);
    setHeroBannersData([]);
    setHeroBannerImages([]);
    setLoadingBanners(false);
  }, []);

  const fetchShops = useCallback(async (filters = {}) => {
    try {
      setLoadingShops(true);
      const params = {
        _ts: Date.now(),
        ...(filters.sortBy && { sortBy: filters.sortBy }),
        ...(filters.cuisine && { cuisine: filters.cuisine }),
        ...(zoneId && { zoneId })
      };
      const res = await shopAPI.getShops(params);
      if (res.data?.success) {
        const raw = res.data.data.shops || [];
        const userLat = location?.latitude;
        const userLng = location?.longitude;

        const transformed = raw.map(r => {
          const rLoc = r.location;
          const rLat = rLoc?.latitude || (rLoc?.coordinates?.[1]);
          const rLng = rLoc?.longitude || (rLoc?.coordinates?.[0]);
          
          let distInKm = calculateDistance(userLat, userLng, rLat, rLng);
          const coverImgs = extractImages(r.coverImages);
          const menuImgs = extractImages(r.menuImages);
          const profileImgs = extractImages(r.profileImage || r.image);
          const allImgs = Array.from(new Set([...coverImgs, ...menuImgs, ...profileImgs]));

          return {
            ...r,
            id: r.shopId || r._id,
            mongoId: r._id,
            distanceInKm: distInKm,
            image: allImgs[0] || "",
            images: allImgs,
            rating: r.rating || 4.5,
            cuisine: r.cuisines?.[0] || "Multi-cuisine"
          };
        });
        setShopsData(transformed);
      }
    } finally {
      setLoadingShops(false);
    }
  }, [location, zoneId]);

  const fetchMenuMeta = useCallback(async () => {
    if (!shopsData.length) return;
    setLoadingMenuCategories(true);
    try {
      const categoryMap = new Map();
      const dietMeta = {};

      const menuResponses = await Promise.all(
        shopsData.slice(0, 50).map(async (r) => {
          try {
            const res = await shopAPI.getMenuByShopId(r.id);
            return { id: r.id, menu: res?.data?.data?.menu };
          } catch {
            return { id: r.id, menu: null };
          }
        })
      );

      menuResponses.forEach(({ id, menu }) => {
        let hasVeg = false, hasNonVeg = false;
        const sections = menu?.sections || [];
        sections.forEach(s => {
          const items = s.items || [];
          items.forEach(i => {
            const type = String(i.foodType || "").toLowerCase();
            if (type === "veg") hasVeg = true;
            if (type.includes("non")) hasNonVeg = true;
          });
          const slug = slugify(s.name);
          if (slug && !categoryMap.has(slug)) {
            categoryMap.set(slug, {
              id: slug, name: s.name, slug, label: s.name,
              image: items[0]?.image ? normalizeImageUrl(items[0].image) : ""
            });
          }
        });
        dietMeta[id] = { hasVeg, hasNonVeg, isPureVeg: hasVeg && !hasNonVeg };
      });

      setMenuCategories(Array.from(categoryMap.values()));
      setShopDietMeta(dietMeta);
    } finally {
      setLoadingMenuCategories(false);
    }
  }, [shopsData]);

  useEffect(() => {
    initLandingConfig();
    initBanners();
  }, [initLandingConfig, initBanners]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  useEffect(() => {
    fetchMenuMeta();
  }, [fetchMenuMeta]);

  return {
    loadingConfig, landingCategories, exploreMoreItems, exploreMoreHeading, recommendedShops,
    loadingBanners, heroBannerImages, heroBannersData,
    loadingShops, shopsData, setShopsData,
    loadingMenuCategories, menuCategories, shopDietMeta,
    fetchShops
  };
};
