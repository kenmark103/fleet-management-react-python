from contextlib import asynccontextmanager
import os
import uvicorn
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio
from fastapi.staticfiles import StaticFiles

from core.config import get_settings
from db.dbconfig import create_db_tables
from auth.route_auth import router as auth_router
from auth.route_oauth import router as oauth_router
from routes.health import router as health_router
from routes.fleet import router as fleet_router
from routes.drivers import router as drivers_router
from routes.fuel import router as fuel_router
from routes.maintenance import router as maintenance_router
from routes.settings import settings_router
from routes.trips import router as trips_router
from routes.notifications import router as notifications_router
from routes.vehicles import router as vehicle_router
from services.expiry_checker import daily_expiry_check_loop
from scripts.seed_admin import seed

log = logging.getLogger(__name__)
settings = get_settings()

async def run_migrations():
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")

@asynccontextmanager
async def lifespan(app: FastAPI):
    #if settings.ENVIRONMENT in ("development", "docker"):
    await create_db_tables()
    await seed()

    task = asyncio.create_task(daily_expiry_check_loop())
    log.info("Daily expiry check task launched.")

    yield

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        log.info("Daily expiry check task stopped.")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3000",
        "https://fleet-management-react-python.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static upload directories exist on every environment (local, Docker, Render).
for _dir in ("static", "static/avatars", "static/trucks", "static/trailers"):
    os.makedirs(_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")

#routing
app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(health_router)
app.include_router(fleet_router, prefix="/api/v1")
app.include_router(drivers_router, prefix="/api/v1")
app.include_router(fuel_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(trips_router, prefix="/api/v1")
app.include_router(maintenance_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(vehicle_router, prefix="/api/v1")
if __name__ == "__main__":
    uvicorn.run("main:app", reload=True, host="0.0.0.0", port=8000)