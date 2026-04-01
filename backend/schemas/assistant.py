from __future__ import annotations

from datetime import datetime
from typing import Optional

from schemas.common import CamelBase


class AssistantChatRequest(CamelBase):
    message: str
    session_id: Optional[str] = None


class AssistantChatResponse(CamelBase):
    session_id: str
    reply: str
    citations: list[str] = []
    suggestions: list[str] = []
    created_at: datetime


class AssistantSuggestion(CamelBase):
    label: str
    prompt: str


class AssistantSuggestionsResponse(CamelBase):
    suggestions: list[AssistantSuggestion]


class AssistantActionQueryRequest(CamelBase):
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    query: Optional[str] = None


class AssistantActionQueryResponse(CamelBase):
    action: str
    result: str
    items: list[dict] = []
    created_at: datetime
