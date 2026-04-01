from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from auth.deps import get_current_user, require_roles
from db.dbconfig import DB
from db.models import User
from schemas.assistant import (
    AssistantActionQueryRequest,
    AssistantActionQueryResponse,
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantSuggestion,
    AssistantSuggestionsResponse,
)
from schemas.common import ApiResponse
from services.assistant_service import SUGGESTIONS, handle_chat, perform_action_query

router = APIRouter(prefix='/assistant', tags=['assistant'])


@router.post('/chat', response_model=ApiResponse[AssistantChatResponse])
async def chat(body: AssistantChatRequest, db: DB, current_user: User = Depends(get_current_user)):
    if not body.message.strip():
        raise HTTPException(status_code=422, detail='Message cannot be empty')
    payload = await handle_chat(db, current_user.id, body.message, body.session_id)
    return ApiResponse(data=AssistantChatResponse.model_validate(payload))


@router.post('/actions/query', response_model=ApiResponse[AssistantActionQueryResponse])
async def action_query(body: AssistantActionQueryRequest, db: DB, current_user: User = Depends(get_current_user)):
    payload = await perform_action_query(db, current_user.id, body.action, body.target_type, body.target_id, body.query)
    return ApiResponse(data=AssistantActionQueryResponse.model_validate(payload))


@router.get('/suggestions', response_model=ApiResponse[AssistantSuggestionsResponse])
async def suggestions(_: User = Depends(get_current_user)):
    return ApiResponse(data=AssistantSuggestionsResponse(
        suggestions=[AssistantSuggestion(**row) for row in SUGGESTIONS]
    ))
