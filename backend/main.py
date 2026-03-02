from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.dbconfig import create_db_tables
from auth.route_auth import router as auth_router
from auth.route_oauth import router as oauth_router
from routes.health import router as health_router
from routes.fleet import router as fleet_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_tables()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
	"http://localhost:5173",   # Vite dev server
        "http://localhost:4173",
	"http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(health_router)
app.include_router(fleet_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("main:app", reload=True, host="0.0.0.0", port=8000)
