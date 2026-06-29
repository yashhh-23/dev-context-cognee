import os
import sys
import json
import pathlib

def main():
    mcp_dir = pathlib.Path(__file__).resolve().parent
    server_py = str(mcp_dir / "server.py")
    
    # Locate virtual environment python interpreter to ensure correct imports at runtime
    venv_python = str(mcp_dir.parent / "backend" / "venv" / "Scripts" / "python.exe")
    if not os.path.exists(venv_python):
        venv_python = str(mcp_dir.parent / "backend" / "venv" / "bin" / "python")
    
    if not os.path.exists(venv_python):
        venv_python = sys.executable

    config = {
        "mcpServers": {
            "dev-context-cognee": {
                "command": venv_python,
                "args": [server_py],
                "env": {
                    "GROQ_API_KEY": os.environ.get("GROQ_API_KEY", "YOUR_GROQ_API_KEY"),
                    "GEMINI_API_KEY": os.environ.get("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY")
                }
            }
        }
    }
    
    print("=" * 60)
    print(" dev-context-cognee MCP Server Configuration ")
    print("=" * 60)
    print(json.dumps(config, indent=2))
    print("=" * 60)
    print("\nCommon IDE Config Locations:")
    print("-" * 30)
    if sys.platform == "win32":
        print(f"Claude Desktop: %APPDATA%\\Claude\\claude_desktop_config.json")
        print(f"Cursor Settings: Open Cursor -> Settings -> Features -> MCP -> Add new MCP server")
        print(f"  - Name: dev-context-cognee")
        print(f"  - Type: command")
        print(f"  - Command: {venv_python} \"{server_py}\"")
    else:
        print(f"Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json")
        print(f"Cursor Settings: Open Cursor -> Settings -> Features -> MCP -> Add new MCP server")
        print(f"  - Name: dev-context-cognee")
        print(f"  - Type: command")
        print(f"  - Command: {venv_python} '{server_py}'")
    print("-" * 30)

if __name__ == "__main__":
    main()
