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

// Global Search handler triggered from the common topbar search input
async function triggerDashboardGlobalSearch(q) {
  const overlay = document.getElementById("global-search-overlay");
  const content = document.getElementById("global-search-results-content");
  
  if (!q) {
    overlay.style.display = "none";
    return;
  }

  overlay.style.display = "block";
  content.innerHTML = `<div class="spinner" style="margin: 20px auto;"></div>`;

  try {
    const [library, queries, faqs] = await Promise.all([
      apiGet(`/library?search=${encodeURIComponent(q)}`),
      apiGet(`/queries?search=${encodeURIComponent(q)}`),
      apiGet(`/faqs?search=${encodeURIComponent(q)}`)
    ]);

    let resultsHtml = "";

    // 1. Render matching manuals/videos
    const docs = library.filter(item => item.item_type !== "TRANSACTION");
    if (docs.length > 0) {
      resultsHtml += `
        <div class="global-search-section">
          <h4>SAP Manuals & Media</h4>
          ${docs.map(item => `
            <div class="global-search-item">
              <a href="library.html" class="global-search-link" onclick="sessionStorage.setItem('library_search_target', '${item.title.replace(/'/g, "\\'")}');">
                <strong>${item.title}</strong> - ${item.description || 'No description'}
              </a>
              <span class="global-search-type">${item.item_type}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 2. Render matching T-Codes
    const tcodes = library.filter(item => item.item_type === "TRANSACTION");
    if (tcodes.length > 0) {
      resultsHtml += `
        <div class="global-search-section">
          <h4>SAP Transaction Codes</h4>
          ${tcodes.map(item => `
            <div class="global-search-item">
              <a href="#" class="global-search-link" onclick="viewTxnDetails(${item.item_id}); return false;">
                <strong>${item.transaction_code}</strong> - ${item.title} (${item.description || 'No description'})
              </a>
              <span class="global-search-type">T-CODE</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 3. Render matching Q&A Queries
    if (queries.length > 0) {
      resultsHtml += `
        <div class="global-search-section">
          <h4>Q&A Forum Discussions</h4>
          ${queries.map(qItem => `
            <div class="global-search-item">
              <a href="query.html" class="global-search-link" onclick="sessionStorage.setItem('query_search_target', '${qItem.title.replace(/'/g, "\\'")}');">
                <strong>${qItem.title}</strong> - ${qItem.body ? qItem.body.substring(0, 100) + '...' : ''}
              </a>
              <span class="global-search-type">FORUM (${qItem.status})</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 4. Render matching FAQs
    if (faqs.length > 0) {
      resultsHtml += `
        <div class="global-search-section">
          <h4>Frequently Asked Questions</h4>
          ${faqs.map(faq => `
            <div class="global-search-item">
              <a href="faqs.html" class="global-search-link" onclick="sessionStorage.setItem('faq_search_target', '${faq.question.replace(/'/g, "\\'")}');">
                <strong>Q: ${faq.question}</strong><br>
                <span style="font-size: 0.85rem; color: var(--text-light);">A: ${faq.answer.substring(0, 120)}...</span>
              </a>
              <span class="global-search-type">FAQ</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (!resultsHtml) {
      resultsHtml = `
        <div class="empty-state" style="padding: 24px;">
          <p>No matches found in manuals, T-codes, queries, or FAQs for "${q}".</p>
        </div>
      `;
    }

    content.innerHTML = resultsHtml;
  } catch (err) {
    console.error("Global search failed:", err);
    content.innerHTML = `<p class="text-muted" style="text-align: center;">Failed to perform search. Please try again.</p>`;
  }
}

function closeGlobalSearch() {
  document.getElementById("global-search-overlay").style.display = "none";
  document.getElementById("global-search").value = "";
}
