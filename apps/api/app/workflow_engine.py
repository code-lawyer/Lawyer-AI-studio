from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from .models import WorkflowStep, WorkflowTemplate, utc_now


class WorkflowEngine:
    def __init__(self, preset_dir: Path, custom_dir: Path):
        self.preset_dir = preset_dir
        self.custom_dir = custom_dir
        self._preset_cache: list[WorkflowTemplate] = self._load_dir(preset_dir)

    @staticmethod
    def _load_dir(directory: Path) -> list[WorkflowTemplate]:
        results: list[WorkflowTemplate] = []
        if not directory.exists():
            return results
        for path in sorted(directory.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            results.append(WorkflowTemplate(**data))
        return results

    def list_workflows(self) -> list[WorkflowTemplate]:
        return list(self._preset_cache) + self._load_dir(self.custom_dir)

    def get_workflow(self, workflow_id: str) -> WorkflowTemplate | None:
        for wf in self._preset_cache:
            if wf.id == workflow_id:
                return wf
        path = self.custom_dir / f"{workflow_id}.json"
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            return WorkflowTemplate(**data)
        return None

    def create_workflow(
        self,
        name: str,
        description: str,
        steps: list[WorkflowStep],
        trigger_keywords: list[str] | None = None,
        expected_outputs: list[str] | None = None,
    ) -> WorkflowTemplate:
        wf = WorkflowTemplate(
            id=f"wf_{uuid4().hex[:10]}",
            name=name,
            description=description,
            category="custom",
            trigger_keywords=trigger_keywords or [],
            steps=list(steps),
            expected_outputs=expected_outputs or [],
        )
        self._save_custom(wf)
        return wf

    def update_workflow(self, workflow_id: str, updates: dict) -> WorkflowTemplate | None:
        wf = self.get_workflow(workflow_id)
        if wf is None or wf.category == "preset":
            return None
        updated = wf.model_copy(update={**updates, "updated_at": utc_now()})
        self._save_custom(updated)
        return updated

    def delete_workflow(self, workflow_id: str) -> bool:
        wf = self.get_workflow(workflow_id)
        if wf is None or wf.category == "preset":
            return False
        path = self.custom_dir / f"{workflow_id}.json"
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        return True

    def duplicate_workflow(self, workflow_id: str) -> WorkflowTemplate | None:
        source = self.get_workflow(workflow_id)
        if source is None:
            return None
        return self.create_workflow(
            name=f"{source.name} (副本)",
            description=source.description,
            steps=list(source.steps),
            trigger_keywords=list(source.trigger_keywords),
            expected_outputs=list(source.expected_outputs),
        )

    def _save_custom(self, wf: WorkflowTemplate) -> None:
        self.custom_dir.mkdir(parents=True, exist_ok=True)
        path = self.custom_dir / f"{wf.id}.json"
        path.write_text(
            json.dumps(wf.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
