#!/usr/bin/env python3
"""
lm_code.py — Delegate coding tasks to a local LM Studio model.

Usage:
  python lm_code.py "Add a loading spinner to ProviderCard.tsx" src/components/ProviderCard.tsx
  python lm_code.py "Refactor usePractitioners hook to support pagination" src/hooks/usePractitioners.ts
  python lm_code.py --task-file task.txt src/pages/Directory.tsx src/components/SearchBar.tsx
  python lm_code.py --list-models

Environment:
  LM_HOST   — host where LM Studio is running (default: 192.168.64.1)
  LM_PORT   — LM Studio API port (default: 1234)
  LM_MODEL  — model to use (default: qwen/qwen3-coder-30b)
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error

# ── Config ─────────────────────────────────────────────────────────────────────

LM_HOST  = os.environ.get("LM_HOST",  "192.168.64.1")
LM_PORT  = os.environ.get("LM_PORT",  "1234")
LM_MODEL = os.environ.get("LM_MODEL", "qwen/qwen3-coder-30b")
BASE_URL = f"http://{LM_HOST}:{LM_PORT}/v1"

SYSTEM_PROMPT = """You are an expert TypeScript / React / Python developer working on the Aloha Health Hub project — a Hawaii holistic wellness directory built with React + Vite + TypeScript + Tailwind CSS + Supabase.

When asked to modify code:
1. Output ONLY the complete updated file contents — no commentary before or after.
2. Preserve all existing imports, types, and logic unless specifically asked to change them.
3. Do not add markdown code fences or language tags.
4. Keep Tailwind class names; do not switch to inline styles.
5. If multiple files need changes, output each file separated by a line like:
   === FILE: path/to/file.ts ===

When asked a question (not a code change), answer concisely without wrapping in code fences."""

# ── Helpers ────────────────────────────────────────────────────────────────────

def lm_request(endpoint: str, payload: dict) -> dict:
    url = f"{BASE_URL}/{endpoint}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read())
    except urllib.error.URLError as e:
        print(f"[lm_code] Connection error: {e}", file=sys.stderr)
        print(f"  Is LM Studio running at {BASE_URL}?", file=sys.stderr)
        sys.exit(1)


def list_models() -> None:
    url = f"{BASE_URL}/models"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    print("Available models:")
    for m in data.get("data", []):
        marker = " ◀ (current)" if m["id"] == LM_MODEL else ""
        print(f"  {m['id']}{marker}")


def read_files(paths: list[str]) -> str:
    """Read file contents and format them as context."""
    parts = []
    for path in paths:
        if not os.path.exists(path):
            print(f"[lm_code] Warning: file not found: {path}", file=sys.stderr)
            continue
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        parts.append(f"=== FILE: {path} ===\n{content}")
    return "\n\n".join(parts)


def build_user_message(task: str, file_contents: str) -> str:
    if file_contents:
        return f"Task: {task}\n\nCurrent file(s):\n\n{file_contents}"
    return f"Task: {task}"


def call_model(task: str, file_contents: str) -> str:
    payload = {
        "model": LM_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_message(task, file_contents)},
        ],
        "temperature": 0.2,
        "max_tokens": 8192,
    }
    print(f"[lm_code] Sending to {LM_MODEL}…", file=sys.stderr)
    result = lm_request("chat/completions", payload)
    return result["choices"][0]["message"]["content"]


def write_output(response: str, input_paths: list[str]) -> None:
    """
    Parse model output and write files back.
    If output has === FILE: ... === separators, write each section to its path.
    Otherwise, if exactly one input file was given, overwrite it.
    """
    sections = []
    if "=== FILE:" in response:
        parts = response.split("=== FILE:")
        for part in parts[1:]:
            lines = part.strip().split("\n")
            path = lines[0].strip().rstrip(" ===")
            content = "\n".join(lines[1:]).lstrip("\n")
            sections.append((path, content))
    elif len(input_paths) == 1:
        # Strip a bare filename header the model sometimes emits as line 1
        # e.g. "src/pages/Directory.tsx\nimport ..."
        lines = response.split("\n")
        if lines and lines[0].strip() == input_paths[0].strip():
            response = "\n".join(lines[1:]).lstrip("\n")
        # Also strip markdown code fences if present
        response = response.strip()
        if response.startswith("```"):
            response = "\n".join(response.split("\n")[1:])
            if response.endswith("```"):
                response = response[: response.rfind("```")]
            response = response.strip()
        sections = [(input_paths[0], response)]

    if not sections:
        # No structured output — just print the response
        print(response)
        return

    for path, content in sections:
        os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[lm_code] ✓ Wrote {path} ({len(content)} chars)")


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Delegate coding tasks to a local LM Studio model."
    )
    parser.add_argument("task", nargs="?", help="Task description (or use --task-file)")
    parser.add_argument("files", nargs="*", help="Source files to include as context")
    parser.add_argument("--task-file", help="Read task description from a file")
    parser.add_argument("--list-models", action="store_true", help="List available models")
    parser.add_argument(
        "--print-only", action="store_true",
        help="Print model output without writing files"
    )
    parser.add_argument(
        "--model", default=LM_MODEL,
        help=f"Model ID to use (default: {LM_MODEL})"
    )
    args = parser.parse_args()

    if args.model != LM_MODEL:
        os.environ["LM_MODEL"] = args.model
        globals()["LM_MODEL"] = args.model

    if args.list_models:
        list_models()
        return

    # Resolve task
    if args.task_file:
        with open(args.task_file, "r") as f:
            task = f.read().strip()
    elif args.task:
        task = args.task
    else:
        parser.print_help()
        sys.exit(1)

    file_contents = read_files(args.files) if args.files else ""
    response = call_model(task, file_contents)

    if args.print_only or not args.files:
        print(response)
    else:
        write_output(response, args.files)


if __name__ == "__main__":
    main()
