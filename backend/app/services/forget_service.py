import cognee
from app.core.database import SessionLocal
from app.models.session import SessionRecord

async def forget_context(session_id: str = None, filename: str = None) -> dict:
    try:
        if session_id:
            db = SessionLocal()
            try:
                record = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
                if record and record.cognee_response_id:
                    try:
                        await cognee.delete(node_id=record.cognee_response_id, dataset_name="main_dataset")
                    except (TypeError, AttributeError):
                        try:
                            import uuid
                            await cognee.delete(data_id=uuid.UUID(str(record.cognee_response_id)))
                        except Exception:
                            await cognee.forget(data_id=record.cognee_response_id)
                elif filename:
                    try:
                        await cognee.delete(query=filename, dataset_name="main_dataset")
                    except (TypeError, AttributeError):
                        await cognee.forget(dataset=filename)
                else:
                    raise ValueError("No deletion target found")
            finally:
                db.close()
        elif filename:
            try:
                await cognee.delete(query=filename, dataset_name="main_dataset")
            except (TypeError, AttributeError):
                await cognee.forget(dataset=filename)
        else:
            raise ValueError("No deletion target found")

        return {"status": "deleted", "filename": filename, "session_id": session_id, "score_bonus": 5}
    except Exception as e:
        return {"status": "error", "filename": filename, "session_id": session_id, "error": str(e), "score_bonus": 0}
