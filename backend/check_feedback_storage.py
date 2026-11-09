import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'app')))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
sys.stdout.reconfigure(encoding='utf-8')

from psycopg2.extras import RealDictCursor
from app.db.supabase import get_db_connection

conn = get_db_connection()
with conn.cursor(cursor_factory=RealDictCursor) as cur:
    cur.execute("SELECT COUNT(*) FROM public.conversations;")
    print("conversations count:", cur.fetchone()['count'])
    cur.execute("SELECT COUNT(*) FROM public.messages;")
    print("messages count:", cur.fetchone()['count'])

conn.close()
