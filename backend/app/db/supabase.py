import psycopg2
from psycopg2.extras import RealDictCursor
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
    conn = get_db_connection()
    if not conn:
        return None
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, email, canonical_email, full_name, password_hash, is_verified, created_at 
            FROM public.profiles 
            WHERE canonical_email = %s 
            LIMIT 1;
        """, (canonical_email,))
        user = cur.fetchone()
        cur.close()
        conn.close()
        return dict(user) if user else None
    except Exception as e:
        print(f"[Supabase get_user_by_canonical Error]: {e}")
        try: conn.close()
        except: pass
        return None

def save_pending_user(user_id: str, email: str, canonical_email: str, full_name: str, password_hash: str):
    """
    Insert or update a pending (unverified) user profile in Supabase.
    If the user is already verified, do NOT overwrite!
    """
    conn = get_db_connection()
    if not conn:
        return False
    try:
        cur = conn.cursor()
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
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[Supabase save_pending_user Error]: {e}")
        try: conn.close()
        except: pass
        return False

def mark_user_verified(canonical_email: str):
    """Mark an account as verified in Supabase permanently."""
    conn = get_db_connection()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE public.profiles 
            SET is_verified = TRUE, updated_at = now() 
            WHERE canonical_email = %s;
        """, (canonical_email,))
        cur.close()
        conn.close()
        print(f"[Supabase] User {canonical_email} is now VERIFIED!")
        return True
    except Exception as e:
        print(f"[Supabase mark_user_verified Error]: {e}")
        try: conn.close()
        except: pass
        return False

def update_user_password(canonical_email: str, new_password_hash: str):
    """Update password hash for a verified user in Supabase."""
    conn = get_db_connection()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE public.profiles 
            SET password_hash = %s, updated_at = now() 
            WHERE canonical_email = %s;
        """, (new_password_hash, canonical_email))
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[Supabase update_user_password Error]: {e}")
        try: conn.close()
        except: pass
        return False

def upsert_user_profile(user_id: str, email: str, full_name: str = ""):
    """Save or update user in Supabase public.profiles."""
    cleaned, canonical = normalize_email(email)
    conn = get_db_connection()
    if not conn:
        return False
    try:
        cur = conn.cursor()
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
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[Supabase Profile Sync Error]: {e}")
        try: conn.close()
        except: pass
        return False
