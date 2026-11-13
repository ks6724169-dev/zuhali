import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from typing import Optional
from app.core.config import settings

_DB_POOL: Optional[pool.ThreadedConnectionPool] = None

def get_connection_pool() -> Optional[pool.ThreadedConnectionPool]:
    """Lazy initialize and return thread-safe PostgreSQL connection pool."""
    global _DB_POOL
    if _DB_POOL is None and settings.SUPABASE_DB_PASSWORD:
        try:
            _DB_POOL = pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=10,
                host="db.uvibkxulhhknhptzvbwo.supabase.co",
                port=5432,
                user="postgres",
                password=settings.SUPABASE_DB_PASSWORD,
                dbname="postgres",
                sslmode="require",
                connect_timeout=6,
                options="-c statement_timeout=5000"  # 5-second statement timeout
            )
        except Exception as e:
            print("[Supabase DB Connection Pool Warning]:", str(e))
    return _DB_POOL

@contextmanager
def get_db_cursor(commit: bool = True):
    """
    Context manager yielding a thread-safe connection and cursor from the connection pool.
    Automatically returns the connection to the pool on completion.
    """
    p = get_connection_pool()
    conn = None
    if p:
        try:
            conn = p.getconn()
            conn.autocommit = False
        except Exception as e:
            print("[Supabase Pool getconn Error]:", str(e))
            conn = None

    if not conn:
        try:
            conn = psycopg2.connect(
                host="db.uvibkxulhhknhptzvbwo.supabase.co",
                port=5432,
                user="postgres",
                password=settings.SUPABASE_DB_PASSWORD,
                dbname="postgres",
                sslmode="require",
                connect_timeout=6,
                options="-c statement_timeout=5000"
            )
            conn.autocommit = True
        except Exception as e:
            print("[Supabase Direct Connect Warning]:", str(e))
            yield None
            return

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        yield cur
        if commit and not conn.autocommit:
            conn.commit()
        cur.close()
    except Exception as e:
        if conn and not conn.autocommit:
            try: conn.rollback()
            except Exception: pass
        raise e
    finally:
        if conn:
            if p and hasattr(p, 'putconn'):
                try: p.putconn(conn)
                except Exception: pass
            else:
                try: conn.close()
                except Exception: pass

def get_db_connection():
    """Legacy helper for backward compatibility."""
    p = get_connection_pool()
    if p:
        try:
            c = p.getconn()
            c.autocommit = True
            return c
        except Exception:
            pass
    try:
        conn = psycopg2.connect(
            host="db.uvibkxulhhknhptzvbwo.supabase.co",
            port=5432,
            user="postgres",
            password=settings.SUPABASE_DB_PASSWORD,
            dbname="postgres",
            sslmode="require",
            connect_timeout=6
        )
        conn.autocommit = True
        return conn
    except Exception as e:
        print("[Supabase DB Connection Warning]:", str(e))
        return None

def normalize_email(raw_email: str) -> tuple[str, str]:
    """
    Normalize email address and generate a canonical email to block tricks:
    - Gmail dots trick: 'm.a.n.i.s.h@gmail.com' -> 'manish@gmail.com'
    - Gmail alias trick: 'manish+hack@gmail.com' -> 'manish@gmail.com'
    - Googlemail domain: 'manish@googlemail.com' -> 'manish@gmail.com'
    - Case sensitivity: 'MANISH@Gmail.COM' -> 'manish@gmail.com'
    - Whitespaces: '  manish@gmail.com  ' -> 'manish@gmail.com'
    Returns (cleaned_display_email, canonical_email).
    """
    cleaned = raw_email.strip().lower()
    if "@" not in cleaned:
        return cleaned, cleaned
    
    local_part, domain = cleaned.split("@", 1)
    
    if domain in ("gmail.com", "googlemail.com"):
        domain = "gmail.com"
        local_part = local_part.split("+")[0]
        local_part = local_part.replace(".", "")
    else:
        local_part = local_part.split("+")[0]
    
    canonical = f"{local_part}@{domain}"
    return cleaned, canonical

def get_user_by_canonical(canonical_email: str):
    """Fetch user profile from Supabase using canonical email."""
    try:
        with get_db_cursor(commit=False) as cur:
            if not cur:
                return None
            cur.execute("""
                SELECT id, email, canonical_email, full_name, password_hash, is_verified, created_at 
                FROM public.profiles 
                WHERE canonical_email = %s 
                LIMIT 1;
            """, (canonical_email,))
            user = cur.fetchone()
            return dict(user) if user else None
    except Exception as e:
        print(f"[Supabase get_user_by_canonical Error]: {e}")
        return None

def save_pending_user(user_id: str, email: str, canonical_email: str, full_name: str, password_hash: str):
    """
    Insert or update a pending (unverified) user profile in Supabase.
    If the user is already verified, do NOT overwrite!
    """
    try:
        with get_db_cursor(commit=True) as cur:
            if not cur:
                return False
            cur.execute("""
                INSERT INTO public.profiles (id, email, canonical_email, full_name, password_hash, is_verified, updated_at)
                VALUES (%s, %s, %s, %s, %s, FALSE, now())
                ON CONFLICT (email) 
                DO UPDATE SET 
                    canonical_email = EXCLUDED.canonical_email,
                    full_name = EXCLUDED.full_name,
                    password_hash = EXCLUDED.password_hash,
                    updated_at = now()
                WHERE public.profiles.is_verified = FALSE;
            """, (user_id, email, canonical_email, full_name, password_hash))
            return True
    except Exception as e:
        print(f"[Supabase save_pending_user Error]: {e}")
        return False

def mark_user_verified(canonical_email: str):
    """Mark an account as verified in Supabase permanently."""
    try:
        with get_db_cursor(commit=True) as cur:
            if not cur:
                return False
            cur.execute("""
                UPDATE public.profiles 
                SET is_verified = TRUE, updated_at = now() 
                WHERE canonical_email = %s;
            """, (canonical_email,))
            print(f"[Supabase] User {canonical_email} is now VERIFIED!")
            return True
    except Exception as e:
        print(f"[Supabase mark_user_verified Error]: {e}")
        return False

def update_user_password(canonical_email: str, new_password_hash: str):
    """Update password hash for a verified user in Supabase."""
    try:
        with get_db_cursor(commit=True) as cur:
            if not cur:
                return False
            cur.execute("""
                UPDATE public.profiles 
                SET password_hash = %s, updated_at = now() 
                WHERE canonical_email = %s;
            """, (new_password_hash, canonical_email))
            return True
    except Exception as e:
        print(f"[Supabase update_user_password Error]: {e}")
        return False

def upsert_user_profile(user_id: str, email: str, full_name: str = ""):
    """Save or update user in Supabase public.profiles."""
    cleaned, canonical = normalize_email(email)
    try:
        with get_db_cursor(commit=True) as cur:
            if not cur:
                return False
            cur.execute("""
                INSERT INTO public.profiles (id, email, canonical_email, full_name, is_verified, updated_at)
                VALUES (%s, %s, %s, %s, TRUE, now())
                ON CONFLICT (email) 
                DO UPDATE SET 
                    canonical_email = EXCLUDED.canonical_email,
                    full_name = EXCLUDED.full_name,
                    is_verified = TRUE,
                    updated_at = now();
            """, (user_id, cleaned, canonical, full_name))
            return True
    except Exception as e:
        print(f"[Supabase Profile Sync Error]: {e}")
        return False
