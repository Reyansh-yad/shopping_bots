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
export async function register(username, password) {
  return post("/auth/register", { username, password });
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
