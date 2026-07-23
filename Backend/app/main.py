import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.routers import auth, search, profile
from app.database import pool
from app.workers.session_cleaner import cleanup_sessions
from app.schemas.database_schema import create_schema
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.workers.product_cleaner import cleanup_products
from app.workers.price_tracker import price_collector

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    create_schema()
    scheduler.add_job(cleanup_sessions, 'interval', minutes=30)
    scheduler.add_job(cleanup_products, 'interval', hours=3)
    scheduler.add_job(price_collector, 'interval', hours=5)
    scheduler.start()
    yield
    scheduler.shutdown()
    pool.close()

app = FastAPI(lifespan=lifespan)

# ── Static file serving (profile photo uploads) ─────────────────────────────
_AVATARS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "avatars")
os.makedirs(_AVATARS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "..", "uploads")), name="uploads")

# ── CORS ────────────────────────────────────────────────────────────────────
# Allow the Vite dev server (port 5173) and any other local origins
# Also allow the frontend URL from environment variables
from app.core.settings import settings

origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    settings.frontend_url
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router)
app.include_router(auth.auth)
app.include_router(profile.profile)
