from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Protocol

from .models import ArtifactRecord, DocumentRecord, TaskRecord, utc_now
from .store import JsonStore


class ExecutionAdapter(Protocol):
    mode: str

    def submit(self, case: dict, task: TaskRecord, documents: list[DocumentRecord]) -> tuple[TaskRecord, ArtifactRecord | None]: ...

    def sync(self, case: dict, task: TaskRecord, documents: list[DocumentRecord]) -> tuple[TaskRecord, ArtifactRecord | None]: ...

    def cancel(self, task: TaskRecord) -> TaskRecord: ...


def build_execution_adapter(store: JsonStore, mode: str, command: str | None = None) -> ExecutionAdapter:
    if mode == "external_stub":
        return ExternalStubExecutionAdapter(store, mode="external_stub", auto_complete=True)
    if mode == "external_stub_hold":
        return ExternalStubExecutionAdapter(store, mode="external_stub_hold", auto_complete=False)
    if mode == "command_runner":
        return CommandRunnerExecutionAdapter(store, mode="command_runner", command=command or "")
    if mode == "claude_cli":
        return CommandRunnerExecutionAdapter(
            store,
            mode="claude_cli",
            command=command or "claude -p --output-format text --permission-mode bypassPermissions --bare",
        )
    return LocalExecutionAdapter(store)


def _build_default_content(case: dict, task: TaskRecord, documents: list[DocumentRecord]) -> str:
    source_snippets = []
    for document in documents:
        text = Path(document.extracted_text_path).read_text(encoding="utf-8")
        source_snippets.append(f"## Source document: {document.file_name}\n\n{text.strip()}\n")

    return "\n".join(
        [
            f"# {task.title}",
            "",
            f"- Task type: {task.task_type}",
            f"- Case code: {case['case_code']}",
            f"- Cause: {case['case_cause']}",
            f"- Generated at: {utc_now()}",
            f"- Execution mode: {task.execution_mode}",
            "",
            "## Draft summary",
            f"This output was generated for task `{task.title}`.",
            "It exists to validate workflow persistence, execution tracking, review, and export capabilities.",
            "",
            "## Notes",
            "- Review the extracted text before relying on this draft.",
            "- Replace the stub executor with a real Claude Code style executor in the next phase.",
            "",
            "## Sources",
            "\n".join(source_snippets),
        ]
    )


def _build_artifact(
    store: JsonStore,
    case: dict,
    task: TaskRecord,
    documents: list[DocumentRecord],
    content: str | None = None,
) -> ArtifactRecord:
    artifact_content = content or _build_default_content(case, task, documents)
    output_dir = store.ensure_case_subdir(case["case_code"], "10 - Reports")
    file_path = output_dir / f"{task.title}.md"
    file_path.write_text(artifact_content, encoding="utf-8")

    return ArtifactRecord(
        id=store.next_id("artifact"),
        case_id=task.case_id,
        source_task_id=task.id,
        artifact_type=task.task_type,
        title=task.title,
        content=artifact_content,
        file_path=str(file_path),
        review_status="waiting_review",
    )


class LocalExecutionAdapter:
    mode = "local_adapter"

    def __init__(self, store: JsonStore):
        self.store = store

    def submit(self, case: dict, task: TaskRecord, documents: list[DocumentRecord]) -> tuple[TaskRecord, ArtifactRecord | None]:
        logs = [f"{utc_now()} accepted by local executor", f"{utc_now()} task is running"]
        running = task.model_copy(
            update={
                "status": "running",
                "execution_mode": self.mode,
                "external_task_id": f"local-{task.id}",
                "logs": logs,
                "updated_at": utc_now(),
            }
        )

        if not documents:
            failed = running.model_copy(
                update={
                    "status": "failed",
                    "error_message": "No documents were selected for this task.",
                    "logs": running.logs + [f"{utc_now()} task failed because no source documents were provided"],
                    "updated_at": utc_now(),
                }
            )
            return failed, None

        artifact = _build_artifact(self.store, case, running, documents)
        completed = running.model_copy(
            update={
                "status": "completed",
                "artifact_ids": [artifact.id],
                "error_message": "",
                "logs": running.logs + [f"{utc_now()} task completed and artifact {artifact.id} was created"],
                "updated_at": utc_now(),
            }
        )
        return completed, artifact

    def sync(self, case: dict, task: TaskRecord, documents: list[DocumentRecord]) -> tuple[TaskRecord, ArtifactRecord | None]:
        return task, None

    def cancel(self, task: TaskRecord) -> TaskRecord:
        if task.status in {"completed", "failed", "canceled"}:
            return task
        return task.model_copy(
            update={
                "status": "canceled",
                "logs": task.logs + [f"{utc_now()} cancellation requested on local executor"],
                "updated_at": utc_now(),
            }
        )


class ExternalStubExecutionAdapter:
    def __init__(self, store: JsonStore, mode: str, auto_complete: bool):
        self.store = store
        self.mode = mode
        self.auto_complete = auto_complete

    def submit(self, case: dict, task: TaskRecord, documents: list[DocumentRecord]) -> tuple[TaskRecord, ArtifactRecord | None]:
        logs = [f"{utc_now()} submitted to {self.mode}", f"{utc_now()} task is queued in external executor"]
        if not documents:
            failed = task.model_copy(
                update={
                    "status": "failed",
                    "execution_mode": self.mode,
                    "external_task_id": f"external-{task.id}",
                    "error_message": "No documents were selected for this task.",
                    "logs": logs + [f"{utc_now()} task failed before dispatch because no source documents were provided"],
                    "updated_at": utc_now(),
                }
            )
            return failed, None

        running = task.model_copy(
            update={
                "status": "running",
                "execution_mode": self.mode,
                "external_task_id": f"external-{task.id}",
                "logs": logs,
                "updated_at": utc_now(),
            }
        )
        return running, None

    def sync(self, case: dict, task: TaskRecord, documents: list[DocumentRecord]) -> tuple[TaskRecord, ArtifactRecord | None]:
        if task.status != "running":
            return task, None
        if not self.auto_complete:
            return task.model_copy(
                update={"logs": task.logs + [f"{utc_now()} status polled: still running"], "updated_at": utc_now()}
            ), None

        artifact = _build_artifact(self.store, case, task, documents)
        completed = task.model_copy(
            update={
                "status": "completed",
                "artifact_ids": [artifact.id],
                "logs": task.logs + [f"{utc_now()} external executor returned completed result"],
                "updated_at": utc_now(),
            }
        )
        return completed, artifact

    def cancel(self, task: TaskRecord) -> TaskRecord:
        if task.status in {"completed", "failed", "canceled"}:
            return task
        return task.model_copy(
            update={
                "status": "canceled",
                "logs": task.logs + [f"{utc_now()} cancel requested in external executor"],
                "updated_at": utc_now(),
            }
        )


class CommandRunnerExecutionAdapter:
    def __init__(self, store: JsonStore, mode: str, command: str):
        self.store = store
        self.mode = mode
        self.command = command

    def submit(self, case: dict, task: TaskRecord, documents: list[DocumentRecord]) -> tuple[TaskRecord, ArtifactRecord | None]:
        logs = [f"{utc_now()} submitted to {self.mode}"]
        if not documents:
            failed = task.model_copy(
                update={
                    "status": "failed",
                    "execution_mode": self.mode,
                    "external_task_id": f"{self.mode}-{task.id}",
                    "error_message": "No documents were selected for this task.",
                    "logs": logs + [f"{utc_now()} task failed before dispatch because no source documents were provided"],
                    "updated_at": utc_now(),
                }
            )
            return failed, None
        if not self.command:
            failed = task.model_copy(
                update={
                    "status": "failed",
                    "execution_mode": self.mode,
                    "external_task_id": f"{self.mode}-{task.id}",
                    "error_message": "No external command is configured for this executor.",
                    "logs": logs + [f"{utc_now()} executor command is missing"],
                    "updated_at": utc_now(),
                }
            )
            return failed, None
        running = task.model_copy(
            update={
                "status": "running",
                "execution_mode": self.mode,
                "external_task_id": f"{self.mode}-{task.id}",
                "logs": logs + [f"{utc_now()} task queued for external command"],
                "updated_at": utc_now(),
            }
        )
        return running, None

    def sync(self, case: dict, task: TaskRecord, documents: list[DocumentRecord]) -> tuple[TaskRecord, ArtifactRecord | None]:
        if task.status != "running":
            return task, None
        payload = json.dumps(
            {
                "case": case,
                "task": task.model_dump(),
                "documents": [document.model_dump() for document in documents],
            },
            ensure_ascii=False,
        )
        try:
            result = subprocess.run(
                self.command,
                input=payload,
                text=True,
                capture_output=True,
                shell=True,
                check=False,
            )
        except Exception as exc:
            failed = task.model_copy(
                update={
                    "status": "failed",
                    "error_message": f"External executor invocation failed: {exc}",
                    "logs": task.logs + [f"{utc_now()} external command invocation raised an exception"],
                    "updated_at": utc_now(),
                }
            )
            return failed, None

        if result.returncode != 0:
            stderr = (result.stderr or "").strip() or "Unknown external executor error"
            failed = task.model_copy(
                update={
                    "status": "failed",
                    "error_message": stderr,
                    "logs": task.logs + [f"{utc_now()} external command failed with exit code {result.returncode}"],
                    "updated_at": utc_now(),
                }
            )
            return failed, None

        output = (result.stdout or "").strip()
        artifact = _build_artifact(self.store, case, task, documents, content=output or "# Empty result")
        completed = task.model_copy(
            update={
                "status": "completed",
                "artifact_ids": [artifact.id],
                "logs": task.logs + [f"{utc_now()} external command completed successfully"],
                "updated_at": utc_now(),
            }
        )
        return completed, artifact

    def cancel(self, task: TaskRecord) -> TaskRecord:
        if task.status in {"completed", "failed", "canceled"}:
            return task
        return task.model_copy(
            update={
                "status": "canceled",
                "logs": task.logs + [f"{utc_now()} cancel requested before external command execution"],
                "updated_at": utc_now(),
            }
        )
