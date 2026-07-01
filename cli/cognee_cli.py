import sys
import subprocess
import requests
import os
import json
import signal
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import typer

from cli.config import load_config, save_config, get_auth_headers

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
    typer.secho("[SUCCESS] Config saved", fg=typer.colors.GREEN)

@app.command()
def start(
    dir: str = typer.Argument(".", help="Project directory to watch"),
):
    """Start a dev-context memory session (background daemon)"""
    cfg = load_config()
    from cli.daemon import DAEMON_PID_FILE, DAEMON_INFO_FILE
    
    if DAEMON_PID_FILE.exists():
        typer.secho("⚠ Session already running. Run 'dev-context end' first.", 
                    fg=typer.colors.YELLOW)
        raise typer.Exit(1)
    
    daemon_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "daemon.py")
    api_key = cfg.get("api_key") or "NONE"
    
    if os.name == 'nt':
        CREATE_NO_WINDOW = 0x08000000
        subprocess.Popen([sys.executable, daemon_script, cfg["api_url"], api_key, dir], 
                         creationflags=CREATE_NO_WINDOW)
    else:
        pid = os.fork()
        if pid > 0:
            project = os.path.basename(os.path.abspath(dir))
            typer.secho(f"[SUCCESS] Session started for '{project}' (PID {pid})", 
                        fg=typer.colors.GREEN)
            typer.echo("  Run 'dev-context end' to stop and distill learnings")
            return
        
        import asyncio
        from cli.daemon import watch_and_collect
        DAEMON_PID_FILE.parent.mkdir(exist_ok=True)
        DAEMON_PID_FILE.write_text(str(os.getpid()))
        DAEMON_INFO_FILE.write_text(json.dumps({
            "pid": os.getpid(),
            "project_dir": os.path.abspath(dir),
            "start_time": datetime.now().isoformat()
        }))
        try:
            asyncio.run(watch_and_collect(cfg["api_url"], api_key, dir))
        finally:
            if DAEMON_PID_FILE.exists():
                DAEMON_PID_FILE.unlink()
            if DAEMON_INFO_FILE.exists():
                DAEMON_INFO_FILE.unlink()
        sys.exit(0)
    
    project = os.path.basename(os.path.abspath(dir))
    typer.secho(f"[SUCCESS] Session started for '{project}'", fg=typer.colors.GREEN)
    typer.echo("  Run 'dev-context end' to stop and distill learnings")

@app.command()
def status():
    """Check if the background daemon is running"""
    from cli.daemon import DAEMON_PID_FILE, DAEMON_INFO_FILE
    if not DAEMON_PID_FILE.exists() or not DAEMON_INFO_FILE.exists():
        typer.secho("No active session running.", fg=typer.colors.YELLOW)
        return
    
    try:
        info = json.loads(DAEMON_INFO_FILE.read_text())
        typer.secho(f"[SUCCESS] Session ACTIVE", fg=typer.colors.GREEN, bold=True)
        typer.echo(f"  PID: {info.get('pid')}")
        typer.echo(f"  Project Dir: {info.get('project_dir')}")
        typer.echo(f"  Started: {info.get('start_time')}")
    except Exception:
        typer.secho("Session info file corrupted.", fg=typer.colors.RED)

@app.command()
def end(
    distill: bool = typer.Option(True, help="Distill session learnings into permanent memory"),
):
    """End session and optionally distill learnings into Cognee graph"""
    from cli.daemon import DAEMON_PID_FILE, DAEMON_INFO_FILE
    if not DAEMON_PID_FILE.exists():
        typer.secho("No active session found.", fg=typer.colors.YELLOW)
        raise typer.Exit(1)
    
    pid = int(DAEMON_PID_FILE.read_text())
    try:
        if os.name == 'nt':
            subprocess.run(["taskkill", "/F", "/PID", str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            os.kill(pid, signal.SIGTERM)
    except Exception:
        pass
    
    if DAEMON_PID_FILE.exists():
        DAEMON_PID_FILE.unlink()
    if DAEMON_INFO_FILE.exists():
        DAEMON_INFO_FILE.unlink()
    
    if distill:
        cfg = load_config()
        with typer.progressbar(length=1, label="Distilling session learnings") as progress:
            try:
                requests.post(f"{cfg['api_url']}/session/end", 
                              json={"trigger_distillation": True},
                              headers=get_auth_headers(cfg), timeout=30)
            except Exception:
                pass
            progress.update(1)
        typer.secho("[SUCCESS] Session distilled into permanent memory", fg=typer.colors.GREEN)

@app.command()
def ingest(
    text: Optional[str] = typer.Option(None, help="Text to ingest directly"),
    source: str = typer.Option("cli", help="Source of the data"),
    silent: bool = typer.Option(False, "--silent", help="Do not print success message"),
):
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
        "tags": [source],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    cfg = load_config()
    try:
        response = requests.post(f"{cfg['api_url']}/ingest/", json=payload, headers=get_auth_headers(cfg))
        if response.status_code == 200:
            if not silent:
                typer.secho(f"[SUCCESS] Successfully ingested to Cognee! Session ID: {response.json().get('session_id')}", fg=typer.colors.GREEN)
        else:
            if not silent:
                typer.secho(f"[ERROR] Failed to ingest. Status code: {response.status_code}", fg=typer.colors.RED)
                typer.echo(response.text)
    except Exception as e:
        if not silent:
            typer.secho(f"[ERROR] Connection error: {e}", fg=typer.colors.RED)

@app.command()
def recall(
    query: str = typer.Argument(...),
    top_k: int = typer.Option(5, "--top", "-n"),
    interactive: bool = typer.Option(False, "--interactive", "-i", help="Interactive mode with feedback"),
):
    """Query Cognee memory for past context"""
    from rich.console import Console
    from rich.panel import Panel
    
    cfg = load_config()
    console = Console()
    
    with console.status("[bold cyan]Searching memory...[/bold cyan]"):
        try:
            resp = requests.post(f"{cfg['api_url']}/recall",
                                 json={"query": query, "limit": top_k},
                                 headers=get_auth_headers(cfg))
        except Exception as e:
            console.print(f"[red]Connection error: {e}[/red]")
            return
            
    if resp.status_code != 200:
        console.print(f"[red]Failed to recall. Status code: {resp.status_code}[/red]")
        return
        
    results = resp.json().get("bugs", [])
    
    if not results:
        console.print("[yellow]No memories found for this query.[/yellow]")
        return
    
    for i, r in enumerate(results, 1):
        score = r.get("score", 0.0)
        score_color = "green" if score > 0.8 else "yellow" if score > 0.5 else "red"
        content = r.get('content', '').strip()
        
        panel = Panel(
            f"{content}",
            title=f"[bold]#{i}[/bold] [{score_color}]{score:.0%} match[/{score_color}]",
            subtitle=f"[dim]ID: {r.get('id', 'N/A')}[/dim]",
            border_style=score_color,
        )
        console.print(panel)
        
        if interactive:
            from rich.prompt import Prompt
            
            score_input = Prompt.ask(
                "Was this context block helpful?", 
                choices=["y", "n"], 
                default="y"
            )
            
            try:
                requests.post(f"{cfg['api_url']}/recall/feedback",
                              json={"qa_id": r.get('id'), "score": 1 if score_input == 'y' else -1},
                              headers=get_auth_headers(cfg))
            except Exception:
                pass

@app.command()
def improve(
    session_id: str = typer.Argument(..., help="Session ID to improve"),
    feedback: str = typer.Option(..., "--feedback", "-f", prompt="What was useful about this memory?"),
    score: int = typer.Option(1, "--score", "-s", help="1=helpful, -1=not useful"),
):
    """Improve a recalled memory with your feedback"""
    cfg = load_config()
    try:
        resp = requests.post(
            f"{cfg['api_url']}/recall/feedback",
            json={"session_id": session_id, "feedback": feedback, "score": score},
            headers=get_auth_headers(cfg)
        )
        if resp.status_code == 200:
            verb = "strengthened" if score > 0 else "flagged for review"
            typer.secho(f"[SUCCESS] Memory {verb}", fg=typer.colors.GREEN)
        else:
            typer.secho(f"[ERROR] Failed: {resp.text}", fg=typer.colors.RED)
    except Exception as e:
        typer.secho(f"[ERROR] Connection error: {e}", fg=typer.colors.RED)

@app.command()
def forget(session_id: str):
    """Delete a memory session from Cognee"""
    cfg = load_config()
    try:
        response = requests.delete(f"{cfg['api_url']}/forget/{session_id}", headers=get_auth_headers(cfg))
        if response.status_code == 200:
            typer.secho(f"[SUCCESS] Session {session_id} forgotten.", fg=typer.colors.GREEN)
        else:
            typer.secho(f"[ERROR] Failed to forget session. Status code: {response.status_code}", fg=typer.colors.RED)
            typer.echo(response.text)
    except Exception as e:
        typer.secho(f"[ERROR] Connection error: {e}", fg=typer.colors.RED)

@app.command()
def install_hook(
    shell: str = typer.Option("auto", help="Shell type: powershell/zsh/bash/auto"),
):
    """Install shell error hook for automatic error capture"""
    if shell == "auto":
        if os.name == 'nt':
            shell = "powershell"
        else:
            shell_env = os.environ.get("SHELL", "")
            if "zsh" in shell_env:
                shell = "zsh"
            else:
                shell = "bash"

    if shell == "powershell":
        profile_path = subprocess.run(["powershell", "-NoProfile", "-Command", "echo $PROFILE"], capture_output=True, text=True).stdout.strip()
        if not profile_path:
            profile_path = str(Path.home() / "Documents" / "WindowsPowerShell" / "Microsoft.PowerShell_profile.ps1")
        
        hook_ps1 = """
# dev-context memory hook
if (-not (Test-Path Function:\\prompt_orig)) {
    Rename-Item -Path Function:\\prompt -NewName prompt_orig -ErrorAction SilentlyContinue
}
function prompt {
    $last_exit = $global:LASTEXITCODE
    $last_success = $?
    if (-not $last_success -and $last_exit -ne 0) {
        $last_cmd = (Get-History -Count 1 | Select-Object -ExpandProperty CommandLine)
        if ($last_cmd) {
            Start-Process -NoNewWindow -FilePath "dev-context" -ArgumentList "ingest", "--text", "EXIT_CODE:$last_exit CMD:$last_cmd PWD:$PWD", "--source", "shell-error", "--silent"
        }
    }
    if (Test-Path Function:\\prompt_orig) {
        prompt_orig
    } else {
        "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) "
    }
}
"""
        os.makedirs(os.path.dirname(profile_path), exist_ok=True)
        with open(profile_path, "a", encoding="utf-8") as f:
            f.write(hook_ps1)
        typer.secho(f"[SUCCESS] Hook installed in {profile_path}. Restart PowerShell to activate.", fg=typer.colors.GREEN)

    elif shell in ["zsh", "bash"]:
        shell_rc = Path.home() / f".{shell}rc"
        hook_line = """
_devcontext_hook() {
    local exit_code=$?
    if [ $exit_code -ne 0 ] && command -v dev-context &>/dev/null; then
        local last_cmd=$(fc -ln -1 2>/dev/null || history 1 | sed 's/^ *[0-9]* *//')
        dev-context ingest --text "EXIT_CODE:$exit_code CMD:$last_cmd PWD:$(pwd)" --source "shell-error" --silent &
    fi
}
trap '_devcontext_hook' ERR
"""
        with open(shell_rc, "a") as f:
            f.write(f"\n# dev-context memory hook\n{hook_line}\n")
        typer.secho(f"[SUCCESS] Hook installed in {shell_rc}. Restart terminal to activate.", fg=typer.colors.GREEN)
    else:
        typer.secho(f"Unsupported shell: {shell}", fg=typer.colors.RED)

@app.command()
def contribute(
    session_id: Optional[str] = typer.Option(None, help="Filter by specific session ID"),
    keyword: Optional[str] = typer.Option(None, help="Search by keyword instead of recent memory"),
):
    """List current OSS Radar matches and contribution opportunities"""
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    
    cfg = load_config()
    console = Console()
    
    with console.status("[bold cyan]Scanning GitHub for open issues...[/bold cyan]"):
        try:
            # If a keyword or session is provided, use the search endpoint
            if session_id or keyword:
                params = {}
                if session_id: params["session_id"] = session_id
                if keyword: params["keyword"] = keyword
                resp = requests.get(f"{cfg['api_url']}/contribute/search", params=params, headers=get_auth_headers(cfg), timeout=15)
                
                if resp.status_code == 200:
                    data = resp.json()
                    issues = data.get("contribution_opportunities", []) + data.get("github_issues", [])
                else:
                    console.print(f"[red]Failed to fetch OSS radar matches. Status code: {resp.status_code}[/red]")
                    return
            else:
                # Default endpoint
                resp = requests.get(f"{cfg['api_url']}/contribute", headers=get_auth_headers(cfg), timeout=15)
                if resp.status_code == 200:
                    issues = resp.json()
                else:
                    console.print(f"[red]Failed to fetch OSS radar matches. Status code: {resp.status_code}[/red]")
                    return
        except requests.exceptions.RequestException as e:
            console.print(f"[red]Connection error while reaching backend: {e}[/red]")
            return
            
    if not issues:
        console.print(Panel("[yellow]No relevant open source issues found at the moment.[/yellow]", title="OSS Radar"))
        return
        
    table = Table(title="Open Source Contribution Opportunities", show_header=True, header_style="bold magenta")
    table.add_column("Repo", style="cyan")
    table.add_column("Issue", style="green")
    table.add_column("Title", style="white")
    table.add_column("Type", justify="center")
    
    for issue in issues:
        repo = issue.get("repo", "unknown/repo")
        issue_id = issue.get("id") or issue.get("number", "N/A")
        title = issue.get("title", "")
        if len(title) > 60: title = title[:57] + "..."
        itype = issue.get("type") or "issue"
        type_color = "green" if "first" in itype.lower() else "yellow"
        
        table.add_row(
            repo,
            f"#{issue_id}",
            title,
            f"[{type_color}]{itype}[/{type_color}]"
        )
        
    console.print(table)
    console.print("[dim]Run `devcontext contribute --keyword <query>` to search for specific bug patterns.[/dim]")


@app.command()
def graph(
    project: Optional[str] = typer.Option(None, help="Filter by specific project name"),
):
    """Print an ASCII summary of the recent memory graph"""
    from rich.console import Console
    from rich.table import Table
    from collections import defaultdict
    
    cfg = load_config()
    console = Console()
    
    with console.status("[bold cyan]Fetching memory graph...[/bold cyan]"):
        try:
            params = {"project": project} if project else {}
            resp = requests.get(f"{cfg['api_url']}/graph", params=params, headers=get_auth_headers(cfg), timeout=15)
            
            if resp.status_code != 200:
                console.print(f"[red]Failed to fetch memory graph. Status code: {resp.status_code}[/red]")
                return
            
            data = resp.json()
        except requests.exceptions.RequestException as e:
            console.print(f"[red]Connection error while reaching backend: {e}[/red]")
            return

    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    
    if not nodes:
        console.print("[yellow]The memory graph is currently empty. Run `dev-context ingest` to build memory.[/yellow]")
        return
        
    # Aggregate stats for summary
    type_counts = defaultdict(int)
    for node in nodes:
        type_counts[node.get("type", "unknown")] += 1
        
    summary_table = Table(title="Memory Graph Summary", show_header=True, header_style="bold blue")
    summary_table.add_column("Node Type", style="cyan")
    summary_table.add_column("Count", justify="right", style="magenta")
    
    for ntype, count in sorted(type_counts.items()):
        summary_table.add_row(ntype.capitalize(), str(count))
        
    console.print(summary_table)
    console.print(f"\n[bold]Total Nodes:[/bold] {len(nodes)} | [bold]Total Edges:[/bold] {len(edges)}")
    
    if edges:
        console.print("\n[bold]Sample Relationships:[/bold]")
        edge_table = Table(show_header=False, box=None)
        node_map = {str(n.get("id")): n.get("label", n.get("id")) for n in nodes}
        for edge in edges[:5]:
            src = node_map.get(str(edge.get("source")), "Unknown")
            tgt = node_map.get(str(edge.get("target")), "Unknown")
            rel = edge.get("label", "connected to")
            if len(src) > 30: src = src[:27] + "..."
            if len(tgt) > 30: tgt = tgt[:27] + "..."
            edge_table.add_row(f"[cyan]{src}[/cyan]", f"[dim]{rel} ->[/dim]", f"[green]{tgt}[/green]")
        console.print(edge_table)


if __name__ == "__main__":
    app()
