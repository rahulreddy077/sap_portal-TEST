let departmentsMap = {};
let loadedUsers = [];

window.onload = async function() {
  const user = getSession();
  if (!user) return;

  // Protect page (only allow Super Admins or Module Admins)
  if (user.role !== "SUPER_ADMIN" && user.role !== "MODULE_ADMIN") {
    toast("Unauthorized access", "error");
    window.location.href = "dashboard.html";
    return;
  }

  // Load departments catalog first
  try {
    const depts = await apiGet("/departments");
    const deptFilter = document.getElementById("user-dept-filter");
    const userDeptSelect = document.getElementById("user-dept");

    depts.forEach(d => {
      departmentsMap[d.department_id] = {
        name: d.department_name,
        module: d.sap_module
      };
    });

    // Populate Super Admin filter
    if (user.role === "SUPER_ADMIN") {
      deptFilter.innerHTML = `<option value="">All Departments</option>` +
        depts.map(d => `<option value="${d.department_id}">${d.department_name} (${d.sap_module})</option>`).join('');
      deptFilter.style.display = "inline-block";
    }

    // Populate modal select options
    userDeptSelect.innerHTML = depts.map(d => `<option value="${d.department_id}">${d.department_name} (${d.sap_module})</option>`).join('');

  } catch (e) {
    console.error("Failed to cache departments in users screen", e);
  }

  loadUsers();
};

async function loadUsers() {
  const user = getSession();
  if (!user) return;

  const role = document.getElementById("user-role-filter").value;
  const searchVal = document.getElementById("user-search").value.trim().toLowerCase();

  let deptId = user.department_id;
  if (user.role === "SUPER_ADMIN") {
    deptId = document.getElementById("user-dept-filter").value;
  }

  let queryUrl = "/users?";
  if (deptId) queryUrl += `department_id=${deptId}&`;
  if (role) queryUrl += `role=${role}&`;

  try {
    let list = await apiGet(queryUrl);
    loadedUsers = list;

    // Filter list locally by search input
    if (searchVal) {
      list = list.filter(u => 
        u.name.toLowerCase().includes(searchVal) || 
        u.employee_id.toLowerCase().includes(searchVal)
      );
    }

    const tbody = document.getElementById("userTableBody");
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No user profiles found matching filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(u => {
      const isSelf = u.user_id === user.user_id;
      const statusLbl = u.is_active ? `<span class="badge badge-success">Active</span>` : `<span class="badge badge-gray">Inactive</span>`;
      
      const deptInfo = departmentsMap[u.department_id] || { name: "Super Admin (Global)", module: "—" };

      return `
        <tr>
          <td><strong>${u.employee_id}</strong></td>
          <td>${u.name} ${isSelf ? ' <span class="text-muted text-small">(You)</span>' : ''}</td>
          <td>${u.designation || '—'}</td>
          <td>${deptInfo.name}</td>
          <td>${deptInfo.module}</td>
          <td>${statusBadge(u.role)}</td>
          <td>${statusLbl}</td>
          <td>${fmtDateTime(u.last_login)}</td>
          <td>
            <button class="btn btn-accent btn-sm" onclick="openEditUserModal(${u.user_id})">✏️ Edit</button>
            ${!isSelf ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.user_id})">🗑️ Delete</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

  } catch (e) {
    console.error(e);
    toast("Could not load users database", "error");
  }
}

function filterUsers(query) {
  if (typeof query === "string") {
    document.getElementById("user-search").value = query;
  }
  loadUsers();
}

function toggleFormDeptLock() {
  const role = document.getElementById("user-role").value;
  const deptSelect = document.getElementById("user-dept");
  const deptGroup = document.getElementById("form-dept-group");

  if (role === "SUPER_ADMIN") {
    deptSelect.required = false;
    deptGroup.style.display = "none";
  } else {
    deptSelect.required = true;
    deptGroup.style.display = "block";
  }
}

function openAddUserModal() {
  document.getElementById("user-form").reset();
  document.getElementById("edit-user-id").value = "";
  document.getElementById("user-modal-title").innerText = "Create User Profile";
  document.getElementById("user-emp-id").disabled = false;
  document.getElementById("user-pwd").required = true;
  document.getElementById("active-checkbox-group").style.display = "none";
  
  toggleFormDeptLock();
  openModal("user-modal");
}

async function openEditUserModal(id) {
  try {
    const u = await apiGet(`/users/${id}`);
    document.getElementById("edit-user-id").value = u.user_id;
    document.getElementById("user-modal-title").innerText = `Edit Profile: ${u.employee_id}`;
    
    document.getElementById("user-emp-id").value = u.employee_id;
    document.getElementById("user-emp-id").disabled = true; // Cannot edit employee ID
    document.getElementById("user-name").value = u.name;
    document.getElementById("user-pwd").value = "";
    document.getElementById("user-pwd").required = false; // Optional in edit
    
    document.getElementById("user-email").value = u.email || "";
    document.getElementById("user-role").value = u.role;
    toggleFormDeptLock();
    
    if (u.role !== "SUPER_ADMIN") {
      document.getElementById("user-dept").value = u.department_id || "";
    }
    
    document.getElementById("user-designation").value = u.designation || "";
    document.getElementById("user-phone").value = u.phone || "";
    document.getElementById("user-active").checked = u.is_active === 1;

    document.getElementById("active-checkbox-group").style.display = "block";
    openModal("user-modal");
  } catch {
    toast("Failed to load user credentials", "error");
  }
}

async function saveUser(event) {
  event.preventDefault();
  const user = getSession();
  if (!user) return;

  const id = document.getElementById("edit-user-id").value;
  const name = document.getElementById("user-name").value.trim();
  const password = document.getElementById("user-pwd").value;
  const email = document.getElementById("user-email").value.trim();
  const role = document.getElementById("user-role").value;
  const designation = document.getElementById("user-designation").value.trim();
  const phone = document.getElementById("user-phone").value.trim();

  let deptId = null;
  if (role !== "SUPER_ADMIN") {
    deptId = parseInt(document.getElementById("user-dept").value);
  }

  const payload = {
    name,
    email: email || null,
    role,
    department_id: deptId,
    designation: designation || null,
    phone: phone || null,
    admin_id: user.user_id,
    admin_role: user.role
  };

  if (password) {
    payload.password_hash = password; // Sets password directly (seed standard)
  }

  if (id) {
    payload.is_active = document.getElementById("user-active").checked ? 1 : 0;
  } else {
    payload.employee_id = document.getElementById("user-emp-id").value.trim();
  }

  try {
    if (id) {
      await apiPut(`/users/${id}`, payload);
      toast("User profile updated", "success");
    } else {
      await apiPost(`/users`, payload);
      toast("New user created successfully", "success");
    }
    closeModal("user-modal");
    loadUsers();
  } catch (e) {
    console.error(e);
    toast(e.message || "Failed to save user profile", "error");
  }
}

async function deleteUser(id) {
  if (!confirm("Are you sure you want to permanently delete this user? This will remove all their bookmarks and references!")) return;
  const user = getSession();
  try {
    await apiDelete(`/users/${id}`, { admin_id: user.user_id, admin_role: user.role });
    toast("User profile deleted", "success");
    loadUsers();
  } catch {
    toast("Failed to delete user profile", "error");
  }
}

function triggerCsvSelect() {
  document.getElementById("csv-file-input").click();
}

async function uploadCsvFile(input) {
  const file = input.files[0];
  if (!file) return;

  const user = getSession();
  if (!user) return;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("admin_id", user.user_id);
  formData.append("admin_role", user.role);

  toast("Uploading and parsing CSV file...", "info");
  try {
    const res = await apiUpload("/users/import-csv", formData, "POST");
    if (res.status === "success" || res.imported_count !== undefined) {
      toast(`Import successful! Added/updated ${res.imported_count} users.`, "success");
      if (res.errors && res.errors.length > 0) {
        console.warn("CSV import warnings:", res.errors);
        toast(`Imported with ${res.errors.length} warnings. See console.`, "warning");
      }
      loadUsers();
    } else {
      toast(res.error || "Failed to import CSV", "error");
    }
  } catch (e) {
    console.error("CSV import error:", e);
    toast(e.message || "Failed to upload and import CSV file", "error");
  } finally {
    input.value = "";
  }
}
