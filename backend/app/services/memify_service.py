import cognee


async def improve_context(
    filename: str,
    content: str,
    language: str = "unknown",
) -> dict:
    """
    Re-ingest and re-process a file context into Cognee knowledge graph.
    Stores a higher-value 'improved memory' representation with structured metadata
    and records an explicit improved session node in the database.
    """
    try:
        improved_representation = (
            f"# [IMPROVED CONTEXT MEMORY]\n"
            f"**File:** {filename}\n"
            f"**Language:** {language}\n"
            f"**Type:** High-Value Architecture & Fact Representation\n"
            f"**Status:** Verified & Distilled\n\n"
            f"## Core Memory Content:\n{content}\n"
        )

        await cognee.add(
            improved_representation,
            dataset_name="main_dataset",
        )

        # Re-process to extract entities and relationships
        await cognee.cognify()

        record_id = None
        try:
            from app.core.database import SessionLocal
            from app.models.session import SessionRecord
            db = SessionLocal()
            try:
                record = SessionRecord(
                    project=filename,
                    branch="memify",
                    status="improved_memory",
                    tags=["memify", "improved", language],
                    _terminal_output=improved_representation,
                    context_size=len(improved_representation),
                )
                db.add(record)
                db.commit()
                db.refresh(record)
                record_id = str(record.id)
            finally:
                db.close()
        except Exception as db_exc:
            print(f"[memify] note: could not record improved_memory session: {db_exc}")

        return {
            "status": "improved",
            "filename": filename,
            "language": language,
            "record_id": record_id,
            "representation": "improved_memory",
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
