from fastapi import Depends, HTTPException, Request
from sqlalchemy import Select
from auth.tokens import decode_token
from db.dbconfig import DB
from db.models import User

async def get_current_user(request: Request, db: DB):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(401, 'Invalid Token')
    user_email = payload.get("email")
    result = await db.execute(Select(User).where(User.email == user_email))
    current_user = result.scalars().first()
    if not current_user:
        raise HTTPException(401, 'User not found')
    return current_user


async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(400, 'Invalid User')
    return current_user

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "ADMIN":
        raise HTTPException(403, "Not allowed")
    return current_user

def require_roles(required_roles: list[str]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(403, 'Insufficient permissions')
        return current_user
    return role_checker