from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.db import Base, engine
from app import models  # noqa: F401 - registers model metadata
from app.api.routes import auth, catalog, vendors, admin
from app.routes import ai
from app.api.routes import availability
from app.api.routes import bookings
from app.api.routes import reviews
from app.api.routes import vendor_profiles
from app.api.routes import service_requests

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Convenient for local MVP only. Use Alembic migrations for production.
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(catalog.router, prefix="/api/v1")
app.include_router(vendors.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(availability.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(vendor_profiles.router, prefix="/api/v1")
app.include_router(service_requests.router, prefix="/api/v1")

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "dailydrill-api"}
