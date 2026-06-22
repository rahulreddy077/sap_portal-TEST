import os
import json
import csv
import io
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from db import db
import config

app = Flask(__name__)
CORS(app)

# ── DB Configuration ──────────────────────────────────────────────────────────
app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"mysql+pymysql://{config.DB_USER}:{config.DB_PASSWORD}"
    f"@{config.DB_HOST}/{config.DB_NAME}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"]          = config.SECRET_KEY
app.config["UPLOAD_FOLDER"]       = config.UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"]  = config.MAX_CONTENT_LENGTH

db.init_app(app)

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
os.makedirs(os.path.join(app.config["UPLOAD_FOLDER"], "manuals"), exist_ok=True)
os.makedirs(os.path.join(app.config["UPLOAD_FOLDER"], "videos"),  exist_ok=True)

from models import (
    Department, User, LibraryItem, LibraryItemVersion,
    Query, QueryComment, FAQ, Notification, Bookmark, AuditLog
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def allowed_file(filename):
    return "." in filename and \
           filename.rsplit(".", 1)[1].lower() in config.ALLOWED_EXTENSIONS


def log_action(performed_by, role, action, entity_type=None, entity_id=None, details=None):
    entry = AuditLog(
        performed_by=performed_by,
        role=role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=request.remote_addr,
    )
    db.session.add(entry)


def notify_department(department_id, title, body, n_type="GENERAL", ref_id=None, ref_type=None):
    notif = Notification(
        department_id=department_id,
        title=title,
        body=body,
        type=n_type,
        ref_id=ref_id,
        ref_type=ref_type,
    )
    db.session.add(notif)


def notify_user(user_id, title, body, n_type="GENERAL", ref_id=None, ref_type=None):
    notif = Notification(
        user_id=user_id,
        title=title,
        body=body,
        type=n_type,
        ref_id=ref_id,
        ref_type=ref_type,
    )
    db.session.add(notif)


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    return "BHEL SAP Portal API Running"


@app.route("/login", methods=["POST"])
def login():
    data        = request.json or {}
    employee_id = data.get("employee_id", "").strip()
    password    = data.get("password", "")

    user = User.query.filter_by(employee_id=employee_id, is_active=1).first()

    if not user or user.password_hash != password:
        return jsonify({"status": "failed", "message": "Invalid credentials"})

    user.last_login = datetime.utcnow()
    db.session.commit()

    dept = Department.query.get(user.department_id) if user.department_id else None

    return jsonify({
        "status":         "success",
        "role":           user.role,
        "user_id":        user.user_id,
        "name":           user.name,
        "employee_id":    user.employee_id,
        "department_id":  user.department_id,
        "department_name": dept.department_name if dept else None,
        "sap_module":     dept.sap_module if dept else None,
    })


# ── Departments ───────────────────────────────────────────────────────────────

@app.route("/departments", methods=["GET"])
def get_departments():
    depts = Department.query.all()
    return jsonify([{
        "department_id":   d.department_id,
        "department_name": d.department_name,
        "sap_module":      d.sap_module,
        "description":     d.description,
    } for d in depts])


# ── Users (SUPER_ADMIN) ───────────────────────────────────────────────────────

@app.route("/users", methods=["GET"])
def get_users():
    dept_id = request.args.get("department_id")
    role    = request.args.get("role")
    q       = User.query
    if dept_id:
        q = q.filter_by(department_id=int(dept_id))
    if role:
        q = q.filter_by(role=role)
    users = q.all()
    return jsonify([u.to_dict() for u in users])


@app.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())


@app.route("/users", methods=["POST"])
def create_user():
    data = request.json or {}
    required = ["employee_id", "name", "password_hash", "role"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing required fields"}), 400

    if User.query.filter_by(employee_id=data["employee_id"]).first():
        return jsonify({"error": "Employee ID already exists"}), 409

    user = User(
        employee_id=data["employee_id"],
        name=data["name"],
        email=data.get("email"),
        password_hash=data["password_hash"],
        role=data["role"],
        department_id=data.get("department_id"),
        phone=data.get("phone"),
        designation=data.get("designation"),
    )
    db.session.add(user)
    admin_id   = data.get("admin_id")
    admin_role = data.get("admin_role", "SUPER_ADMIN")
    log_action(admin_id, admin_role, "CREATE_USER", "USER", None,
               f"Created user {data['employee_id']}")
    db.session.commit()
    return jsonify(user.to_dict()), 201


@app.route("/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json or {}
    for field in ["name", "email", "role", "department_id", "phone",
                  "designation", "is_active", "password_hash"]:
        if field in data:
            setattr(user, field, data[field])
    admin_id   = data.get("admin_id")
    admin_role = data.get("admin_role", "SUPER_ADMIN")
    log_action(admin_id, admin_role, "UPDATE_USER", "USER", user_id,
               f"Updated user {user.employee_id}")
    db.session.commit()
    return jsonify(user.to_dict())


@app.route("/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json or {}
    admin_id   = data.get("admin_id")
    admin_role = data.get("admin_role", "SUPER_ADMIN")
    log_action(admin_id, admin_role, "DELETE_USER", "USER", user_id,
               f"Deleted user {user.employee_id}")
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted"})


@app.route("/users/import-csv", methods=["POST"])
def import_users_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files["file"]
    if not file or not file.filename.endswith(".csv"):
        return jsonify({"error": "Invalid file format. Must be CSV."}), 400
        
    admin_id = request.form.get("admin_id")
    admin_role = request.form.get("admin_role", "SUPER_ADMIN")
    
    stream = io.StringIO(file.stream.read().decode("utf-8"), newline=None)
    csv_reader = csv.reader(stream)
    
    header = next(csv_reader, None)
    
    imported_count = 0
    errors = []
    
    for row in csv_reader:
        if not row or not any(row):
            continue
        try:
            username = row[0].strip()
            email = row[1].strip() if len(row) > 1 and row[1].strip() else None
            password = row[2].strip() if len(row) > 2 and row[2].strip() else None
            role = row[3].strip().upper() if len(row) > 3 and row[3].strip() else "USER"
            
            if role not in ("USER", "MODULE_ADMIN", "SUPER_ADMIN"):
                role = "USER"
                
            module_name = row[4].strip() if len(row) > 4 and row[4].strip() else None
            
            if not username or not password:
                errors.append(f"Row skipped: missing username or password. Row data: {row}")
                continue
            
            dept_id = None
            if module_name:
                module_upper = module_name.upper()
                dept = Department.query.filter(
                    (db.func.upper(Department.sap_module) == module_upper) |
                    (db.func.upper(Department.department_name).like(f"%{module_upper}%"))
                ).first()
                if dept:
                    dept_id = dept.department_id
            
            existing_user = User.query.filter_by(employee_id=username).first()
            if existing_user:
                existing_user.name = username.replace("_", " ").replace("-", " ").title()
                existing_user.email = email
                existing_user.password_hash = password
                existing_user.role = role
                existing_user.department_id = dept_id
            else:
                new_user = User(
                    employee_id=username,
                    name=username.replace("_", " ").replace("-", " ").title(),
                    email=email,
                    password_hash=password,
                    role=role,
                    department_id=dept_id
                )
                db.session.add(new_user)
            
            imported_count += 1
        except Exception as e:
            errors.append(f"Error parsing row {row}: {str(e)}")
            
    try:
        log_action(admin_id, admin_role, "BULK_IMPORT_USERS", "USER", None, f"Imported {imported_count} users from CSV")
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database commit failed: {str(e)}"}), 500
        
    return jsonify({
        "status": "success",
        "imported_count": imported_count,
        "errors": errors
    })


# ── Library ───────────────────────────────────────────────────────────────────

@app.route("/library", methods=["GET"])
def get_library():
    dept_id   = request.args.get("department_id")
    item_type = request.args.get("item_type")
    search    = request.args.get("search", "")
    q = LibraryItem.query.filter_by(is_active=1)
    if dept_id:
        q = q.filter_by(department_id=int(dept_id))
    if item_type:
        q = q.filter_by(item_type=item_type)
    if search:
        q = q.filter(
            db.or_(
                LibraryItem.title.ilike(f"%{search}%"),
                LibraryItem.description.ilike(f"%{search}%"),
                LibraryItem.transaction_code.ilike(f"%{search}%"),
            )
        )
    items = q.order_by(LibraryItem.updated_at.desc()).all()
    return jsonify([i.to_dict() for i in items])


@app.route("/library/<int:item_id>", methods=["GET"])
def get_library_item(item_id):
    item = LibraryItem.query.get_or_404(item_id)
    item.view_count += 1
    db.session.commit()
    return jsonify(item.to_dict())


@app.route("/library", methods=["POST"])
def create_library_item():
    """Handle both JSON (TRANSACTION) and multipart (MANUAL/VIDEO)."""
    if request.content_type and "multipart" in request.content_type:
        data = request.form.to_dict()
    else:
        data = request.json or {}

    required = ["department_id", "title", "item_type", "uploaded_by"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing required fields"}), 400

    file_path = None
    video_path = None
    
    if "file" in request.files:
        f = request.files["file"]
        if f and allowed_file(f.filename):
            fname = secure_filename(f.filename)
            subdir = "videos" if data.get("item_type") == "VIDEO" else "manuals"
            save_path = os.path.join(app.config["UPLOAD_FOLDER"], subdir, fname)
            f.save(save_path)
            if data.get("item_type") == "VIDEO":
                video_path = f"uploads/{subdir}/{fname}"
            else:
                file_path = f"uploads/{subdir}/{fname}"

    if "video_file" in request.files:
        vf = request.files["video_file"]
        if vf and allowed_file(vf.filename):
            vfname = secure_filename(vf.filename)
            vsave_path = os.path.join(app.config["UPLOAD_FOLDER"], "videos", vfname)
            vf.save(vsave_path)
            video_path = f"uploads/videos/{vfname}"

    item = LibraryItem(
        department_id    = int(data["department_id"]),
        title            = data["title"],
        description      = data.get("description"),
        item_type        = data["item_type"],
        file_path        = file_path,
        video_path       = video_path,
        transaction_code = data.get("transaction_code"),
        version          = data.get("version", "1.0"),
        version_notes    = data.get("version_notes"),
        uploaded_by      = int(data["uploaded_by"]),
    )
    db.session.add(item)
    db.session.flush()

    log_action(int(data["uploaded_by"]), data.get("admin_role", "MODULE_ADMIN"),
               "CREATE_LIBRARY_ITEM", "LIBRARY_ITEM", item.item_id,
               f"Uploaded {data['item_type']}: {data['title']}")

    notify_department(
        int(data["department_id"]),
        f"New {data['item_type'].title()} Added: {data['title']}",
        data.get("description", ""),
        "MANUAL_UPDATED", item.item_id, "LIBRARY_ITEM"
    )

    db.session.commit()
    return jsonify(item.to_dict()), 201


@app.route("/library/<int:item_id>", methods=["PUT"])
def update_library_item(item_id):
    item = LibraryItem.query.get_or_404(item_id)

    if request.content_type and "multipart" in request.content_type:
        data = request.form.to_dict()
    else:
        data = request.json or {}

    # Save old version
    old_version = LibraryItemVersion(
        item_id       = item.item_id,
        version       = item.version,
        file_path     = item.file_path,
        video_path    = item.video_path,
        version_notes = item.version_notes,
        uploaded_by   = item.uploaded_by,
    )
    db.session.add(old_version)

    for field in ["title", "description", "version", "version_notes", "transaction_code"]:
        if field in data:
            setattr(item, field, data[field])

    if "file" in request.files:
        f = request.files["file"]
        if f and allowed_file(f.filename):
            fname = secure_filename(f.filename)
            subdir = "videos" if item.item_type == "VIDEO" else "manuals"
            save_path = os.path.join(app.config["UPLOAD_FOLDER"], subdir, fname)
            f.save(save_path)
            if item.item_type == "VIDEO":
                item.video_path = f"uploads/{subdir}/{fname}"
            else:
                item.file_path = f"uploads/{subdir}/{fname}"

    if "video_file" in request.files:
        vf = request.files["video_file"]
        if vf and allowed_file(vf.filename):
            vfname = secure_filename(vf.filename)
            vsave_path = os.path.join(app.config["UPLOAD_FOLDER"], "videos", vfname)
            vf.save(vsave_path)
            item.video_path = f"uploads/videos/{vfname}"

    admin_id = int(data.get("updated_by", 0))
    log_action(admin_id, data.get("admin_role", "MODULE_ADMIN"),
               "UPDATE_LIBRARY_ITEM", "LIBRARY_ITEM", item_id,
               f"Updated to version {data.get('version', item.version)}")

    notify_department(
        item.department_id,
        f"Manual Updated: {item.title} → v{item.version}",
        item.version_notes or "",
        "MANUAL_UPDATED", item.item_id, "LIBRARY_ITEM"
    )

    db.session.commit()
    return jsonify(item.to_dict())


@app.route("/library/<int:item_id>", methods=["DELETE"])
def delete_library_item(item_id):
    item = LibraryItem.query.get_or_404(item_id)
    data = request.json or {}
    item.is_active = 0
    log_action(data.get("admin_id"), data.get("admin_role", "MODULE_ADMIN"),
               "DELETE_LIBRARY_ITEM", "LIBRARY_ITEM", item_id, f"Deleted: {item.title}")
    db.session.commit()
    return jsonify({"message": "Item deleted"})


@app.route("/library/<int:item_id>/versions", methods=["GET"])
def get_item_versions(item_id):
    versions = LibraryItemVersion.query.filter_by(item_id=item_id)\
                                       .order_by(LibraryItemVersion.created_at.desc()).all()
    return jsonify([{
        "version_id":   v.version_id,
        "version":      v.version,
        "file_path":    v.file_path,
        "video_path":   v.video_path,
        "version_notes": v.version_notes,
        "uploaded_by":  v.uploaded_by,
        "uploader_name": v.uploader.name if v.uploader else None,
        "created_at":   v.created_at.isoformat() if v.created_at else None,
    } for v in versions])


@app.route("/library/stats", methods=["GET"])
def library_stats():
    dept_id = request.args.get("department_id")
    q = LibraryItem.query.filter_by(is_active=1)
    if dept_id:
        q = q.filter_by(department_id=int(dept_id))
    items = q.all()
    return jsonify({
        "total":        len(items),
        "manuals":      sum(1 for i in items if i.item_type == "MANUAL"),
        "videos":       sum(1 for i in items if i.item_type == "VIDEO"),
        "transactions": sum(1 for i in items if i.item_type == "TRANSACTION"),
    })


# ── Queries ───────────────────────────────────────────────────────────────────

@app.route("/queries", methods=["GET"])
def get_queries():
    dept_id  = request.args.get("department_id")
    user_id  = request.args.get("user_id")
    status   = request.args.get("status")
    role     = request.args.get("role", "USER")
    search   = request.args.get("search", "")

    q = Query.query
    if dept_id:
        q = q.filter_by(department_id=int(dept_id))
    if user_id:
        q = q.filter_by(posted_by=int(user_id))
    if status:
        q = q.filter_by(status=status)
    if search:
        q = q.filter(
            db.or_(
                Query.title.ilike(f"%{search}%"),
                Query.body.ilike(f"%{search}%"),
            )
        )
    queries = q.order_by(Query.created_at.desc()).all()
    return jsonify([qr.to_dict(viewer_role=role) for qr in queries])


@app.route("/queries/<int:query_id>", methods=["GET"])
def get_query(query_id):
    role = request.args.get("role", "USER")
    qr   = Query.query.get_or_404(query_id)
    qr.view_count += 1
    db.session.commit()
    return jsonify(qr.to_dict(include_comments=True, viewer_role=role))


@app.route("/queries", methods=["POST"])
def create_query():
    data = request.json or {}
    required = ["department_id", "posted_by", "title", "body"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing required fields"}), 400

    qr = Query(
        department_id = int(data["department_id"]),
        posted_by     = int(data["posted_by"]),
        title         = data["title"],
        body          = data["body"],
        priority      = data.get("priority", "MEDIUM"),
        is_anonymous  = int(data.get("is_anonymous", 0)),
    )
    db.session.add(qr)
    db.session.commit()
    return jsonify(qr.to_dict()), 201


@app.route("/queries/<int:query_id>", methods=["PUT"])
def update_query_status(query_id):
    qr   = Query.query.get_or_404(query_id)
    data = request.json or {}
    if "status" in data:
        qr.status = data["status"]
    db.session.commit()
    return jsonify(qr.to_dict())


# Comments ────────────────────────────────────────────────────────────────────

@app.route("/queries/<int:query_id>/comments", methods=["POST"])
def add_comment(query_id):
    qr   = Query.query.get_or_404(query_id)
    data = request.json or {}
    role = data.get("role", "USER")

    is_admin = 1 if role in ("MODULE_ADMIN", "SUPER_ADMIN") else 0
    status   = "APPROVED" if is_admin else "PENDING"

    comment = QueryComment(
        query_id      = query_id,
        posted_by     = int(data["posted_by"]),
        body          = data["body"],
        is_admin_reply = is_admin,
        status        = status,
        approved_by   = int(data["posted_by"]) if is_admin else None,
        approved_at   = datetime.utcnow()       if is_admin else None,
    )
    db.session.add(comment)

    # If admin replied, mark query answered and notify query poster
    if is_admin:
        qr.status = "ANSWERED"
        notify_user(
            qr.posted_by,
            f"Your query has been answered: {qr.title}",
            "",
            "QUERY_ANSWERED", query_id, "QUERY"
        )

    db.session.commit()
    return jsonify(comment.to_dict()), 201


@app.route("/comments/<int:comment_id>/moderate", methods=["PUT"])
def moderate_comment(comment_id):
    comment = QueryComment.query.get_or_404(comment_id)
    data    = request.json or {}
    action  = data.get("action")   # "APPROVE" or "REJECT"
    admin_id = int(data.get("admin_id", 0))

    if action == "APPROVE":
        comment.status      = "APPROVED"
        comment.approved_by = admin_id
        comment.approved_at = datetime.utcnow()
    elif action == "REJECT":
        comment.status = "REJECTED"

    db.session.commit()
    return jsonify(comment.to_dict())


@app.route("/queries/stats", methods=["GET"])
def query_stats():
    dept_id = request.args.get("department_id")
    user_id = request.args.get("user_id")
    q = Query.query
    if dept_id:
        q = q.filter_by(department_id=int(dept_id))
    if user_id:
        q = q.filter_by(posted_by=int(user_id))
    queries = q.all()
    pending_comments = QueryComment.query.filter_by(status="PENDING")
    if dept_id:
        qids = [qr.query_id for qr in queries]
        pending_comments = pending_comments.filter(QueryComment.query_id.in_(qids))
    return jsonify({
        "total":            len(queries),
        "open":             sum(1 for qr in queries if qr.status == "OPEN"),
        "answered":         sum(1 for qr in queries if qr.status == "ANSWERED"),
        "closed":           sum(1 for qr in queries if qr.status == "CLOSED"),
        "pending_comments": pending_comments.count(),
    })


# ── FAQs ──────────────────────────────────────────────────────────────────────

@app.route("/faqs", methods=["GET"])
def get_faqs():
    dept_id = request.args.get("department_id")
    q = FAQ.query.filter_by(is_active=1)
    if dept_id:
        q = q.filter_by(department_id=int(dept_id))
    faqs = q.order_by(FAQ.display_order).all()
    return jsonify([f.to_dict() for f in faqs])


@app.route("/faqs", methods=["POST"])
def create_faq():
    data = request.json or {}
    faq = FAQ(
        department_id = int(data["department_id"]),
        question      = data["question"],
        answer        = data["answer"],
        display_order = data.get("display_order", 0),
        created_by    = data.get("created_by"),
    )
    db.session.add(faq)
    log_action(data.get("created_by"), data.get("admin_role", "MODULE_ADMIN"),
               "CREATE_FAQ", "FAQ", None, f"Created FAQ: {data['question'][:50]}")
    notify_department(
        int(data["department_id"]),
        "New FAQ Added",
        data["question"],
        "FAQ_UPDATED"
    )
    db.session.commit()
    return jsonify(faq.to_dict()), 201


@app.route("/faqs/<int:faq_id>", methods=["PUT"])
def update_faq(faq_id):
    faq  = FAQ.query.get_or_404(faq_id)
    data = request.json or {}
    for field in ["question", "answer", "display_order", "is_active"]:
        if field in data:
            setattr(faq, field, data[field])
    faq.updated_by = data.get("updated_by")
    log_action(data.get("updated_by"), data.get("admin_role", "MODULE_ADMIN"),
               "UPDATE_FAQ", "FAQ", faq_id)
    db.session.commit()
    return jsonify(faq.to_dict())


@app.route("/faqs/<int:faq_id>", methods=["DELETE"])
def delete_faq(faq_id):
    faq  = FAQ.query.get_or_404(faq_id)
    data = request.json or {}
    faq.is_active = 0
    log_action(data.get("admin_id"), data.get("admin_role", "MODULE_ADMIN"),
               "DELETE_FAQ", "FAQ", faq_id)
    db.session.commit()
    return jsonify({"message": "FAQ deleted"})


# ── Notifications ─────────────────────────────────────────────────────────────

@app.route("/notifications", methods=["GET"])
def get_notifications():
    user_id = request.args.get("user_id")
    dept_id = request.args.get("department_id")
    limit   = int(request.args.get("limit", 20))

    q = Notification.query
    if user_id and dept_id:
        q = q.filter(
            db.or_(
                Notification.user_id == int(user_id),
                db.and_(Notification.department_id == int(dept_id),
                        Notification.user_id.is_(None))
            )
        )
    elif user_id:
        q = q.filter_by(user_id=int(user_id))
    elif dept_id:
        q = q.filter_by(department_id=int(dept_id))

    notifs = q.order_by(Notification.created_at.desc()).limit(limit).all()
    return jsonify([n.to_dict() for n in notifs])


@app.route("/notifications/<int:notif_id>/read", methods=["PUT"])
def mark_notification_read(notif_id):
    n = Notification.query.get_or_404(notif_id)
    n.is_read = 1
    db.session.commit()
    return jsonify({"message": "Marked as read"})


@app.route("/notifications/mark-all-read", methods=["PUT"])
def mark_all_read():
    data    = request.json or {}
    user_id = data.get("user_id")
    dept_id = data.get("department_id")
    q = Notification.query.filter_by(is_read=0)
    if user_id:
        q = q.filter(
            db.or_(Notification.user_id == int(user_id),
                   db.and_(Notification.department_id == int(dept_id),
                           Notification.user_id.is_(None)))
        )
    q.update({"is_read": 1}, synchronize_session=False)
    db.session.commit()
    return jsonify({"message": "All marked as read"})


@app.route("/notifications/clear-all", methods=["PUT"])
def clear_all_notifications():
    data    = request.json or {}
    user_id = data.get("user_id")
    dept_id = data.get("department_id")
    q = Notification.query
    if user_id:
        q = q.filter(
            db.or_(Notification.user_id == int(user_id),
                   db.and_(Notification.department_id == int(dept_id),
                           Notification.user_id.is_(None)))
        )
        q.delete(synchronize_session=False)
        db.session.commit()
        return jsonify({"message": "All notifications cleared"})
    return jsonify({"error": "user_id is required"}), 400


# ── Bookmarks ─────────────────────────────────────────────────────────────────

@app.route("/bookmarks", methods=["GET"])
def get_bookmarks():
    user_id  = request.args.get("user_id")
    ref_type = request.args.get("ref_type")
    q = Bookmark.query
    if user_id:
        q = q.filter_by(user_id=int(user_id))
    if ref_type:
        q = q.filter_by(ref_type=ref_type)
    bookmarks = q.order_by(Bookmark.created_at.desc()).all()

    # Enrich with actual item data
    result = []
    for bm in bookmarks:
        d = bm.to_dict()
        if bm.ref_type == "LIBRARY_ITEM":
            item = LibraryItem.query.get(bm.ref_id)
            d["item"] = item.to_dict() if item else None
        elif bm.ref_type == "QUERY":
            query = Query.query.get(bm.ref_id)
            d["item"] = query.to_dict() if query else None
        elif bm.ref_type == "FAQ":
            faq = FAQ.query.get(bm.ref_id)
            d["item"] = faq.to_dict() if faq else None
        result.append(d)
    return jsonify(result)


@app.route("/bookmarks", methods=["POST"])
def add_bookmark():
    data = request.json or {}
    # Toggle: remove if exists
    existing = Bookmark.query.filter_by(
        user_id  = int(data["user_id"]),
        ref_type = data["ref_type"],
        ref_id   = int(data["ref_id"]),
    ).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"message": "Bookmark removed", "bookmarked": False})

    bm = Bookmark(
        user_id  = int(data["user_id"]),
        ref_type = data["ref_type"],
        ref_id   = int(data["ref_id"]),
    )
    db.session.add(bm)
    db.session.commit()
    return jsonify({"message": "Bookmarked", "bookmarked": True, "bookmark": bm.to_dict()}), 201


# ── Audit Log ─────────────────────────────────────────────────────────────────

@app.route("/audit-log", methods=["GET"])
def get_audit_log():
    dept_id  = request.args.get("department_id")
    limit    = int(request.args.get("limit", 50))
    offset   = int(request.args.get("offset", 0))

    q = AuditLog.query
    # filter by department via joining users
    if dept_id:
        user_ids = [u.user_id for u in User.query.filter_by(department_id=int(dept_id)).all()]
        q = q.filter(AuditLog.performed_by.in_(user_ids))
    logs = q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    total = q.count()
    return jsonify({"total": total, "logs": [l.to_dict() for l in logs]})


# ── Dashboard Stats ───────────────────────────────────────────────────────────

@app.route("/dashboard/stats", methods=["GET"])
def dashboard_stats():
    dept_id = request.args.get("department_id")
    user_id = request.args.get("user_id")
    role    = request.args.get("role", "USER")

    lib_q = LibraryItem.query.filter_by(is_active=1)
    qry_q = Query.query
    faq_q = FAQ.query.filter_by(is_active=1)
    if dept_id:
        lib_q = lib_q.filter_by(department_id=int(dept_id))
        qry_q = qry_q.filter_by(department_id=int(dept_id))
        faq_q = faq_q.filter_by(department_id=int(dept_id))

    my_open_queries = 0
    if user_id:
        my_open_queries = Query.query.filter_by(
            posted_by=int(user_id), status="OPEN"
        ).count()

    pending_comments = 0
    if role in ("MODULE_ADMIN", "SUPER_ADMIN") and dept_id:
        qids = [qr.query_id for qr in qry_q.all()]
        pending_comments = QueryComment.query.filter(
            QueryComment.query_id.in_(qids),
            QueryComment.status == "PENDING"
        ).count()

    return jsonify({
        "library": {
            "total":        lib_q.count(),
            "manuals":      lib_q.filter_by(item_type="MANUAL").count(),
            "videos":       lib_q.filter_by(item_type="VIDEO").count(),
            "transactions": lib_q.filter_by(item_type="TRANSACTION").count(),
        },
        "queries": {
            "total":            qry_q.count(),
            "open":             qry_q.filter_by(status="OPEN").count(),
            "answered":         qry_q.filter_by(status="ANSWERED").count(),
            "pending_comments": pending_comments,
            "my_open":          my_open_queries,
        },
        "faqs":  faq_q.count(),
    })


# ── File Serving ──────────────────────────────────────────────────────────────

@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


if __name__ == "__main__":
    app.run(debug=True, port=5000)