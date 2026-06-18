#!/usr/bin/env python3
"""Ensure Fast Top-3 knowledge-retrieval includes FOIA + tenant datasets.

Run on Dify host (75.127.14.185):
  python3 patch-fast-top-3-kb-dify.py
"""
from __future__ import annotations

import json
import subprocess
import sys

APP_ID = "b0399663-f1c1-49a7-949e-ee04effb71a3"
FOIA_DATASET = "dcbc8963-82b5-488c-93b6-22e7fe62fcf1"
LIVE_DATASET_IDS = [
    "ed26b332-6c6e-4fa4-9eb3-eafa512e88bf",
    "015cd9ba-bd43-46d0-a03c-2b4036a291b5",
    FOIA_DATASET,
    "9b118c06-7dcd-4913-a340-9d48c72b8e47",
]


def psql_json(query: str):
    raw = subprocess.check_output(
        ["docker", "exec", "dify-db_postgres-1", "psql", "-U", "postgres", "-d", "dify", "-t", "-A", "-c", query],
        text=True,
    )
    return json.loads(raw)


def psql_exec(sql: str):
    subprocess.check_call(
        ["docker", "exec", "dify-db_postgres-1", "psql", "-U", "postgres", "-d", "dify", "-c", sql],
    )


def workflow_ids() -> list[str]:
    raw = subprocess.check_output(
        [
            "docker",
            "exec",
            "dify-db_postgres-1",
            "psql",
            "-U",
            "postgres",
            "-d",
            "dify",
            "-t",
            "-A",
            "-c",
            f"SELECT id FROM workflows WHERE app_id = '{APP_ID}' ORDER BY created_at DESC LIMIT 2;",
        ],
        text=True,
    )
    return [line.strip() for line in raw.splitlines() if line.strip()]


def patch_graph(graph: dict) -> bool:
    changed = False
    for node in graph.get("nodes", []):
        if node.get("data", {}).get("type") != "knowledge-retrieval":
            continue
        existing = list(node["data"].get("dataset_ids") or [])
        merged = list(dict.fromkeys(existing + LIVE_DATASET_IDS))
        if merged != existing:
            node["data"]["dataset_ids"] = merged
            changed = True
        print(f"  dataset_ids={merged}")
    return changed


def main() -> int:
    ids = workflow_ids()
    if not ids:
        print(f"No workflows for app {APP_ID}", file=sys.stderr)
        return 1
    for wid in ids:
        graph = psql_json(f"SELECT graph::json FROM workflows WHERE id = '{wid}';")
        print(f"workflow {wid}")
        if not patch_graph(graph):
            print("  skip (already wired)")
            continue
        payload = json.dumps(graph).replace("'", "''")
        psql_exec(f"UPDATE workflows SET graph = '{payload}'::json WHERE id = '{wid}';")
        print("  patched")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
