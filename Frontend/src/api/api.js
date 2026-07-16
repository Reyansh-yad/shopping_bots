/**
 * PRC Engine — API Client
 * All backend calls go through this module.
 * Backend base URL is proxied via vite.config.js in dev.
 */

const BASE = "";  // Proxied by vite dev server → http://localhost:8000

// ─── Helpers ────────────────────────────────────────────────────────────────

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Request failed (${res.status})`);
  }
  return data;
}

// ─── Session helpers (localStorage) ─────────────────────────────────────────

export function saveSession(sessionId, username) {
  localStorage.setItem("prc_session_id", sessionId);
  localStorage.setItem("prc_username", username);
}

export function getSession() {
  return {
    sessionId: localStorage.getItem("prc_session_id"),
    username: localStorage.getItem("prc_username"),
  };
}

export function clearSession() {
  localStorage.removeItem("prc_session_id");
  localStorage.removeItem("prc_username");
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem("prc_session_id"));
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Login → returns { status, session_id, message }
 */
export async function login(username, password) {
  return post("/auth/login", { username, password });
}

/**
 * Register → returns { status, message }
 */
export async function register(username, password, fullName = "") {
  return post("/auth/register", { username, password, full_name: fullName });
}

/**
 * Logout → returns { status, message }
 */
export async function logout(sessionId) {
  return post("/auth/logout", { session_id: sessionId });
}

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Search for products.
 * filters: "relevance" | "price-asc" | "price-desc" | "rating-asc" | "rating-desc"
 * Returns { status, _product_id, products: Product[] }
 */
export async function search(productSearch, filters = "relevance", pageNumber = 1) {
  return post("/search", {
    product_search: productSearch,
    filters,
    page_number: pageNumber,
  });
}

// ─── Profile / Tracking ───────────────────────────────────────────────────────

/**
 * Get user profile + tracked products.
 * Returns { status, user_id, username, tracked_products }
 */
export async function getProfile(sessionId) {
  return post("/profile/", { session_id: sessionId });
}

/**
 * Track a product.
 */
export async function trackProduct(sessionId, productLink, productName, latestPrice) {
  return post("/profile/track", {
    session_id: sessionId,
    product_link: productLink,
    product_name: productName,
    latest_price: String(latestPrice),
  });
}

/**
 * Untrack a product.
 */
export async function untrackProduct(sessionId, productLink) {
  return post("/profile/untrack", {
    session_id: sessionId,
    product_link: productLink,
  });
}

export async function getDashboardStats(sessionId) {
  return post("/profile/stats", { session_id: sessionId });
}

// ─── Profile / Tracking (Extended) ──────────────────────────────────────────────

/**
 * Get user's tracked products.
 * Returns { status, items: TrackedProduct[] }
 */
export async function getTrackedProducts(sessionId) {
  return post("/profile/tracked", { session_id: sessionId });
}

/**
 * Update tracked product metadata.
 * updates: { target_price?: number, notify?: boolean }
 */
export async function updateTrackedProduct(sessionId, id, updates) {
  return post("/profile/tracked/update", {
    session_id: sessionId,
    tracked_product_id: id,
    ...updates
  });
}

/**
 * Remove a tracked product.
 */
export async function removeTrackedProduct(sessionId, id) {
  return post("/profile/tracked/remove", {
    session_id: sessionId,
    tracked_product_id: id
  });
}

/**
 * Export tracked products to CSV format.
 * This is a client-side function that formats data as CSV.
 * @param {Array} items - Array of tracked product items
 * @returns {string} CSV formatted string
 */
export async function exportTrackedCSV(items) {
  // This is a client-side function that converts items to CSV
  // It doesn't make an API call since it's just formatting data
  const headers = ["Product Name", "Latest Price", "Target Price", "Notify", "Source", "Rating"];
  const rows = items.map(item => [
    `"${item.product_name || ""}"`,
    `${item.latest_price || ""}`,
    `${item.target_price || ""}`,
    `${item.notify || ""}`,
    `${item.source_site || ""}`,
    `${item.rating || ""}`
  ].join(","));
  return [headers.join(","), ...rows].join("\n");
}
