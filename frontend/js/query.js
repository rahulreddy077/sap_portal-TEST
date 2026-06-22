let departmentsList = [];
let currentOpenQueryId = null;

window.onload = async function() {
  const user = getSession();
  if (!user) return;

  // Renders department options for Super Admin
  if (user.role === "SUPER_ADMIN") {
    try {
      departmentsList = await apiGet("/departments");
      const deptFilter = document.getElementById("query-dept-filter");
      const addQueryDept = document.getElementById("query-dept");

      const optionsHtml = `<option value="">All Departments</option>` +
        departmentsList.map(d => `<option value="${d.department_id}">${d.department_name} (${d.sap_module})</option>`).join('');

      const formOptionsHtml = departmentsList.map(d => `<option value="${d.department_id}">${d.department_name} (${d.sap_module})</option>`).join('');

      deptFilter.innerHTML = optionsHtml;
      deptFilter.style.display = "inline-block";

      addQueryDept.innerHTML = formOptionsHtml;
      document.getElementById("query-dept-group").style.display = "block";
    } catch (e) {
      console.error("Failed to load departments in queries screen", e);
    }
  }

  loadQueries();
};

async function loadQueries() {
  const user = getSession();
  if (!user) return;

  const search = document.getElementById("query-search").value.trim();
  const status = document.getElementById("query-status-filter").value;

  let deptId = user.department_id;
  if (user.role === "SUPER_ADMIN") {
    deptId = document.getElementById("query-dept-filter").value;
  }

  let queryUrl = `/queries?role=${user.role}&`;
  if (deptId) queryUrl += `department_id=${deptId}&`;
  if (status) queryUrl += `status=${status}&`;
  if (search) queryUrl += `search=${encodeURIComponent(search)}&`;

  try {
    const list = await apiGet(queryUrl);
    const container = document.getElementById("queryList");

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p>No queries found. Feel free to ask a question!</p>
        </div>`;
      return;
    }

    container.innerHTML = list.map(q => {
      const priorityCls = { HIGH: "badge-danger", MEDIUM: "badge-warning", LOW: "badge-primary" }[q.priority] || "badge-gray";
      const statusClass = { OPEN: "status-open", ANSWERED: "status-answered", CLOSED: "status-closed" }[q.status] || "";

      return `
        <div class="query-item ${statusClass}" onclick="viewQuery(${q.query_id})">
          <div class="query-item-header">
            <h4 class="query-title">${q.title}</h4>
            <span class="badge ${priorityCls}">${q.priority}</span>
            ${statusBadge(q.status)}
          </div>
          <div class="query-meta mb-16">
            <span>Posted by: <strong>${q.poster_name}</strong></span>
            <span>Created: ${fmtDate(q.created_at)}</span>
            <span>Views: ${q.view_count}</span>
            <span>Replies: ${q.comment_count}</span>
          </div>
          <p class="query-body-preview">${q.body}</p>
        </div>
      `;
    }).join('');

  } catch (e) {
    console.error(e);
    toast("Could not load queries list", "error");
  }
}

function filterQueries(query) {
  if (typeof query === "string") {
    document.getElementById("query-search").value = query;
  }
  loadQueries();
}

function openAddQueryModal() {
  document.getElementById("add-query-form").reset();
  openModal("add-query-modal");
}

async function saveQuery(event) {
  event.preventDefault();
  const user = getSession();
  if (!user) return;

  const title = document.getElementById("query-title").value.trim();
  const body = document.getElementById("query-body").value.trim();
  const priority = document.getElementById("query-priority").value;
  const anonymous = document.getElementById("query-anonymous").checked ? 1 : 0;

  let deptId = user.department_id;
  if (user.role === "SUPER_ADMIN") {
    deptId = document.getElementById("query-dept").value;
  }

  const payload = {
    department_id: parseInt(deptId),
    posted_by: user.user_id,
    title,
    body,
    priority,
    is_anonymous: anonymous
  };

  try {
    await apiPost("/queries", payload);
    closeModal("add-query-modal");
    toast("Query posted successfully!", "success");
    loadQueries();
  } catch (e) {
    console.error(e);
    toast("Failed to post query", "error");
  }
}

async function viewQuery(id) {
  const user = getSession();
  if (!user) return;

  currentOpenQueryId = id;
  try {
    const q = await apiGet(`/queries/${id}?role=${user.role}`);
    const detailsContainer = document.getElementById("detail-container");
    const commentsContainer = document.getElementById("comment-thread-list");
    document.getElementById("comment-query-id").value = id;
    
    // Reset reply body
    document.getElementById("comment-body").value = "";

    const isAdmin = user.role === "SUPER_ADMIN" || 
                    (user.role === "MODULE_ADMIN" && user.department_id === q.department_id);

    // Renders full details
    const priorityCls = { HIGH: "badge-danger", MEDIUM: "badge-warning", LOW: "badge-primary" }[q.priority] || "badge-gray";
    
    let adminControls = "";
    if (isAdmin) {
      adminControls = `
        <div class="form-group flex flex-center gap-8 mt-16" style="border-top: 1px dashed var(--border); padding-top: 12px;">
          <label for="change-status" style="margin-bottom: 0; font-weight: 700;">Update Status:</label>
          <select id="change-status" onchange="updateQueryStatus(${q.query_id}, this.value)" style="width: auto; padding: 4px 10px;">
            <option value="OPEN" ${q.status === 'OPEN' ? 'selected' : ''}>Open</option>
            <option value="ANSWERED" ${q.status === 'ANSWERED' ? 'selected' : ''}>Answered</option>
            <option value="CLOSED" ${q.status === 'CLOSED' ? 'selected' : ''}>Closed</option>
          </select>
        </div>
      `;
    }

    detailsContainer.innerHTML = `
      <div class="flex flex-between mb-16">
        <span class="badge ${priorityCls}">${q.priority} Priority</span>
        ${statusBadge(q.status)}
      </div>
      <h2 style="font-size: 1.3rem; color: var(--primary); margin-bottom: 10px;">${q.title}</h2>
      <div class="query-meta mb-16" style="border-bottom: 1px solid var(--border); padding-bottom: 10px;">
        <span>Posted by: <strong>${q.poster_name}</strong></span>
        <span>Date: ${fmtDateTime(q.created_at)}</span>
        <span>Views: ${q.view_count}</span>
      </div>
      <p style="white-space: pre-wrap; font-size: 0.95rem; line-height: 1.7; color: var(--text);">${q.body}</p>
      
      <div class="flex mt-16">
        <button class="btn btn-outline btn-sm btn-icon" onclick="toggleBookmark('QUERY', ${q.query_id}, this)">
          🔖 Bookmark Question
        </button>
      </div>

      ${adminControls}
    `;

    // Renders comment list
    if (q.comments && q.comments.length > 0) {
      commentsContainer.innerHTML = q.comments.map(c => {
        let moderationBtns = "";
        
        // Show approval buttons for pending comments to module/super admins
        if (c.status === "PENDING" && isAdmin) {
          moderationBtns = `
            <div class="flex gap-8 mt-8">
              <button class="btn btn-success btn-sm" onclick="moderateComment(${c.comment_id}, 'APPROVE')">Approve</button>
              <button class="btn btn-danger btn-sm" onclick="moderateComment(${c.comment_id}, 'REJECT')">Reject</button>
            </div>
          `;
        }

        const cls = c.is_admin_reply ? "admin-reply" : c.status === "PENDING" ? "pending" : "";
        const roleLabel = c.is_admin_reply ? " <span class='badge badge-success' style='font-size:0.6rem; padding: 1px 5px;'>Admin Answer</span>" : "";

        return `
          <div class="comment ${cls}">
            <div class="comment-header">
              <span class="comment-author">${c.poster_name}${roleLabel}</span>
              ${c.status === 'PENDING' ? '<span class="badge badge-warning" style="font-size:0.6rem;">Pending Approval</span>' : ''}
              <span class="comment-date">${timeAgo(c.created_at)}</span>
            </div>
            <p style="white-space: pre-wrap; margin: 4px 0;">${c.body}</p>
            ${moderationBtns}
          </div>
        `;
      }).join('');
    } else {
      commentsContainer.innerHTML = `
        <div class="empty-state" style="padding: 20px 0;">
          <p style="font-size: 0.85rem;">No answers posted yet.</p>
        </div>`;
    }

    openModal("detail-modal");

  } catch (e) {
    console.error(e);
    toast("Failed to view discussion thread", "error");
  }
}

async function postComment(event) {
  event.preventDefault();
  const user = getSession();
  if (!user) return;

  const queryId = document.getElementById("comment-query-id").value;
  const body = document.getElementById("comment-body").value.trim();

  const payload = {
    posted_by: user.user_id,
    body,
    role: user.role
  };

  try {
    const res = await apiPost(`/queries/${queryId}/comments`, payload);
    document.getElementById("comment-body").value = "";
    
    if (res.status === "PENDING") {
      toast("Your answer was submitted and is pending administrator moderation", "warning");
    } else {
      toast("Answer posted!", "success");
    }

    // Refresh modal details
    viewQuery(queryId);
    // Refresh main list (comment counts)
    loadQueries();
  } catch (e) {
    console.error(e);
    toast("Failed to post response", "error");
  }
}

async function moderateComment(commentId, action) {
  const user = getSession();
  if (!user) return;

  try {
    await apiPut(`/comments/${commentId}/moderate`, { action, admin_id: user.user_id });
    toast(`Reply ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`, "success");
    if (currentOpenQueryId) {
      viewQuery(currentOpenQueryId);
    }
    loadQueries();
  } catch {
    toast("Moderation failed", "error");
  }
}

async function updateQueryStatus(queryId, status) {
  try {
    await apiPut(`/queries/${queryId}`, { status });
    toast(`Query status marked as ${status.toLowerCase()}`, "success");
    loadQueries();
    // Refresh details modal view
    viewQuery(queryId);
  } catch {
    toast("Failed to update status", "error");
  }
}
