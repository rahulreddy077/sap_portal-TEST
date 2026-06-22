let loadedFaqs = [];
let departmentsList = [];

window.onload = async function() {
  const user = getSession();
  if (!user) return;

  // Render department filters for Super Admin
  if (user.role === "SUPER_ADMIN") {
    try {
      departmentsList = await apiGet("/departments");
      const deptFilter = document.getElementById("faq-dept-filter");
      const addFaqDept = document.getElementById("faq-dept");

      const optionsHtml = `<option value="">All Departments</option>` +
        departmentsList.map(d => `<option value="${d.department_id}">${d.department_name} (${d.sap_module})</option>`).join('');

      const formOptionsHtml = departmentsList.map(d => `<option value="${d.department_id}">${d.department_name} (${d.sap_module})</option>`).join('');

      deptFilter.innerHTML = optionsHtml;
      deptFilter.style.display = "inline-block";

      addFaqDept.innerHTML = formOptionsHtml;
      document.getElementById("faq-dept-group").style.display = "block";
    } catch (e) {
      console.error("Failed to load departments in FAQs screen", e);
    }
  }

  // Admin access controls
  if (user.role === "SUPER_ADMIN" || user.role === "MODULE_ADMIN") {
    document.getElementById("add-faq-btn").style.display = "inline-block";
  }

  loadFaqs();
};

async function loadFaqs() {
  const user = getSession();
  if (!user) return;

  let deptId = user.department_id;
  if (user.role === "SUPER_ADMIN") {
    deptId = document.getElementById("faq-dept-filter").value;
  }

  let queryUrl = "/faqs?";
  if (deptId) queryUrl += `department_id=${deptId}`;

  try {
    loadedFaqs = await apiGet(queryUrl);
    const container = document.getElementById("faqList");

    if (loadedFaqs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❓</div>
          <p>No FAQs available for this module yet.</p>
        </div>`;
      return;
    }

    container.innerHTML = loadedFaqs.map(faq => {
      // Check if admin of this department or super admin
      const canEdit = user.role === "SUPER_ADMIN" || 
                     (user.role === "MODULE_ADMIN" && user.department_id === faq.department_id);

      const actionPanel = canEdit ? `
        <span class="faq-actions" style="margin-left: auto; display: flex; gap: 8px;">
          <button class="btn btn-accent btn-sm" style="padding: 2px 8px;" onclick="openEditFaqModal(event, ${faq.faq_id})">✏️</button>
          <button class="btn btn-danger btn-sm" style="padding: 2px 8px;" onclick="deleteFaq(event, ${faq.faq_id})">🗑️</button>
        </span>
      ` : "";

      return `
        <div class="faq-item" id="faq-item-${faq.faq_id}">
          <div class="faq-question">
            <span><strong>Q:</strong> ${faq.question}</span>
            <div class="flex flex-center gap-12" style="margin-left: auto;">
              ${actionPanel}
              <span class="faq-arrow">▼</span>
            </div>
          </div>
          <div class="faq-answer">
            <p style="white-space: pre-wrap; margin: 0;">${faq.answer}</p>
          </div>
        </div>
      `;
    }).join('');

    // Bind click events for accordion behavior
    initLocalFaqAccordion();

  } catch (e) {
    console.error(e);
    toast("Failed to load FAQs", "error");
  }
}

function filterFaqs() {
  loadFaqs();
}

function filterFAQs(query) {
  const q = query.trim().toLowerCase();
  const faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(item => {
    const questionText = item.querySelector(".faq-question").innerText.toLowerCase();
    const answerText = item.querySelector(".faq-answer").innerText.toLowerCase();
    if (questionText.includes(q) || answerText.includes(q)) {
      item.style.display = "block";
    } else {
      item.style.display = "none";
    }
  });
}

function initLocalFaqAccordion() {
  document.querySelectorAll(".faq-question").forEach(q => {
    q.addEventListener("click", (e) => {
      // Avoid expanding when clicking action buttons
      if (e.target.closest(".faq-actions")) return;

      const item = q.closest(".faq-item");
      item.classList.toggle("open");
    });
  });
}

function openAddFaqModal() {
  document.getElementById("faq-form").reset();
  document.getElementById("faq-edit-id").value = "";
  document.getElementById("faq-modal-title").innerText = "Create FAQ Entry";
  openModal("faq-modal");
}

function openEditFaqModal(event, id) {
  event.stopPropagation(); // Stop accordion from expanding
  
  const faq = loadedFaqs.find(f => f.faq_id === id);
  if (!faq) return;

  document.getElementById("faq-edit-id").value = faq.faq_id;
  document.getElementById("faq-modal-title").innerText = "Edit FAQ Entry";
  
  document.getElementById("faq-question").value = faq.question;
  document.getElementById("faq-answer").value = faq.answer;
  document.getElementById("faq-order").value = faq.display_order;

  if (document.getElementById("faq-dept-group").style.display !== "none") {
    document.getElementById("faq-dept").value = faq.department_id;
  }

  openModal("faq-modal");
}

async function saveFaq(event) {
  event.preventDefault();
  const user = getSession();
  if (!user) return;

  const id = document.getElementById("faq-edit-id").value;
  const question = document.getElementById("faq-question").value.trim();
  const answer = document.getElementById("faq-answer").value.trim();
  const order = parseInt(document.getElementById("faq-order").value);
  
  let deptId = user.department_id;
  if (user.role === "SUPER_ADMIN") {
    deptId = document.getElementById("faq-dept").value;
  }

  const payload = {
    department_id: parseInt(deptId),
    question,
    answer,
    display_order: order,
  };

  if (id) {
    payload.updated_by = user.user_id;
    payload.admin_role = user.role;
  } else {
    payload.created_by = user.user_id;
    payload.admin_role = user.role;
  }

  try {
    if (id) {
      await apiPut(`/faqs/${id}`, payload);
    } else {
      await apiPost(`/faqs`, payload);
    }
    closeModal("faq-modal");
    toast("FAQ entry saved successfully!", "success");
    loadFaqs();
  } catch (e) {
    console.error(e);
    toast("Failed to save FAQ", "error");
  }
}

async function deleteFaq(event, id) {
  event.stopPropagation(); // Stop accordion from expanding
  
  if (!confirm("Are you sure you want to delete this FAQ entry?")) return;
  const user = getSession();

  try {
    await apiDelete(`/faqs/${id}`, { admin_id: user.user_id, admin_role: user.role });
    toast("FAQ deleted", "success");
    loadFaqs();
  } catch {
    toast("Failed to delete FAQ", "error");
  }
}
