from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.chat import router as chat_router
from app.api.v1.auth import router as auth_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Zuhali AI Production-Grade Backend Engine"
)

# Robust CORS Middleware supporting local dev & production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:[0-9]+)?|https://([a-z0-9-]+\.)+run\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    return response

# Global Exception Handler (Crash-Proof & No Stack Trace Leaks)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[FastAPI Global Exception]: {type(exc).__name__}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Routers
app.include_router(chat_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Zuhali AI Backend",
        "version": settings.VERSION
    }

@app.get("/")
async def root():
    return {
        "message": "Welcome to Zuhali AI API Gateway. Use /docs for interactive Swagger API testing."
    }
