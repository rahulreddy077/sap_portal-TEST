import os

DB_USER     = os.environ.get("DB_USER",     "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "BVRreddy2006")
DB_HOST     = os.environ.get("DB_HOST",     "localhost")
DB_NAME     = os.environ.get("DB_NAME",     "bhel_sap_portal")

SECRET_KEY  = os.environ.get("SECRET_KEY",  "bhel-sap-secret-key-change-in-production")

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "..", "frontend", "uploads")
ALLOWED_EXTENSIONS = {"pdf", "mp4", "mov", "avi", "webm", "png", "jpg", "jpeg"}
MAX_CONTENT_LENGTH = 100 * 1024 * 1024   # 100 MB