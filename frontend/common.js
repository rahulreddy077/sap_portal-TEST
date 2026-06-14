/* ============================================================
   BHEL SAP Portal — Shared Utilities
   ============================================================ */

const API = "http://127.0.0.1:5000";

// ── Session helpers ───────────────────────────────────────────
function getSession() {
  const s = sessionStorage.getItem("bhel_user");
  return s ? JSON.parse(s) : null;
}
function setSession(data) {
  sessionStorage.setItem("bhel_user", JSON.stringify(data));
}
function clearSession() {
  sessionStorage.removeItem("bhel_user");
}
function requireAuth(allowedRoles) {
  const user = getSession();
  if (!user) { window.location.href = "../index.html"; return null; }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = "../index.html";
    return null;
  }
  return user;
}

// ── API helpers ───────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    console.error("API error:", e);
    throw e;
  }
}
async function apiGet(path)          { return apiFetch(path); }
async function apiPost(path, body)   { return apiFetch(path, { method: "POST",   body: JSON.stringify(body) }); }
async function apiPut(path, body)    { return apiFetch(path, { method: "PUT",    body: JSON.stringify(body) }); }
async function apiDelete(path, body) { return apiFetch(path, { method: "DELETE", body: JSON.stringify(body) }); }

async function apiUpload(path, formData, method = "POST") {
  const res = await fetch(API + path, { method, body: formData });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Toast notifications ───────────────────────────────────────
function toast(msg, type = "info", duration = 3200) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .4s"; }, duration);
  setTimeout(() => el.remove(), duration + 450);
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("open");
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("open");
}
function closeAllModals() {
  document.querySelectorAll(".modal-overlay.open").forEach(m => m.classList.remove("open"));
}
document.addEventListener("click", e => {
  if (e.target.classList.contains("modal-overlay")) closeAllModals();
  if (e.target.classList.contains("modal-close"))   closeAllModals();
});

// ── Date helpers ──────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}
function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return fmtDate(iso);
}

// ── Status badge ──────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    OPEN:     ["badge-warning", "Open"],
    ANSWERED: ["badge-success", "Answered"],
    CLOSED:   ["badge-gray",    "Closed"],
    PENDING:  ["badge-warning", "Pending"],
    APPROVED: ["badge-success", "Approved"],
    REJECTED: ["badge-danger",  "Rejected"],
    MANUAL:   ["badge-info",    "Manual"],
    VIDEO:    ["badge-warning", "Video"],
    TRANSACTION: ["badge-success", "Transaction"],
    USER:         ["badge-gray",    "User"],
    MODULE_ADMIN: ["badge-primary", "Module Admin"],
    SUPER_ADMIN:  ["badge-danger",  "Super Admin"],
  };
  const [cls, label] = map[status] || ["badge-gray", status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ── Library type icon ─────────────────────────────────────────
function libIcon(type) {
  return { MANUAL: "📄", VIDEO: "🎬", TRANSACTION: "⚡" }[type] || "📁";
}

// ── Sidebar active nav ────────────────────────────────────────
function setActiveNav(id) {
  document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

// ── Bookmark toggle button ────────────────────────────────────
async function toggleBookmark(refType, refId, btn) {
  const user = getSession();
  if (!user) return;
  try {
    const res = await apiPost("/bookmarks", { user_id: user.user_id, ref_type: refType, ref_id: refId });
    btn.textContent = res.bookmarked ? "🔖 Bookmarked" : "🔖 Bookmark";
    toast(res.message, res.bookmarked ? "success" : "info");
  } catch { toast("Could not update bookmark", "error"); }
}

// ── Render sidebar user info ──────────────────────────────────
function renderSidebarUser() {
  const user = getSession();
  if (!user) return;
  const el = document.getElementById("sidebar-user-info");
  if (el) {
    el.innerHTML = `
      <div class="user-name">${user.name}</div>
      <div class="user-role">${user.role.replace("_", " ")}</div>
      ${user.department_name ? `<div class="user-dept">${user.department_name} · ${user.sap_module || ""}</div>` : ""}
    `;
  }
}

// ── Logout ────────────────────────────────────────────────────
function logout() {
  clearSession();
  window.location.href = "../index.html";
}

// ── Notification badge in topbar ──────────────────────────────
async function loadNotifCount() {
  const user = getSession();
  if (!user) return;
  try {
    const notifs = await apiGet(
      `/notifications?user_id=${user.user_id}&department_id=${user.department_id || ""}&limit=50`
    );
    const unread = notifs.filter(n => !n.is_read).length;
    const dot = document.getElementById("notif-dot");
    if (dot) dot.style.display = unread > 0 ? "block" : "none";
  } catch {}
}

// ── FAQ accordion ─────────────────────────────────────────────
function initFaqAccordion() {
  document.querySelectorAll(".faq-question").forEach(q => {
    q.addEventListener("click", () => {
      const item = q.closest(".faq-item");
      item.classList.toggle("open");
    });
  });
}

// ── Sidebar toggle (mobile) ───────────────────────────────────
function initMobileToggle() {
  const toggle = document.getElementById("sidebar-toggle");
  const sidebar = document.querySelector(".sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  }
}

// Tab system
function initTabs(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      container.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const pane = document.getElementById(btn.dataset.tab);
      if (pane) pane.classList.add("active");
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  renderSidebarUser();
  loadNotifCount();
  initFaqAccordion();
  initMobileToggle();
});