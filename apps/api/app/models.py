from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal

from pydantic import BaseModel, Field


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TimelineItem(BaseModel):
    id: str
    case_id: str
    kind: str
    message: str
    created_at: str = Field(default_factory=utc_now)


class CaseCreate(BaseModel):
    case_code: str
    title: str
    case_type: str
    case_cause: str
    owner_name: str


class CaseRecord(CaseCreate):
    id: str
    status: str = "active"
    phase: str = "intake"
    workspace_initialized: bool = True
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)


class DocumentRecord(BaseModel):
    id: str
    case_id: str
    file_name: str
    file_type: str
    storage_path: str
    extracted_text_path: str
    category: str
    processing_status: str
    uploaded_at: str = Field(default_factory=utc_now)


class DocumentDetail(DocumentRecord):
    extracted_text: str


class TaskCreate(BaseModel):
    task_type: str
    title: str
    document_ids: List[str] = Field(default_factory=list)


class WorkflowRunRecord(BaseModel):
    id: str
    case_id: str
    workflow_type: str
    title: str
    status: Literal["pending", "running", "completed", "failed", "canceled"]
    task_ids: List[str] = Field(default_factory=list)
    started_by: str = "workspace_user"
    error_message: str = ""
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)
    completed_at: str = ""


class TaskRecord(TaskCreate):
    id: str
    case_id: str
    workflow_run_id: str
    status: Literal["pending", "running", "completed", "failed", "canceled"]
    artifact_ids: List[str] = Field(default_factory=list)
    attempts: int = 1
    execution_mode: str = "local_adapter"
    external_task_id: str = ""
    error_message: str = ""
    logs: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)


class ArtifactRecord(BaseModel):
    id: str
    case_id: str
    source_task_id: str
    artifact_type: str
    title: str
    content: str
    file_path: str
    review_status: Literal["draft", "waiting_review", "approved", "rejected"] = "waiting_review"
    review_comment: str = ""
    reviewed_by: str = ""
    reviewed_at: str = ""
    created_at: str = Field(default_factory=utc_now)


class ArtifactReviewPayload(BaseModel):
    action: Literal["approved", "rejected"]
    reviewer_name: str
    comment: str = ""


class ReviewRecord(BaseModel):
    id: str
    case_id: str
    artifact_id: str
    action: Literal["approved", "rejected"]
    reviewer_name: str
    comment: str = ""
    created_at: str = Field(default_factory=utc_now)


class ArtifactExportPayload(BaseModel):
    format: Literal["docx", "md"] = "docx"


class ArtifactExportResult(BaseModel):
    artifact_id: str
    format: Literal["docx", "md"]
    file_path: str
    exported_at: str = Field(default_factory=utc_now)


class WorkflowStep(BaseModel):
    order: int
    agent: str
    label: str


class WorkflowTemplate(BaseModel):
    id: str
    name: str
    description: str
    category: Literal["preset", "custom"]
    trigger_keywords: List[str] = Field(default_factory=list)
    steps: List[WorkflowStep] = Field(default_factory=list)
    expected_outputs: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)


class WorkflowCreate(BaseModel):
    name: str
    description: str
    trigger_keywords: List[str] = Field(default_factory=list)
    steps: List[WorkflowStep] = Field(default_factory=list)
    expected_outputs: List[str] = Field(default_factory=list)


class SettingsRecord(BaseModel):
    claude_cli_path: str = ""
    case_storage_dir: str = ""
    auto_review_reminder: bool = True
    default_export_docx: bool = True
    show_execution_logs: bool = False
    onboarding_completed: bool = False


class CaseDetail(CaseRecord):
    documents: List[DocumentRecord] = Field(default_factory=list)
    tasks: List[TaskRecord] = Field(default_factory=list)
    artifacts: List[ArtifactRecord] = Field(default_factory=list)
    workflow_runs: List[WorkflowRunRecord] = Field(default_factory=list)
    review_records: List[ReviewRecord] = Field(default_factory=list)
    timeline: List[TimelineItem] = Field(default_factory=list)
