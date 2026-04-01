from __future__ import annotations

from datetime import datetime
from typing import Optional

from schemas.common import CamelBase


class ExtractedDocumentFieldResponse(CamelBase):
    id: str
    field_name: str
    field_value: Optional[str] = None
    confidence: Optional[float] = None


class DocumentVerificationIssueResponse(CamelBase):
    id: str
    issue_type: str
    severity: str
    message: str


class DocumentOCRJobResponse(CamelBase):
    id: str
    document_type: str
    entity_type: str
    entity_id: str
    file_url: str
    status: str
    processor: Optional[str] = None
    extracted_text: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    fields: list[ExtractedDocumentFieldResponse] = []
    issues: list[DocumentVerificationIssueResponse] = []


class DocumentOCRStartRequest(CamelBase):
    document_type: str
    entity_type: str
    entity_id: str
    file_url: str


class DocumentFieldVerification(CamelBase):
    field_name: str
    field_value: Optional[str] = None
    confidence: Optional[float] = None


class DocumentVerifyRequest(CamelBase):
    fields: list[DocumentFieldVerification]
