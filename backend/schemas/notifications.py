"""
schemas/notifications.py
Fleet Management System — Phase 9
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id:          str
    userId:      str
    type:        str
    title:       str
    message:     str
    isRead:      bool
    entityType:  Optional[str] = None
    entityId:    Optional[str] = None
    actionUrl:   Optional[str] = None
    createdAt:   datetime

    model_config = {"from_attributes": True, "populate_by_name": True}

    @classmethod
    def from_orm_row(cls, n: object) -> "NotificationResponse":
        return cls(
            id=n.id,
            userId=n.user_id,
            type=n.type,
            title=n.title,
            message=n.message,
            isRead=n.is_read,
            entityType=n.entity_type,
            entityId=n.entity_id,
            actionUrl=n.action_url,
            createdAt=n.created_at,
        )


class NotificationMarkRead(BaseModel):
    isRead: bool = True


class UnreadCountResponse(BaseModel):
    count: int