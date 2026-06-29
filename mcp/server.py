import sys
import os

# Add backend directory to sys.path to run MCP server from repo root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

# Importing mcp will trigger backend/app/mcp_server.py which is already lock-guarded
from app.mcp_server import mcp

if __name__ == "__main__":
    mcp.run()
