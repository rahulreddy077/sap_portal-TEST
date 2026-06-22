/* ============================================================
   BHEL SAP Portal — Shared Utilities & Layout Engine
   ============================================================ */

const RENDER_BACKEND_URL = "https://sap-portal-backend-tnc3.onrender.com";
const API = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:5000"
    : RENDER_BACKEND_URL;

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
  if (!user) {
    window.location.href = "../index.html";
    return null;
  }
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
function parseUTCDate(iso) {
  if (!iso) return new Date();
  if (!iso.endsWith("Z") && !iso.includes("+") && (iso.lastIndexOf("-") < 10)) {
    return new Date(iso + "Z");
  }
  return new Date(iso);
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = parseUTCDate(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = parseUTCDate(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}
function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - parseUTCDate(iso)) / 1000;
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

// ── Layout Render Engine ───────────────────────────────────────
function renderLayout(activeId) {
  const user = getSession();
  if (!user) return;

  // Header Title mapping
  const pageTitles = {
    dashboard: "Dashboard Overview",
    library: "SAP Training Library",
    query: "Q&A Discussion Forum",
    faqs: "Frequently Asked Questions",
    users: "User Directory Management"
  };
  const title = pageTitles[activeId] || "BHEL SAP Portal";

  // Build Sidebar HTML
  const logoPath = (window.location.pathname.includes("/pages/")) 
      ? "../css/images/bhel_logo_official.png" 
      : "css/images/bhel_logo_official.png";

  let sidebarHtml = `
    <div class="sidebar">
      <div class="sidebar-header">
        <div class="brand" style="display: flex; align-items: center;">
          <img src="${logoPath}" alt="BHEL Logo" style="height: 38px; width: 38px; margin-right: 10px; border-radius: 4px; object-fit: contain;">
          <div>
            <span class="brand-name" style="font-size: 11px; font-weight: 700; display: block; color: var(--gold-primary); text-transform: uppercase; line-height: 1.2;">SAP Knowledge Management Portal</span>
            <span class="brand-sub" style="font-size: 10px; opacity: 0.8; display: block; line-height: 1.2;">BHEL Ltd. Hyderabad</span>
          </div>
        </div>
      </div>
      <div class="sidebar-user" id="sidebar-user-info">
        <div class="user-name">${user.name}</div>
        <div class="user-role">${user.role.replace("_", " ")}</div>
        ${user.department_name ? `<div class="user-dept">${user.department_name} · ${user.sap_module || ""}</div>` : ""}
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">Main Menu</div>
        <a href="dashboard.html" class="nav-item ${activeId === 'dashboard' ? 'active' : ''}" id="nav-dashboard">
          <span class="nav-icon">📊</span> Dashboard
        </a>
        <a href="library.html" class="nav-item ${activeId === 'library' ? 'active' : ''}" id="nav-library">
          <span class="nav-icon">📄</span> SAP Library
        </a>
        <a href="query.html" class="nav-item ${activeId === 'query' ? 'active' : ''}" id="nav-query">
          <span class="nav-icon">💬</span> Q&A Forum
        </a>
        <a href="faqs.html" class="nav-item ${activeId === 'faqs' ? 'active' : ''}" id="nav-faqs">
          <span class="nav-icon">❓</span> FAQs
        </a>
  `;

  // Admins & Super Admins get the user management option
  if (user.role === "SUPER_ADMIN" || user.role === "MODULE_ADMIN") {
    sidebarHtml += `
        <div class="nav-section">Administration</div>
        <a href="users.html" class="nav-item ${activeId === 'users' ? 'active' : ''}" id="nav-users">
          <span class="nav-icon">👥</span> Manage Users
        </a>
    `;
  }

  sidebarHtml += `
      </nav>
      <div class="sidebar-footer">
        <div class="nav-item" onclick="logout()">
          <span class="nav-icon">🚪</span> Sign Out
        </div>
      </div>
    </div>
  `;

  // Build Topbar HTML
  const topbarHtml = `
    <header class="topbar" style="display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 15px;">
        <button class="icon-btn" id="sidebar-toggle">☰</button>
        <h1 class="topbar-title">${title}</h1>
        ${user.department_name ? `<span class="topbar-module">${user.sap_module || "SAP"}</span>` : ""}
      </div>
      
      <div class="topbar-search" style="flex: 1; max-width: 400px; margin: 0 20px; position: relative;">
        <input type="text" id="global-search" placeholder="Search page content..." oninput="triggerPageSearch(this.value)">
      </div>
      
      <div class="topbar-actions">
        <button class="icon-btn" id="notif-btn" onclick="openNotifModal()">
          🔔
          <span class="notif-dot" id="notif-dot" style="display: none;"></span>
        </button>
      </div>
    </header>
  `;

  // Modal templates for dynamic layouts (like notifications modal)
  const notifModalHtml = `
    <div class="modal-overlay" id="notif-modal">
      <div class="modal" style="width: 480px;">
        <div class="modal-header">
          <h3 class="modal-title">Recent Notifications</h3>
          <button class="modal-close" onclick="closeModal('notif-modal')">×</button>
        </div>
        <div class="notif-list" id="modal-notif-list">
          <div class="empty-state">
            <div class="empty-icon">🔔</div>
            <p>No notifications</p>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn btn-outline btn-sm" onclick="markNotificationsAllRead()">Mark all read</button>
          <button class="btn btn-danger btn-sm" onclick="clearAllNotifications()">Clear All</button>
          <button class="btn btn-primary btn-sm" onclick="closeModal('notif-modal')">Close</button>
        </div>
      </div>
    </div>
  `;

  // Restructure the original document body
  const pageContent = document.body.innerHTML;
  document.body.innerHTML = `
    <div class="layout">
      ${sidebarHtml}
      <div class="main">
        ${topbarHtml}
        <div class="content">
          ${pageContent}
        </div>
      </div>
    </div>
    ${notifModalHtml}
  `;
}

// ── Notification modal logic ──────────────────────────────────
async function openNotifModal() {
  openModal("notif-modal");
  const user = getSession();
  if (!user) return;
  try {
    const notifs = await apiGet(
      `/notifications?user_id=${user.user_id}&department_id=${user.department_id || ""}&limit=20`
    );
    const listEl = document.getElementById("modal-notif-list");
    if (!listEl) return;

    if (notifs.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔔</div>
          <p>No notifications found.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = notifs.map(n => `
      <div class="notif-item ${!n.is_read ? 'unread' : ''}" onclick="markNotifRead(${n.notification_id})">
        <div class="notif-icon">${n.type === 'QUERY_ANSWERED' ? '💬' : n.type === 'MANUAL_UPDATED' ? '📄' : '📢'}</div>
        <div style="flex: 1;">
          <div class="notif-title">${n.title}</div>
          <div class="notif-body">${n.body || ''}</div>
          <div class="notif-date">${timeAgo(n.created_at)}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function markNotifRead(id) {
  try {
    await apiPut(`/notifications/${id}/read`);
    loadNotifCount();
    openNotifModal();
  } catch {}
}

async function markNotificationsAllRead() {
  const user = getSession();
  if (!user) return;
  try {
    await apiPut(`/notifications/mark-all-read`, { user_id: user.user_id, department_id: user.department_id });
    loadNotifCount();
    openNotifModal();
    toast("All notifications marked as read", "success");
  } catch {}
}

async function clearAllNotifications() {
  const user = getSession();
  if (!user) return;
  try {
    const response = await fetch(`${API}/notifications/clear-all`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.user_id, department_id: user.department_id })
    });
    const res = await response.json();
    loadNotifCount();
    openNotifModal();
    toast(res.message || "Notifications cleared", "success");
  } catch (e) {
    toast("Could not clear notifications", "error");
  }
}

function triggerPageSearch(query) {
  const q = query.trim().toLowerCase();
  if (typeof filterLibrary === "function") {
    filterLibrary(q);
  }
  if (typeof filterQueries === "function") {
    filterQueries(q);
  }
  if (typeof filterFAQs === "function") {
    filterFAQs(q);
  }
  if (typeof filterUsers === "function") {
    filterUsers(q);
  }
}

// ── Page Layout Auto Initialization ─────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;
  const page = path.substring(path.lastIndexOf('/') + 1).replace('.html', '');

  // Define dashboard pages that should be formatted inside the layout frame
  const dashboardPages = ["dashboard", "library", "query", "faqs", "users"];
  
  if (dashboardPages.includes(page)) {
    const user = requireAuth();
    if (user) {
      renderLayout(page);
      loadNotifCount();
      
      // Initialize shared visual event listeners
      const toggle = document.getElementById("sidebar-toggle");
      const sidebar = document.querySelector(".sidebar");
      if (toggle && sidebar) {
        toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
      }
    }
  }
});