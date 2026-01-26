from typing import Tuple
from sqlalchemy import Select, select
from starlette.responses import RedirectResponse
from auth.email_utils import send_welcome_email
from auth.tokens import extract_redirect_url_from_state
from db.dbconfig import DB
from db.models import User, UserOAuth
from fastapi import BackgroundTasks


async def find_or_create_user_from_google(db: DB, google_data: dict, google_token)->Tuple[User, bool]:
    google_id = google_data.get('sub')
    email = google_data.get('email')

    #check if user is linked
    oauth_account = await db.execute(select(UserOAuth).where(UserOAuth.provider_user_id == google_id, UserOAuth.provider=="google"))
    existing_oauth = oauth_account.scalar_one_or_none()
    if existing_oauth:
        existing_oauth.access_token = google_token.get('access_token')
        existing_oauth.refresh_token = google_token.get('refresh_token')
        existing_oauth.token_expiry = google_token.get('expires_at')

        await db.commit()
        return existing_oauth.user, False

    result = await db.execute(select(User).where(User.email == email))
    existing_user = result.scalar_one_or_none()

    is_new_user = False
    if existing_user:
        user = existing_user

    else:

        username = email.split('@')[0]
        base_username = username
        counter = 1
        while True:
            result = await db.execute(
                select(User).where(User.username == base_username)
            )
            if not result.scalar_one_or_none():
                break
            base_username = f"{username}#{counter}"
            counter += 1

        user = User(
            email=email,
            username=base_username,
            is_verified=True,
            password=None

        )
        db.add(user)
        await db.flush()
        is_new_user = True

    oauth_account = UserOAuth(
        user_id=user.id,
        provider='google',
        provider_user_id=google_id,
        provider_email=email,
        access_token=google_token.get('access_token'),
        refresh_token=google_token.get('refresh_token'),
        expires_at=google_token.get('expires_at')
        )

    db.add(oauth_account)
    await db.commit()

    background_task = BackgroundTasks()

    background_task.add_task(send_welcome_email, email, google_data.get('name'))

    return user, is_new_user


async def handle_frontend_redirect(access_token, refresh_token, state):

    response = RedirectResponse(extract_redirect_url_from_state(state))
    response.set_cookie('access_token', access_token, secure=True, httponly=True, max_age=1800)
    response.set_cookie('refresh_token', refresh_token, secure=True, httponly=True, max_age=86400)
    return response

async def link_google_account(user: User, db: DB, google_data: dict, google_tokens: dict)->UserOAuth:
    google_id = google_data.get('sub')
    result = await db.execute(Select(UserOAuth).where(UserOAuth.user_id == user.id))
    existing_user = result.scalar_one_or_none()
    if existing_user:

        existing_user.access_token = google_tokens.get('access_token')
        existing_user.refresh_token = google_tokens.get('refresh_token')
        existing_user.expires_at = google_tokens.get('expires_at')

        await db.commit()
        return existing_user

    oauth = UserOAuth(
        user_id=user.id,
        provider='google',
        provider_user_id=google_id,
        provider_email=user.email,
        access_token=google_tokens.get('access_token'),
        refresh_token=google_tokens.get('refresh_token'),
        expires_at=google_tokens.get('expires_at')
    )

    db.add(oauth)
    await db.commit()

    return oauth


