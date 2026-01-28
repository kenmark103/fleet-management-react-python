
from fastapi import APIRouter
from sqlalchemy import text
from db.dbconfig import DB
from fastapi import status

status_code = status.HTTP_200_OK
router = APIRouter()

@router.get("/health")
async def health_check(db: DB):
    try:
        # Simple query to check database connectivity
        await db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "detail": "Database connection successful"
            }
    except Exception as e:
        return {"status": "unhealthy", "detail": str(e)}

