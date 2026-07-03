import cognee


async def improve_context(
    filename: str,
    content: str,
    language: str = "unknown",
) -> dict:
    """
    Re-ingest and re-process a file context into Cognee knowledge graph.
    Uses cognee.add() + cognee.cognify() to update the stored memory.
    """
    try:
        await cognee.add(
            content,
            dataset_name="main_dataset",
        )

        # Re-process to extract entities and relationships
        await cognee.cognify()

        return {
            "status": "improved",
            "filename": filename,
            "language": language,
            "score_bonus": 15,
        }

    except Exception as e:
        # Return a safe fallback instead of crashing
        return {
            "status": "error",
            "filename": filename,
            "error": str(e),
            "score_bonus": 0,
        }
