from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import DocumentOCRJob, DocumentVerificationIssue, ExtractedDocumentField

try:
    import pytesseract  # type: ignore
    from PIL import Image  # type: ignore
except Exception:  # pragma: no cover
    pytesseract = None
    Image = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _url_to_local_path(file_url: str) -> Optional[Path]:
    if file_url.startswith('/static/'):
        return Path(file_url.lstrip('/'))
    parsed = urlparse(file_url)
    if parsed.scheme in ('', 'file'):
        candidate = Path(parsed.path.lstrip('/'))
        return candidate
    return None


def _extract_fields(text: str) -> list[dict]:
    patterns = {
        'license_number': r'(?:license|licence)[^A-Z0-9]{0,10}([A-Z0-9-]{5,})',
        'policy_number': r'(?:policy)[^A-Z0-9]{0,10}([A-Z0-9-]{5,})',
        'registration_number': r'(?:registration)[^A-Z0-9]{0,10}([A-Z0-9-]{4,})',
        'amount': r'\b(?:USD|KES|NGN|\$)?\s?([0-9]+(?:\.[0-9]{2})?)\b',
        'date': r'\b(20\d{2}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]20\d{2})\b',
    }
    results: list[dict] = []
    for field_name, pattern in patterns.items():
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            results.append({
                'field_name': field_name,
                'field_value': match.group(1),
                'confidence': 0.6,
            })
    return results


async def start_ocr_job(db: AsyncSession, document_type: str, entity_type: str, entity_id: str, file_url: str) -> DocumentOCRJob:
    job = DocumentOCRJob(
        document_type=document_type,
        entity_type=entity_type,
        entity_id=entity_id,
        file_url=file_url,
        status='uploaded',
        processor='tesseract' if pytesseract else 'regex-fallback',
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    await run_ocr_job(db, job.id)
    return await get_ocr_job(db, job.id)  # type: ignore[return-value]


async def get_ocr_job(db: AsyncSession, job_id: str) -> Optional[DocumentOCRJob]:
    return (await db.execute(select(DocumentOCRJob).where(DocumentOCRJob.id == job_id))).scalar_one_or_none()


async def get_ocr_job_for_entity(db: AsyncSession, entity_type: str, entity_id: str) -> Optional[DocumentOCRJob]:
    return (await db.execute(
        select(DocumentOCRJob)
        .where(DocumentOCRJob.entity_type == entity_type, DocumentOCRJob.entity_id == entity_id)
        .order_by(DocumentOCRJob.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()


async def get_ocr_fields(db: AsyncSession, job_id: str) -> list[ExtractedDocumentField]:
    return (await db.execute(select(ExtractedDocumentField).where(ExtractedDocumentField.ocr_job_id == job_id))).scalars().all()


async def get_ocr_issues(db: AsyncSession, job_id: str) -> list[DocumentVerificationIssue]:
    return (await db.execute(select(DocumentVerificationIssue).where(DocumentVerificationIssue.ocr_job_id == job_id))).scalars().all()


async def run_ocr_job(db: AsyncSession, job_id: str) -> None:
    job = await get_ocr_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail='OCR job not found')

    await db.execute(delete(ExtractedDocumentField).where(ExtractedDocumentField.ocr_job_id == job.id))
    await db.execute(delete(DocumentVerificationIssue).where(DocumentVerificationIssue.ocr_job_id == job.id))
    await db.commit()

    job.status = 'processing'
    job.started_at = _utcnow()
    await db.commit()

    local_path = _url_to_local_path(job.file_url)
    extracted_text = ''

    try:
        if local_path and local_path.exists() and pytesseract and Image and local_path.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp'}:
            extracted_text = pytesseract.image_to_string(Image.open(local_path))
        elif local_path and local_path.exists():
            extracted_text = local_path.stem.replace('_', ' ')
        else:
            extracted_text = Path(urlparse(job.file_url).path).stem.replace('_', ' ')

        job.extracted_text = extracted_text.strip() or None
        fields = _extract_fields(extracted_text)
        for field in fields:
            db.add(ExtractedDocumentField(ocr_job_id=job.id, **field))

        if not fields:
            db.add(DocumentVerificationIssue(
                ocr_job_id=job.id,
                issue_type='low_confidence',
                severity='medium',
                message='No structured fields could be extracted automatically.',
            ))
            job.status = 'review_needed'
        else:
            job.status = 'verified'

        job.completed_at = _utcnow()
        job.error_message = None
        await db.commit()
    except Exception as exc:
        job.status = 'failed'
        job.completed_at = _utcnow()
        job.error_message = str(exc)
        await db.commit()


async def verify_ocr_fields(db: AsyncSession, job_id: str, fields: list[dict]) -> DocumentOCRJob:
    job = await get_ocr_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail='OCR job not found')

    await db.execute(delete(ExtractedDocumentField).where(ExtractedDocumentField.ocr_job_id == job.id))
    await db.execute(delete(DocumentVerificationIssue).where(DocumentVerificationIssue.ocr_job_id == job.id))
    for field in fields:
        db.add(ExtractedDocumentField(ocr_job_id=job.id, **field))
    job.status = 'verified'
    job.completed_at = _utcnow()
    await db.commit()
    await db.refresh(job)
    return job
