import psycopg2
from app.core.config import settings

def get_db_connection():
    """Get a direct connection to live Supabase PostgreSQL database."""
    try:
        conn = psycopg2.connect(
            host="db.uvibkxulhhknhptzvbwo.supabase.co",
            port=5432,
            user="postgres",
            password=settings.SUPABASE_DB_PASSWORD,
            dbname="postgres",
            connect_timeout=10
        )
        conn.autocommit = True
        return conn
    except Exception as e:
        print("[Supabase DB Connection Warning]:", str(e))
        return None

def upsert_user_profile(user_id: str, email: str, full_name: str = ""):
    """Save or update user in Supabase public.profiles."""
    conn = get_db_connection()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO public.profiles (id, email, full_name, updated_at)
            VALUES (%s, %s, %s, now())
            ON CONFLICT (email) 
            DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = now();
        """, (user_id, email.lower().strip(), full_name))
        cur.close()
        conn.close()
        print(f"[Supabase Sync] Profile synced for {email}")
        return True
    except Exception as e:
        print(f"[Supabase Profile Sync Error]: {e}")
        try: conn.close()
        except: pass
        return False
