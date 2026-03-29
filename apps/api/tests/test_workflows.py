from pathlib import Path
from app.workflow_engine import WorkflowEngine


def test_load_presets_returns_workflows(tmp_path: Path) -> None:
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
