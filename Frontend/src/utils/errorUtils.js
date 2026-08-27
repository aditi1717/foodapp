/**
 * Safely extracts a user-friendly error message from an API error or JS Error object.
 * Prevents displaying raw Axios status messages like "Request failed with status code 400".
 */
export const getErrorMessage = (err, fallback = "An error occurred. Please try again.") => {
  const serverMsg =
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.response?.data?.msg ||
    (typeof err?.response?.data === "string" ? err.response.data : null);

  if (serverMsg && typeof serverMsg === "string" && serverMsg.trim()) {
    return serverMsg.trim();
  }

  if (
    err?.message &&
    typeof err.message === "string" &&
    !err.message.toLowerCase().includes("status code") &&
    !err.message.toLowerCase().includes("network error")
  ) {
    return err.message;
  }

  return fallback;
};
