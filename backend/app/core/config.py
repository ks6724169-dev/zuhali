import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend directory or root
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = "Zuhali AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "zuhali_super_secure_jwt_secret_change_in_production_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://zuhali.onrender.com",
        "https://zuhali.vercel.app",
        "*"
    ]
    
    # --- Supabase Database, Auth & Storage ---
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://uvibkxulhhknhptzvbwo.supabase.co")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_PUBLISHABLE_KEY: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    SUPABASE_SECRET_KEY: str = os.getenv("SUPABASE_SECRET_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_DB_PASSWORD: str = os.getenv("SUPABASE_DB_PASSWORD", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    SUPABASE_JWKS_URL: str = os.getenv("SUPABASE_JWKS_URL", "")

    # --- Multi-AI Inference Providers ---
    # 1. Google Gemini AI API
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # 2. Cloudflare Workers AI & Edge
    CLOUDFLARE_ACCOUNT_ID: str = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
    CLOUDFLARE_API_TOKEN: str = os.getenv("CLOUDFLARE_API_TOKEN", "")

    # 3. Sarvam AI (105B LLM & Bulbul TTS)
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")

    # 4. BharatRouter API (120B LLM Cascade & Router)
    BHARATROUTER_API_KEY: str = os.getenv("BHARATROUTER_API_KEY", "")

    # 5. OpenRouter AI Cascade
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BACKUP_KEY: str = os.getenv("OPENROUTER_BACKUP_KEY", "")

    # 6. Groq LPU & Grok AI Acceleration
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROK_API_KEY: str = os.getenv("GROK_API_KEY", "")

    # --- Deployment Tokens ---
    VERCEL_TOKEN: str = os.getenv("VERCEL_TOKEN", "")
    RENDER_API_KEY: str = os.getenv("RENDER_API_KEY", "")

    # --- Fast2SMS & Gmail SMTP OTP Gateway ---
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    FAST2SMS_API_KEY: str = os.getenv("FAST2SMS_API_KEY", "")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "465"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Rhynia Intelligence")

settings = Settings()
