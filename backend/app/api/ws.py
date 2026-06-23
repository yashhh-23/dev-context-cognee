"""WebSocket /ws/notifications — real-time dashboard push."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.ws_manager import manager

router = APIRouter()


@router.websocket("/ws/notifications")
async def ws_notifications(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; clients can send ping messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        manager.disconnect(websocket)
