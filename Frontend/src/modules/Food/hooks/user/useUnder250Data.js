import { useState, useCallback, useEffect } from 'react';
import { shopAPI } from "@food/api";
import BRAND_THEME from "@/config/brandTheme";

export const useUnder250Data = (zoneId) => {
  const homepageDefaults = BRAND_THEME.tokens.homepage.defaults;
  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([
    { id: homepageDefaults.allCategoryId, name: "All", slug: homepageDefaults.allCategoryId },
  ]);
  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [restRes] = await Promise.all([
        shopAPI.getShops({ zoneId }),
      ]);

      if (restRes.data?.success) setShops(restRes.data.data.shops || []);
      // Old backend endpoints (categories + under-250 banner) removed.
      setCategories([
        { id: homepageDefaults.allCategoryId, name: "All", slug: homepageDefaults.allCategoryId },
      ]);
      setBanner(null);
    } catch (err) {
      console.error("Failed to fetch Under 250 data", err);
    } finally {
      setLoading(false);
    }
  }, [homepageDefaults.allCategoryId, zoneId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { shops, categories, banner, loading };
};
