"""
services/email.py
Fleet Management System

Async email service using fastapi-mail + Gmail SMTP (App Password).

Setup:
  1. pip install fastapi-mail  (add to requirements.txt)
  2. Enable 2FA on your Gmail account
  3. Google Account → Security → App Passwords → generate one
  4. Set in .env:
       MAIL_USERNAME=you@gmail.com
       MAIL_PASSWORD=xxxx xxxx xxxx xxxx   ← 16-char App Password (no spaces needed)
       MAIL_FROM=you@gmail.com
       MAIL_FROM_NAME=FleetMS
       MAIL_PORT=587
       MAIL_SERVER=smtp.gmail.com

Design decisions:
  - Email is OPTIONAL. If MAIL_USERNAME is not set, all send functions
    are silent no-ops. The app works fully without email configured.
  - Templates live in templates/email/*.html and use Jinja2 placeholders.
  - Each public function is typed and self-documenting — callers don't
    need to know anything about fastapi-mail internals.
  - All functions are async and safe to fire-and-forget with asyncio.create_task()
    so they never block a request handler.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from core.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

# ── Config ─────────────────────────────────────────────────────────────────────

_MAIL_USERNAME  = settings.MAIL_USERNAME
_MAIL_PASSWORD  = settings.MAIL_PASSWORD
_MAIL_FROM      = settings.MAIL_FROM
_MAIL_FROM_NAME = settings.MAIL_FROM_NAME
_MAIL_PORT      = settings.MAIL_PORT
_MAIL_SERVER    = settings.MAIL_SERVER

_EMAIL_ENABLED = bool(_MAIL_USERNAME and _MAIL_PASSWORD)

# Template directory — relative to project root
_TEMPLATE_DIR = Path("templates/email")

# Lazy-initialised fastapi-mail connection (avoids import error if not installed)
_fm = None

def _get_fm():
    """Lazy-init FastMail so missing credentials or package don't crash startup."""
    global _fm
    if _fm is not None:
        return _fm
    try:
        from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
        conf = ConnectionConfig(
            MAIL_USERNAME   = _MAIL_USERNAME,
            MAIL_PASSWORD   = _MAIL_PASSWORD,
            MAIL_FROM       = _MAIL_FROM,
            MAIL_FROM_NAME  = _MAIL_FROM_NAME,
            MAIL_PORT       = _MAIL_PORT,
            MAIL_SERVER     = _MAIL_SERVER,
            MAIL_STARTTLS   = True,
            MAIL_SSL_TLS    = False,
            USE_CREDENTIALS = True,
            VALIDATE_CERTS  = True,
            TEMPLATE_FOLDER = _TEMPLATE_DIR,
        )
        _fm = FastMail(conf)
        return _fm
    except Exception as exc:
        log.warning("Email service unavailable: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL SEND HELPER
# ─────────────────────────────────────────────────────────────────────────────

async def _send(
    to:       str | list[str],
    subject:  str,
    template: str,
    context:  dict[str, Any],
) -> None:
    """
    Internal helper. Never raises — email failure is always logged and swallowed
    so it never breaks the calling request handler.
    """
    if not _EMAIL_ENABLED:
        log.debug("Email not configured — skipping '%s' to %s", subject, to)
        return

    fm = _get_fm()
    if fm is None:
        return

    try:
        from fastapi_mail import MessageSchema, MessageType
        recipients = [to] if isinstance(to, str) else to
        msg = MessageSchema(
            subject    = subject,
            recipients = recipients,
            template_body = context,
            subtype    = MessageType.html,
        )
        await fm.send_message(msg, template_name=template)
        log.info("Email '%s' sent to %s", subject, recipients)
    except Exception as exc:
        log.error("Failed to send email '%s' to %s: %s", subject, to, exc)


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

async def send_welcome(
    to:        str,
    full_name: str,
    role:      str,
    login_url: str,
) -> None:
    """
    Sent when an admin creates a new user account.
    Tells them their account is ready and how to log in.
    """
    await _send(
        to       = to,
        subject  = f"Welcome to FleetMS, {full_name.split()[0]}!",
        template = "welcome.html",
        context  = {
            "full_name": full_name,
            "role":      role.title(),
            "login_url": login_url,
        },
    )


async def send_password_reset(
    to:         str,
    full_name:  str,
    reset_link: str,
) -> None:
    """Sent when a user requests a password reset."""
    await _send(
        to       = to,
        subject  = "Reset your FleetMS password",
        template = "reset_password.html",
        context  = {
            "full_name":  full_name,
            "reset_link": reset_link,
        },
    )


async def send_work_order_assigned(
    to:               str,
    mechanic_name:    str,
    wo_number:        str,
    wo_title:         str,
    truck_plate:      str,
    priority:         str,
    scheduled_date:   str,
    wo_url:           str,
) -> None:
    """Sent to a mechanic when a work order is assigned to them."""
    await _send(
        to       = to,
        subject  = f"Work order assigned: {wo_number}",
        template = "work_order_assigned.html",
        context  = {
            "mechanic_name":  mechanic_name,
            "wo_number":      wo_number,
            "wo_title":       wo_title,
            "truck_plate":    truck_plate,
            "priority":       priority.upper(),
            "scheduled_date": scheduled_date,
            "wo_url":         wo_url,
        },
    )


async def send_document_expiry(
    to:           str | list[str],
    entity_label: str,
    expiry_date:  str,
    days_left:    int,
    action_url:   str,
) -> None:
    """
    Sent to admins/dispatchers when a vehicle or driver document is expiring.
    `days_left` can be negative (already expired).
    """
    expired = days_left <= 0
    subject = (
        f"EXPIRED: {entity_label}"
        if expired
        else f"Expiring in {days_left} days: {entity_label}"
    )
    await _send(
        to       = to,
        subject  = subject,
        template = "document_expiry.html",
        context  = {
            "entity_label": entity_label,
            "expiry_date":  expiry_date,
            "days_left":    days_left,
            "expired":      expired,
            "action_url":   action_url,
        },
    )


async def send_invite(
    to:          str,
    full_name:   str,
    role:        str,
    invite_link: str,
) -> None:
    """
    Sent when an admin creates a new user account.
    User clicks the link to set their password and activate their account.
    """
    await _send(
        to       = to,
        subject  = f"You've been invited to FleetMS",
        template = "invite.html",
        context  = {
            "full_name":   full_name,
            "role":        role.title(),
            "invite_link": invite_link,
        },
    )