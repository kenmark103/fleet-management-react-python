from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=50)
    role: Optional[str] = 'user'

class UserResponse(BaseModel):
    username: str
    email: str
    role: str



