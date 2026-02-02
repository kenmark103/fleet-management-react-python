from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.dbconfig import create_db_tables
from auth.route_auth import router as auth_router
from auth.route_oauth import router as oauth_router
from routes.route_users import router as user_router
from routes.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_tables()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(user_router)
app.include_router(health_router)

if __name__ == "__main__":
    uvicorn.run("main:app", reload=True, host="0.0.0.0", port=8000)
