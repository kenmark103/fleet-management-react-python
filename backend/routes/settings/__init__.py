"""
routers/settings/__init__.py
Fleet Management System — Phase 8

Exports a combined `settings_router` so main.py stays clean:

    from routers.settings import settings_router
    app.include_router(settings_router, prefix="/api/v1")
"""

from fastapi import APIRouter

from routes.settings.users import router as users_router
from routes.settings.profile import router as profile_router
from routes.settings.system import router as system_route

settings_router = APIRouter()
settings_router.include_router(users_router)
settings_router.include_router(profile_router)
settings_router.include_router(system_route)

__all__ = ["settings_router"]