const normalizeUrl = (value = "") => String(value || "").trim().replace(/\/+$/, "");

export const getApiBaseUrl = () => {
  if (typeof import.meta === "undefined" || !import.meta.env) {
    return "";
  }

  return normalizeUrl(import.meta.env.VITE_API_BASE_URL);
};

export const getApiOrigin = () => {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    if (typeof window !== "undefined" && import.meta?.env?.DEV) {
      const protocol = window.location?.protocol || "http:";
      const hostname = window.location?.hostname || "localhost";
      return `${protocol}//${hostname}:5000`;
    }
    return typeof window !== "undefined" ? window.location.origin : "";
  }

  return apiBaseUrl.replace(/\/api\/v1$/i, "").replace(/\/api$/i, "");
};

export const getSocketUrl = () => {
  if (typeof import.meta === "undefined" || !import.meta.env) {
    return "";
  }

  const explicitSocketUrl = normalizeUrl(import.meta.env.VITE_SOCKET_URL);
  if (explicitSocketUrl) {
    return explicitSocketUrl;
  }

  return getApiOrigin();
};
