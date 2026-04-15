from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
import asyncio
import httpx
import json
import os
from datetime import datetime

from core.scheduler import Scheduler
from core.monitor import GPUMonitor
from core.sys_ctl import SystemController
from core.logger import setup_logger
from core.websocket_manager import WebSocketManager
from core.config_watcher import ConfigWatcher
from core.metrics import MetricsCollector
from middleware.error_handler import (
    http_exception_handler,
    generic_exception_handler,
    controller_exception_handler,
    ControllerException,
    ModelNotFoundException,
    InsufficientMemoryException,
    TooManyRequestsException,
    ModelServiceUnavailableException
)
from middleware.rate_limit import RateLimitMiddleware
from middleware.timeout_handler import TimeoutHandlerMiddleware

logger = setup_logger()

app = FastAPI(title="AI Controller API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(RateLimitMiddleware(max_requests=100, window_seconds=60))
app.middleware("http")(TimeoutHandlerMiddleware(timeout_seconds=60))

gpu_monitor = GPUMonitor()
sys_controller = SystemController()
scheduler = Scheduler(gpu_monitor, sys_controller)
ws_manager = WebSocketManager()
metrics = MetricsCollector()

config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
config_watcher = ConfigWatcher(config_path)

def on_config_changed(new_config: Dict):
    logger.info("Configuration updated, reloading scheduler")
    scheduler.config = new_config

config_watcher.register_callback(on_config_changed)
config_watcher.start_watching()

app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)
app.add_exception_handler(ControllerException, controller_exception_handler)

class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[Dict[str, str]]
    stream: Optional[bool] = False
    max_tokens: Optional[int] = None
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 1.0
    stop: Optional[List[str]] = None
    presence_penalty: Optional[float] = 0.0
    frequency_penalty: Optional[float] = 0.0

class ChatCompletionResponseChoice(BaseModel):
    index: int
    message: Dict[str, str]
    finish_reason: Optional[str] = "stop"

class ChatCompletionResponse(BaseModel):
    id: str = Field(default_factory=lambda: f"chatcmpl-{os.urandom(12).hex()}")
    object: str = "chat.completion"
    created: int = Field(default_factory=lambda: int(asyncio.get_event_loop().time()))
    model: str
    choices: List[ChatCompletionResponseChoice]
    usage: Optional[Dict[str, int]] = None

class ChatCompletionChunk(BaseModel):
    id: str = Field(default_factory=lambda: f"chatcm