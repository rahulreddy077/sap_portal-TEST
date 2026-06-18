window.onload = loadDashboard;

async function loadDashboard() {
  const user = getSession();
  if (!user) return;

  try {
    // 1. Fetch dashboard stats
    const stats = await apiGet(
      `/dashboard/stats?department_id=${user.department_id || ""}&user_id=${user.user_id}&role=${user.role}`
    );

    document.getElementById("manuals").innerText = stats.library.total;
    document.getElementById("videos").innerText = stats.library.videos;
    document.getElementById("queries").innerText = stats.queries.open;
    document.getElementById("faqs").innerText = stats.faqs;

    // 2. Fetch full user profile
    const profile = await apiGet(`/users/${user.user_id}`);
    document.getElementById("prof-avatar").innerText = profile.name.charAt(0).toUpperCase();
    document.getElementById("prof-name").innerText = profile.name;
    document.getElementById("prof-role").innerText = profile.role.replace("_", " ");
    document.getElementById("prof-id").innerText = profile.employee_id;
    document.getElementById("prof-dept").innerText = user.department_name ? `${user.department_name} (${user.sap_module})` : "Super Administrator";
    document.getElementById("prof-designation").innerText = profile.designation || "Not Assigned";
    document.getElementById("prof-phone").innerText = profile.phone || "Not Assigned";

    // 3. Fetch Transaction codes for Quick Links (if in a department)
    if (user.department_id) {
      const txns = await apiGet(`/library?department_id=${user.department_id}&item_type=TRANSACTION`);
      const linksContainer = document.getElementById("quick-links-list");
      if (txns.length > 0) {
        linksContainer.innerHTML = txns.map(t => `
          <a href="#" class="quick-link" onclick="viewTxnDetails(${t.item_id}); return false;">
            <span class="ql-code">${t.transaction_code}</span>
            <span>${t.title}</span>
          </a>
        `).join('');
      } else {
        linksContainer.innerHTML = `
          <div class="empty-state">
            <p style="font-size: 0.85rem;">No transaction shortcuts added for ${user.sap_module || 'your module'} yet.</p>
          </div>`;
      }
    }
  } catch (e) {
    console.error("Dashboard load failed:", e);
    toast("Could not load dashboard statistics", "error");
  }
}

// Transaction code detail display trigger
async function viewTxnDetails(id) {
  try {
    const item = await apiGet(`/library/${id}`);
    toast(`T-Code ${item.transaction_code}: ${item.description || item.title}`, "info");
  } catch {
    toast("Could not load T-code information", "error");
  }
}
