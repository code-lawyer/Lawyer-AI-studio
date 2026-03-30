from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .models import SettingsRecord, WorkflowCreate
from .workflow_engine import WorkflowEngine
from .store import JsonStore


def create_workflow_router(engine: WorkflowEngine, store: JsonStore) -> APIRouter:
    r = APIRouter(prefix="/api")

    @r.get("/workflows")
    def list_workflows() -> list[dict]:
        return [wf.model_dump() for wf in engine.list_workflows()]

    @r.get("/workflows/{workflow_id}")
    def get_workflow(workflow_id: str) -> dict:
        wf = engine.get_workflow(workflow_id)
        if not wf:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return wf.model_dump()

    @r.post("/workflows", status_code=201)
    def create_workflow(payload: WorkflowCreate) -> dict:
        wf = engine.create_workflow(
            name=payload.name,
            description=payload.description,
            steps=payload.steps,
            trigger_keywords=payload.trigger_keywords,
            expected_outputs=payload.expected_outputs,
        )
        return wf.model_dump()

    @r.put("/workflows/{workflow_id}")
    def update_workflow(workflow_id: str, payload: WorkflowCreate) -> dict:
        wf = engine.update_workflow(workflow_id, payload.model_dump())
        if not wf:
            raise HTTPException(status_code=403, detail="Cannot update preset workflow")
        return wf.model_dump()

    @r.delete("/workflows/{workflow_id}")
    def delete_workflow(workflow_id: str) -> dict:
        if not engine.delete_workflow(workflow_id):
            raise HTTPException(status_code=403, detail="Cannot delete preset workflow")
        return {"deleted": True}

    @r.post("/workflows/{workflow_id}/duplicate", status_code=201)
    def duplicate_workflow(workflow_id: str) -> dict:
        wf = engine.duplicate_workflow(workflow_id)
        if not wf:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return wf.model_dump()

    @r.get("/settings")
    def get_settings() -> dict:
        record = store.get("settings", "global")
        if not record:
            return SettingsRecord().model_dump()
        return SettingsRecord(**record).model_dump()

    @r.put("/settings")
    def update_settings(payload: dict) -> dict:
        existing = store.get("settings", "global")
        current = SettingsRecord(**(existing or {}))
        updated = current.model_copy(update=payload)
        data = {**updated.model_dump(), "id": "global"}
        store.create("settings", data)
        return updated.model_dump()

    return r
