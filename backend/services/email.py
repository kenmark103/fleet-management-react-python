"""
services/email.py
Fleet Management System

Changes from previous version:
  - Added Mailtrap support for development/testing.
    Set MAIL_PROVIDER=mailtrap in your .env to route all emails to your
    Mailtrap inbox instead of sending real email via Gmail.
    All other code is identical — the switch is purely configuration.

──────────────────────────────────────────────────────────────────────────────
MAILTRAP SETUP (one-time, ~2 minutes)
──────────────────────────────────────────────────────────────────────────────

1. Go to https://mailtrap.io and create a free account (no phone, no card).

2. In your Mailtrap dashboard:
   My Inboxes → Click your inbox → SMTP/POP3 tab → choose "SMTP"
   You'll see credentials like:
     Host:     sandbox.smtp.mailtrap.io
     Port:     587  (or 465, or 25 — all work; use 587)
     Username: <your-mailtrap-username>
     Password: <your-mailtrap-password>

3. Add to your .env:

   # Switch between "gmail" and "mailtrap"
   MAIL_PROVIDER=mailtrap

   # Mailtrap credentials (from step 2)
   MAILTRAP_USERNAME=<username>
   MAILTRAP_PASSWORD=<password>

   # Gmail credentials (for production — leave configured even in dev)
   MAIL_USERNAME=you@gmail.com
   MAIL_PASSWORD=xxxx xxxx xxxx xxxx
   MAIL_FROM=you@gmail.com
   MAIL_FROM_NAME=FleetMS
   MAIL_PORT=587
   MAIL_SERVER=smtp.gmail.com

4. That's it. Every email your app sends (invites, resets, alerts) will now
   land in your Mailtrap inbox and NEVER reach real users.
   To go live, set MAIL_PROVIDER=gmail (or delete the variable).

──────────────────────────────────────────────────────────────────────────────
FASTAPI-MAIL INSTALL  (if not already installed)
──────────────────────────────────────────────────────────────────────────────

  pip install fastapi-mail
  # or add to requirements.txt:
  fastapi-mail>=1.4.0

──────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from core.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

# ── Resolve which provider to use ─────────────────────────────────────────────

_PROVIDER = getattr(settings, "MAIL_PROVIDER", "gmail").lower()  # "gmail" | "mailtrap"

if _PROVIDER == "mailtrap":
    _MAIL_USERNAME  = getattr(settings, "MAILTRAP_USERNAME", "")
    _MAIL_PASSWORD  = getattr(settings, "MAILTRAP_PASSWORD", "")
    _MAIL_FROM      = getattr(settings, "MAIL_FROM",      "noreply@fleetms.dev")
    _MAIL_FROM_NAME = getattr(settings, "MAIL_FROM_NAME", "FleetMS")
    _MAIL_PORT      = 587
    _MAIL_SERVER    = "sandbox.smtp.mailtrap.io"
else:
    # Gmail (production default)
    _MAIL_USERNAME  = getattr(settings, "MAIL_USERNAME",  "")
    _MAIL_PASSWORD  = getattr(settings, "MAIL_PASSWORD",  "")
    _MAIL_FROM      = getattr(settings, "MAIL_FROM",      "")
    _MAIL_FROM_NAME = getattr(settings, "MAIL_FROM_NAME", "FleetMS")
    _MAIL_PORT      = getattr(settings, "MAIL_PORT",      587)
    _MAIL_SERVER    = getattr(settings, "MAIL_SERVER",    "smtp.gmail.com")

_EMAIL_ENABLED = bool(_MAIL_USERNAME and _MAIL_PASSWORD)

# Template directory — relative to project root
_TEMPLATE_DIR = Path("templates/email")

# Lazy-initialised FastMail instance
_fm = None


def _get_fm():
    """Lazy-init FastMail. Returns None if credentials missing or package absent."""
    global _fm
    if _fm is not None:
        return _fm
    try:
        from fastapi_mail import FastMail, ConnectionConfig
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
        log.info("Email service ready — provider: %s, server: %s", _PROVIDER, _MAIL_SERVER)
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
    Never raises — email failures are logged and silently swallowed
    so they never break a request handler.
    """
    if not _EMAIL_ENABLED:
        log.debug(
            "Email not configured (provider=%s) — skipping '%s' to %s",
            _PROVIDER, subject, to,
        )
        return

    fm = _get_fm()
    if fm is None:
        return

    try:
        from fastapi_mail import MessageSchema, MessageType
        recipients = [to] if isinstance(to, str) else to
        msg = MessageSchema(
            subject       = subject,
            recipients    = recipients,
            template_body = context,
            subtype       = MessageType.html,
        )
        await fm.send_message(msg, template_name=template)
        log.info("Email '%s' sent to %s via %s", subject, recipients, _PROVIDER)
    except Exception as exc:
        log.error("Failed to send email '%s' to %s: %s", subject, to, exc)


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API  (unchanged — callers don't need to know about the provider)
# ─────────────────────────────────────────────────────────────────────────────

async def send_invite(
    to:          str,
    full_name:   str,
    role:        str,
    invite_link: str,
) -> None:
    """Invite email — sent by POST /settings/users when admin creates a new account."""
    await _send(
        to       = to,
        subject  = "You've been invited to FleetMS",
        template = "invite.html",
        context  = {
            "full_name":   full_name,
            "role":        role.title(),
            "invite_link": invite_link,
        },
    )


async def send_password_reset(
    to:         str,
    full_name:  str,
    reset_link: str,
) -> None:
    """Password reset email."""
    await _send(
        to       = to,
        subject  = "Reset your FleetMS password",
        template = "reset_password.html",
        context  = {
            "full_name":  full_name,
            "reset_link": reset_link,
        },
    )


async def send_welcome(
    to:        str,
    full_name: str,
    role:      str,
    login_url: str,
) -> None:
    """Welcome email — optional, can be sent after a driver completes setup."""
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


async def send_work_order_assigned(
    to:             str,
    mechanic_name:  str,
    wo_number:      str,
    wo_title:       str,
    truck_plate:    str,
    priority:       str,
    scheduled_date: str,
    wo_url:         str,
) -> None:
    """Work order assignment notification to mechanic."""
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
    """Document expiry alert to admins/dispatchers."""
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