import { useState, useCallback, useEffect } from 'react';
import { adminAPI, shopAPI } from "@food/api";
import { foodImages } from "@food/constants/images";
import { normalizeImageUrl } from "@food/utils/common";
import BRAND_THEME from "@/config/brandTheme";

export const useCategoryData = (zoneId) => {
  const homepageDefaults = BRAND_THEME.tokens.homepage.defaults;
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [shopsData, setShopsData] = useState([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [categoryKeywords, setCategoryKeywords] = useState({});

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const response = await adminAPI.getPublicCategories(zoneId ? { zoneId } : {});
      if (response.data?.success) {
        const cats = response.data.data.categories || [];
        const transformed = [
          { id: homepageDefaults.allCategoryId, name: "All", image: null, slug: homepageDefaults.allCategoryId },
          ...cats.map((cat) => ({
            id: cat.slug || cat._id,
            name: cat.name,
            image: cat.image || foodImages[0],
            slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
          }))
        ];
        setCategories(transformed);

        const keywordsMap = {};
        cats.forEach((cat) => {
          const id = cat.slug || cat._id;
          const name = cat.name.toLowerCase();
          const words = name.split(/[\s-]+/).filter(w => w.length > 0);
          keywordsMap[id] = [name, ...words];
        });
        setCategoryKeywords(keywordsMap);
      }
    } catch (err) {
      console.error("Failed to fetch categories", err);
    } finally {
      setLoadingCategories(false);
    }
  }, [homepageDefaults.allCategoryId, zoneId]);

  const fetchShops = useCallback(async () => {
    try {
      setLoadingShops(true);
      const params = zoneId ? { zoneId } : {};
      const response = await shopAPI.getShops(params);
      if (response.data?.success) {
        const raw = response.data.data.shops || [];
        const transformed = raw.map(r => ({
          ...r,
          id: r.shopId || r._id,
          image: normalizeImageUrl(r.profileImage?.url || r.image),
          slug: r.slug || r.name?.toLowerCase().replace(/\s+/g, '-')
        }));
        setShopsData(transformed);
      }
    } catch (err) {
      console.error("Failed to fetch shops", err);
    } finally {
      setLoadingShops(false);
    }
  }, [zoneId]);

  useEffect(() => {
    fetchCategories();
    fetchShops();
  }, [fetchCategories, fetchShops]);

  return {
    categories, loadingCategories,
    shopsData, loadingShops,
    categoryKeywords
  };
};
