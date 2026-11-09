import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'app')))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
sys.stdout.reconfigure(encoding='utf-8')

from psycopg2.extras import RealDictCursor
from app.db.supabase import get_db_connection

conn = get_db_connection()
with conn.cursor() as cur:
    # 1. Drop foreign key constraint on message_id if exists
    cur.execute("""
        DO $$
        DECLARE r record;
        BEGIN
            FOR r IN (
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'message_feedback' AND constraint_type = 'FOREIGN KEY'
            ) LOOP
                EXECUTE 'ALTER TABLE public.message_feedback DROP CONSTRAINT ' || quote_ident(r.constraint_name) || ';';
            END LOOP;
        END $$;
    """)
    
    # 2. Change message_id to TEXT and make user_id nullable
    cur.execute("""
        ALTER TABLE public.message_feedback ALTER COLUMN message_id TYPE TEXT;
        ALTER TABLE public.message_feedback ALTER COLUMN user_id DROP NOT NULL;
    """)
    
    # 3. Add user_email, prompt, and message_text columns if not present
    cur.execute("""
        ALTER TABLE public.message_feedback ADD COLUMN IF NOT EXISTS user_email TEXT;
        ALTER TABLE public.message_feedback ADD COLUMN IF NOT EXISTS prompt TEXT;
        ALTER TABLE public.message_feedback ADD COLUMN IF NOT EXISTS message_text TEXT;
    """)
    
    print("message_feedback table updated successfully in Supabase PostgreSQL!")

with conn.cursor(cursor_factory=RealDictCursor) as cur:
    cur.execute("""
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'message_feedback';
    """)
    print("Updated columns:", cur.fetchall())

conn.close()
