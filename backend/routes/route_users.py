from typing import Annotated

from fastapi.params import Depends
from auth.deps import get_current_user
from db.models import User
from schemas.users import UserResponse
from fastapi import APIRouter


router = APIRouter(prefix="/users", tags=["users"])
@router.get("/me", response_model=UserResponse)
async def me(current_user: Annotated[User, Depends(get_current_user) ]):
    return current_user