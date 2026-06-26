import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.mcp_server import remember_context, recall_context

async def run_test():
    print("--- 1. Storing first memory ---")
    res1 = await remember_context("Remember that the project name is Dev-Context-Cognee.")
    print("Result:", res1)
    print()

    print("Waiting 25 seconds for Cognee background indexing pipeline to complete...")
    await asyncio.sleep(25)

    print("--- 2. Storing duplicate memory ---")
    res2 = await remember_context("Remember that the project name is Dev-Context-Cognee.")
    print("Result:", res2)
    print()

    print("Waiting 25 seconds for Cognee background indexing pipeline to complete...")
    await asyncio.sleep(25)

    print("--- 3. Storing conflicting memory ---")
    res3 = await remember_context("Remember that the project name is actually Cognee-Hackathon.")
    print("Result:", res3)
    print()

    print("Waiting 25 seconds for Cognee background indexing pipeline to complete...")
    await asyncio.sleep(25)

    print("--- 4. Recalling project name ---")
    res4 = await recall_context("What is the project name?")
    print("Result:", res4)
    print()

if __name__ == "__main__":
    asyncio.run(run_test())
