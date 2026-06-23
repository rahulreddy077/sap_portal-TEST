import pymysql
import re

# Database Credentials from your Clever Cloud screenshot
DB_HOST = "bn61dwfaodnfby6lso3i-mysql.services.clever-cloud.com"
DB_USER = "u6dsrhuufiibfpbs"
DB_PASSWORD = "afSeaOWeFovIBJ1DmTpY"
DB_NAME = "bn61dwfaodnfby6lso3i"

schema_path = "../database/schema.sql"

def init_db():
    print(f"Connecting to database {DB_NAME} on {DB_HOST}...")
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=3306,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    
    try:
        with open(schema_path, "r", encoding="utf-8") as f:
            sql_content = f.read()

        # Remove CREATE DATABASE and USE statements (including multi-line variants)
        sql_content = re.sub(r'(?i)CREATE DATABASE\s+IF\s+NOT\s+EXISTS\s+\w+\s+CHARACTER\s+SET\s+\w+\s+COLLATE\s+[\w_]+;', '', sql_content, flags=re.DOTALL)
        sql_content = re.sub(r'(?i)USE\s+\w+;', '', sql_content)

        # Uncomment the seed inserts
        # Let's find any commented lines starting with INSERT and remove the '-- '
        lines = sql_content.splitlines()
        clean_lines = []
        for line in lines:
            trimmed = line.strip()
            # If it's a commented INSERT, uncomment it
            if trimmed.startswith("-- INSERT") or trimmed.startswith("-- (") or trimmed.startswith("-- ('") or (trimmed.startswith("--") and "INSERT INTO" in line):
                clean_lines.append(line.replace("--", "", 1))
            else:
                clean_lines.append(line)
        
        sql_content = "\n".join(clean_lines)
        
        # Split by semicolon, ignoring comments
        statements = []
        current_stmt = []
        for line in sql_content.splitlines():
            # Skip pure comments unless they are part of statements
            if line.strip().startswith("--") or line.strip().startswith("#"):
                continue
            if not line.strip():
                continue
            current_stmt.append(line)
            if ";" in line:
                statements.append("\n".join(current_stmt))
                current_stmt = []
        
        with conn.cursor() as cursor:
            # Drop existing tables if any to do a clean init
            print("Dropping existing tables if any...")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
            tables = ["audit_log", "bookmarks", "notifications", "faqs", "query_comments", "queries", "library_item_versions", "library_items", "users", "departments"]
            for table in tables:
                cursor.execute(f"DROP TABLE IF EXISTS {table};")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
            conn.commit()
            
            print("Creating tables and seeding data...")
            for statement in statements:
                stmt_clean = statement.strip()
                if not stmt_clean:
                    continue
                try:
                    cursor.execute(stmt_clean)
                except Exception as ex:
                    print(f"Error executing statement:\n{stmt_clean}\nError: {ex}")
                    raise ex
            conn.commit()
            print("Database successfully initialized and seeded!")
            
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
