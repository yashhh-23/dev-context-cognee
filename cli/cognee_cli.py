import sys
import subprocess
import requests
import os
from datetime import datetime, timezone
import typer
from typing import Optional

API_URL = "http://localhost:8000/api"

app = typer.Typer(help="CLI for dev-context-cognee memory management.")

def get_git_branch():
    try:
        branch = subprocess.check_output(["git", "branch", "--show-current"], stderr=subprocess.DEVNULL)
        return branch.decode("utf-8").strip()
    except Exception:
        return "unknown_branch"

def get_project_name():
    return os.path.basename(os.getcwd())

@app.command()
def ingest(text: Optional[str] = typer.Option(None, help="Text to ingest directly")):
    """Ingest terminal output (via pipe) or text into Cognee memory"""
    terminal_output = text
    
    if not terminal_output and not sys.stdin.isatty():
        terminal_output = sys.stdin.read()
        
    if not terminal_output or not terminal_output.strip():
        typer.secho("No input provided. Please pipe text or provide --text.", fg=typer.colors.RED)
        raise typer.Exit(1)

    project_name = get_project_name()
    branch_name = get_git_branch()

    payload = {
        "project": project_name,
        "branch": branch_name,
        "terminal_output": terminal_output,
        "tags": ["cli-ingest"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    try:
        response = requests.post(f"{API_URL}/ingest/", json=payload)
        if response.status_code == 200:
            typer.secho(f"[SUCCESS] Successfully ingested to Cognee! Session ID: {response.json().get('session_id')}", fg=typer.colors.GREEN)
        else:
            typer.secho(f"[ERROR] Failed to ingest. Status code: {response.status_code}", fg=typer.colors.RED)
            typer.echo(response.text)
    except Exception as e:
        typer.secho(f"[ERROR] Connection error: {e}", fg=typer.colors.RED)

@app.command()
def recall(query: str):
    """Query Cognee memory for past context"""
    try:
        response = requests.get(f"{API_URL}/recall/", params={"q": query})
        if response.status_code == 200:
            results = response.json()
            if not results:
                typer.echo("No matching memories found.")
                return
            for idx, res in enumerate(results, 1):
                typer.secho(f"[{idx}] (Score: {res.get('score', 0):.2f})", fg=typer.colors.CYAN)
                typer.echo(res.get('content', '').strip())
                typer.echo("-" * 40)
        else:
            typer.secho(f"[ERROR] Failed to recall. Status code: {response.status_code}", fg=typer.colors.RED)
    except Exception as e:
        typer.secho(f"[ERROR] Connection error: {e}", fg=typer.colors.RED)

@app.command()
def forget(session_id: str):
    """Delete a memory session from Cognee"""
    try:
        response = requests.delete(f"{API_URL}/forget/{session_id}")
        if response.status_code == 200:
            typer.secho(f"[SUCCESS] Session {session_id} forgotten.", fg=typer.colors.GREEN)
        else:
            typer.secho(f"[ERROR] Failed to forget session. Status code: {response.status_code}", fg=typer.colors.RED)
            typer.echo(response.text)
    except Exception as e:
        typer.secho(f"[ERROR] Connection error: {e}", fg=typer.colors.RED)

@app.command()
def watch():
    """Starts capturing terminal output to a log file"""
    log_file = os.path.join(os.getcwd(), ".devcontext.log")
    if os.name == 'nt':
        typer.secho(f"Starting PowerShell transcript to {log_file}...", fg=typer.colors.CYAN)
        typer.secho("Type 'exit' to stop the session, then run 'dev-context stop' to ingest.", fg=typer.colors.YELLOW)
        # Spawn a powershell with transcript
        subprocess.run(["powershell", "-NoExit", "-Command", f"Start-Transcript -Path '{log_file}'"])
    else:
        typer.secho(f"Starting script capture to {log_file}...", fg=typer.colors.CYAN)
        typer.secho("Type 'exit' to stop the session, then run 'dev-context stop' to ingest.", fg=typer.colors.YELLOW)
        os.system(f"script -q {log_file}")

@app.command()
def stop():
    """Stops capturing and ingests the session from the log file"""
    log_file = os.path.join(os.getcwd(), ".devcontext.log")
    if not os.path.exists(log_file):
        typer.secho("No active session log found (.devcontext.log). Run 'dev-context watch' first.", fg=typer.colors.RED)
        raise typer.Exit(1)
    
    with open(log_file, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    
    typer.secho("Ingesting captured session...", fg=typer.colors.CYAN)
    
    # Process the content using the ingest logic
    project_name = get_project_name()
    branch_name = get_git_branch()
    
    payload = {
        "project": project_name,
        "branch": branch_name,
        "terminal_output": content,
        "tags": ["cli-watch"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    try:
        response = requests.post(f"{API_URL}/ingest/", json=payload)
        if response.status_code == 200:
            typer.secho(f"[SUCCESS] Successfully ingested watched session! Session ID: {response.json().get('session_id')}", fg=typer.colors.GREEN)
            try:
                os.remove(log_file)
                typer.echo("Cleaned up log file.")
            except Exception:
                pass
        else:
            typer.secho(f"[ERROR] Failed to ingest session. Status: {response.status_code}", fg=typer.colors.RED)
    except Exception as e:
        typer.secho(f"[ERROR] Connection error: {e}", fg=typer.colors.RED)

if __name__ == "__main__":
    app()
