import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Set storage path
os.environ["COGNEE_SYSTEM_PATH"] = os.path.expanduser("~/.cognee_system")

import cognee
from app.core.cognee_client import init_cognee

async def run_diagnostics():
    init_cognee()
    query = "Remember that the project name is Dev-Context-Cognee."
    print("Searching for:", query)
    try:
        results = await cognee.search(query, query_type=cognee.SearchType.SUMMARIES)
        if results:
            print("Search Result structure:")
            for key, val in results[0].items():
                print(f"Key: {key}, Type: {type(val)}")
            print("\nContent of 'search_result':")
            search_res = results[0]['search_result']
            print(search_res)
            print("Type of 'search_result':", type(search_res))
            if isinstance(search_res, list) and len(search_res) > 0:
                print("First element in list:")
                el = search_res[0]
                print("Type:", type(el))
                print("Attributes/Keys:", dir(el) if not isinstance(el, dict) else el.keys())
                if isinstance(el, dict):
                    print("Text/Score:", el.get("text"), el.get("score"))
                else:
                    print("Text/Score:", getattr(el, "text", None), getattr(el, "score", None))
    except Exception as e:
        print("Error during search:", e)

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
