"""WebSocket /ws/notifications — real-time dashboard push."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.ws_manager import manager
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


async def _heartbeat(websocket: WebSocket):
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_text('{"type": "ping"}')
    except Exception:
        pass

async def _handle(websocket: WebSocket):
    await manager.connect(websocket)
    heartbeat_task = asyncio.create_task(_heartbeat(websocket))
    try:
        while True:
            # Keep connection alive; clients can send ping messages
            data = await websocket.receive_text()
            if data == "ping" or data == '{"type":"ping"}':
                await websocket.send_text('{"type":"pong"}')
            else:
                logger.debug(f"[ws] Unknown message: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    finally:
        heartbeat_task.cancel()

@router.websocket("/ws/notifications")
async def ws_notifications(websocket: WebSocket):
    await _handle(websocket)

@router.websocket("/ws")
async def ws_short(websocket: WebSocket):
    await _handle(websocket)
