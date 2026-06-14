from db import db
from datetime import datetime


class Department(db.Model):
    __tablename__ = "departments"

    department_id   = db.Column(db.Integer, primary_key=True)
    department_name = db.Column(db.String(100), nullable=False)
    sap_module      = db.Column(db.String(50),  nullable=False)
    description     = db.Column(db.Text)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    users           = db.relationship("User",        backref="department", lazy=True)
    library_items   = db.relationship("LibraryItem", backref="department", lazy=True)
    queries         = db.relationship("Query",       backref="department", lazy=True)
    faqs            = db.relationship("FAQ",         backref="department", lazy=True)


class User(db.Model):
    __tablename__ = "users"

    user_id       = db.Column(db.Integer, primary_key=True)
    employee_id   = db.Column(db.String(20),  unique=True, nullable=False)
    name          = db.Column(db.String(100), nullable=False)
    email         = db.Column(db.String(150), unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role          = db.Column(db.Enum("USER", "MODULE_ADMIN", "SUPER_ADMIN"), nullable=False, default="USER")
    department_id = db.Column(db.Integer, db.ForeignKey("departments.department_id"), nullable=True)
    profile_pic   = db.Column(db.String(255))
    phone         = db.Column(db.String(20))
    designation   = db.Column(db.String(100))
    is_active     = db.Column(db.SmallInteger, default=1)
    last_login    = db.Column(db.DateTime)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "user_id":       self.user_id,
            "employee_id":   self.employee_id,
            "name":          self.name,
            "email":         self.email,
            "role":          self.role,
            "department_id": self.department_id,
            "phone":         self.phone,
            "designation":   self.designation,
            "is_active":     self.is_active,
            "last_login":    self.last_login.isoformat() if self.last_login else None,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
        }


class LibraryItem(db.Model):
    __tablename__ = "library_items"

    item_id          = db.Column(db.Integer, primary_key=True)
    department_id    = db.Column(db.Integer, db.ForeignKey("departments.department_id"), nullable=False)
    title            = db.Column(db.String(255), nullable=False)
    description      = db.Column(db.Text)
    item_type        = db.Column(db.Enum("MANUAL", "VIDEO", "TRANSACTION"), nullable=False)
    file_path        = db.Column(db.String(500))
    transaction_code = db.Column(db.String(20))
    version          = db.Column(db.String(20), default="1.0")
    version_notes    = db.Column(db.Text)
    uploaded_by      = db.Column(db.Integer, db.ForeignKey("users.user_id"))
    is_active        = db.Column(db.SmallInteger, default=1)
    view_count       = db.Column(db.Integer, default=0)
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at       = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    uploader  = db.relationship("User", foreign_keys=[uploaded_by])
    versions  = db.relationship("LibraryItemVersion", backref="item", lazy=True)

    def to_dict(self):
        return {
            "item_id":          self.item_id,
            "department_id":    self.department_id,
            "title":            self.title,
            "description":      self.description,
            "item_type":        self.item_type,
            "file_path":        self.file_path,
            "transaction_code": self.transaction_code,
            "version":          self.version,
            "version_notes":    self.version_notes,
            "uploaded_by":      self.uploaded_by,
            "uploader_name":    self.uploader.name if self.uploader else None,
            "is_active":        self.is_active,
            "view_count":       self.view_count,
            "created_at":       self.created_at.isoformat() if self.created_at else None,
            "updated_at":       self.updated_at.isoformat() if self.updated_at else None,
        }


class LibraryItemVersion(db.Model):
    __tablename__ = "library_item_versions"

    version_id    = db.Column(db.Integer, primary_key=True)
    item_id       = db.Column(db.Integer, db.ForeignKey("library_items.item_id"), nullable=False)
    version       = db.Column(db.String(20), nullable=False)
    file_path     = db.Column(db.String(500))
    version_notes = db.Column(db.Text)
    uploaded_by   = db.Column(db.Integer, db.ForeignKey("users.user_id"))
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    uploader = db.relationship("User", foreign_keys=[uploaded_by])


class Query(db.Model):
    __tablename__ = "queries"

    query_id      = db.Column(db.Integer, primary_key=True)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.department_id"), nullable=False)
    posted_by     = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    title         = db.Column(db.String(255), nullable=False)
    body          = db.Column(db.Text, nullable=False)
    status        = db.Column(db.Enum("OPEN", "ANSWERED", "CLOSED"), default="OPEN")
    priority      = db.Column(db.Enum("LOW", "MEDIUM", "HIGH"), default="MEDIUM")
    is_anonymous  = db.Column(db.SmallInteger, default=0)
    view_count    = db.Column(db.Integer, default=0)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    poster   = db.relationship("User",         foreign_keys=[posted_by])
    comments = db.relationship("QueryComment", backref="query", lazy=True,
                               order_by="QueryComment.created_at")

    def to_dict(self, include_comments=False, viewer_role=None):
        d = {
            "query_id":      self.query_id,
            "department_id": self.department_id,
            "posted_by":     self.posted_by,
            "poster_name":   self.poster.name if (self.poster and not self.is_anonymous) else "Anonymous",
            "title":         self.title,
            "body":          self.body,
            "status":        self.status,
            "priority":      self.priority,
            "view_count":    self.view_count,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
            "updated_at":    self.updated_at.isoformat() if self.updated_at else None,
            "comment_count": len(self.comments),
        }
        if include_comments:
            if viewer_role in ("MODULE_ADMIN", "SUPER_ADMIN"):
                d["comments"] = [c.to_dict() for c in self.comments]
            else:
                d["comments"] = [c.to_dict() for c in self.comments if c.status == "APPROVED"]
        return d


class QueryComment(db.Model):
    __tablename__ = "query_comments"

    comment_id    = db.Column(db.Integer, primary_key=True)
    query_id      = db.Column(db.Integer, db.ForeignKey("queries.query_id"), nullable=False)
    posted_by     = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    body          = db.Column(db.Text, nullable=False)
    is_admin_reply = db.Column(db.SmallInteger, default=0)
    status        = db.Column(db.Enum("PENDING", "APPROVED", "REJECTED"), default="PENDING")
    approved_by   = db.Column(db.Integer, db.ForeignKey("users.user_id"))
    approved_at   = db.Column(db.DateTime)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    poster    = db.relationship("User", foreign_keys=[posted_by])
    approver  = db.relationship("User", foreign_keys=[approved_by])

    def to_dict(self):
        return {
            "comment_id":    self.comment_id,
            "query_id":      self.query_id,
            "posted_by":     self.posted_by,
            "poster_name":   self.poster.name if self.poster else "Unknown",
            "body":          self.body,
            "is_admin_reply": self.is_admin_reply,
            "status":        self.status,
            "approved_by":   self.approved_by,
            "approved_at":   self.approved_at.isoformat() if self.approved_at else None,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
        }


class FAQ(db.Model):
    __tablename__ = "faqs"

    faq_id        = db.Column(db.Integer, primary_key=True)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.department_id"), nullable=False)
    question      = db.Column(db.Text, nullable=False)
    answer        = db.Column(db.Text, nullable=False)
    display_order = db.Column(db.Integer, default=0)
    is_active     = db.Column(db.SmallInteger, default=1)
    created_by    = db.Column(db.Integer, db.ForeignKey("users.user_id"))
    updated_by    = db.Column(db.Integer, db.ForeignKey("users.user_id"))
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = db.relationship("User", foreign_keys=[created_by])
    updater = db.relationship("User", foreign_keys=[updated_by])

    def to_dict(self):
        return {
            "faq_id":        self.faq_id,
            "department_id": self.department_id,
            "question":      self.question,
            "answer":        self.answer,
            "display_order": self.display_order,
            "is_active":     self.is_active,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
            "updated_at":    self.updated_at.isoformat() if self.updated_at else None,
        }


class Notification(db.Model):
    __tablename__ = "notifications"

    notification_id = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey("users.user_id"))
    department_id   = db.Column(db.Integer, db.ForeignKey("departments.department_id"))
    title           = db.Column(db.String(255), nullable=False)
    body            = db.Column(db.Text)
    type            = db.Column(db.Enum("QUERY_ANSWERED", "MANUAL_UPDATED", "GENERAL", "FAQ_UPDATED"),
                                default="GENERAL")
    ref_id          = db.Column(db.Integer)
    ref_type        = db.Column(db.String(50))
    is_read         = db.Column(db.SmallInteger, default=0)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "notification_id": self.notification_id,
            "user_id":         self.user_id,
            "department_id":   self.department_id,
            "title":           self.title,
            "body":            self.body,
            "type":            self.type,
            "ref_id":          self.ref_id,
            "ref_type":        self.ref_type,
            "is_read":         self.is_read,
            "created_at":      self.created_at.isoformat() if self.created_at else None,
        }


class Bookmark(db.Model):
    __tablename__ = "bookmarks"

    bookmark_id = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    ref_type    = db.Column(db.Enum("LIBRARY_ITEM", "QUERY", "FAQ"), nullable=False)
    ref_id      = db.Column(db.Integer, nullable=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "bookmark_id": self.bookmark_id,
            "user_id":     self.user_id,
            "ref_type":    self.ref_type,
            "ref_id":      self.ref_id,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
        }


class AuditLog(db.Model):
    __tablename__ = "audit_log"

    log_id       = db.Column(db.Integer, primary_key=True)
    performed_by = db.Column(db.Integer, db.ForeignKey("users.user_id"))
    role         = db.Column(db.String(30))
    action       = db.Column(db.String(100), nullable=False)
    entity_type  = db.Column(db.String(50))
    entity_id    = db.Column(db.Integer)
    details      = db.Column(db.Text)
    ip_address   = db.Column(db.String(45))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    performer = db.relationship("User", foreign_keys=[performed_by])

    def to_dict(self):
        return {
            "log_id":        self.log_id,
            "performed_by":  self.performed_by,
            "performer_name": self.performer.name if self.performer else "Unknown",
            "role":          self.role,
            "action":        self.action,
            "entity_type":   self.entity_type,
            "entity_id":     self.entity_id,
            "details":       self.details,
            "ip_address":    self.ip_address,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
        }