from typing import Optional
from pydantic import BaseModel, Field, EmailStr


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=50)
    role: Optional[str] = 'user'

class LoginRequest(BaseModel):
    username: str | None
    email: EmailStr
    password: str

class ForgetPasswordRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    newpassword: str