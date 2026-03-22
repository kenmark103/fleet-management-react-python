"""
tests/integration/test_notifications.py
Fleet Management System

Covers: /api/v1/notifications

Endpoints (from notifications router):
  GET    /notifications                     paginated list for current user
  GET    /notifications/unread-count        badge count
  PATCH  /notifications/{id}/read           mark single read/unread
  PATCH  /notifications/read-all            mark all as read
  DELETE /notifications/{id}               delete single

AUTH: All endpoints require authentication (get_current_user dependency).
No role restrictions — every user sees only their own notifications.

Response shape:
  List     → PaginatedResponse[NotificationResponse]
               { "data": [...], "meta": {...}, "success": true }
  Single   → ApiResponse[NotificationResponse]
               { "data": {...}, "message": "...", "success": true }
  Count    → ApiResponse[UnreadCountResponse]
               { "data": {"count": N} }

NotificationResponse field names are ALREADY camelCase (no CamelBase alias):
  userId, type, title, message, isRead, entityType, entityId,
  actionUrl, createdAt

NotificationTypeEnum (valid type values):
  trip_assigned | trip_status_changed | work_order_assigned |
  maintenance_due | document_expiring | fuel_logged |
  expense_submitted | system

FIXTURE STRATEGY:
  Notifications are created directly via db_session since there is no
  public POST endpoint — they are produced as side-effects of business
  events. The `seed_notification` fixture inserts a row and yields the
  notification id for use within each test.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

NULL_UUID = "00000000-0000-0000-0000-000000000000"
BASE = "/api/v1/notifications"


# ─────────────────────────────────────────────────────────────────────────────
# LOCAL FIXTURES — insert notifications directly into the test DB
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def mechanic_notification(
    db_session: AsyncSession,
    mechanic_user_id: str,
) -> dict:
    """
    One unread notification belonging to the MECHANIC user.
    Created directly in the DB so we don't depend on business-event triggers.
    """
    from db.models import Notification

    n = Notification(
        user_id=mechanic_user_id,
        type="work_order_assigned",
        title="New work order assigned",
        message="You have been assigned WO-001: Brake inspection",
        is_read=False,
    )
    db_session.add(n)
    await db_session.commit()
    await db_session.refresh(n)
    return {"id": n.id, "user_id": n.user_id, "type": n.type}


@pytest_asyncio.fixture
async def read_notification(
    db_session: AsyncSession,
    mechanic_user_id: str,
) -> dict:
    """An already-read notification for the mechanic user."""
    from db.models import Notification

    n = Notification(
        user_id=mechanic_user_id,
        type="maintenance_due",
        title="Maintenance due",
        message="Oil change overdue on KBZ 001A",
        is_read=True,
    )
    db_session.add(n)
    await db_session.commit()
    await db_session.refresh(n)
    return {"id": n.id, "user_id": n.user_id}


@pytest_asyncio.fixture
async def admin_notification(
    db_session: AsyncSession,
    admin_user_id: str,
) -> dict:
    """An unread notification belonging to the ADMIN user."""
    from db.models import Notification

    n = Notification(
        user_id=admin_user_id,
        type="expense_submitted",
        title="New expense submitted",
        message="Finance submitted a KES 4500 maintenance expense",
        is_read=False,
    )
    db_session.add(n)
    await db_session.commit()
    await db_session.refresh(n)
    return {"id": n.id, "user_id": n.user_id}


# ─────────────────────────────────────────────────────────────────────────────
# LIST
# ─────────────────────────────────────────────────────────────────────────────

class TestListNotifications:

    async def test_list_own_notifications(
        self, auth_client: AsyncClient, mechanic_notification: dict
    ):
        res = await auth_client.get(BASE)

        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "meta" in body
        assert isinstance(body["data"], list)

    async def test_list_returns_only_own_notifications(
        self,
        auth_client: AsyncClient,
        admin_client: AsyncClient,
        mechanic_notification: dict,
        admin_notification: dict,
    ):
        """
        Each user must only see their own notifications.
        Mechanic list must not contain the admin notification and vice versa.
        """
        mechanic_res = await auth_client.get(BASE)
        mechanic_ids = {n["id"] for n in mechanic_res.json()["data"]}

        admin_res = await admin_client.get(BASE)
        admin_ids = {n["id"] for n in admin_res.json()["data"]}

        # No overlap
        assert mechanic_notification["id"] in mechanic_ids
        assert admin_notification["id"] not in mechanic_ids
        assert admin_notification["id"] in admin_ids
        assert mechanic_notification["id"] not in admin_ids

    async def test_list_unread_only_filter(
        self,
        auth_client: AsyncClient,
        mechanic_notification: dict,
        read_notification: dict,
    ):
        """unread_only=true must exclude already-read notifications."""
        res = await auth_client.get(BASE, params={"unread_only": True})

        assert res.status_code == 200
        ids = [n["id"] for n in res.json()["data"]]
        assert mechanic_notification["id"] in ids
        assert read_notification["id"] not in ids

    async def test_list_filter_by_type(
        self, auth_client: AsyncClient, mechanic_notification: dict
    ):
        res = await auth_client.get(
            BASE, params={"type": "work_order_assigned"}
        )
        assert res.status_code == 200
        for n in res.json()["data"]:
            assert n["type"] == "work_order_assigned"

    async def test_list_pagination(
        self,
        auth_client: AsyncClient,
        mechanic_notification: dict,
        read_notification: dict,
    ):
        res = await auth_client.get(BASE, params={"page": 1, "page_size": 1})

        assert res.status_code == 200
        body = res.json()
        assert len(body["data"]) <= 1
        assert body["meta"]["pageSize"] == 1

    async def test_list_notification_response_fields(
        self, auth_client: AsyncClient, mechanic_notification: dict
    ):
        """Verify all expected camelCase fields are present in each item."""
        res = await auth_client.get(BASE)
        assert res.status_code == 200

        items = res.json()["data"]
        assert len(items) >= 1
        n = next(
            item for item in items
            if item["id"] == mechanic_notification["id"]
        )
        for field in ("id", "userId", "type", "title", "message", "isRead", "createdAt"):
            assert field in n, f"Missing field: {field}"

    async def test_list_requires_auth(self, client: AsyncClient):
        res = await client.get(BASE)
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# UNREAD COUNT
# ─────────────────────────────────────────────────────────────────────────────

class TestUnreadCount:

    async def test_unread_count_returns_correct_number(
        self,
        auth_client: AsyncClient,
        mechanic_notification: dict,
        read_notification: dict,
    ):
        """
        mechanic_notification is unread, read_notification is already read.
        Count must be >= 1 (other fixtures may have also seeded notifications).
        """
        res = await auth_client.get(f"{BASE}/unread-count")

        assert res.status_code == 200
        data = res.json()["data"]
        assert "count" in data
        assert data["count"] >= 1

    async def test_unread_count_decreases_after_mark_read(
        self, auth_client: AsyncClient, mechanic_notification: dict
    ):
        before = (await auth_client.get(f"{BASE}/unread-count")).json()["data"]["count"]

        # Mark the unread notification as read
        await auth_client.patch(
            f"{BASE}/{mechanic_notification['id']}/read",
            json={"isRead": True},
        )

        after = (await auth_client.get(f"{BASE}/unread-count")).json()["data"]["count"]
        assert after == before - 1

    async def test_unread_count_requires_auth(self, client: AsyncClient):
        res = await client.get(f"{BASE}/unread-count")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# MARK SINGLE READ / UNREAD
# ─────────────────────────────────────────────────────────────────────────────

class TestMarkNotificationRead:

    async def test_mark_notification_as_read(
        self, auth_client: AsyncClient, mechanic_notification: dict
    ):
        n_id = mechanic_notification["id"]
        res = await auth_client.patch(
            f"{BASE}/{n_id}/read", json={"isRead": True}
        )

        assert res.status_code == 200
        data = res.json()["data"]
        assert data["id"] == n_id
        assert data["isRead"] is True

    async def test_mark_notification_as_unread(
        self, auth_client: AsyncClient, read_notification: dict
    ):
        """Toggle back from read → unread."""
        n_id = read_notification["id"]
        res = await auth_client.patch(
            f"{BASE}/{n_id}/read", json={"isRead": False}
        )

        assert res.status_code == 200
        assert res.json()["data"]["isRead"] is False

    async def test_mark_already_read_is_idempotent(
        self, auth_client: AsyncClient, read_notification: dict
    ):
        """Setting isRead=True on an already-read notification is fine."""
        n_id = read_notification["id"]
        res = await auth_client.patch(
            f"{BASE}/{n_id}/read", json={"isRead": True}
        )
        assert res.status_code == 200
        assert res.json()["data"]["isRead"] is True

    async def test_mark_nonexistent_notification(
        self, auth_client: AsyncClient
    ):
        res = await auth_client.patch(
            f"{BASE}/{NULL_UUID}/read", json={"isRead": True}
        )
        assert res.status_code == 404

    async def test_cannot_mark_other_users_notification(
        self,
        auth_client: AsyncClient,
        admin_notification: dict,
    ):
        """Mechanic must NOT be able to mark the admin's notification."""
        res = await auth_client.patch(
            f"{BASE}/{admin_notification['id']}/read",
            json={"isRead": True},
        )
        # 404 is correct — the router checks user_id ownership and
        # treats foreign notifications as non-existent to the caller
        assert res.status_code == 404

    async def test_mark_read_requires_auth(
        self, client: AsyncClient, mechanic_notification: dict
    ):
        res = await client.patch(
            f"{BASE}/{mechanic_notification['id']}/read",
            json={"isRead": True},
        )
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# MARK ALL READ
# ─────────────────────────────────────────────────────────────────────────────

class TestMarkAllRead:

    async def test_mark_all_read(
        self,
        auth_client: AsyncClient,
        mechanic_notification: dict,
    ):
        """
        After PATCH /read-all, unread-count for this user must be 0.
        """
        # Ensure at least one unread exists
        count_before = (
            await auth_client.get(f"{BASE}/unread-count")
        ).json()["data"]["count"]
        assert count_before >= 1

        res = await auth_client.patch(f"{BASE}/read-all")
        assert res.status_code == 200

        count_after = (
            await auth_client.get(f"{BASE}/unread-count")
        ).json()["data"]["count"]
        assert count_after == 0

    async def test_mark_all_read_only_affects_own_notifications(
        self,
        auth_client: AsyncClient,
        admin_client: AsyncClient,
        mechanic_notification: dict,
        admin_notification: dict,
    ):
        """Mechanic marking all read must not touch admin's notifications."""
        await auth_client.patch(f"{BASE}/read-all")

        # Admin's notification should still be unread
        admin_count = (
            await admin_client.get(f"{BASE}/unread-count")
        ).json()["data"]["count"]
        assert admin_count >= 1

    async def test_mark_all_read_is_idempotent(
        self, auth_client: AsyncClient
    ):
        """Calling read-all when there are no unread notifications is fine."""
        await auth_client.patch(f"{BASE}/read-all")
        res = await auth_client.patch(f"{BASE}/read-all")
        assert res.status_code == 200

    async def test_mark_all_read_requires_auth(self, client: AsyncClient):
        res = await client.patch(f"{BASE}/read-all")
        assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteNotification:

    async def test_delete_own_notification(
        self, auth_client: AsyncClient, mechanic_notification: dict
    ):
        n_id = mechanic_notification["id"]
        res = await auth_client.delete(f"{BASE}/{n_id}")

        assert res.status_code == 200
        body = res.json()
        assert body["data"]["id"] == n_id

        # Verify it no longer appears in the list
        list_res = await auth_client.get(BASE)
        ids = [n["id"] for n in list_res.json()["data"]]
        assert n_id not in ids

    async def test_cannot_delete_other_users_notification(
        self,
        auth_client: AsyncClient,
        admin_notification: dict,
    ):
        """Mechanic must NOT be able to delete the admin's notification."""
        res = await auth_client.delete(f"{BASE}/{admin_notification['id']}")
        assert res.status_code == 404

    async def test_delete_nonexistent_notification(
        self, auth_client: AsyncClient
    ):
        res = await auth_client.delete(f"{BASE}/{NULL_UUID}")
        assert res.status_code == 404

    async def test_delete_requires_auth(
        self, client: AsyncClient, mechanic_notification: dict
    ):
        res = await client.delete(f"{BASE}/{mechanic_notification['id']}")
        assert res.status_code == 401

    async def test_delete_notification_response_contains_id(
        self, auth_client: AsyncClient, read_notification: dict
    ):
        """DELETE response body must contain the deleted notification's id."""
        res = await auth_client.delete(f"{BASE}/{read_notification['id']}")
        assert res.status_code == 200
        assert res.json()["data"]["id"] == read_notification["id"]