from __future__ import annotations

import importlib.util
from pathlib import Path


class DocumentProcessor:
    def __init__(self) -> None:
        self.repo_root = Path(__file__).resolve().parents[3]

    def extract(self, file_name: str, content: bytes, temp_output_dir: Path) -> str:
        suffix = Path(file_name).suffix.lower()
        if suffix == ".txt":
            body = content.decode("utf-8", errors="ignore")
            return f"# Extracted text\n\n{body}\n"
        if suffix == ".pdf":
            return self._extract_pdf(file_name, content, temp_output_dir)
        return (
            "# Extracted text\n\n"
            f"Preview extraction for `{suffix or 'unknown'}` files is not implemented in the MVP.\n"
            "The original file has been stored and can still be attached to tasks.\n"
        )

    def _extract_pdf(self, file_name: str, content: bytes, temp_output_dir: Path) -> str:
        tool_path = self.repo_root / ".claude" / "tools" / "pdf_processor.py"
        if not tool_path.exists():
            return "# Extracted text\n\nPDF extraction tool is not available in this workspace.\n"

        temp_pdf_path = temp_output_dir / file_name
        temp_pdf_path.write_bytes(content)

        try:
            spec = importlib.util.spec_from_file_location("suitagent_pdf_processor", tool_path)
            if spec is None or spec.loader is None:
                raise RuntimeError("Failed to load PDF processor module")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            text, _stats = module.extract_pdf_text(str(temp_pdf_path), None)
            if text:
                return f"# Extracted text\n\n{text}\n"
        except Exception as exc:
            return (
                "# Extracted text\n\n"
                "The PDF processor raised an exception and the extracted text preview is unavailable.\n\n"
                f"Error: {exc}"
            )
        return "# Extracted text\n\nThe PDF file was stored, but no text could be extracted.\n"
