import asyncio
import cognee

async def main():
    try:
        print("Pruning system...")
        await cognee.prune.prune_system(metadata=True)
        await cognee.prune.prune_data()
        print("Pruning complete.")
    except Exception as e:
        print(f"Error pruning: {e}")

if __name__ == "__main__":
    asyncio.run(main())
