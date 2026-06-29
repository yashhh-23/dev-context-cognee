import datetime
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.session import SessionRecord, PinnedNode
from app.core.byok import encrypt_data

def seed_db():
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        count = db.query(SessionRecord).count()
        if count == 0:
            print("[seed] Seeding database with professional example sessions...")
            
            # Create session 1
            s1 = SessionRecord(
                project="cognee",
                branch="main",
                terminal_output="TypeError: Cannot read properties of undefined (reading 'status') in WebSocketContext",
                status="completed",
                context_size=3,
                tags=["bug", "websocket"],
                github_url="https://github.com/yashhh-23/dev-context-cognee/issues/101",
                timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=2)
            )
            
            # Create session 2
            s2 = SessionRecord(
                project="dev-context-cognee",
                branch="dev",
                terminal_output="Failed to load LanceDB vector index on Windows due to MAX_PATH limit. Setting system_root_directory to ~/.cognee_system resolved this error.",
                status="completed",
                context_size=4,
                tags=["bug", "database"],
                github_url="https://github.com/yashhh-23/dev-context-cognee/issues/102",
                timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=1)
            )
            
            # Create session 3
            s3 = SessionRecord(
                project="cognee",
                branch="main",
                terminal_output="Memory leak in the session lifecycle API. Traced back to unclosed database connections in the session handler. Fixed by applying a context manager to db sessions.",
                status="completed",
                context_size=2,
                tags=["bug", "database"],
                github_url="https://github.com/yashhh-23/dev-context-cognee/issues/103",
                timestamp=datetime.datetime.utcnow()
            )
            
            db.add_all([s1, s2, s3])
            db.commit()
            print("[seed] Database seeding completed successfully.")
            
            # Start background task to index these memories into Cognee
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(seed_cognee_memories())
            except Exception as e:
                print(f"[seed] Could not start background Cognee seeding: {e}")
                
    except Exception as e:
        print(f"[seed] Seeding failed: {e}")
        db.rollback()
    finally:
        db.close()

async def seed_cognee_memories():
    import cognee
    from app.core.cognee_client import init_cognee
    from app.utils.embeddings import sanitize_dataset_name
    print("[seed] Seeding Cognee graph memories in background...")
    try:
        init_cognee()
        
        mem1 = "TypeError: Cannot read properties of undefined (reading 'status') in WebSocketContext"
        mem2 = "Failed to load LanceDB vector index on Windows due to MAX_PATH limit. Setting system_root_directory to ~/.cognee_system resolved this error."
        mem3 = "Memory leak in the session lifecycle API. Traced back to unclosed database connections in the session handler. Fixed by applying a context manager to db sessions."
        
        # Enforce sanitization guardrails on dataset names
        clean_ds = sanitize_dataset_name("workspacedata")
        await cognee.add(mem1, dataset_name=clean_ds)
        await cognee.add(mem2, dataset_name=clean_ds)
        await cognee.add(mem3, dataset_name=clean_ds)
        
        print("[seed] Running cognify in background...")
        await cognee.cognify()
        print("[seed] Cognee graph seeding completed successfully.")
    except Exception as e:
        print(f"[seed] Cognee graph seeding failed/warned (non-fatal): {e}")
