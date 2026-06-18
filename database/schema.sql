-- ============================================================
-- BHEL SAP PORTAL - DATABASE SCHEMA
-- ============================================================

CREATE DATABASE IF NOT EXISTS bhel_sap_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bhel_sap_portal;

-- ============================================================
-- DEPARTMENTS & SAP MODULES
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
    department_id   INT AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL,
    sap_module      VARCHAR(50)  NOT NULL,   -- e.g. FI, HR, MM, SD, PP
    description     TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    user_id         INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     VARCHAR(20)  UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('USER','MODULE_ADMIN','SUPER_ADMIN') NOT NULL DEFAULT 'USER',
    department_id   INT,
    profile_pic     VARCHAR(255),
    phone           VARCHAR(20),
    designation     VARCHAR(100),
    is_active       TINYINT(1)   DEFAULT 1,
    last_login      DATETIME,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE SET NULL
);

-- ============================================================
-- LIBRARY: MANUALS / VIDEOS / TRANSACTION CODES
-- ============================================================

CREATE TABLE IF NOT EXISTS library_items (
    item_id         INT AUTO_INCREMENT PRIMARY KEY,
    department_id   INT NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    item_type       ENUM('MANUAL','VIDEO','TRANSACTION') NOT NULL,
    file_path       VARCHAR(500),           -- for MANUAL (PDF) or VIDEO (mp4/url)
    transaction_code VARCHAR(20),           -- for TRANSACTION items  e.g. F-02
    version         VARCHAR(20) DEFAULT '1.0',
    version_notes   TEXT,
    uploaded_by     INT,                    -- user_id of uploader
    is_active       TINYINT(1) DEFAULT 1,
    view_count      INT DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by)   REFERENCES users(user_id) ON DELETE SET NULL
);

-- Version history for library items
CREATE TABLE IF NOT EXISTS library_item_versions (
    version_id      INT AUTO_INCREMENT PRIMARY KEY,
    item_id         INT NOT NULL,
    version         VARCHAR(20) NOT NULL,
    file_path       VARCHAR(500),
    version_notes   TEXT,
    uploaded_by     INT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id)      REFERENCES library_items(item_id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by)  REFERENCES users(user_id) ON DELETE SET NULL
);

-- ============================================================
-- QUERIES (Forum / Q&A)
-- ============================================================

CREATE TABLE IF NOT EXISTS queries (
    query_id        INT AUTO_INCREMENT PRIMARY KEY,
    department_id   INT NOT NULL,
    posted_by       INT NOT NULL,           -- user_id
    title           VARCHAR(255) NOT NULL,
    body            TEXT NOT NULL,
    status          ENUM('OPEN','ANSWERED','CLOSED') DEFAULT 'OPEN',
    priority        ENUM('LOW','MEDIUM','HIGH') DEFAULT 'MEDIUM',
    is_anonymous    TINYINT(1) DEFAULT 0,
    view_count      INT DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE CASCADE,
    FOREIGN KEY (posted_by)     REFERENCES users(user_id) ON DELETE CASCADE
);

-- Comments / answers on queries
CREATE TABLE IF NOT EXISTS query_comments (
    comment_id      INT AUTO_INCREMENT PRIMARY KEY,
    query_id        INT NOT NULL,
    posted_by       INT NOT NULL,
    body            TEXT NOT NULL,
    is_admin_reply  TINYINT(1) DEFAULT 0,
    status          ENUM('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING',
    -- admin comments auto-approved; user comments need approval
    approved_by     INT,
    approved_at     DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (query_id)     REFERENCES queries(query_id) ON DELETE CASCADE,
    FOREIGN KEY (posted_by)    REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by)  REFERENCES users(user_id) ON DELETE SET NULL
);

-- ============================================================
-- FAQs
-- ============================================================

CREATE TABLE IF NOT EXISTS faqs (
    faq_id          INT AUTO_INCREMENT PRIMARY KEY,
    department_id   INT NOT NULL,
    question        TEXT NOT NULL,
    answer          TEXT NOT NULL,
    display_order   INT DEFAULT 0,
    is_active       TINYINT(1) DEFAULT 1,
    created_by      INT,
    updated_by      INT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by)    REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by)    REFERENCES users(user_id) ON DELETE SET NULL
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT,                    -- NULL = broadcast to entire department
    department_id   INT,
    title           VARCHAR(255) NOT NULL,
    body            TEXT,
    type            ENUM('QUERY_ANSWERED','MANUAL_UPDATED','GENERAL','FAQ_UPDATED') DEFAULT 'GENERAL',
    ref_id          INT,                    -- id of related item (query_id / item_id)
    ref_type        VARCHAR(50),            -- 'QUERY','LIBRARY_ITEM' etc.
    is_read         TINYINT(1) DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)       REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE CASCADE
);

-- ============================================================
-- BOOKMARKS
-- ============================================================

CREATE TABLE IF NOT EXISTS bookmarks (
    bookmark_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    ref_type        ENUM('LIBRARY_ITEM','QUERY','FAQ') NOT NULL,
    ref_id          INT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bookmark (user_id, ref_type, ref_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
    log_id          INT AUTO_INCREMENT PRIMARY KEY,
    performed_by    INT,
    role            VARCHAR(30),
    action          VARCHAR(100) NOT NULL,   -- e.g. 'CREATE_FAQ', 'DELETE_USER'
    entity_type     VARCHAR(50),             -- 'FAQ','USER','LIBRARY_ITEM' etc.
    entity_id       INT,
    details         TEXT,                    -- JSON or human-readable note
    ip_address      VARCHAR(45),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (performed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- INSERT INTO departments (department_name, sap_module) VALUES
-- ('Finance & Accounts',      'FI'),
-- ('Human Resources',         'HR'),
-- ('Materials Management',    'MM'),
-- ('Sales & Distribution',    'SD'),
-- ('Production Planning',     'PP'),
-- ('Project Systems',         'PS'),
-- ('Plant Maintenance',       'PM');

-- INSERT INTO users (employee_id, name, email, password_hash, role, department_id) VALUES
-- ('ADMIN001', 'Super Admin', 'admin@bhel.in', 'Admin@123', 'SUPER_ADMIN', NULL);

-- INSERT INTO users (employee_id, name, email, password_hash, role, department_id) VALUES
-- ('EMP1001', 'Rajesh Kumar',  'rajesh.kumar@bhel.in',  'Test@1234', 'MODULE_ADMIN', 1),
-- ('EMP1002', 'Priya Sharma',  'priya.sharma@bhel.in',  'Test@1234', 'USER',         1),
-- ('EMP1003', 'Anil Verma',    'anil.verma@bhel.in',    'Test@1234', 'USER',         2);

-- INSERT INTO faqs (department_id, question, answer, display_order, created_by) VALUES
-- (1, 'How do I post a journal entry in SAP FI?', 'Use transaction code F-02 to post a manual journal entry. Navigate to Accounting > Financial Accounting > General Ledger > Posting > Enter G/L Account Document.', 1, 1),
-- (1, 'What is the transaction code for displaying a G/L account balance?', 'Use FS10N to display G/L account balances. Enter the G/L account number, company code, and fiscal year to view the balance.', 2, 1),
-- (1, 'How do I clear open items in SAP?', 'Use transaction F-03 for manual clearing or F.13 for automatic clearing of open items in the G/L.', 3, 1),
-- (2, 'How do I run payroll in SAP HR?', 'Use transaction PC00_M40_CALC to run payroll for Indian payroll. Ensure master data is complete before running.', 1, 1);

-- INSERT INTO library_items (department_id, title, description, item_type, file_path, transaction_code, version, uploaded_by) VALUES
-- (1, 'FI Module User Manual v2.1', 'Complete guide to SAP Financial Accounting module', 'MANUAL', 'uploads/manuals/fi_manual_v2.1.pdf', NULL, '2.1', 1),
-- (1, 'Journal Entry Posting Guide', 'Step-by-step video guide for posting journal entries', 'VIDEO', 'uploads/videos/journal_entry.mp4', NULL, '1.0', 1),
-- (1, 'F-02: Post Document', 'Post a G/L account document manually', 'TRANSACTION', NULL, 'F-02', '1.0', 1),
-- (1, 'FS10N: G/L Account Balance Display', 'Display balances in G/L accounts', 'TRANSACTION', NULL, 'FS10N', '1.0', 1),
-- (1, 'FB50: Enter G/L Account Document', 'Screen variant for G/L account document entry', 'TRANSACTION', NULL, 'FB50', '1.0', 1);

-- INSERT INTO queries (department_id, posted_by, title, body, status) VALUES
-- (1, 2, 'Error during month-end closing', 'I am getting error F5 800 during month-end closing. The system says posting period is not open. How do I resolve this?', 'OPEN'),
-- (1, 3, 'How to reverse a posted document?', 'I accidentally posted a document with wrong amount. What is the procedure to reverse it in SAP FI?', 'ANSWERED');

-- INSERT INTO query_comments (query_id, posted_by, body, is_admin_reply, status, approved_by, approved_at) VALUES
-- (2, 1, 'To reverse a posted document, use transaction FB08 for individual reversal or F.80 for mass reversal. Enter the document number, company code, fiscal year, and reversal reason code. Press Post to complete the reversal.', 1, 'APPROVED', 1, NOW());

-- INSERT INTO notifications (department_id, title, body, type, ref_type) VALUES
-- (1, 'FI Manual Updated to v2.1', 'The Financial Accounting user manual has been updated to version 2.1 with new month-end procedures.', 'MANUAL_UPDATED', 'LIBRARY_ITEM'),
-- (1, 'New FAQ Added', 'A new FAQ on G/L account balance display has been added to the FI module.', 'FAQ_UPDATED', NULL);