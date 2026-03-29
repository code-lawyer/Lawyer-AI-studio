import json
import sys


def main() -> int:
    payload = json.loads(sys.stdin.read() or "{}")
    task_title = payload.get("task", {}).get("title", "unknown task")
    case_code = payload.get("case", {}).get("case_code", "unknown case")
    print(f"# MOCK EXECUTOR RESULT\n\nExecuted {task_title} for {case_code}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
