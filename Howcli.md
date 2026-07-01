
## How the CLI Is Currently Implemented

Here's the complete picture of the terminal CLI:

```
cli/
├── cognee_cli.py     ← Single-file CLI (142 lines, typer-based)
└── requirements.txt  ← requests, typer, rich (3 deps)

pyproject.toml        ← Entry point: dev-context = "cli.cognee_cli:app"
```


### Full Command Map[^1]

| Command | Trigger | What happens |
| :-- | :-- | :-- |
| `dev-context watch` | Manual | Spawns `script -q .devcontext.log` (POSIX) or `Start-Transcript` (Windows) to record terminal output into a local log file |
| `dev-context stop` | Manual | Reads `.devcontext.log` → POSTs entire content to `/api/ingest/` → deletes log file |
| `dev-context ingest --text "..."` | Manual / pipe | Accepts text directly or via stdin pipe → POSTs to `/api/ingest/` |
| `dev-context recall "query"` | Manual | POSTs query to `/api/recall/` → prints results with scores to terminal |
| `dev-context forget <session_id>` | Manual | DELETEs session from Cognee via `/api/forget/<id>` |

### What Happens on the Backend When CLI Sends Data[^2]

```
CLI POST /api/ingest/
  → verify_safe_input() (prompt injection guard)
  → encrypt terminal_output if BYOK key provided
  → create SessionRecord in DB (status="queued")
  → background_tasks: process_ingest(session_id, payload)
      → cognee.add() + cognee.cognify() (async)
```


### The Core Architecture Problem

The `watch`/`stop` model is **fundamentally broken for real use**. Here's why:

1. `watch` spawns the `script` command which records a **child shell** — the developer must work inside that child shell for recording to work
2. `stop` reads the entire log at once and dumps it as a blob — no chunking, no structure, no context tagging
3. **Zero automation** — every single operation requires the developer to manually type a command
4. The `script` command on macOS has different flags than Linux, and Windows PowerShell transcripts have a completely different format — the cross-platform logic is fragile
5. `API_URL` is **hardcoded to `http://localhost:8000/api`** — no config file, no env var override[^3]

***

## Current Weaknesses at a Glance

| Problem | Severity |
| :-- | :-- |
| `API_URL = "http://localhost:8000/api"` hardcoded | 🔴 High |
| `watch`/`stop` requires child shell — developers can't use their normal shell | 🔴 High |
| No `improve()` / feedback command | 🔴 High (missing lifecycle) |
| No session distillation trigger | 🔴 High |
| Entire terminal dump sent as one blob — no chunking or tagging | 🟠 Medium |
| No config file — API key, URL, settings have nowhere to persist | 🟠 Medium |
| No `status` command — no way to know if backend is alive | 🟡 Medium |
| No `git` context auto-detection beyond branch name | 🟡 Medium |
| No streaming recall output — waits for full response | 🟡 Low |
| No shell completion | 🟡 Low |


***

## Improvements \& Full Implementation Steps

### 1. Fix Config System — Replace Hardcoded `API_URL`

**First thing to fix.** Currently `API_URL = "http://localhost:8000/api"` is on line 9. Anyone using Cognee Cloud or a remote backend can't use the CLI at all.[^3]

**Implement `~/.devcontext/config.json`:**

```python
# cli/config.py  ← NEW FILE
import json
import os
from pathlib import Path

CONFIG_DIR = Path.home() / ".devcontext"
CONFIG_FILE = CONFIG_DIR / "config.json"

DEFAULTS = {
    "api_url": "http://localhost:8000/api",
    "api_key": None,
    "auto_ingest_on_error": True,
    "watch_chunk_interval_seconds": 30,
    "recall_top_k": 5,
}

def load_config() -> dict:
    CONFIG_DIR.mkdir(exist_ok=True)
    if not CONFIG_FILE.exists():
        save_config(DEFAULTS)
        return DEFAULTS.copy()
    with open(CONFIG_FILE) as f:
        return {**DEFAULTS, **json.load(f)}

def save_config(cfg: dict):
    CONFIG_DIR.mkdir(exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)
```

**Add `dev-context config` command:**

```python
@app.command()
def config(
    api_url: Optional[str] = typer.Option(None, help="Backend URL"),
    api_key: Optional[str] = typer.Option(None, help="Cognee API key"),
    show: bool = typer.Option(False, "--show", help="Print current config"),
):
    """Configure dev-context CLI settings"""
    cfg = load_config()
    if show:
        typer.echo(json.dumps(cfg, indent=2))
        return
    if api_url: cfg["api_url"] = api_url
    if api_key: cfg["api_key"] = api_key
    save_config(cfg)
    typer.secho("✓ Config saved", fg=typer.colors.GREEN)
```


***

### 2. Replace `watch`/`stop` with a Proper Background Daemon

**The Problem:** `watch` requires a child shell. Nobody will use this in real work.

**The Fix:** A proper background file watcher daemon that monitors the shell's history file and the project directory simultaneously, running silently in the background.

**New `dev-context start` / `dev-context end` commands:**

```python
# cli/daemon.py  ← NEW FILE
import asyncio
import time
import os
import json
import signal
from pathlib import Path
from watchfiles import awatch, Change

DAEMON_PID_FILE = Path.home() / ".devcontext" / "daemon.pid"
DAEMON_LOG = Path.home() / ".devcontext" / "session.jsonl"

async def watch_and_collect(api_url: str, api_key: str, project_dir: str):
    """
    Watches shell history + project dir for changes.
    Sends structured chunks to backend every 30 seconds or on significant change.
    """
    buffer = []
    last_flush = time.time()
    
    async for changes in awatch(project_dir, watch_filter=should_track):
        for change_type, path in changes:
            entry = {
                "path": os.path.relpath(path, project_dir),
                "change": change_type.name,  # added/modified/deleted
                "timestamp": time.time(),
            }
            buffer.append(entry)
        
        # Flush every 30s or when buffer hits 20 entries
        if time.time() - last_flush > 30 or len(buffer) >= 20:
            await flush_buffer(buffer, api_url, api_key, project_dir)
            buffer.clear()
            last_flush = time.time()
```

```python
# In cognee_cli.py
@app.command()
def start(
    dir: str = typer.Argument(".", help="Project directory to watch"),
):
    """Start a dev-context memory session (background daemon)"""
    cfg = load_config()
    
    if DAEMON_PID_FILE.exists():
        typer.secho("⚠ Session already running. Run 'dev-context end' first.", 
                    fg=typer.colors.YELLOW)
        raise typer.Exit(1)
    
    # Fork to background
    pid = os.fork()
    if pid > 0:
        # Parent: write PID and exit
        DAEMON_PID_FILE.write_text(str(pid))
        project = os.path.basename(os.path.abspath(dir))
        typer.secho(f"✓ Session started for '{project}' (PID {pid})", 
                    fg=typer.colors.GREEN)
        typer.echo("  Run 'dev-context end' to stop and distill learnings")
        return
    
    # Child: run the async watcher
    asyncio.run(watch_and_collect(cfg["api_url"], cfg["api_key"], dir))

@app.command()
def end(
    distill: bool = typer.Option(True, help="Distill session learnings into permanent memory"),
):
    """End session and optionally distill learnings into Cognee graph"""
    if not DAEMON_PID_FILE.exists():
        typer.secho("No active session found.", fg=typer.colors.YELLOW)
        raise typer.Exit(1)
    
    pid = int(DAEMON_PID_FILE.read_text())
    os.kill(pid, signal.SIGTERM)
    DAEMON_PID_FILE.unlink()
    
    if distill:
        cfg = load_config()
        with typer.progressbar(length=3, label="Distilling session learnings") as progress:
            resp = requests.post(f"{cfg['api_url']}/session/end", 
                                 json={"trigger_distillation": True},
                                 headers=_auth_headers(cfg))
            progress.update(3)
        typer.secho("✓ Session distilled into permanent memory", fg=typer.colors.GREEN)
```

This means `dev-context start` → background process silently watches → `dev-context end` → learnings distilled via `session_distillation`. **No child shell. Works with the developer's normal terminal.**

***

### 3. Shell Error Auto-Capture Hook

**The most powerful CLI feature possible.** When a command exits with a non-zero status, automatically send that error + context to Cognee — zero manual effort.

**The developer adds one line to their `.bashrc` / `.zshrc`:**

```bash
# Add to ~/.zshrc or ~/.bashrc — dev-context installs this automatically
_devcontext_hook() {
    local exit_code=$?
    if [ $exit_code -ne 0 ] && command -v dev-context &>/dev/null; then
        # Capture the last command and its error
        local last_cmd=$(fc -ln -1 2>/dev/null || history 1 | sed 's/^ *[0-9]* *//')
        dev-context ingest --text "EXIT_CODE:$exit_code CMD:$last_cmd PWD:$(pwd)" \
                           --source "shell-error" --silent &
    fi
}
trap '_devcontext_hook' ERR
```

**The CLI auto-installs this hook with:**

```python
@app.command()
def install_hook(
    shell: str = typer.Option("auto", help="Shell type: bash/zsh/auto"),
):
    """Install shell error hook for automatic error capture"""
    # Detect shell, append hook to rc file
    shell_rc = Path.home() / ".zshrc"  # or .bashrc
    hook_line = 'eval "$(dev-context shell-hook)"'
    
    if hook_line not in shell_rc.read_text():
        with open(shell_rc, "a") as f:
            f.write(f"\n# dev-context memory hook\n{hook_line}\n")
        typer.secho(f"✓ Hook installed in {shell_rc}. Restart terminal to activate.", 
                    fg=typer.colors.GREEN)
```

From now on: every failed command is silently captured into Cognee. When the developer hits the same error pattern again, `recall` surfaces the solution instantly.

***

### 4. Add `improve` Command — Complete the Lifecycle

**Currently missing entirely.** This is a mandatory hackathon criterion.

```python
@app.command()
def improve(
    session_id: str = typer.Argument(..., help="Session ID to improve"),
    feedback: str = typer.Option(..., "--feedback", "-f", 
                                  prompt="What was useful about this memory?"),
    score: int = typer.Option(1, "--score", "-s", help="1=helpful, -1=not useful"),
):
    """Improve a recalled memory with your feedback"""
    cfg = load_config()
    resp = requests.post(
        f"{cfg['api_url']}/recall/feedback",
        json={"session_id": session_id, "feedback": feedback, "score": score},
        headers=_auth_headers(cfg)
    )
    if resp.status_code == 200:
        verb = "strengthened" if score > 0 else "flagged for review"
        typer.secho(f"✓ Memory {verb}", fg=typer.colors.GREEN)
    else:
        typer.secho(f"✗ Failed: {resp.text}", fg=typer.colors.RED)
```

**Also pipe-friendly:**

```bash
# Recall, then immediately improve the top result
dev-context recall "redis connection error" | dev-context improve --score 1 --feedback "this solved it"
```


***

### 5. Rich TUI Recall Output

**Currently `recall` just prints plain text.** With `rich` already in `requirements.txt`, give it a proper terminal UI:[^4]

```python
@app.command()
def recall(
    query: str = typer.Argument(...),
    top_k: int = typer.Option(5, "--top", "-n"),
    interactive: bool = typer.Option(False, "--interactive", "-i", 
                                      help="Interactive mode with feedback"),
):
    """Query Cognee memory for past context"""
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    
    cfg = load_config()
    console = Console()
    
    with console.status("[bold cyan]Searching memory...[/bold cyan]"):
        resp = requests.post(f"{cfg['api_url']}/recall",
                             json={"query": query, "top_k": top_k},
                             headers=_auth_headers(cfg))
    
    results = resp.json().get("results", [])
    
    if not results:
        console.print("[yellow]No memories found for this query.[/yellow]")
        return
    
    for i, r in enumerate(results, 1):
        score_color = "green" if r["score"] > 0.8 else "yellow" if r["score"] > 0.5 else "red"
        panel = Panel(
            f"[dim]{r.get('source_file', 'unknown')}[/dim]\n\n{r['summary']}",
            title=f"[bold]#{i}[/bold] [{score_color}]{r['score']:.0%} match[/{score_color}]",
            subtitle=f"[dim]{r.get('timestamp', '')}[/dim]",
            border_style=score_color,
        )
        console.print(panel)
        
        # Interactive feedback
        if interactive:
            feedback = typer.confirm(f"  Was result #{i} helpful?")
            if feedback is not None:
                requests.post(f"{cfg['api_url']}/recall/feedback",
                              json={"qa_id": r["qa_id"], "score": 1 if feedback else -1},
                              headers=_auth_headers(cfg))
```