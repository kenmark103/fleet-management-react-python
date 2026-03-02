from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import User, UserOAuth


async def find_or_create_user_from_google(
    db: AsyncSession,
    userinfo: dict,
    google_tokens: dict,
) -> tuple[User, bool]:
    """
    Returns (user, is_new_user).

    Lookup order:
      1. Existing UserOAuth record by provider_user_id (most reliable)
      2. Existing User by email (user registered normally, now linking Google)
      3. Create a new User + UserOAuth record
    """
    provider_user_id: str = userinfo["sub"]
    email: str           = userinfo["email"]
    is_new_user: bool    = False

    # ── 1. Look up by OAuth provider ID ──────────────────────────────────────
    result = await db.execute(
        select(UserOAuth).where(
            UserOAuth.provider == "google",
            UserOAuth.provider_user_id == provider_user_id,
        )
    )
    oauth_record = result.scalar_one_or_none()

    if oauth_record:
        # Refresh tokens on every login
        await _update_oauth_tokens(db, oauth_record, google_tokens)
        result = await db.execute(select(User).where(User.id == oauth_record.user_id))
        user = result.scalar_one()
        _check_active(user)
        return user, is_new_user

    # ── 2. Existing user with same email (link accounts) ─────────────────────
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        _check_active(user)
        # Link the Google account to this existing user
        oauth_record = UserOAuth(
            user_id=user.id,
            provider="google",
            provider_user_id=provider_user_id,
            provider_email=email,
            **_token_fields(google_tokens),
        )
        db.add(oauth_record)
        await db.commit()
        return user, is_new_user

    # ── 3. Brand new user ─────────────────────────────────────────────────────
    is_new_user = True
    first_name, last_name = _parse_name(userinfo.get("name", ""))

    user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        password=None,
        role="DRIVER",
        is_active=True,
        is_verified=True,
        avatar_url=userinfo.get("picture"),
    )
    db.add(user)
    await db.flush()            # populate user.id before creating OAuth record

    oauth_record = UserOAuth(
        user_id=user.id,
        provider="google",
        provider_user_id=provider_user_id,
        provider_email=email,
        **_token_fields(google_tokens),
    )
    db.add(oauth_record)
    await db.commit()
    await db.refresh(user)

    return user, is_new_user


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _parse_name(full_name: str) -> tuple[str, str]:
    """
    Splits Google's display name into first + last.
    'John Doe'      → ('John', 'Doe')
    'John'          → ('John', '')
    'John A. Doe'   → ('John', 'A. Doe')
    ''              → ('Unknown', '')
    """
    parts = full_name.strip().split(" ", 1)
    if not parts or not parts[0]:
        return "Unknown", ""
    return parts[0], parts[1] if len(parts) > 1 else ""


def _token_fields(google_tokens: dict) -> dict:
    """Extracts token fields to store on the UserOAuth record."""
    expires_in = google_tokens.get("expires_in")
    expires_at = None
    if expires_in:
        from datetime import timedelta
        expires_at = datetime.utcnow() + timedelta(seconds=int(expires_in))

    return {
        "access_token":  google_tokens.get("access_token"),
        "refresh_token": google_tokens.get("refresh_token"),
        "expires_at":    expires_at,
    }


async def _update_oauth_tokens(
    db: AsyncSession,
    oauth_record: UserOAuth,
    google_tokens: dict,
) -> None:
    """Refreshes stored OAuth tokens on every login."""
    fields = _token_fields(google_tokens)
    oauth_record.access_token  = fields["access_token"]
    oauth_record.refresh_token = fields["refresh_token"]
    oauth_record.expires_at    = fields["expires_at"]
    await db.commit()


def _check_active(user: User) -> None:
    from fastapi import HTTPException
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is deactivated. Contact your administrator.",
        )