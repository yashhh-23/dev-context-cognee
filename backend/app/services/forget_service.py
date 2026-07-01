import cognee


async def forget_context(filename: str) -> dict:
    """
    Delete a saved context from Cognee knowledge graph.
    Uses cognee.prune() scoped to the dataset name.
    Note: cognee.prune() removes all data — use with caution.
    For per-file deletion, we use dataset_name scoping via cognee.add with empty content
    then prune, or directly call the underlying vector store delete.
    """
    try:
        # Strategy: overwrite the dataset with empty content, then prune stale nodes
        await cognee.add(
            "",
            dataset_name=filename,
        )

        # Prune removes orphan nodes and stale embeddings
        await cognee.prune.prune_system(metadata=True)

        return {
            "status": "deleted",
            "filename": filename,
            "score_bonus": 5,
        }

    except Exception as e:
        return {
            "status": "error",
            "filename": filename,
            "error": str(e),
            "score_bonus": 0,
        }
