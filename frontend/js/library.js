let departmentsList = [];

window.onload = async function() {
  const user = getSession();
  if (!user) return;

  // Render department filters for Super Admins
  if (user.role === "SUPER_ADMIN") {
    try {
      departmentsList = await apiGet("/departments");
      const deptFilter = document.getElementById("lib-dept-filter");
      const itemDeptSelect = document.getElementById("item-dept");
      
      const optionsHtml = `<option value="">All Departments</option>` + 
        departmentsList.map(d => `<option value="${d.department_id}">${d.department_name} (${d.sap_module})</option>`).join('');
      
      const formOptionsHtml = departmentsList.map(d => `<option value="${d.department_id}">${d.department_name} (${d.sap_module})</option>`).join('');
      
      deptFilter.innerHTML = optionsHtml;
      deptFilter.style.display = "inline-block";
      
      itemDeptSelect.innerHTML = formOptionsHtml;
      document.getElementById("item-dept-group").style.display = "block";
    } catch (e) {
      console.error("Failed to load departments list", e);
    }
  }

  // Admin access controls
  if (user.role === "SUPER_ADMIN" || user.role === "MODULE_ADMIN") {
    document.getElementById("add-item-btn").style.display = "inline-block";
  }

  loadLibrary();
};

async function loadLibrary() {
  const user = getSession();
  if (!user) return;

  const search = document.getElementById("lib-search").value.trim();
  const type = document.getElementById("lib-type-filter").value;
  
  // Decide department filter: Super admin can select 'all' or specific. Module admins/users are locked to their own.
  let deptId = user.department_id;
  if (user.role === "SUPER_ADMIN") {
    deptId = document.getElementById("lib-dept-filter").value;
  }

  let queryUrl = "/library?";
  if (deptId) queryUrl += `department_id=${deptId}&`;
  if (type) queryUrl += `item_type=${type}&`;
  if (search) queryUrl += `search=${encodeURIComponent(search)}&`;

  try {
    const items = await apiGet(queryUrl);
    const grid = document.getElementById("libraryGrid");

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <p>No training resources found in this module category.</p>
        </div>`;
      return;
    }

    grid.innerHTML = items.map(item => {
      // Check if user is creator or administrator
      const canEdit = user.role === "SUPER_ADMIN" || 
                     (user.role === "MODULE_ADMIN" && user.department_id === item.department_id);

      let actionBtn = "";
      if (item.item_type === "TRANSACTION") {
        actionBtn = `<div class="txn-code">${item.transaction_code}</div>`;
      } else {
        const hasPdf = item.file_path;
        const hasVid = item.video_path || (item.item_type === "VIDEO" ? item.file_path : null);
        const pdfBtn = hasPdf ? `<a href="${API}/${item.file_path}" target="_blank" class="btn btn-outline btn-sm">📄 Open PDF</a>` : "";
        const videoBtn = hasVid ? `<button class="btn btn-primary btn-sm" onclick="viewVideo('${hasVid}', '${item.title.replace(/'/g, "\\'")}')">🎬 Watch Video</button>` : "";
        actionBtn = `<div style="display: flex; gap: 8px; flex-wrap: wrap;">${pdfBtn} ${videoBtn}</div>`;
      }

      return `
        <div class="lib-card type-${item.item_type.toLowerCase() === 'manual' || item.item_type.toLowerCase() === 'video' ? 'manual' : 'txn'}">
          <div class="lib-card-header">
            <div class="lib-card-icon">${libIcon(item.item_type)}</div>
            <div style="flex: 1;">
              <h4 class="lib-card-title">${item.title}</h4>
              <span class="lib-card-meta">v${item.version} · Uploaded ${fmtDate(item.created_at)}</span>
            </div>
            ${statusBadge(item.item_type)}
          </div>
          ${item.transaction_code ? `<div style="margin: 6px 0;"><span class="txn-code" style="font-size: 0.8rem; padding: 2px 8px;">T-Code: ${item.transaction_code}</span></div>` : ""}
          <p class="lib-card-desc">${item.description || 'No description provided.'}</p>
          
          <div class="lib-card-footer">
            ${actionBtn}
            <button class="btn btn-outline btn-sm btn-icon" onclick="toggleBookmark('LIBRARY_ITEM', ${item.item_id}, this)">
              🔖 Bookmark
            </button>
            <button class="btn btn-outline btn-sm" onclick="viewVersions(${item.item_id})">
              🕒 Revisions
            </button>
            ${canEdit ? `
              <button class="btn btn-accent btn-sm" onclick="openEditModal(${item.item_id})">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="deleteLibraryItem(${item.item_id})">🗑️</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    console.error(e);
    toast("Error loading library items", "error");
  }
}

function filterLibrary(query) {
  if (typeof query === "string") {
    document.getElementById("lib-search").value = query;
  }
  loadLibrary();
}

function toggleItemTypeForm() {
  const type = document.getElementById("item-type").value;
  const pdfGroup = document.getElementById("pdf-field-group");
  const videoGroup = document.getElementById("video-field-group");
  const tcodeGroup = document.getElementById("tcode-field-group");
  const tcodeLabel = document.getElementById("tcode-label");
  const tcodeVal = document.getElementById("item-tcode");

  if (type === "TRANSACTION") {
    pdfGroup.style.display = "none";
    videoGroup.style.display = "none";
    tcodeLabel.innerText = "SAP Transaction Code (T-Code) - Required";
    tcodeVal.required = true;
  } else {
    pdfGroup.style.display = "block";
    videoGroup.style.display = "block";
    tcodeLabel.innerText = "SAP Transaction Code (T-Code) - Optional";
    tcodeVal.required = false;
  }
}

function openAddModal() {
  document.getElementById("item-form").reset();
  document.getElementById("edit-item-id").value = "";
  document.getElementById("modal-title").innerText = "Add Training Media";
  toggleItemTypeForm();
  document.getElementById("item-file").value = "";
  document.getElementById("item-video-file").value = "";
  openModal("item-modal");
}

async function openEditModal(id) {
  try {
    const item = await apiGet(`/library/${id}`);
    document.getElementById("edit-item-id").value = item.item_id;
    document.getElementById("modal-title").innerText = `Edit: ${item.title}`;
    
    document.getElementById("item-title").value = item.title;
    document.getElementById("item-desc").value = item.description || "";
    
    // Convert VIDEO items to MANUAL type in UI since they can have both
    document.getElementById("item-type").value = (item.item_type === "VIDEO") ? "MANUAL" : item.item_type;
    
    if (document.getElementById("item-dept-group").style.display !== "none") {
      document.getElementById("item-dept").value = item.department_id;
    }
    
    document.getElementById("item-tcode").value = item.transaction_code || "";
    document.getElementById("item-version").value = item.version;
    document.getElementById("item-notes").value = item.version_notes || "";

    toggleItemTypeForm();
    document.getElementById("item-file").value = "";
    document.getElementById("item-video-file").value = "";
    openModal("item-modal");
  } catch {
    toast("Error loading item details", "error");
  }
}

async function saveLibraryItem(event) {
  event.preventDefault();
  const user = getSession();
  if (!user) return;

  const id = document.getElementById("edit-item-id").value;
  const title = document.getElementById("item-title").value.trim();
  const description = document.getElementById("item-desc").value.trim();
  const type = document.getElementById("item-type").value;
  const version = document.getElementById("item-version").value.trim();
  const version_notes = document.getElementById("item-notes").value.trim();
  
  let deptId = user.department_id;
  if (user.role === "SUPER_ADMIN") {
    deptId = document.getElementById("item-dept").value;
  }

  if (type === "MANUAL") {
    const formData = new FormData();
    formData.append("department_id", deptId);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("item_type", type);
    formData.append("version", version);
    formData.append("version_notes", version_notes);
    
    const tcode = document.getElementById("item-tcode").value.trim();
    if (tcode) {
      formData.append("transaction_code", tcode);
    }

    const fileField = document.getElementById("item-file");
    if (fileField.files[0]) {
      formData.append("file", fileField.files[0]);
    }
    
    const videoField = document.getElementById("item-video-file");
    if (videoField.files[0]) {
      formData.append("video_file", videoField.files[0]);
    }

    if (!id && !fileField.files[0] && !videoField.files[0] && !tcode) {
      toast("Please upload a PDF document, video tutorial, or specify a T-code.", "warning");
      return;
    }

    if (id) {
      formData.append("updated_by", user.user_id);
      formData.append("admin_role", user.role);
    } else {
      formData.append("uploaded_by", user.user_id);
      formData.append("admin_role", user.role);
    }

    try {
      const url = id ? `/library/${id}` : `/library`;
      const method = id ? "PUT" : "POST";
      await apiUpload(url, formData, method);
      closeModal("item-modal");
      toast(`Resource saved successfully`, "success");
      loadLibrary();
    } catch {
      toast("File upload failed", "error");
    }
  } else {
    // Transaction code only
    const payload = {
      department_id: parseInt(deptId),
      title,
      description,
      item_type: type,
      transaction_code: document.getElementById("item-tcode").value.trim(),
      version,
      version_notes,
    };

    if (id) {
      payload.updated_by = user.user_id;
      payload.admin_role = user.role;
    } else {
      payload.uploaded_by = user.user_id;
      payload.admin_role = user.role;
    }

    try {
      if (id) {
        await apiPut(`/library/${id}`, payload);
      } else {
        await apiPost(`/library`, payload);
      }
      closeModal("item-modal");
      toast(`Transaction Code saved`, "success");
      loadLibrary();
    } catch {
      toast("Failed to save transaction code", "error");
    }
  }
}

async function deleteLibraryItem(id) {
  if (!confirm("Are you sure you want to delete this resource?")) return;
  const user = getSession();
  try {
    await apiDelete(`/library/${id}`, { admin_id: user.user_id, admin_role: user.role });
    toast("Item deleted", "success");
    loadLibrary();
  } catch {
    toast("Failed to delete item", "error");
  }
}

function viewVideo(filePath, title) {
  const player = document.getElementById("video-player");
  player.src = `${API}/${filePath}`;
  document.getElementById("video-modal-title").innerText = `Video: ${title}`;
  openModal("video-modal");
  player.play();
}

function closeVideoModal() {
  const player = document.getElementById("video-player");
  player.pause();
  player.src = "";
  closeModal("video-modal");
}

async function viewVersions(itemId) {
  try {
    const list = await apiGet(`/library/${itemId}/versions`);
    const tbody = document.getElementById("versions-table-body");
    
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No revisions found for this item.</td></tr>`;
    } else {
      tbody.innerHTML = list.map(v => `
        <tr>
          <td><strong>v${v.version}</strong></td>
          <td>${v.version_notes || '—'}</td>
          <td>${v.uploader_name || 'System'}</td>
          <td>${fmtDateTime(v.created_at)}</td>
          <td>
            ${(v.file_path ? `<a href="${API}/${v.file_path}" target="_blank" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 0.8rem; margin-right: 4px;">PDF</a>` : "") + 
              (v.video_path ? `<a href="${API}/${v.video_path}" target="_blank" class="btn btn-primary btn-sm" style="padding: 2px 6px; font-size: 0.8rem;">Video</a>` : "") || "—"}
          </td>
        </tr>
      `).join('');
    }
    openModal("versions-modal");
  } catch {
    toast("Failed to fetch revision history", "error");
  }
}
