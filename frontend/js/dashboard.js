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
