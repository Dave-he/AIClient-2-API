from fastapi import WebSocket
from typing import Dict, List, Set
import asyncio
import json
from datetime import datetime

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self._background_task = None
    
    async def connect(self, websocket: WebSocket, channel: str = "default"):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
    
    def disconnect(self, websocket: WebSocket, channel: str = "default"):
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
    
    async def broadcast(self, message: dict, channel: str = "default"):
        if channel not in self.active_connections:
            return
        
        disconnected = []
        for connection in self.active_connections[channel]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        
        for conn in disconnected:
            self.active_connections[channel].discard(conn)
    
    async def broadcast_status(self, gpu_status: dict, model_status: dict):
        message = {
            "type": "status_update",
            "timestamp": datetime.now().isoformat(),
            "gpu": gpu_status,
            "models": model_status
        }
        await self.broadcast(message, channel="monitor")