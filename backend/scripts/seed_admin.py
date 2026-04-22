import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import select

from auth.security import hash_password
from db.dbconfig import async_session
from db.models import DashboardTemplate, ReportWidgetConfig, User


async def seed():
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == "admin@fleetms.com"))
        admin = result.scalar_one_or_none()

        if not admin:
            admin = User(
                first_name="Admin",
                last_name="User",
                email="admin@fleetms.com",
                password=hash_password("Admin1234!"),
                role="ADMIN",
                is_active=True,
                is_verified=True,
            )
            db.add(admin)
            await db.flush()
            print(f"Admin created: {admin.email}  (id: {admin.id})")
        else:
            print("Admin already exists; keeping current record.")

        existing_templates = (await db.execute(select(DashboardTemplate))).scalars().all()
        if not existing_templates:
            db.add(
                DashboardTemplate(
                    name="Operations Overview",
                    description="Default operations dashboard with fleet health, anomalies, and driver insights.",
                    widgets_json={
                        "widgets": [
                            {"key": "fleet-health", "title": "Fleet Health", "type": "analytics"},
                            {"key": "maintenance-risk", "title": "Maintenance Risk", "type": "analytics"},
                            {"key": "recent-anomalies", "title": "Recent Anomalies", "type": "table"},
                            {"key": "driver-leaderboard", "title": "Driver Leaderboard", "type": "table"},
                        ]
                    },
                    layout_json={"columns": 2, "dense": False},
                    is_default=True,
                )
            )
            print("Dashboard template created.")

        existing_widgets = (await db.execute(select(ReportWidgetConfig))).scalars().all()
        if not existing_widgets:
            db.add_all([
                ReportWidgetConfig(
                    name="Fleet Health",
                    code="fleet-health",  # Changed from key → code
                    category="analytics",
                    config_json={"endpoint": "/api/v1/analytics/fleet-health", "chart": "stat", "description": "Average health score across the fleet."},
                ),
                ReportWidgetConfig(
                    name="Maintenance Risk",
                    code="maintenance-risk",
                    category="analytics",
                    config_json={"endpoint": "/api/v1/analytics/fleet-health", "chart": "list", "description": "High-risk maintenance predictions and overdue service."},
                ),
                ReportWidgetConfig(
                    name="Recent Anomalies",
                    code="recent-anomalies",
                    category="analytics",
                    config_json={"endpoint": "/api/v1/analytics/anomalies", "chart": "table", "description": "Latest anomalies from maintenance and fuel patterns."},
                ),
                ReportWidgetConfig(
                    name="Driver Leaderboard",
                    code="driver-leaderboard",
                    category="drivers",
                    config_json={"endpoint": "/api/v1/drivers/leaderboard", "chart": "table", "description": "Top driver scorecards for the current period."},
                ),
                ReportWidgetConfig(
                    name="Route Plans",
                    code="route-plans",
                    category="routing",
                    config_json={"endpoint": "/api/v1/trips/{tripId}/route-plan", "chart": "map", "description": "Optimized trip routing and ETA summaries."},
                ),
                ReportWidgetConfig(
                    name="OCR Queue",
                    code="ocr-queue",
                    category="documents",
                    config_json={"endpoint": "/api/v1/documents/{entityId}/ocr", "chart": "table", "description": "OCR processing state for uploaded documents."},
                ),
            ])
            print("Report widget configs created.")

        await db.commit()
        print("Seed completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed())