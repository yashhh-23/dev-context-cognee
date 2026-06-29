import sys
import subprocess
import requests
import os
from datetime import datetime, timezone

API_URL = "http://localhost:8000/api/ingest/"

def get_git_branch():
    try:
        branch = subprocess.check_output(["git", "branch", "--show-current"], stderr=subprocess.DEVNULL)
        return branch.decode("utf-8").strip()
    except Exception:
        return "unknown_branch"

def main():
    if sys.stdin.isatty():
        print("Please pipe terminal output to this script. e.g. echo 'text' | python cognee_cli.py")
        sys.exit(1)

    terminal_output = sys.stdin.read()
    if not terminal_output.strip():
        print("No input provided.")
        sys.exit(1)

    project_name = os.path.basename(os.getcwd())
    branch_name = get_git_branch()

    payload = {
        "project": project_name,
        "branch": branch_name,
        "terminal_output": terminal_output,
        "tags": ["cli-ingest"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    try:
        # Ingest accepts trailing slash or no trailing slash, but our route is POST /ingest/
        response = requests.post(API_URL, json=payload)
        if response.status_code == 200:
            print(f"[SUCCESS] Successfully ingested to Cognee! Session ID: {response.json().get('session_id')}")
        else:
            print(f"[ERROR] Failed to ingest. Status code: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"[ERROR] Connection error: {e}")

if __name__ == "__main__":
    main()
