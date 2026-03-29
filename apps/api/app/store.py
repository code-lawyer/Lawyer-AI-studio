from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable, List
from uuid import uuid4


CASE_FOLDERS = [
    "00 - Calendar",
    "01 - Engagement",
    "02 - Case Analysis",
    "03 - Legal Research",
    "04 - Evidence",
    "05 - Opposing Materials",
    "06 - Court Filings",
    "07 - Hearing Notes",
    "08 - Client Communications",
    "09 - Work Notes",
    "10 - Reports",
    "11 - Templates",
]

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


class JsonStore:
    """SQLite-backed store that preserves the original collection-style API."""

    def __init__(self, root: Path):
        self.root = root
        self.data_dir = self.root / "data"
        self.files_dir = self.root / "files"
        self.db_path = self.data_dir / "workspace.sqlite3"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.files_dir.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            for name in TABLES:
                connection.execute(
                    f"""
                    CREATE TABLE IF NOT EXISTS {name} (
                        id TEXT PRIMARY KEY,
                        payload TEXT NOT NULL
                    )
                    """
                )
            connection.commit()

    def _read_rows(self, name: str) -> List[Dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(f"SELECT payload FROM {name}").fetchall()
        return [json.loads(row["payload"]) for row in rows]

    def list(self, name: str) -> List[Dict[str, Any]]:
        return self._read_rows(name)

    def create(self, name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._connect() as connection:
            connection.execute(
                f"INSERT OR REPLACE INTO {name} (id, payload) VALUES (?, ?)",
                (payload["id"], json.dumps(payload, ensure_ascii=False)),
            )
            connection.commit()
        return payload

    def update(self, name: str, item_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._connect() as connection:
            result = connection.execute(
                f"UPDATE {name} SET payload = ? WHERE id = ?",
                (json.dumps(payload, ensure_ascii=False), item_id),
            )
            connection.commit()
        if result.rowcount == 0:
            raise KeyError(item_id)
        return payload

    def get(self, name: str, item_id: str) -> Dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(f"SELECT payload FROM {name} WHERE id = ?", (item_id,)).fetchone()
        return json.loads(row["payload"]) if row else None

    def filter_by(self, name: str, **conditions: str) -> List[Dict[str, Any]]:
        items = self._read_rows(name)
        return [
            item
            for item in items
            if all(item.get(field) == value for field, value in conditions.items())
        ]

    def next_id(self, prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:10]}"

    def ensure_case_workspace(self, case_code: str) -> Path:
        workspace = self.files_dir / case_code
        workspace.mkdir(parents=True, exist_ok=True)
        for folder in CASE_FOLDERS:
            (workspace / folder).mkdir(parents=True, exist_ok=True)
        return workspace

    def ensure_case_subdir(self, case_code: str, folder: str) -> Path:
        workspace = self.ensure_case_workspace(case_code)
        target = workspace / folder
        target.mkdir(parents=True, exist_ok=True)
        return target

    def exists(self, name: str, item_id: str) -> bool:
        return self.get(name, item_id) is not None
