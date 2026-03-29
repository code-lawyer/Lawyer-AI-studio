from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient


def build_client(tmp_path: Path, executor_mode: str = "local", executor_command: str | None = None) -> TestClient:
    from app.main import create_app

    app = create_app(tmp_path, executor_mode=executor_mode, executor_command=executor_command)
    return TestClient(app)


def create_case(client: TestClient, case_code: str = "SUIT-2026-001") -> dict:
    response = client.post(
        "/api/cases",
        json={
            "case_code": case_code,
            "title": "Contract dispute",
            "case_type": "civil",
            "case_cause": "service contract dispute",
            "owner_name": "Lawyer A",
        },
    )
    assert response.status_code == 201
    return response.json()


def upload_text_document(client: TestClient, case_id: str, name: str = "facts.txt") -> dict:
    response = client.post(
        f"/api/cases/{case_id}/documents",
        files={"file": (name, BytesIO("Key factual timeline".encode("utf-8")), "text/plain")},
        data={"category": "04 - Evidence"},
    )
    assert response.status_code == 201
    return response.json()


def create_research_task(client: TestClient, case_id: str, document_id: str, title: str = "Research memo") -> dict:
    response = client.post(
        f"/api/cases/{case_id}/tasks",
        json={
            "task_type": "legal_research",
            "title": title,
            "document_ids": [document_id],
        },
    )
    assert response.status_code == 201
    return response.json()


def test_case_document_task_artifact_flow(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    case = create_case(client)
    document = upload_text_document(client, case["id"])

    task = create_research_task(client, case["id"], document["id"])
    assert task["status"] == "completed"
    assert task["artifact_ids"]
    assert task["workflow_run_id"]
    assert task["external_task_id"]
    assert task["logs"]

    artifact_response = client.get(f"/api/artifacts/{task['artifact_ids'][0]}")
    assert artifact_response.status_code == 200
    artifact = artifact_response.json()
    assert artifact["artifact_type"] == "legal_research"
    assert "Research memo" in artifact["content"]
    assert artifact["review_status"] == "waiting_review"


def test_failed_task_can_be_retried_after_documents_are_available(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    case = create_case(client, "SUIT-2026-002")

    failed_task_response = client.post(
        f"/api/cases/{case['id']}/tasks",
        json={
            "task_type": "legal_research",
            "title": "Missing materials",
            "document_ids": [],
        },
    )
    assert failed_task_response.status_code == 201
    failed_task = failed_task_response.json()
    assert failed_task["status"] == "failed"
    assert failed_task["error_message"]
    assert failed_task["workflow_run_id"]
    assert failed_task["logs"]

    document = upload_text_document(client, case["id"], "evidence.txt")

    recovery_task = create_research_task(client, case["id"], document["id"], "Recovery memo")
    assert recovery_task["status"] == "completed"


def test_document_detail_exposes_extracted_content(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    case = create_case(client, "SUIT-2026-003")
    document = upload_text_document(client, case["id"], "summary.txt")

    response = client.get(f"/api/documents/{document['id']}")
    assert response.status_code == 200
    document_detail = response.json()
    assert document_detail["id"] == document["id"]
    assert "Key factual timeline" in document_detail["extracted_text"]


def test_artifact_review_updates_status_and_case_detail(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    case = create_case(client, "SUIT-2026-004")
    document = upload_text_document(client, case["id"])

    task = create_research_task(client, case["id"], document["id"], "Review memo")
    artifact_id = task["artifact_ids"][0]

    review_response = client.post(
        f"/api/artifacts/{artifact_id}/review",
        json={
            "action": "approved",
            "reviewer_name": "Lawyer A",
            "comment": "Approved for drafting",
        },
    )
    assert review_response.status_code == 200
    artifact = review_response.json()
    assert artifact["review_status"] == "approved"
    assert artifact["reviewed_by"] == "Lawyer A"

    review_records_response = client.get(f"/api/artifacts/{artifact_id}/reviews")
    assert review_records_response.status_code == 200
    review_records = review_records_response.json()
    assert len(review_records) == 1
    assert review_records[0]["comment"] == "Approved for drafting"

    case_detail = client.get(f"/api/cases/{case['id']}").json()
    assert case_detail["artifacts"][0]["review_status"] == "approved"
    assert case_detail["review_records"][0]["artifact_id"] == artifact_id
    assert any(item["kind"] == "artifact_reviewed" for item in case_detail["timeline"])


def test_case_detail_includes_workflow_runs_and_exported_artifacts(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    case = create_case(client, "SUIT-2026-005")
    document = upload_text_document(client, case["id"], "claim.txt")
    task = create_research_task(client, case["id"], document["id"], "Export memo")

    case_detail = client.get(f"/api/cases/{case['id']}").json()
    assert len(case_detail["workflow_runs"]) == 1
    assert case_detail["workflow_runs"][0]["task_ids"] == [task["id"]]

    export_response = client.post(
        f"/api/artifacts/{task['artifact_ids'][0]}/export",
        json={"format": "docx"},
    )
    assert export_response.status_code == 200
    export_payload = export_response.json()
    assert export_payload["artifact_id"] == task["artifact_ids"][0]
    assert export_payload["format"] == "docx"
    assert export_payload["file_path"].endswith(".docx")
    assert Path(export_payload["file_path"]).exists()


def test_external_executor_task_syncs_from_running_to_completed(tmp_path: Path) -> None:
    client = build_client(tmp_path, executor_mode="external_stub")
    case = create_case(client, "SUIT-2026-006")
    document = upload_text_document(client, case["id"], "executor.txt")

    task = create_research_task(client, case["id"], document["id"], "External memo")
    assert task["status"] == "running"
    assert task["execution_mode"] == "external_stub"
    assert task["artifact_ids"] == []

    synced = client.get(f"/api/tasks/{task['id']}").json()
    assert synced["status"] == "completed"
    assert synced["artifact_ids"]
    assert synced["external_task_id"].startswith("external-")

    case_detail = client.get(f"/api/cases/{case['id']}").json()
    assert case_detail["workflow_runs"][0]["status"] == "completed"


def test_external_executor_task_can_be_canceled(tmp_path: Path) -> None:
    client = build_client(tmp_path, executor_mode="external_stub_hold")
    case = create_case(client, "SUIT-2026-007")
    document = upload_text_document(client, case["id"], "hold.txt")

    task = create_research_task(client, case["id"], document["id"], "Hold memo")
    assert task["status"] == "running"

    canceled_response = client.post(f"/api/tasks/{task['id']}/cancel")
    assert canceled_response.status_code == 200
    canceled = canceled_response.json()
    assert canceled["status"] == "canceled"
    assert "cancel" in " ".join(canceled["logs"]).lower()

    case_detail = client.get(f"/api/cases/{case['id']}").json()
    assert case_detail["workflow_runs"][0]["status"] == "canceled"


def test_command_runner_executor_calls_external_process_and_returns_artifact(tmp_path: Path) -> None:
    worker = Path(__file__).parent / "fixtures" / "mock_executor.py"
    command = f'py -3 "{worker}"'
    client = build_client(tmp_path, executor_mode="command_runner", executor_command=command)
    case = create_case(client, "SUIT-2026-008")
    document = upload_text_document(client, case["id"], "command.txt")

    task = create_research_task(client, case["id"], document["id"], "CLI memo")
    assert task["status"] == "running"
    assert task["execution_mode"] == "command_runner"

    synced = client.get(f"/api/tasks/{task['id']}").json()
    assert synced["status"] == "completed"
    assert synced["artifact_ids"]

    artifact = client.get(f"/api/artifacts/{synced['artifact_ids'][0]}").json()
    assert "MOCK EXECUTOR RESULT" in artifact["content"]
