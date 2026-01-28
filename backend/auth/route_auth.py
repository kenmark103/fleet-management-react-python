from sqlalchemy import select, Select
from starlette.requests import Request
from auth.deps import Credentials
from auth.email_utils import send_password_reset_email, send_verification_email
from auth.security import verify_password, hash_password
from auth.tokens import create_access_token, decode_token, generate_email_verification_token, \
    create_refresh_token, generate_reset_password_token
from core.rate_limiter import limiter
from db.dbconfig import DB
from fastapi import HTTPException, BackgroundTasks, APIRouter
from db.models import User
from schemas.auth import RegisterRequest, LoginRequest, ForgetPasswordRequest, PasswordResetConfirm
from schemas.tokens import TokenResponse
from schemas.users import UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/token", response_model=TokenResponse)
@limiter.limit("5 per minute")
async def login(request: Request, login_request: LoginRequest, db: DB):
    result = await db.execute(select(User).where(User.email == login_request.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if user.password is None:
        raise HTTPException(status_code=400, detail="This account uses Google Sign In. Please login with google")
    if not verify_password(login_request.password, user.password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    data = {'role':user.role,'email': user.email,}
    access_token = create_access_token(data)
    refresh_token = create_refresh_token(data)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token, token_type="bearer")

@router.post("/register", response_model=UserResponse)
async def register(request: RegisterRequest, db: DB, background_tasks: BackgroundTasks):
    #check if email exists
    result = await db.execute(select(User).where(User.email == request.email))
    user= result.scalar_one_or_none()
    if user:
        raise HTTPException(status_code=400, detail="Email is already registered")
    else:
        password= hash_password(request.password)
        email_verification_token = generate_email_verification_token()
        user = User(
            email=request.email,
            password=password,
            username=request.username,
            email_verification_token=email_verification_token,
            role=request.role,
        )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    #background_tasks.add_task(send_verification_email, request.email, email_verification_token)
    return user




@router.post("/logout")
def logout():
    pass

@router.post("/forgot_password")
async def forgot_password(request: ForgetPasswordRequest, db: DB, background_tasks: BackgroundTasks):
    result = await db.execute(Select(User).where(User.email == request.email))
    user= result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Email is invalid")
    else:
        user.reset_password_token = generate_reset_password_token(
            {
                "email": user.email
            }
        )
        await db.commit()
        await db.refresh(user)

        background_tasks.add_task( send_password_reset_email,
                                   user.email, user.reset_password_token)

        return {'msg':'Reset password sent, check your email inbox to reset your password'}


@router.post("/verify_email")
async def verify_email(token: str, db: DB):
    result = await db.execute(select(User).where(User.email_verification_token==token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(400, "Invalid or expired token")

    user.is_verified = True
    user.email_verification_token = None

    await db.commit()

    return {"message": "Email verified successfully"}

@router.post("/reset_password")
async def reset_password(password_reset: PasswordResetConfirm, db:DB):
    payload = decode_token(password_reset.token)
    result = await db.execute(select(User).where(User.email == payload["email"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(400, "Invalid or expired token")

    hashed_pwd = hash_password(password_reset.password)
    user.password = hashed_pwd
    user.reset_password_token = None

    await db.commit()
    return {"message": "Password reset successful, u can now log in"}


@router.post("/refresh")
async def refresh(credentials: Credentials):
    token = credentials.credentials
    payload = decode_token(token)
    new_token = create_access_token({"email": payload["email"], 'role': payload["role"]})
    return {"access_token": new_token}
