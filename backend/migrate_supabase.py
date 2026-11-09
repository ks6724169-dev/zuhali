import psycopg2
from app.core.config import settings

def run_migration():
    print("Connecting to live Supabase PostgreSQL database...")
    
    conn = psycopg2.connect(
        host="db.uvibkxulhhknhptzvbwo.supabase.co",
        port=5432,
        user="postgres",
        password=settings.SUPABASE_DB_PASSWORD,
        dbname="postgres",
        connect_timeout=15
    )
    conn.autocommit = True
    cur = conn.cursor()

    sql_commands = [
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',

        '''
        CREATE TABLE IF NOT EXISTS public.profiles (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email TEXT UNIQUE NOT NULL,
            full_name TEXT,
            avatar_url TEXT,
            selected_theme TEXT DEFAULT 'Light',
            selected_accent TEXT DEFAULT 'Green',
            selected_language TEXT DEFAULT 'English',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
        ''',

        '''
        CREATE TABLE IF NOT EXISTS public.conversations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL,
            title TEXT NOT NULL DEFAULT 'New chat',
            is_pinned BOOLEAN DEFAULT FALSE,
            is_archived BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
        ''',

        '''
        CREATE TABLE IF NOT EXISTS public.messages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            parent_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
            model TEXT DEFAULT 'zuhali-pro-v1',
            token_count INT DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
        ''',

        '''
        CREATE TABLE IF NOT EXISTS public.message_feedback (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
            user_id UUID NOT NULL,
            feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like', 'dislike')),
            reason TEXT,
            comment TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
        ''',

        '''
        CREATE TABLE IF NOT EXISTS public.attachments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size BIGINT,
            mime_type TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
        ''',

        'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;',
        'ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;',
        'ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;',
        'ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;',
        'ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;'
    ]

    for cmd in sql_commands:
        cur.execute(cmd)

    print("[SUCCESS] All tables and RLS security applied successfully!")

    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    tables = [row[0] for row in cur.fetchall()]
    print("[SUPABASE DATABASE TABLES]:", tables)

    cur.close()
    conn.close()

if __name__ == "__main__":
    run_migration()
