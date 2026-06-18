import requests
import sys

API_BASE = "http://localhost:5000"

def test_portal():
    print("==================================================")
    print("STARTING 360-DEGREE PORTAL AUTHORIZATION TESTING")
    print("==================================================")

    # ──────────────────────────────────────────────────────────
    # STEP 1: Super Admin login
    # ──────────────────────────────────────────────────────────
    print("\n[Step 1] Logging in as Super Admin...")
    login_payload = {"employee_id": "ADMIN001", "password": "Admin@123"}
    r = requests.post(f"{API_BASE}/login", json=login_payload)
    assert r.status_code == 200, f"Super Admin login failed: {r.text}"
    admin_data = r.json()
    assert admin_data["status"] == "success", "Failed admin login status"
    assert admin_data["role"] == "SUPER_ADMIN", "Incorrect role returned"
    print("OK - Super Admin authenticated successfully!")
    super_admin_id = admin_data["user_id"]

    # ──────────────────────────────────────────────────────────
    # STEP 2: Super Admin creates a new standard user in Dept 2 (HR)
    # ──────────────────────────────────────────────────────────
    print("\n[Step 2] Super Admin creating a new Standard User (TEST_USER_999)...")
    new_user_payload = {
        "employee_id": "TEST_USER_999",
        "name": "Test standard employee",
        "password_hash": "UserPass@123",
        "role": "USER",
        "department_id": 2,  # HR Module
        "email": "test_user_999@bhel.in",
        "designation": "Executive",
        "phone": "9999999999",
        "admin_id": super_admin_id,
        "admin_role": "SUPER_ADMIN"
    }
    
    # Check if user already exists from a previous run and delete if so
    r_check = requests.get(f"{API_BASE}/users")
    existing_users = r_check.json()
    for u in existing_users:
        if u["employee_id"] == "TEST_USER_999":
            requests.delete(f"{API_BASE}/users/{u['user_id']}", json={"admin_id": super_admin_id, "admin_role": "SUPER_ADMIN"})
            print("  (Cleaned up previous TEST_USER_999)")

    r = requests.post(f"{API_BASE}/users", json=new_user_payload)
    assert r.status_code == 201, f"Failed to create standard user: {r.text}"
    user_data = r.json()
    test_user_id = user_data["user_id"]
    print(f"OK - Standard User created successfully with ID: {test_user_id}!")

    # ──────────────────────────────────────────────────────────
    # STEP 3: Super Admin creates a new Module Admin in Dept 2 (HR)
    # ──────────────────────────────────────────────────────────
    print("\n[Step 3] Super Admin creating a new Module Admin (TEST_MADMIN_999)...")
    new_madmin_payload = {
        "employee_id": "TEST_MADMIN_999",
        "name": "Test HR Module Admin",
        "password_hash": "AdminPass@123",
        "role": "MODULE_ADMIN",
        "department_id": 2,  # HR Module
        "email": "test_madmin_999@bhel.in",
        "designation": "HR Manager",
        "phone": "8888888888",
        "admin_id": super_admin_id,
        "admin_role": "SUPER_ADMIN"
    }

    for u in existing_users:
        if u["employee_id"] == "TEST_MADMIN_999":
            requests.delete(f"{API_BASE}/users/{u['user_id']}", json={"admin_id": super_admin_id, "admin_role": "SUPER_ADMIN"})
            print("  (Cleaned up previous TEST_MADMIN_999)")

    r = requests.post(f"{API_BASE}/users", json=new_madmin_payload)
    assert r.status_code == 201, f"Failed to create module admin: {r.text}"
    madmin_data = r.json()
    test_madmin_id = madmin_data["user_id"]
    print(f"OK - Module Admin created successfully with ID: {test_madmin_id}!")

    # ──────────────────────────────────────────────────────────
    # STEP 4: Log in as the new Standard User and perform actions
    # ──────────────────────────────────────────────────────────
    print("\n[Step 4] Logging in as the new Standard User (TEST_USER_999)...")
    r = requests.post(f"{API_BASE}/login", json={"employee_id": "TEST_USER_999", "password": "UserPass@123"})
    assert r.status_code == 200
    user_login_data = r.json()
    assert user_login_data["role"] == "USER"
    assert user_login_data["department_id"] == 2
    print("OK - New Standard User authenticated. Scopes verified (Dept 2, Role USER).")

    # Standard User posts a query in department 2
    print("  -> User posting a query in Department 2...")
    query_payload = {
        "department_id": 2,
        "posted_by": test_user_id,
        "title": "HR payroll module calculation issue",
        "body": "I am facing issues when executing PC00_M40_CALC. The tax slab values are not updated.",
        "priority": "HIGH"
    }
    r = requests.post(f"{API_BASE}/queries", json=query_payload)
    assert r.status_code == 201
    query_id = r.json()["query_id"]
    print(f"OK - Query posted successfully with ID: {query_id}")

    # Standard User posts a comment on that query
    print("  -> User posting a reply comment (requires approval)...")
    comment_payload = {
        "posted_by": test_user_id,
        "body": "Checking if anyone else in HR is getting this error?",
        "role": "USER"
    }
    r = requests.post(f"{API_BASE}/queries/{query_id}/comments", json=comment_payload)
    assert r.status_code == 201
    comment_data = r.json()
    comment_id = comment_data["comment_id"]
    assert comment_data["status"] == "PENDING", "User reply should be in PENDING moderation state"
    print(f"OK - Comment posted! Checked: Status is PENDING moderation.")

    # ──────────────────────────────────────────────────────────
    # STEP 5: Log in as the new Module Admin and perform administrative actions
    # ──────────────────────────────────────────────────────────
    print("\n[Step 5] Logging in as the new Module Admin (TEST_MADMIN_999)...")
    r = requests.post(f"{API_BASE}/login", json={"employee_id": "TEST_MADMIN_999", "password": "AdminPass@123"})
    assert r.status_code == 200
    madmin_login_data = r.json()
    assert madmin_login_data["role"] == "MODULE_ADMIN"
    assert madmin_login_data["department_id"] == 2
    print("OK - New Module Admin authenticated. Scopes verified (Dept 2, Role MODULE_ADMIN).")

    # Module Admin views the query details including pending comments
    print("  -> Module Admin fetching the query details...")
    r = requests.get(f"{API_BASE}/queries/{query_id}?role=MODULE_ADMIN")
    assert r.status_code == 200
    query_detail = r.json()
    assert len(query_detail["comments"]) == 1
    assert query_detail["comments"][0]["status"] == "PENDING"
    print("OK - Verified: Module Admin can see the pending comment.")

    # Module Admin approves the comment
    print("  -> Module Admin moderating: Approving the pending comment...")
    mod_payload = {"action": "APPROVE", "admin_id": test_madmin_id}
    r = requests.put(f"{API_BASE}/comments/{comment_id}/moderate", json=mod_payload)
    assert r.status_code == 200
    assert r.json()["status"] == "APPROVED"
    print("OK - Comment successfully APPROVED by Module Admin!")

    # Module Admin updates the query status to ANSWERED
    print("  -> Module Admin updating query ticket status to ANSWERED...")
    r = requests.put(f"{API_BASE}/queries/{query_id}", json={"status": "ANSWERED"})
    assert r.status_code == 200
    assert r.json()["status"] == "ANSWERED"
    print("OK - Query ticket status updated to ANSWERED successfully!")

    # ──────────────────────────────────────────────────────────
    # STEP 6: Verify final visibility for the Standard User
    # ──────────────────────────────────────────────────────────
    print("\n[Step 6] Verifying user visibility as TEST_USER_999...")
    r = requests.get(f"{API_BASE}/queries/{query_id}?role=USER")
    assert r.status_code == 200
    user_view_detail = r.json()
    assert user_view_detail["status"] == "ANSWERED", "User should see status updated to ANSWERED"
    assert len(user_view_detail["comments"]) == 1, "User should now be able to see the comment"
    assert user_view_detail["comments"][0]["status"] == "APPROVED"
    print("OK - Verified: Standard User sees the updated ANSWERED status and the APPROVED reply!")

    print("\n==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY! 360° TEST VERIFIED!")
    print("==================================================")

if __name__ == "__main__":
    test_portal()
