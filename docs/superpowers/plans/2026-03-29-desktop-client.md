# SuitAgent Desktop Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package SuitAgent as a Tauri desktop app with a workflow editor, powered by a bundled FastAPI backend and Claude Code CLI.

**Architecture:** Tauri v2 shell loads a statically-exported Next.js frontend, manages a PyInstaller-bundled FastAPI sidecar, and launches Claude Code CLI subprocesses on demand. Workflows are JSON files read/written by both the backend API and the frontend editor.

**Tech Stack:** Tauri v2 (Rust), Next.js 16 (static export), React 19, Tailwind CSS v4, @dnd-kit/sortable, FastAPI, SQLite, PyInstaller, Claude Code CLI

---

## File Structure

### New files

```
workflows/
  preset/defendant-response.json      # 7 preset workflow JSONs
  preset/evidence-review.json
  preset/post-trial-analysis.json
  preset/legal-service-plan.json
  preset/strategy-optimization.json
  preset/plaintiff-lawsuit.json
  preset/commission-documents.json
  custom/                              # empty dir for user workflows

apps/api/app/workflow_engine.py        # workflow loading, validation, multi-step execution
apps/api/app/workflow_routes.py        # FastAPI routes for workflow + settings CRUD
apps/api/tests/test_workflows.py       # workflow engine + API tests
apps/api/pyinstaller.spec              # PyInstaller build config

apps/web/src/app/workflows/page.tsx    # workflow editor page
apps/web/src/app/settings/page.tsx     # settings page
apps/web/src/components/workflow-editor.tsx   # editor component (3-column layout)
apps/web/src/components/task-panel.tsx        # floating task progress panel
apps/web/src/components/onboarding.tsx        # first-run setup wizard

apps/desktop/                          # Tauri project root
apps/desktop/src-tauri/src/main.rs     # sidecar management, window, health check
apps/desktop/src-tauri/Cargo.toml
apps/desktop/src-tauri/tauri.conf.json
```

### Modified files

```
apps/api/app/models.py          # add WorkflowTemplate, WorkflowStep, SettingsRecord
apps/api/app/store.py           # add workflows table, settings table
apps/api/app/main.py            # mount workflow_routes, add settings + health/claude
apps/api/app/executor.py        # improve claude_cli adapter (agent name, timeout)
apps/api/app/services.py        # add execute_workflow() multi-step method
apps/api/requirements.txt       # (no new deps needed for API)

apps/web/src/lib/types.ts       # add WorkflowTemplate, WorkflowStep, Settings types
apps/web/src/lib/api.ts         # add workflow + settings API functions
apps/web/src/app/layout.tsx     # add top navigation bar
apps/web/src/components/case-workspace.tsx  # integrate task-panel, restyle
apps/web/src/components/case-dashboard.tsx  # restyle to match new design
apps/web/src/app/globals.css    # new sand-palette CSS variables
apps/web/package.json           # add @dnd-kit/core, @dnd-kit/sortable

package.json                    # add desktop build scripts
```

---

## Task 1: Workflow data model and preset JSON files

**Files:**
- Create: `apps/api/app/workflow_engine.py`
- Modify: `apps/api/app/models.py`
- Create: `workflows/preset/defendant-response.json` (+ 6 more)
- Create: `apps/api/tests/test_workflows.py`

- [ ] **Step 1: Add WorkflowTemplate and WorkflowStep models to models.py**

Add after the `ArtifactExportResult` class (line 128):

```python
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
```

- [ ] **Step 2: Write the failing test for workflow loading**

```python
# apps/api/tests/test_workflows.py
from pathlib import Path
from app.workflow_engine import WorkflowEngine


def test_load_presets_returns_seven_workflows(tmp_path: Path) -> None:
    preset_dir = tmp_path / "preset"
    preset_dir.mkdir()
    (preset_dir / "test.json").write_text(
        '{"id":"wf_test","name":"Test","description":"d","category":"preset",'
        '"trigger_keywords":[],"steps":[{"order":1,"agent":"doc-analyzer","label":"Analyze"}],'
        '"expected_outputs":[],"created_at":"","updated_at":""}',
        encoding="utf-8",
    )
    custom_dir = tmp_path / "custom"
    custom_dir.mkdir()

    engine = WorkflowEngine(preset_dir=preset_dir, custom_dir=custom_dir)
    workflows = engine.list_workflows()
    assert len(workflows) == 1
    assert workflows[0].name == "Test"
    assert workflows[0].category == "preset"


def test_get_workflow_by_id(tmp_path: Path) -> None:
    preset_dir = tmp_path / "preset"
    preset_dir.mkdir()
    (preset_dir / "test.json").write_text(
        '{"id":"wf_test","name":"Test","description":"d","category":"preset",'
        '"trigger_keywords":[],"steps":[{"order":1,"agent":"doc-analyzer","label":"Analyze"}],'
        '"expected_outputs":[],"created_at":"","updated_at":""}',
        encoding="utf-8",
    )
    custom_dir = tmp_path / "custom"
    custom_dir.mkdir()

    engine = WorkflowEngine(preset_dir=preset_dir, custom_dir=custom_dir)
    wf = engine.get_workflow("wf_test")
    assert wf is not None
    assert wf.id == "wf_test"


def test_create_custom_workflow(tmp_path: Path) -> None:
    preset_dir = tmp_path / "preset"
    preset_dir.mkdir()
    custom_dir = tmp_path / "custom"
    custom_dir.mkdir()

    engine = WorkflowEngine(preset_dir=preset_dir, custom_dir=custom_dir)
    wf = engine.create_workflow(
        name="My flow",
        description="Custom",
        steps=[{"order": 1, "agent": "writer", "label": "Draft"}],
    )
    assert wf.category == "custom"
    assert (custom_dir / f"{wf.id}.json").exists()
    assert len(engine.list_workflows()) == 1


def test_delete_custom_workflow(tmp_path: Path) -> None:
    preset_dir = tmp_path / "preset"
    preset_dir.mkdir()
    custom_dir = tmp_path / "custom"
    custom_dir.mkdir()

    engine = WorkflowEngine(preset_dir=preset_dir, custom_dir=custom_dir)
    wf = engine.create_workflow(name="Temp", description="d", steps=[])
    assert engine.delete_workflow(wf.id) is True
    assert engine.get_workflow(wf.id) is None


def test_cannot_delete_preset(tmp_path: Path) -> None:
    preset_dir = tmp_path / "preset"
    preset_dir.mkdir()
    (preset_dir / "test.json").write_text(
        '{"id":"wf_test","name":"Test","description":"d","category":"preset",'
        '"trigger_keywords":[],"steps":[],"expected_outputs":[],"created_at":"","updated_at":""}',
        encoding="utf-8",
    )
    custom_dir = tmp_path / "custom"
    custom_dir.mkdir()

    engine = WorkflowEngine(preset_dir=preset_dir, custom_dir=custom_dir)
    assert engine.delete_workflow("wf_test") is False


def test_duplicate_preset_to_custom(tmp_path: Path) -> None:
    preset_dir = tmp_path / "preset"
    preset_dir.mkdir()
    (preset_dir / "test.json").write_text(
        '{"id":"wf_test","name":"Test","description":"d","category":"preset",'
        '"trigger_keywords":["kw"],"steps":[{"order":1,"agent":"writer","label":"Draft"}],'
        '"expected_outputs":[],"created_at":"","updated_at":""}',
        encoding="utf-8",
    )
    custom_dir = tmp_path / "custom"
    custom_dir.mkdir()

    engine = WorkflowEngine(preset_dir=preset_dir, custom_dir=custom_dir)
    dup = engine.duplicate_workflow("wf_test")
    assert dup is not None
    assert dup.id != "wf_test"
    assert dup.category == "custom"
    assert dup.name == "Test (副本)"
    assert len(dup.steps) == 1
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/api && py -3 -m pytest tests/test_workflows.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.workflow_engine'`

- [ ] **Step 4: Implement WorkflowEngine**

```python
# apps/api/app/workflow_engine.py
from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from .models import WorkflowStep, WorkflowTemplate, utc_now


class WorkflowEngine:
    def __init__(self, preset_dir: Path, custom_dir: Path):
        self.preset_dir = preset_dir
        self.custom_dir = custom_dir

    def _load_dir(self, directory: Path) -> list[WorkflowTemplate]:
        results: list[WorkflowTemplate] = []
        if not directory.exists():
            return results
        for path in sorted(directory.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            results.append(WorkflowTemplate(**data))
        return results

    def list_workflows(self) -> list[WorkflowTemplate]:
        return self._load_dir(self.preset_dir) + self._load_dir(self.custom_dir)

    def get_workflow(self, workflow_id: str) -> WorkflowTemplate | None:
        for wf in self.list_workflows():
            if wf.id == workflow_id:
                return wf
        return None

    def create_workflow(
        self,
        name: str,
        description: str,
        steps: list[dict],
        trigger_keywords: list[str] | None = None,
        expected_outputs: list[str] | None = None,
    ) -> WorkflowTemplate:
        wf = WorkflowTemplate(
            id=f"wf_{uuid4().hex[:10]}",
            name=name,
            description=description,
            category="custom",
            trigger_keywords=trigger_keywords or [],
            steps=[WorkflowStep(**s) for s in steps],
            expected_outputs=expected_outputs or [],
        )
        self._save_custom(wf)
        return wf

    def update_workflow(self, workflow_id: str, updates: dict) -> WorkflowTemplate | None:
        wf = self.get_workflow(workflow_id)
        if wf is None or wf.category == "preset":
            return None
        updated = wf.model_copy(update={**updates, "updated_at": utc_now()})
        if "steps" in updates:
            updated = updated.model_copy(
                update={"steps": [WorkflowStep(**s) if isinstance(s, dict) else s for s in updates["steps"]]}
            )
        self._save_custom(updated)
        return updated

    def delete_workflow(self, workflow_id: str) -> bool:
        wf = self.get_workflow(workflow_id)
        if wf is None or wf.category == "preset":
            return False
        path = self.custom_dir / f"{workflow_id}.json"
        if path.exists():
            path.unlink()
        return True

    def duplicate_workflow(self, workflow_id: str) -> WorkflowTemplate | None:
        source = self.get_workflow(workflow_id)
        if source is None:
            return None
        return self.create_workflow(
            name=f"{source.name} (副本)",
            description=source.description,
            steps=[s.model_dump() for s in source.steps],
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && py -3 -m pytest tests/test_workflows.py -v`
Expected: All 6 tests PASS

- [ ] **Step 6: Create the 7 preset workflow JSON files**

Create `workflows/preset/` directory and write 7 JSON files based on WorkflowSystem.md definitions. Example for `defendant-response.json`:

```json
{
  "id": "wf_defendant_response",
  "name": "被告应诉",
  "description": "收到起诉状时的完整应诉流程",
  "category": "preset",
  "trigger_keywords": ["收到起诉状", "需要应诉", "准备答辩"],
  "steps": [
    { "order": 1, "agent": "doc-analyzer", "label": "分析起诉状" },
    { "order": 2, "agent": "issue-identifier", "label": "识别争议焦点" },
    { "order": 3, "agent": "researcher", "label": "法律检索" },
    { "order": 4, "agent": "strategist", "label": "制定应诉策略" },
    { "order": 5, "agent": "writer", "label": "起草答辩状" },
    { "order": 6, "agent": "reviewer", "label": "质量审查" },
    { "order": 7, "agent": "summarizer", "label": "生成摘要" },
    { "order": 8, "agent": "reporter", "label": "整合报告" }
  ],
  "expected_outputs": ["争议焦点分析", "法律检索报告", "应诉策略方案", "答辩状草稿"],
  "created_at": "2026-01-01T00:00:00",
  "updated_at": "2026-03-29T00:00:00"
}
```

Remaining 6: `evidence-review.json`, `post-trial-analysis.json`, `legal-service-plan.json`, `strategy-optimization.json`, `plaintiff-lawsuit.json`, `commission-documents.json`. Each maps directly from WorkflowSystem.md scene definitions.

- [ ] **Step 7: Create `workflows/custom/` empty directory with .gitkeep**

- [ ] **Step 8: Commit**

```bash
git add apps/api/app/models.py apps/api/app/workflow_engine.py apps/api/tests/test_workflows.py workflows/
git commit -m "feat: add workflow data model, engine, and 7 preset templates"
```

---

## Task 2: Workflow and settings API routes

**Files:**
- Create: `apps/api/app/workflow_routes.py`
- Modify: `apps/api/app/main.py`
- Modify: `apps/api/app/store.py`
- Modify: `apps/api/tests/test_workflows.py`

- [ ] **Step 1: Add settings table to store.py**

In `store.py`, add `"settings"` to the `TABLES` tuple (line 25-33):

```python
TABLES = (
    "cases",
    "documents",
    "workflow_runs",
    "tasks",
    "artifacts",
    "review_records",
    "timelines",
    "settings",
)
```

- [ ] **Step 2: Write failing tests for workflow API endpoints**

Append to `apps/api/tests/test_workflows.py`:

```python
from pathlib import Path
from fastapi.testclient import TestClient


def build_workflow_client(tmp_path: Path) -> TestClient:
    from app.main import create_app

    workflows_dir = tmp_path / "workflows"
    preset_dir = workflows_dir / "preset"
    preset_dir.mkdir(parents=True)
    (preset_dir / "test.json").write_text(
        '{"id":"wf_test","name":"Test Preset","description":"d","category":"preset",'
        '"trigger_keywords":[],"steps":[{"order":1,"agent":"doc-analyzer","label":"Analyze"}],'
        '"expected_outputs":[],"created_at":"","updated_at":""}',
        encoding="utf-8",
    )
    custom_dir = workflows_dir / "custom"
    custom_dir.mkdir()

    app = create_app(data_root=tmp_path, workflows_dir=workflows_dir)
    return TestClient(app)


def test_list_workflows_api(tmp_path: Path) -> None:
    client = build_workflow_client(tmp_path)
    response = client.get("/api/workflows")
    assert response.status_code == 200
    workflows = response.json()
    assert len(workflows) >= 1
    assert workflows[0]["name"] == "Test Preset"


def test_create_custom_workflow_api(tmp_path: Path) -> None:
    client = build_workflow_client(tmp_path)
    response = client.post(
        "/api/workflows",
        json={
            "name": "My Custom",
            "description": "Test custom",
            "steps": [{"order": 1, "agent": "writer", "label": "Draft"}],
        },
    )
    assert response.status_code == 201
    wf = response.json()
    assert wf["category"] == "custom"
    assert wf["name"] == "My Custom"


def test_duplicate_preset_api(tmp_path: Path) -> None:
    client = build_workflow_client(tmp_path)
    response = client.post("/api/workflows/wf_test/duplicate")
    assert response.status_code == 201
    wf = response.json()
    assert wf["category"] == "custom"
    assert "副本" in wf["name"]


def test_delete_custom_workflow_api(tmp_path: Path) -> None:
    client = build_workflow_client(tmp_path)
    create_resp = client.post(
        "/api/workflows",
        json={"name": "Temp", "description": "d", "steps": []},
    )
    wf_id = create_resp.json()["id"]
    delete_resp = client.delete(f"/api/workflows/{wf_id}")
    assert delete_resp.status_code == 200


def test_cannot_delete_preset_api(tmp_path: Path) -> None:
    client = build_workflow_client(tmp_path)
    response = client.delete("/api/workflows/wf_test")
    assert response.status_code == 403


def test_settings_crud(tmp_path: Path) -> None:
    client = build_workflow_client(tmp_path)
    response = client.get("/api/settings")
    assert response.status_code == 200
    settings = response.json()
    assert settings["auto_review_reminder"] is True

    update_resp = client.put("/api/settings", json={"case_storage_dir": "D:\\Cases"})
    assert update_resp.status_code == 200
    assert update_resp.json()["case_storage_dir"] == "D:\\Cases"
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/api && py -3 -m pytest tests/test_workflows.py -v -k "api or settings"`
Expected: FAIL — routes don't exist yet

- [ ] **Step 4: Create workflow_routes.py**

```python
# apps/api/app/workflow_routes.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .models import SettingsRecord, WorkflowCreate
from .workflow_engine import WorkflowEngine
from .store import JsonStore

router = APIRouter(prefix="/api")


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
            steps=[s.model_dump() for s in payload.steps],
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
```

- [ ] **Step 5: Mount routes in main.py**

Modify `create_app` in `main.py` to accept `workflows_dir` and mount the workflow router:

```python
# Add to imports
from .workflow_routes import create_workflow_router
from .workflow_engine import WorkflowEngine

# Modify create_app signature
def create_app(
    data_root: Path | None = None,
    executor_mode: str = "local",
    executor_command: str | None = None,
    workflows_dir: Path | None = None,
) -> FastAPI:
    # ... existing setup ...

    wf_dir = workflows_dir or (Path(__file__).resolve().parents[2] / "workflows")
    engine = WorkflowEngine(
        preset_dir=wf_dir / "preset",
        custom_dir=wf_dir / "custom",
    )
    workflow_router = create_workflow_router(engine, service.store)
    app.include_router(workflow_router)

    # ... existing routes unchanged ...
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/api && py -3 -m pytest tests/test_workflows.py -v`
Expected: All tests PASS

- [ ] **Step 7: Run full test suite to verify no regressions**

Run: `cd apps/api && py -3 -m pytest tests/ -v`
Expected: All existing + new tests PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/app/workflow_routes.py apps/api/app/main.py apps/api/app/store.py apps/api/tests/test_workflows.py
git commit -m "feat: add workflow CRUD and settings API endpoints"
```

---

## Task 3: Multi-step workflow execution

**Files:**
- Modify: `apps/api/app/workflow_engine.py`
- Modify: `apps/api/app/services.py`
- Modify: `apps/api/app/main.py`
- Modify: `apps/api/tests/test_workflows.py`

- [ ] **Step 1: Write failing test for multi-step workflow execution**

Append to `apps/api/tests/test_workflows.py`:

```python
def test_execute_workflow_creates_tasks_for_each_step(tmp_path: Path) -> None:
    client = build_workflow_client(tmp_path)

    # Create a case and document
    case = client.post("/api/cases", json={
        "case_code": "WF-001", "title": "Workflow test",
        "case_type": "civil", "case_cause": "test", "owner_name": "Tester",
    }).json()
    from io import BytesIO
    doc = client.post(
        f"/api/cases/{case['id']}/documents",
        files={"file": ("evidence.txt", BytesIO(b"Key evidence content"), "text/plain")},
        data={"category": "04 - Evidence"},
    ).json()

    # Execute the preset workflow (which has 1 step: doc-analyzer → Analyze)
    response = client.post(
        f"/api/cases/{case['id']}/execute-workflow",
        json={"workflow_id": "wf_test", "document_ids": [doc["id"]]},
    )
    assert response.status_code == 201
    result = response.json()
    assert result["workflow_run_id"]
    assert result["status"] == "running"
    assert len(result["step_tasks"]) == 1
    assert result["step_tasks"][0]["title"] == "Analyze"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && py -3 -m pytest tests/test_workflows.py::test_execute_workflow_creates_tasks_for_each_step -v`
Expected: FAIL — endpoint doesn't exist

- [ ] **Step 3: Add execute_workflow to services.py**

Add this method to `WorkspaceService`:

```python
def execute_workflow(
    self,
    case_id: str,
    workflow_id: str,
    document_ids: list[str],
    engine: "WorkflowEngine",
) -> dict:
    case = self.store.get("cases", case_id)
    if not case:
        raise KeyError(case_id)

    wf = engine.get_workflow(workflow_id)
    if not wf:
        raise KeyError(workflow_id)

    documents = self._get_documents(case_id, document_ids)

    workflow_run = WorkflowRunRecord(
        id=self.store.next_id("run"),
        case_id=case_id,
        workflow_type=wf.name,
        title=wf.name,
        status="running",
    )

    step_tasks = []
    task_ids = []
    for step in wf.steps:
        task = TaskRecord(
            id=self.store.next_id("task"),
            case_id=case_id,
            workflow_run_id=workflow_run.id,
            task_type=step.agent,
            title=step.label,
            document_ids=document_ids,
            status="pending",
        )
        self.store.create("tasks", task.model_dump())
        step_tasks.append(task)
        task_ids.append(task.id)

    workflow_run = workflow_run.model_copy(update={"task_ids": task_ids})
    self.store.create("workflow_runs", workflow_run.model_dump())
    self._append_timeline(case_id, "workflow_started", f"Workflow started: {wf.name}")

    # Execute first step immediately
    if step_tasks:
        first_task = step_tasks[0]
        executed, artifact = self.adapter.submit(case, first_task, documents)
        self.store.update("tasks", first_task.id, executed.model_dump())
        if artifact:
            self._store_artifact_once(artifact)
        step_tasks[0] = executed

    return {
        "workflow_run_id": workflow_run.id,
        "workflow_name": wf.name,
        "status": "running",
        "step_tasks": [t.model_dump() for t in step_tasks],
    }
```

- [ ] **Step 4: Add execute-workflow endpoint to main.py**

Add after existing task routes:

```python
@app.post("/api/cases/{case_id}/execute-workflow", status_code=201)
def execute_workflow(case_id: str, payload: dict) -> dict:
    try:
        result = service.execute_workflow(
            case_id,
            payload["workflow_id"],
            payload.get("document_ids", []),
            engine,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return result
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && py -3 -m pytest tests/test_workflows.py::test_execute_workflow_creates_tasks_for_each_step -v`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `cd apps/api && py -3 -m pytest tests/ -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/services.py apps/api/app/main.py apps/api/tests/test_workflows.py
git commit -m "feat: add multi-step workflow execution endpoint"
```

---

## Task 4: Frontend design system and navigation shell

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Update globals.css with sand palette CSS variables**

Replace the existing CSS variables block in `globals.css` with the new sand palette from the design spec (Section 4.1). Keep Tailwind imports intact. Add the font import for Noto Serif SC + Noto Sans SC.

- [ ] **Step 2: Update layout.tsx with top navigation bar**

Add a shared top navigation component with: SuitAgent brand, four nav links (案件列表 `/`, 工作台 `/cases`, 工作流 `/workflows`, 设置 `/settings`), and a Claude Code connection status indicator on the right.

- [ ] **Step 3: Install @dnd-kit dependencies**

Run: `cd apps/web && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 4: Build to verify no errors**

Run: `npm run build:web`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/layout.tsx apps/web/package.json apps/web/package-lock.json
git commit -m "feat: add sand palette design system and navigation shell"
```

---

## Task 5: Frontend workflow types and API client

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add workflow and settings types to types.ts**

```typescript
export interface WorkflowStep {
  order: number;
  agent: string;
  label: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "preset" | "custom";
  trigger_keywords: string[];
  steps: WorkflowStep[];
  expected_outputs: string[];
  created_at: string;
  updated_at: string;
}

export interface Settings {
  claude_cli_path: string;
  case_storage_dir: string;
  auto_review_reminder: boolean;
  default_export_docx: boolean;
  show_execution_logs: boolean;
  onboarding_completed: boolean;
}

export interface WorkflowExecutionResult {
  workflow_run_id: string;
  workflow_name: string;
  status: string;
  step_tasks: TaskRecord[];
}
```

- [ ] **Step 2: Add API functions to api.ts**

```typescript
export async function fetchWorkflows(): Promise<WorkflowTemplate[]> { ... }
export async function fetchWorkflow(id: string): Promise<WorkflowTemplate> { ... }
export async function createWorkflow(payload: Omit<WorkflowTemplate, "id" | "category" | "created_at" | "updated_at">): Promise<WorkflowTemplate> { ... }
export async function updateWorkflow(id: string, payload: object): Promise<WorkflowTemplate> { ... }
export async function deleteWorkflow(id: string): Promise<void> { ... }
export async function duplicateWorkflow(id: string): Promise<WorkflowTemplate> { ... }
export async function executeWorkflow(caseId: string, workflowId: string, documentIds: string[]): Promise<WorkflowExecutionResult> { ... }
export async function fetchSettings(): Promise<Settings> { ... }
export async function updateSettings(payload: Partial<Settings>): Promise<Settings> { ... }
export async function checkClaudeHealth(): Promise<{ connected: boolean; model: string }> { ... }
```

Each function follows the same pattern as existing ones in api.ts (fetch with `cache: "no-store"`, throw on non-2xx).

- [ ] **Step 3: Build to verify types are correct**

Run: `npm run build:web`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat: add workflow and settings types and API client"
```

---

## Task 6: Workflow editor page

**Files:**
- Create: `apps/web/src/app/workflows/page.tsx`
- Create: `apps/web/src/components/workflow-editor.tsx`

- [ ] **Step 1: Create workflow-editor.tsx component**

Implement the three-column layout from the design mockup:
- Left sidebar (240px): workflow list with "系统预设" and "我的工作流" groups, "新建工作流" button
- Center (flex): pipeline editor with `@dnd-kit/sortable` for step reordering, step cards with grip/order/agent/label/remove, "添加步骤" drop zone, trigger keywords section
- Right panel (200px): available agents grouped by layer (输入层/分析层/输出层/支持层)

Use the sand palette CSS variables. Follow the mockup in `workflow-editor-v3.html`.

- [ ] **Step 2: Create workflows/page.tsx**

```tsx
import { WorkflowEditor } from "@/components/workflow-editor";
export default function WorkflowsPage() {
  return <WorkflowEditor />;
}
```

- [ ] **Step 3: Build and manually test**

Run: `npm run build:web`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/workflows/page.tsx apps/web/src/components/workflow-editor.tsx
git commit -m "feat: add workflow editor page with drag-and-drop pipeline"
```

---

## Task 7: Settings page and onboarding

**Files:**
- Create: `apps/web/src/app/settings/page.tsx`
- Create: `apps/web/src/components/onboarding.tsx`

- [ ] **Step 1: Create onboarding.tsx component**

5-step linear wizard: install app (auto-done), install Claude Code (auto-detect), login Claude Code (user action button), choose storage dir (user action), create first case (user action). Each step shows done/current/pending state. Bottom progress bar.

- [ ] **Step 2: Create settings/page.tsx**

Two-column layout: left side = settings form (Claude Code config, case storage, preferences with toggles), right side = onboarding card (only shown if `onboarding_completed` is false).

- [ ] **Step 3: Build and verify**

Run: `npm run build:web`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/settings/page.tsx apps/web/src/components/onboarding.tsx
git commit -m "feat: add settings page with onboarding wizard"
```

---

## Task 8: Case workspace redesign and task panel

**Files:**
- Create: `apps/web/src/components/task-panel.tsx`
- Modify: `apps/web/src/components/case-workspace.tsx`
- Modify: `apps/web/src/components/case-dashboard.tsx`

- [ ] **Step 1: Create task-panel.tsx**

Floating panel (fixed bottom-right, 360px wide): shows current workflow steps as a checklist (done/active/pending), agent name per step, bottom progress bar with "N / M 已完成" text. Polls task status every 3 seconds when a workflow is running.

- [ ] **Step 2: Redesign case-workspace.tsx**

Restyle the existing three-panel layout to match the new design:
- Left sidebar: case info block + functional navigation (文档中心, 证据材料, etc.) + stats grid
- Main area: content header + split pane (doc list 320px + preview flex)
- Integrate task-panel as floating overlay
- Add "选择工作流执行" button that triggers workflow selection and execution

- [ ] **Step 3: Restyle case-dashboard.tsx**

Update the case list page to use sand palette styling: warm backgrounds, serif headings, simplified card layout.

- [ ] **Step 4: Build and verify**

Run: `npm run build:web`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/task-panel.tsx apps/web/src/components/case-workspace.tsx apps/web/src/components/case-dashboard.tsx
git commit -m "feat: redesign case workspace with floating task panel"
```

---

## Task 9: Tauri desktop shell

**Files:**
- Create: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `package.json`

- [ ] **Step 1: Initialize Tauri project**

Run: `cd apps/desktop && npm create tauri-app@latest -- --template vanilla`

Then customize the generated files.

- [ ] **Step 2: Configure tauri.conf.json**

```json
{
  "$schema": "https://raw.githubusercontent.com/nicegram/nicegram-tauri/main/.schema/config.schema.json",
  "productName": "SuitAgent",
  "version": "0.1.0",
  "identifier": "com.suitagent.desktop",
  "build": {
    "frontendDist": "../../web/out"
  },
  "app": {
    "windows": [
      {
        "title": "SuitAgent",
        "width": 1280,
        "height": 800,
        "minWidth": 1024,
        "minHeight": 600
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "externalBin": ["sidecar/suitagent-api"]
  }
}
```

- [ ] **Step 3: Write main.rs with sidecar management**

```rust
// apps/desktop/src-tauri/src/main.rs
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct ApiProcess(Mutex<Option<Child>>);

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Locate and start the sidecar API
            let sidecar_path = app
                .path()
                .resource_dir()
                .expect("resource dir")
                .join("sidecar")
                .join("suitagent-api.exe");

            let child = Command::new(&sidecar_path)
                .spawn()
                .expect("failed to start API sidecar");

            app.manage(ApiProcess(Mutex::new(Some(child))));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<ApiProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Add desktop build scripts to root package.json**

```json
{
  "scripts": {
    "dev:desktop": "cd apps/desktop && cargo tauri dev",
    "build:desktop": "npm run build:web && cd apps/desktop && cargo tauri build",
    "export:web": "npm --prefix apps/web run build"
  }
}
```

- [ ] **Step 5: Verify Tauri project compiles**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: Compilation check succeeds

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/ package.json
git commit -m "feat: add Tauri desktop shell with sidecar management"
```

---

## Task 10: PyInstaller bundling for FastAPI

**Files:**
- Create: `apps/api/pyinstaller.spec`
- Modify: `package.json`

- [ ] **Step 1: Create pyinstaller.spec**

```python
# apps/api/pyinstaller.spec
# -*- mode: python ; coding: utf-8 -*-
import sys
from pathlib import Path

block_cipher = None
api_dir = Path("apps/api")

a = Analysis(
    [str(api_dir / "app" / "main.py")],
    pathex=[str(api_dir)],
    datas=[],
    hiddenimports=[
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
    ],
    cipher=block_cipher,
)
pyz = PYZ(a.pure, cipher=block_cipher)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    name="suitagent-api",
    console=True,
    onefile=True,
)
```

- [ ] **Step 2: Add build:api script to package.json**

```json
"build:api": "pyinstaller apps/api/pyinstaller.spec --distpath apps/desktop/sidecar"
```

- [ ] **Step 3: Test PyInstaller build**

Run: `pyinstaller apps/api/pyinstaller.spec --distpath apps/desktop/sidecar`
Expected: `apps/desktop/sidecar/suitagent-api.exe` is created

- [ ] **Step 4: Commit**

```bash
git add apps/api/pyinstaller.spec package.json
git commit -m "feat: add PyInstaller spec for FastAPI bundling"
```

---

## Task 11: Next.js static export configuration

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Enable static export in next.config.ts**

Add `output: "export"` to the Next.js config so `next build` produces a static `out/` directory that Tauri can load:

```typescript
const nextConfig = {
  output: "export",
  // ... existing config
};
```

- [ ] **Step 2: Verify static export works**

Run: `npm run build:web`
Expected: Build succeeds and `apps/web/out/` directory is created with static HTML files

- [ ] **Step 3: Verify no server-side features are used**

Check that no page uses `getServerSideProps`, `cookies()`, `headers()`, or other server-only APIs. The existing codebase uses client-side fetch only, so this should pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "feat: enable Next.js static export for Tauri embedding"
```

---

## Task 12: Integration test and full build verification

**Files:**
- No new files

- [ ] **Step 1: Run full API test suite**

Run: `cd apps/api && py -3 -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 2: Run frontend lint**

Run: `npm run lint:web`
Expected: No errors

- [ ] **Step 3: Run frontend build**

Run: `npm run build:web`
Expected: Static export succeeds, `apps/web/out/` exists

- [ ] **Step 4: Verify Tauri compiles**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: Compilation check succeeds

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify full build pipeline (API tests + web export + Tauri check)"
```
