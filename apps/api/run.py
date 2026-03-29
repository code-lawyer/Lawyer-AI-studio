"""PyInstaller entry point for the SuitAgent API server."""

import sys
from pathlib import Path

import uvicorn

from app.main import create_app


def main() -> None:
    # When bundled, resolve data_root relative to executable
    if getattr(sys, "frozen", False):
        base = Path(sys.executable).parent
    else:
        base = Path(__file__).parent

    data_root = base / "data"
    workflows_dir = base / "workflows"

    app = create_app(
        data_root=data_root,
        workflows_dir=workflows_dir,
        executor_mode="claude_cli",
    )

    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()
