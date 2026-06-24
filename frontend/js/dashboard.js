window.onload = loadDashboard;

async function loadDashboard() {
  const user = getSession();
  if (!user) return;

  try {
    // 1. Fetch GLOBAL library stats (all modules — not dept filtered)
    // Users/Module Admins can access all modules' files, so show total count
    const libStats = await apiGet("/library/stats");
    document.getElementById("manuals").innerText = libStats.total;
    document.getElementById("videos").innerText = libStats.videos;

    // 2. Fetch DEPT-SPECIFIC stats for queries and FAQs (relevant to user's work)
    const stats = await apiGet(
      `/dashboard/stats?department_id=${user.department_id || ""}&user_id=${user.user_id}&role=${user.role}`
    );
    document.getElementById("queries").innerText = stats.queries.open;
    document.getElementById("faqs").innerText = stats.faqs;

    // 2. Fetch FAQs and render accordion
    let faqsUrl = "/faqs";
    if (user.department_id) {
      faqsUrl += `?department_id=${user.department_id}`;
    }
    const faqContainer = document.getElementById("dashboard-faq-list");
    try {
      const faqsList = await apiGet(faqsUrl);
      if (faqsList.length === 0) {
        faqContainer.innerHTML = `
          <div class="empty-state">
            <p style="font-size: 0.85rem;">No FAQs available for your department yet.</p>
          </div>`;
      } else {
        faqContainer.innerHTML = faqsList.slice(0, 5).map(faq => `
          <div class="faq-item" style="border: 1px solid var(--border); margin-bottom: 8px; border-radius: var(--radius);">
            <div class="faq-question" style="font-size: 0.9rem; padding: 10px 14px; background-color: var(--bg);">
              <span><strong>Q:</strong> ${faq.question}</span>
              <span class="faq-arrow">▼</span>
            </div>
            <div class="faq-answer" style="font-size: 0.85rem; padding: 0 14px;">
              <p style="white-space: pre-wrap; margin: 0; padding-bottom: 8px;">${faq.answer}</p>
            </div>
          </div>
        `).join('');

        // Bind collapsible actions
        faqContainer.querySelectorAll(".faq-question").forEach(q => {
          q.addEventListener("click", () => {
            const item = q.closest(".faq-item");
            item.classList.toggle("open");
          });
        });
      }
    } catch (faqErr) {
      console.error(faqErr);
      faqContainer.innerHTML = `<p class="text-muted text-small">Could not load FAQs.</p>`;
    }

    // 3. Fetch frequently used Transaction codes for Quick Links (global, not module-specific)
    try {
      const txns = await apiGet("/library?item_type=TRANSACTION");
      const sortedTxns = txns.sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 8);
      const linksContainer = document.getElementById("quick-links-list");
      if (sortedTxns.length > 0) {
        linksContainer.innerHTML = sortedTxns.map(t => `
          <a href="#" class="quick-link" onclick="viewTxnDetails(${t.item_id}); return false;">
            <span class="ql-code">${t.transaction_code}</span>
            <span>${t.title}</span>
          </a>
        `).join('');
      } else {
        linksContainer.innerHTML = `
          <div class="empty-state">
            <p style="font-size: 0.85rem;">No transaction shortcuts added yet.</p>
          </div>`;
      }
    } catch (txnErr) {
      console.error("Failed to load global transaction codes:", txnErr);
    }
  } catch (e) {
    console.error("Dashboard load failed:", e);
    toast("Could not load dashboard statistics", "error");
  }
}

// Transaction code detail display trigger
async function viewTxnDetails(id) {
  try {
    const user = getSession();
    // Send user details to log access in backend
    const item = await apiGet(`/library/${id}?user_id=${user ? user.user_id : ""}&role=${user ? user.role : ""}`);
    toast(`T-Code ${item.transaction_code}: ${item.description || item.title}`, "info");
  } catch {
    toast("Could not load T-code information", "error");
  }
}

// Note: Global search is now handled by triggerPageSearch in common.js
// using the inline dropdown below the topbar search bar.


