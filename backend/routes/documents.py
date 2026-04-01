from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from auth.deps import get_current_user, require_roles
from db.dbconfig import DB
from db.models import User
from schemas.common import ApiResponse
from schemas.documents import DocumentOCRJobResponse, DocumentOCRStartRequest, DocumentVerifyRequest
from services.ocr_service import (
    get_ocr_fields,
    get_ocr_issues,
    get_ocr_job,
    get_ocr_job_for_entity,
    start_ocr_job,
    verify_ocr_fields,
)

router = APIRouter(prefix='/documents', tags=['documents'])


async def _serialize_job(db: DB, job_id: str) -> DocumentOCRJobResponse:
    job = await get_ocr_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail='OCR job not found')
    fields = await get_ocr_fields(db, job.id)
    issues = await get_ocr_issues(db, job.id)
    return DocumentOCRJobResponse(
        id=job.id,
        document_type=job.document_type,
        entity_type=job.entity_type,
        entity_id=job.entity_id,
        file_url=job.file_url,
        status=job.status,
        processor=job.processor,
        extracted_text=job.extracted_text,
        started_at=job.started_at,
        completed_at=job.completed_at,
        error_message=job.error_message,
        created_at=job.created_at,
        fields=[field for field in fields],
        issues=[issue for issue in issues],
    )


@router.post('/{entity_id}/ocr', response_model=ApiResponse[DocumentOCRJobResponse], dependencies=[Depends(require_roles(['ADMIN', 'DISPATCHER', 'MECHANIC']))])
async def start_ocr(entity_id: str, body: DocumentOCRStartRequest, db: DB):
    job = await start_ocr_job(db, body.document_type, body.entity_type, body.entity_id or entity_id, body.file_url)
    return ApiResponse(data=await _serialize_job(db, job.id), message='OCR job completed')


@router.get('/{entity_id}/ocr', response_model=ApiResponse[DocumentOCRJobResponse], dependencies=[Depends(require_roles(['ADMIN', 'DISPATCHER', 'MECHANIC', 'DRIVER']))])
async def get_ocr(entity_id: str, entity_type: str, db: DB, _: User = Depends(get_current_user)):
    job = await get_ocr_job_for_entity(db, entity_type, entity_id)
    if not job:
        raise HTTPException(status_code=404, detail='OCR job not found')
    return ApiResponse(data=await _serialize_job(db, job.id))


@router.patch('/{entity_id}/verify-fields', response_model=ApiResponse[DocumentOCRJobResponse], dependencies=[Depends(require_roles(['ADMIN', 'DISPATCHER', 'MECHANIC']))])
async def verify_fields(entity_id: str, job_id: str, body: DocumentVerifyRequest, db: DB):
    job = await verify_ocr_fields(db, job_id, [field.model_dump() for field in body.fields])
    return ApiResponse(data=await _serialize_job(db, job.id), message='OCR fields verified')
