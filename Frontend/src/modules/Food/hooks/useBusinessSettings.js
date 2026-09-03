import { useState, useEffect } from 'react';
import { loadBusinessSettings, getCachedSettings } from '@food/utils/businessSettings';
import BRAND_THEME from "@/config/brandTheme";
import { DEFAULT_FOOD_LOGO } from "@food/utils/defaultBranding";

/**
 * Custom hook to get business settings
 * @returns {Object} Business settings including logo, company name, favicon
 */
export const useBusinessSettings = () => {
  const [settings, setSettings] = useState(() => {
    return getCachedSettings() || {
      companyName: BRAND_THEME.brandName,
      logo: { url: DEFAULT_FOOD_LOGO },
      favicon: { url: DEFAULT_FOOD_LOGO }
    };
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const fetched = await loadBusinessSettings();
        if (fetched) {
          setSettings(fetched);
        }
      } catch (error) {
        console.warn('Failed to load business settings:', error);
      }
    };

    fetchSettings();

    const handleSettingsUpdate = () => {
      const updated = getCachedSettings();
      if (updated) {
        setSettings(updated);
      }
    };

    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate);
    };
  }, []);

  return settings;
};
