let departmentsList = [];

window.onload = async function() {
  const user = getSession();
  if (!user) return;

  // Load departments list for everyone to enable cross-module browsing
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
    
    // Target department select is visible only to SUPER_ADMIN on upload forms
    if (user.role === "SUPER_ADMIN") {
      document.getElementById("item-dept-group").style.display = "block";
    } else {
      document.getElementById("item-dept-group").style.display = "none";
    }
  } catch (e) {
    console.error("Failed to load departments list", e);
  }

  // Admin access controls
  if (user.role === "SUPER_ADMIN" || user.role === "MODULE_ADMIN") {
    document.getElementById("add-item-btn").style.display = "inline-block";
    document.getElementById("import-lib-btn").style.display = "inline-block";
  }

  // Handle cross-page global search queries routed from dashboard
  const searchTarget = sessionStorage.getItem("library_search_target");
  if (searchTarget) {
    document.getElementById("lib-search").value = searchTarget;
    sessionStorage.removeItem("library_search_target");
  }

  loadLibrary();
};

function parseFilePaths(pathString) {
  if (!pathString) return [];
  if (pathString.startsWith("[")) {
    try {
      return JSON.parse(pathString);
    } catch (e) {
      return [{ name: pathString.substring(pathString.lastIndexOf('/') + 1), path: pathString }];
    }
  }
  return [{ name: pathString.substring(pathString.lastIndexOf('/') + 1), path: pathString }];
}

async function loadLibrary() {
  const user = getSession();
  if (!user) return;

  const search = document.getElementById("lib-search").value.trim();
  const type = document.getElementById("lib-type-filter").value;
  const deptId = document.getElementById("lib-dept-filter").value; // Let everyone browse all depts

  let queryUrl = "/library?";
  if (deptId) queryUrl += `department_id=${deptId}&`;
  if (type) queryUrl += `item_type=${type}&`;
  if (search) queryUrl += `search=${encodeURIComponent(search)}&`;

  try {
    const items = await apiGet(queryUrl);
    const tbody = document.getElementById("libraryTableBody");

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 48px 24px; color: var(--text-light);">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">📁</div>
            No training resources found in this category.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = items.map(item => {
      // Write access check: Super Admin or matching Module Admin
      const canEdit = user.role === "SUPER_ADMIN" || 
                     (user.role === "MODULE_ADMIN" && user.department_id === item.department_id);

      const dept = departmentsList.find(d => d.department_id === item.department_id);
      const moduleBadge = dept 
        ? `<span class="badge badge-info" style="font-weight: 600; padding: 4px 8px; border-radius: 4px;">SAP ${dept.sap_module}</span>` 
        : `<span class="badge badge-gray">—</span>`;

      const tcodeHtml = item.transaction_code 
        ? `<strong style="color: var(--primary); font-size: 0.95rem;">${item.transaction_code}</strong>` 
        : `<span style="color: var(--text-light);">—</span>`;

      const descHtml = `
        <div style="font-weight: 600; color: var(--text); font-size: 0.95rem; margin-bottom: 4px;">${item.title}</div>
        <div style="font-size: 0.8rem; color: var(--text-light); line-height: 1.3;">${item.description || 'No description provided.'}</div>
      `;

      const categoryHtml = `<span style="font-family: monospace; font-size: 0.85rem; color: var(--text-light);">${item.item_type} (v${item.version})</span>`;

      // Parse and display multiple videos
      const vPaths = parseFilePaths(item.video_path);
      let videoHtml = `<span style="color: var(--text-light);">—</span>`;
      if (vPaths.length === 1) {
        videoHtml = `<button class="btn btn-outline btn-sm btn-icon" onclick="viewVideo('${vPaths[0].path}', '${item.title.replace(/'/g, "\\'")}')" style="padding: 4px 8px; font-size: 0.8rem;">🎬 Watch</button>`;
      } else if (vPaths.length > 1) {
        videoHtml = `<div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">` + 
          vPaths.map((vp, idx) => `<button class="btn btn-outline btn-sm btn-icon" onclick="viewVideo('${vp.path}', '${vp.name.replace(/'/g, "\\'")}')" style="padding: 2px 6px; font-size: 0.75rem; width: 85px;">🎬 Video ${idx+1}</button>`).join('') + 
          `</div>`;
      }

      // Parse and display multiple document links
      const fPaths = parseFilePaths(item.file_path);
      let docActionsHtml = "";
      if (fPaths.length === 1) {
        docActionsHtml = `<a href="${API}/${fPaths[0].path}" target="_blank" class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.8rem;" onclick="logAccess(${item.item_id})">📄 View File</a>`;
      } else if (fPaths.length > 1) {
        docActionsHtml = `<div style="display: flex; flex-direction: column; gap: 4px;">` + 
          fPaths.map((fp, idx) => `<a href="${API}/${fp.path}" target="_blank" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 0.75rem; text-align: center; min-width: 90px;" onclick="logAccess(${item.item_id})">📄 Doc ${idx+1}</a>`).join('') + 
          `</div>`;
      }

      const bookmarkBtn = `<button class="btn btn-outline btn-sm btn-icon" onclick="toggleBookmark('LIBRARY_ITEM', ${item.item_id}, this)" style="padding: 4px 8px; font-size: 0.8rem;">🔖 Bookmark</button>`;
      const revisionsBtn = `<button class="btn btn-outline btn-sm" onclick="viewVersions(${item.item_id})" style="padding: 4px 8px; font-size: 0.8rem;">🕒 History</button>`;
      
      const adminActions = canEdit ? `
        <button class="btn btn-accent btn-sm" onclick="openEditModal(${item.item_id})" style="padding: 4px 8px; font-size: 0.8rem;">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteLibraryItem(${item.item_id})" style="padding: 4px 8px; font-size: 0.8rem;">Delete</button>
      ` : "";

      const actionsHtml = `
        <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; align-items: center;">
          ${docActionsHtml}
          ${bookmarkBtn}
          ${revisionsBtn}
          ${adminActions}
        </div>
      `;

      return `
        <tr style="border-bottom: 1px solid var(--border); transition: background-color .15s;">
          <td style="padding: 14px 18px; vertical-align: middle;">${tcodeHtml}</td>
          <td style="padding: 14px 18px; vertical-align: middle;">${descHtml}</td>
          <td style="padding: 14px 18px; vertical-align: middle;">${moduleBadge}</td>
          <td style="padding: 14px 18px; vertical-align: middle;">${categoryHtml}</td>
          <td style="padding: 14px 18px; vertical-align: middle; text-align: center;">${videoHtml}</td>
          <td style="padding: 14px 18px; vertical-align: middle; text-align: center;">${actionsHtml}</td>
        </tr>
      `;
    }).join('');

  } catch (e) {
    console.error(e);
    toast("Error loading library items", "error");
  }
}

// Log resource access details in backend audit_logs
async function logAccess(itemId) {
  const user = getSession();
  if (!user) return;
  try {
    await apiGet(`/library/${itemId}?user_id=${user.user_id}&role=${user.role}`);
  } catch (e) {
    console.error("Access log recording failed", e);
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

function openImportLibModal() {
  document.getElementById("import-lib-form").reset();
  openModal("import-lib-modal");
}

async function importLibraryCSV(event) {
  event.preventDefault();
  const user = getSession();
  if (!user) return;
  const fileInput = document.getElementById("lib-csv-file");
  if (!fileInput.files[0]) return;
  
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);
  formData.append("admin_id", user.user_id);
  formData.append("admin_role", user.role);
  
  try {
    const res = await apiUpload("/library/import-csv", formData);
    closeModal("import-lib-modal");
    toast(`Imported ${res.imported_count} library items!`, "success");
    if (res.errors && res.errors.length > 0) {
      console.warn("Library CSV Import warnings:", res.errors);
      toast(`Import complete with warnings (details in console)`, "warning");
    }
    loadLibrary();
  } catch (err) {
    toast("CSV Import failed", "error");
  }
}

async function openEditModal(id) {
  try {
    const item = await apiGet(`/library/${id}`);
    document.getElementById("edit-item-id").value = item.item_id;
    document.getElementById("modal-title").innerText = `Edit: ${item.title}`;
    
    document.getElementById("item-title").value = item.title;
    document.getElementById("item-desc").value = item.description || "";
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

    // Append multiple files
    const fileField = document.getElementById("item-file");
    if (fileField.files.length > 0) {
      for (let i = 0; i < fileField.files.length; i++) {
        formData.append("file", fileField.files[i]);
      }
    }
    
    // Append multiple video files
    const videoField = document.getElementById("item-video-file");
    if (videoField.files.length > 0) {
      for (let i = 0; i < videoField.files.length; i++) {
        formData.append("video_file", videoField.files[i]);
      }
    }

    if (!id && fileField.files.length === 0 && videoField.files.length === 0 && !tcode) {
      toast("Please upload files, videos, or specify a T-code.", "warning");
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
      tbody.innerHTML = list.map(v => {
        const vFiles = parseFilePaths(v.file_path);
        const vVids = parseFilePaths(v.video_path);
        
        const docLinks = vFiles.map((vf, idx) => `<a href="${API}/${vf.path}" target="_blank" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 0.8rem; margin-right: 4px;">Doc ${idx+1}</a>`).join('');
        const vidLinks = vVids.map((vv, idx) => `<a href="${API}/${vv.path}" target="_blank" class="btn btn-primary btn-sm" style="padding: 2px 6px; font-size: 0.8rem; margin-right: 4px;">Vid ${idx+1}</a>`).join('');
        
        return `
          <tr>
            <td><strong>v${v.version}</strong></td>
            <td>${v.version_notes || '—'}</td>
            <td>${v.uploader_name || 'System'}</td>
            <td>${fmtDateTime(v.created_at)}</td>
            <td>
              ${(docLinks + vidLinks) || "—"}
            </td>
          </tr>
        `;
      }).join('');
    }
    openModal("versions-modal");
  } catch {
    toast("Failed to fetch revision history", "error");
  }
}
