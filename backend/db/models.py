from datetime import datetime
from typing import Optional
from pydantic import EmailStr
from sqlalchemy import String, Integer, DateTime, Boolean, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base

class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[EmailStr] = mapped_column(String(120), unique=True, index=True)
    password: Mapped[Optional[str]] = mapped_column(String(200))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_token: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String(50), default='user')
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime]= mapped_column(DateTime, server_default=func.now())
    email_verification_token: Mapped[str | None] = mapped_column(String, nullable=True)
    reset_password_token: Mapped[str | None] = mapped_column(String, nullable=True)
    user_oauth = relationship("UserOAuth", back_populates="user", cascade="all, delete-orphan")


class UserOAuth(Base):
    __tablename__ = 'user_oauth'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    provider: Mapped[str] = mapped_column(String(50), default='google')
    provider_user_id: Mapped[str] = mapped_column(String, index=True)
    provider_email: Mapped[EmailStr] = mapped_column(String(120))
    access_token: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    user: Mapped[User] = relationship("User", back_populates="user_oauth")

    __table_args__ = (UniqueConstraint("provider", "provider_user_id", name="uq_provider_user"),)




class RefreshTokens(Base):
    __tablename__ = 'refresh_tokens'
    id: Mapped[int]= mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

