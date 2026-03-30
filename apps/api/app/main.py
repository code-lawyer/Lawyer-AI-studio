from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .models import ArtifactExportPayload, ArtifactReviewPayload, CaseCreate, TaskCreate, WorkflowExecuteRequest
from .services import WorkspaceService
from .store import JsonStore
from .workflow_routes import create_workflow_router
from .workflow_engine import WorkflowEngine


def create_app(
    data_root: Path | None = None,
    executor_mode: str = "local",
    executor_command: str | None = None,
    workflows_dir: Path | None = None,
) -> FastAPI:
    app = FastAPI(title="SuitAgent Workspace API", version="0.3.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    store_root = data_root or (Path(__file__).resolve().parents[1] / ".runtime")
    service = WorkspaceService(JsonStore(store_root), executor_mode=executor_mode, executor_command=executor_command)

    wf_dir = workflows_dir or (Path(__file__).resolve().parents[3] / "workflows")
    engine = WorkflowEngine(
        preset_dir=wf_dir / "preset",
        custom_dir=wf_dir / "custom",
    )
    workflow_router = create_workflow_router(engine, service.store)
    app.include_router(workflow_router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "executor_mode": executor_mode,
            "executor_command": executor_command or "",
        }

    @app.get("/api/cases")
    def list_cases() -> list[dict]:
        return [item.model_dump() for item in service.list_cases()]

    @app.post("/api/cases", status_code=201)
    def create_case(payload: CaseCreate) -> dict:
        return service.create_case(payload).model_dump()

    @app.get("/api/cases/{case_id}")
    def get_case(case_id: str) -> dict:
        case = service.get_case(case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        return case.model_dump()

    @app.post("/api/cases/{case_id}/documents", status_code=201)
    async def add_document(case_id: str, file: UploadFile = File(...), category: str = Form(...)) -> dict:
        try:
            document = await service.add_document(case_id, category, file)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Case not found") from exc
        return document.model_dump()

    @app.get("/api/documents/{document_id}")
    def get_document(document_id: str) -> dict:
        document = service.get_document(document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        return document.model_dump()

    @app.post("/api/cases/{case_id}/tasks", status_code=201)
    def create_task(case_id: str, payload: TaskCreate) -> dict:
        try:
            task = service.create_task(case_id, payload)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Case not found") from exc
        return task.model_dump()

    @app.get("/api/tasks/{task_id}")
    def get_task(task_id: str) -> dict:
        task = service.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task.model_dump()

    @app.post("/api/tasks/{task_id}/retry")
    def retry_task(task_id: str) -> dict:
        try:
            task = service.retry_task(task_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Task not found") from exc
        return task.model_dump()

    @app.post("/api/tasks/{task_id}/cancel")
    def cancel_task(task_id: str) -> dict:
        try:
            task = service.cancel_task(task_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Task not found") from exc
        return task.model_dump()

    @app.post("/api/cases/{case_id}/execute-workflow", status_code=201)
    def execute_workflow(case_id: str, payload: WorkflowExecuteRequest) -> dict:
        try:
            result = service.execute_workflow(
                case_id,
                payload.workflow_id,
                payload.document_ids,
                engine,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return result

    @app.get("/api/artifacts/{artifact_id}")
    def get_artifact(artifact_id: str) -> dict:
        artifact = service.get_artifact(artifact_id)
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        return artifact.model_dump()

    @app.get("/api/artifacts/{artifact_id}/reviews")
    def list_artifact_reviews(artifact_id: str) -> list[dict]:
        return [item.model_dump() for item in service.list_review_records(artifact_id)]

    @app.post("/api/artifacts/{artifact_id}/review")
    def review_artifact(artifact_id: str, payload: ArtifactReviewPayload) -> dict:
        try:
            artifact = service.review_artifact(artifact_id, payload)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Artifact not found") from exc
        return artifact.model_dump()

    @app.post("/api/artifacts/{artifact_id}/export")
    def export_artifact(artifact_id: str, payload: ArtifactExportPayload) -> dict:
        try:
            result = service.export_artifact(artifact_id, payload)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Artifact not found") from exc
        return result.model_dump()

    return app


app = create_app()
