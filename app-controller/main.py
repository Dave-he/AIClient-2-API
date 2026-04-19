from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any, Union, Tuple
from functools import lru_cache
import asyncio
import httpx
import json
import os
from datetime import datetime
import uuid
import base64
import io
from PIL import Image
import re

from core.scheduler import Scheduler
from core.monitor import GPUMonitor
from core.sys_ctl import SystemController
from core.logger import setup_logger
from core.websocket_manager import WebSocketManager
from core.config_watcher import ConfigWatcher
from core.metrics import MetricsCollector
from core.prometheus_exporter import PrometheusExporter
from core.structured_logger import StructuredLogger, RequestContext
from core.redis_client import redis_client
from core.vllm_manager import (
    get_available_models,
    get_current_model_info,
    start_vllm_service,
    stop_vllm_service,
    restart_vllm_service,
    get_vllm_service_status,
    switch_vllm_model,
    MODEL_BASE_PATH,
    VLLM_SERVICE_NAME,
    VLLM_DEFAULT_PORT
)
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
structured_logger = StructuredLogger("ai_controller")

# --- Image Validation Constants ---
MAX_IMAGE_SIZE_MB = 10
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024
MAX_WIDTH = 8192
MAX_HEIGHT = 8192
SUPPORTED_FORMATS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff'}

def validate_image_data(image_data: bytes) -> Dict[str, Any]:
    try:
        image = Image.open(io.BytesIO(image_data))
        width, height = image.size
        format = image.format.lower() if image.format else 'unknown'
        
        if format not in SUPPORTED_FORMATS:
            return {
                'valid': False,
                'error': f"Unsupported image format: {format}. Supported formats: {', '.join(SUPPORTED_FORMATS)}"
            }
        
        if width > MAX_WIDTH or height > MAX_HEIGHT:
            return {
                'valid': False,
                'error': f"Image dimensions exceed maximum allowed size. Max: {MAX_WIDTH}x{MAX_HEIGHT}, Got: {width}x{height}"
            }
        
        return {
            'valid': True,
            'width': width,
            'height': height,
            'format': format,
            'size_bytes': len(image_data)
        }
    except Exception as e:
        return {
            'valid': False,
            'error': f"Invalid image data: {str(e)}"
        }

def decode_base64_image(base64_string: str) -> Optional[bytes]:
    try:
        match = re.match(r'^data:image/([\w-]+);base64,(.+)$', base64_string)
        if match:
            base64_data = match.group(2)
        else:
            base64_data = base64_string
        
        decoded = base64.b64decode(base64_data)
        
        if len(decoded) > MAX_IMAGE_SIZE_BYTES:
            return None
        
        return decoded
    except Exception:
        return None

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
prometheus = PrometheusExporter()

config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
config_watcher = ConfigWatcher(config_path)

def on_config_changed(new_config: Dict):
    structured_logger.info("Configuration updated", action="config_reload")
    scheduler.config = new_config

config_watcher.register_callback(on_config_changed)
config_watcher.start_watching()

@app.middleware("http")
async def request_tracking_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start_time = datetime.now()
    
    response = await call_next(request)
    
    duration = (datetime.now() - start_time).total_seconds()
    
    structured_logger.log_request(
        endpoint=str(request.url.path),
        method=request.method,
        status_code=response.status_code,
        duration=duration,
        request_id=request_id
    )
    
    prometheus.record_request(
        endpoint=str(request.url.path),
        method=request.method,
        status_code=response.status_code,
        duration=duration
    )
    
    metrics.record_request(
        endpoint=str(request.url.path),
        status_code=response.status_code,
        response_time=duration
    )
    
    return response

app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)
app.add_exception_handler(ControllerException, controller_exception_handler)

async def broadcast_status_loop():
    while True:
        try:
            gpu_summary = gpu_monitor.get_gpu_summary()
            model_status = await get_model_status()
            await ws_manager.broadcast_status(gpu_summary, model_status)
        except Exception as e:
            logger.error(f"Error broadcasting status: {str(e)}")
        
        await asyncio.sleep(2)

async def save_history_loop():
    while True:
        try:
            gpu_monitor.save_gpu_history()
        except Exception as e:
            logger.error(f"Error saving GPU history: {str(e)}")
        
        await asyncio.sleep(2)

@app.on_event("startup")
async def startup_event():
    redis_client.connect()
    if redis_client.is_connected():
        logger.info("Redis connection established successfully")
        gpu_monitor.set_redis_client(redis_client)
    else:
        logger.warning("Failed to connect to Redis")
    
    asyncio.create_task(broadcast_status_loop())
    asyncio.create_task(save_history_loop())
    structured_logger.info("AI Controller service started", action="startup")

@app.on_event("shutdown")
async def shutdown_event():
    config_watcher.stop_watching()
    structured_logger.info("AI Controller service stopped", action="shutdown")

class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[Dict[str, Any]]
    stream: Optional[bool] = False
    max_tokens: Optional[int] = None
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 1.0
    stop: Optional[List[str]] = None
    presence_penalty: Optional[float] = 0.0
    frequency_penalty: Optional[float] = 0.0

    @field_validator('messages')
    def validate_messages_with_images(cls, v):
        for message in v:
            if 'content' in message:
                content = message['content']
                if isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict) and 'image_url' in part:
                            image_url = part['image_url']
                            if isinstance(image_url, dict) and 'url' in image_url:
                                url = image_url['url']
                                if url.startswith('data:image/'):
                                    decoded = decode_base64_image(url)
                                    if decoded is None:
                                        raise ValueError("Invalid or oversized base64 image data")
                                    validation = validate_image_data(decoded)
                                    if not validation['valid']:
                                        raise ValueError(validation['error'])
        return v

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
    id: str = Field(default_factory=lambda: f"chatcmpl-{os.urandom(12).hex()}")
    object: str = "chat.completion.chunk"
    created: int = Field(default_factory=lambda: int(asyncio.get_event_loop().time()))
    model: str
    choices: List[Dict[str, Any]]

@app.get("/v1/models")
async def list_models():
    logger.info("Listing available models")
    models = scheduler.get_available_models()
    return {"object": "list", "data": [{"id": m, "object": "model", "created": 0, "owned_by": "local"} for m in models]}

def count_image_content(request_data: Dict) -> Tuple[bool, int]:
    has_image = False
    total_size = 0
    
    if request_data.get('messages'):
        for message in request_data['messages']:
            content = message.get('content')
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get('image_url'):
                        has_image = True
                        image_url = part['image_url']
                        if isinstance(image_url, dict):
                            url = image_url.get('url', '')
                        else:
                            url = str(image_url)
                        if url.startswith('data:image/'):
                            comma_pos = url.find(',')
                            if comma_pos > 0:
                                base64_data = url[comma_pos+1:]
                                total_size += int((len(base64_data) * 3) / 4)
    return has_image, total_size

def is_multimodal_model(model_name: str) -> bool:
    return scheduler.get_model_supports_images(model_name)

@lru_cache(maxsize=128)
def get_model_capabilities(model_name: str) -> Dict[str, bool]:
    return {
        'multimodal': is_multimodal_model(model_name),
        'tool_calling': True,
        'streaming': True
    }

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    start_time = datetime.now()
    model_name = request.model
    stream = request.stream or False
    status_code = 200
    slot_acquired = False
    
    request_data = request.model_dump(exclude_unset=True)
    has_image, total_image_size = count_image_content(request_data)
    
    if has_image:
        logger.info(f"Received chat completion request with image content for model: {model_name}, stream: {stream}, image_size: {total_image_size} bytes")
    else:
        logger.info(f"Received chat completion request for model: {model_name}, stream: {stream}")
    
    try:
        if not scheduler.is_model_available(model_name):
            logger.warning(f"Model {model_name} not found")
            raise ModelNotFoundException(model_name)
        
        if has_image and not is_multimodal_model(model_name):
            logger.warning(f"Model {model_name} does not support image inputs")
            raise HTTPException(
                status_code=400,
                detail=f"Model {model_name} does not support image inputs. Please use a multimodal model like gemma-2-vision."
            )
        
        if not scheduler.acquire_request(model_name):
            active = scheduler.get_active_requests(model_name)
            limit = scheduler.get_concurrency_limit()
            queue_length = scheduler.get_queue_length(model_name)
            
            if scheduler.is_queue_available(model_name):
                wait_time = scheduler.get_wait_time_estimate(model_name)
                logger.info(f"Request queued for {model_name}, position: {queue_length + 1}, estimated wait: {wait_time:.1f}s")
                
                success = await scheduler.wait_for_slot(model_name, timeout=30)
                if not success:
                    logger.warning(f"Queue timeout for {model_name}")
                    raise TooManyRequestsException(active, limit, queue_length)
                
                slot_acquired = True
            else:
                logger.warning(f"Queue full for {model_name}: {active}/{limit}, queue: {queue_length}")
                raise TooManyRequestsException(active, limit, queue_length)
        else:
            slot_acquired = True
        
        gpu_status = gpu_monitor.get_gpu_status()
        min_memory = scheduler.get_min_available_memory()
        available_mb = gpu_status.get('available_memory', 0) if gpu_status else 0
        min_memory_mb = min_memory // (1024 ** 2)
        if gpu_status and available_mb < min_memory_mb:
            logger.warning(f"Insufficient GPU memory for {model_name}")
            raise InsufficientMemoryException(available_mb, min_memory_mb)
        
        if not scheduler.is_model_running(model_name):
            logger.info(f"Model {model_name} not running, starting...")
            success = await scheduler.start_model(model_name)
            if not success:
                logger.error(f"Failed to start model {model_name}")
                raise ModelServiceUnavailableException(model_name, "Failed to start service")
            await asyncio.sleep(5)
        
        vllm_port = scheduler.get_model_port(model_name)
        vllm_url = f"http://localhost:{vllm_port}/v1/chat/completions"
        
        model_config = scheduler.get_model_config(model_name)
        vllm_model_name = model_config.get('model_path', model_name) if model_config else model_name
        
        logger.info(f"Forwarding request to vLLM at {vllm_url} with model: {vllm_model_name}")
        
        request_data = request.model_dump(exclude_unset=True)
        request_data['model'] = vllm_model_name
        
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                vllm_url,
                json=request_data,
                timeout=60
            )
            response.raise_for_status()
            
            if stream:
                async def generate():
                    async for chunk in response.aiter_lines():
                        if chunk.startswith("data: "):
                            chunk_data = chunk[6:]
                            if chunk_data == "[DONE]":
                                yield "data: [DONE]\n\n"
                                break
                            try:
                                json_chunk = json.loads(chunk_data)
                                json_chunk['id'] = f"chatcmpl-{os.urandom(12).hex()}"
                                yield f"data: {json.dumps(json_chunk)}\n\n"
                            except:
                                yield f"data: {chunk_data}\n\n"
                return StreamingResponse(generate(), media_type="text/event-stream")
            else:
                result = response.json()
                result['id'] = f"chatcmpl-{os.urandom(12).hex()}"
                logger.info(f"Request completed successfully for {model_name}")
                return result
    except (HTTPException, ControllerException) as e:
        status_code = getattr(e, 'status_code', getattr(e, 'code', 500))
        raise
    except httpx.HTTPError as e:
        status_code = 503
        logger.error(f"vLLM service error for {model_name}: {str(e)}")
        raise ModelServiceUnavailableException(model_name, str(e))
    finally:
        if slot_acquired:
            scheduler.release_request(model_name)
        metrics.record_request(
            endpoint="/v1/chat/completions",
            status_code=status_code,
            response_time=(datetime.now() - start_time).total_seconds(),
            model_name=model_name,
            is_image_request=has_image,
            image_size_bytes=total_image_size
        )

class ImageUploadResponse(BaseModel):
    success: bool
    message: str
    image_info: Optional[Dict[str, Any]] = None

class ImageValidationRequest(BaseModel):
    image_data: str

@app.post("/v1/images/validate", response_model=ImageUploadResponse)
async def validate_image(request: ImageValidationRequest):
    start_time = datetime.now()
    logger.info("Received image validation request")
    
    try:
        decoded = decode_base64_image(request.image_data)
        if decoded is None:
            return {
                "success": False,
                "message": "Failed to decode base64 image data"
            }
        
        validation = validate_image_data(decoded)
        if validation['valid']:
            metrics.record_request(
                endpoint="/v1/images/validate",
                status_code=200,
                response_time=(datetime.now() - start_time).total_seconds(),
                model_name="image-validation"
            )
            return {
                "success": True,
                "message": "Image validation successful",
                "image_info": validation
            }
        else:
            metrics.record_request(
                endpoint="/v1/images/validate",
                status_code=400,
                response_time=(datetime.now() - start_time).total_seconds(),
                model_name="image-validation"
            )
            return {
                "success": False,
                "message": validation['error'],
                "image_info": validation
            }
    except Exception as e:
        logger.error(f"Image validation error: {str(e)}")
        metrics.record_request(
            endpoint="/v1/images/validate",
            status_code=500,
            response_time=(datetime.now() - start_time).total_seconds(),
            model_name="image-validation"
        )
        raise HTTPException(status_code=500, detail=f"Image validation failed: {str(e)}")

@app.post("/v1/images/upload", response_model=ImageUploadResponse)
async def upload_image(file: UploadFile = File(...)):
    start_time = datetime.now()
    logger.info(f"Received image upload request: {file.filename}")
    
    try:
        contents = await file.read()
        
        if len(contents) > MAX_IMAGE_SIZE_BYTES:
            metrics.record_request(
                endpoint="/v1/images/upload",
                status_code=413,
                response_time=(datetime.now() - start_time).total_seconds(),
                model_name="image-upload"
            )
            return {
                "success": False,
                "message": f"Image size exceeds maximum allowed size of {MAX_IMAGE_SIZE_MB}MB"
            }
        
        validation = validate_image_data(contents)
        if validation['valid']:
            metrics.record_request(
                endpoint="/v1/images/upload",
                status_code=200,
                response_time=(datetime.now() - start_time).total_seconds(),
                model_name="image-upload"
            )
            return {
                "success": True,
                "message": "Image uploaded successfully",
                "image_info": {
                    **validation,
                    "filename": file.filename,
                    "content_type": file.content_type
                }
            }
        else:
            metrics.record_request(
                endpoint="/v1/images/upload",
                status_code=400,
                response_time=(datetime.now() - start_time).total_seconds(),
                model_name="image-upload"
            )
            return {
                "success": False,
                "message": validation['error'],
                "image_info": validation
            }
    except Exception as e:
        logger.error(f"Image upload error: {str(e)}")
        metrics.record_request(
            endpoint="/v1/images/upload",
            status_code=500,
            response_time=(datetime.now() - start_time).total_seconds(),
            model_name="image-upload"
        )
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

@app.get("/v1/images/info")
async def get_image_info():
    return {
        "max_size_mb": MAX_IMAGE_SIZE_MB,
        "max_dimensions": f"{MAX_WIDTH}x{MAX_HEIGHT}",
        "supported_formats": list(SUPPORTED_FORMATS),
        "endpoints": {
            "validate": "POST /v1/images/validate - Validate base64 encoded image",
            "upload": "POST /v1/images/upload - Upload image file",
            "info": "GET /v1/images/info - Get image service information"
        }
    }

@app.websocket("/ws/monitor")
async def websocket_monitor(websocket: WebSocket):
    await ws_manager.connect(websocket, channel="monitor")
    logger.info("WebSocket connection established for monitoring")
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, channel="monitor")
        logger.info("WebSocket connection closed")

@app.get("/manage/gpu")
async def get_gpu_status():
    logger.info("Getting GPU status")
    status = gpu_monitor.get_gpu_status()
    if not status:
        return {"status": "unavailable", "message": "No GPU detected", "serverTime": datetime.now().isoformat()}
    status["serverTime"] = datetime.now().isoformat()
    return status

@app.get("/manage/gpu/summary")
async def get_gpu_summary():
    logger.info("Getting GPU summary")
    summary = gpu_monitor.get_gpu_summary()
    return summary

@app.get("/manage/models")
async def get_model_status():
    logger.info("Getting model statuses")
    models = scheduler.get_available_models()
    status = {}
    for model in models:
        status[model] = {
            "running": scheduler.is_model_running(model),
            "port": scheduler.get_model_port(model),
            "service": scheduler.get_model_service(model),
            "active_requests": scheduler.get_active_requests(model),
            "preloaded": scheduler.is_model_preloaded(model),
            "last_used": scheduler.get_model_last_used(model).isoformat() if scheduler.get_model_last_used(model) else None
        }
    return status

@app.get("/manage/queue")
async def get_queue_status():
    logger.info("Getting queue status")
    models = scheduler.get_available_models()
    queue_info = {}
    for model in models:
        queue_info[model] = {
            "active_requests": scheduler.get_active_requests(model),
            "concurrency_limit": scheduler.get_concurrency_limit(),
            "can_accept": scheduler.can_accept_request(model)
        }
    return queue_info

@app.get("/manage/metrics")
async def get_metrics():
    logger.info("Getting metrics")
    return metrics.get_metrics()

@app.post("/manage/metrics/reset")
async def reset_metrics():
    logger.info("Resetting metrics")
    metrics.reset()
    return {"status": "reset"}

@app.get("/health")
async def health_check():
    gpu_status = gpu_monitor.get_gpu_status()
    health_info = metrics.get_comprehensive_health_score(gpu_status)
    return {
        "status": health_info["status"],
        "timestamp": datetime.now().isoformat(),
        "health_score": health_info["overall"],
        "details": health_info
    }

@app.get("/health/detailed")
async def health_check_detailed():
    gpu_status = gpu_monitor.get_gpu_status()
    health_info = metrics.get_comprehensive_health_score(gpu_status)
    return {
        "status": health_info["status"],
        "timestamp": datetime.now().isoformat(),
        "scores": health_info,
        "gpu": gpu_status,
        "metrics": metrics.get_detailed_metrics()
    }

@app.get("/manage/health/alert")
async def check_alert_status():
    gpu_status = gpu_monitor.get_gpu_status()
    health_info = metrics.get_comprehensive_health_score(gpu_status)
    alert_reasons = metrics.get_alert_reasons()

    return {
        "should_alert": health_info["overall"] < 70,
        "health_score": health_info["overall"],
        "status": health_info["status"],
        "alert_reasons": alert_reasons,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/metrics")
async def get_prometheus_metrics():
    gpu_status = gpu_monitor.get_gpu_status()
    prometheus.update_gpu_metrics(gpu_status)

    health_info = metrics.get_comprehensive_health_score(gpu_status)
    prometheus.set_health_score(health_info["overall"])

    for model_name in scheduler.get_available_models():
        prometheus.set_model_status(
            model_name,
            scheduler.get_model_service(model_name) or "",
            scheduler.is_model_running(model_name)
        )
        prometheus.set_active_requests(model_name, scheduler.get_active_requests(model_name))

    return prometheus.generate_metrics()

@app.get("/metrics/metadata")
async def get_metrics_metadata():
    return prometheus.get_metrics_dict()

@app.get("/manage/logs/test")
async def test_structured_logging():
    structured_logger.info("Test message", test=True, value=42)
    structured_logger.warning("Warning test", level="high")
    structured_logger.log_request("/test", "GET", 200, 0.123)
    structured_logger.log_model_event("test-model", "started", duration=10.5)
    return {"status": "logging_test_completed"}

@app.get("/manage/redis/health")
async def redis_health_check():
    try:
        connected = redis_client.is_connected()
        info = {}

        if connected:
            client = redis_client.get_client()
            if client:
                info = client.info()

        return {
            "status": "healthy" if connected else "unhealthy",
            "connected": connected,
            "info": info,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "connected": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/manage/redis/keys")
async def get_redis_keys(pattern: str = "*"):
    try:
        if not redis_client.is_connected():
            return {"error": "Redis not connected"}

        keys = redis_client.keys(pattern)
        return {"keys": keys, "count": len(keys)}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/manage/redis/flush")
async def flush_redis():
    try:
        if not redis_client.is_connected():
            return {"error": "Redis not connected"}

        success = redis_client.flush_db()
        return {"status": "success" if success else "failed"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/manage/gpu/history")
async def get_gpu_history(count: int = 60):
    try:
        history = gpu_monitor.get_gpu_history(count)
        return {
            "history": history,
            "count": len(history),
            "enabled": gpu_monitor.get_history_enabled(),
            "max_days": gpu_monitor.get_max_history_days()
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/manage/gpu/history/config")
async def configure_gpu_history(enabled: Optional[bool] = None, max_days: Optional[int] = None):
    try:
        if enabled is not None:
            gpu_monitor.set_history_enabled(enabled)
        
        if max_days is not None and max_days > 0:
            gpu_monitor.set_max_history_days(max_days)
        
        return {
            "enabled": gpu_monitor.get_history_enabled(),
            "max_days": gpu_monitor.get_max_history_days()
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/manage/websocket/connections")
async def get_websocket_connections():
    return ws_manager.get_connection_stats()

@app.get("/manage/config")
async def get_config():
    logger.info("Getting current configuration")
    return config_watcher.get_config()

@app.post("/manage/config/reload")
async def reload_config():
    logger.info("Manual configuration reload requested")
    new_config = config_watcher.load_config()
    on_config_changed(new_config)
    return {"status": "reloaded", "config": new_config}

@app.get("/manage/preload/status")
async def get_preload_status():
    logger.info("Getting preload status")
    preloaded = scheduler.get_preloaded_models()
    all_models = scheduler.get_available_models()
    preload_status = {}
    for model in all_models:
        config = scheduler.get_model_config(model)
        preload_status[model] = {
            "preloaded": model in preloaded,
            "running": scheduler.is_model_running(model),
            "preload_config": config.get("preload", False) if config else False
        }
    return {"preloaded_models": preloaded, "all_models": all_models, "status": preload_status}

@app.post("/manage/preload/{model_name}/enable")
async def enable_preload(model_name: str):
    logger.info(f"Enabling preload for model {model_name}")
    if not scheduler.is_model_available(model_name):
        raise ModelNotFoundException(model_name)
    
    success = scheduler.schedule_preload(model_name)
    if success:
        return {"status": "preload_enabled", "model": model_name}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to enable preload for model {model_name}")

@app.post("/manage/preload/{model_name}/disable")
async def disable_preload(model_name: str):
    logger.info(f"Disabling preload for model {model_name}")
    if not scheduler.is_model_available(model_name):
        raise ModelNotFoundException(model_name)
    
    success = scheduler.cancel_preload(model_name)
    if success:
        return {"status": "preload_disabled", "model": model_name}
    else:
        return {"status": "already_disabled", "model": model_name}

@app.post("/manage/preload/all")
async def preload_all_models():
    logger.info("Preloading all models")
    results = {}
    for model_name in scheduler.get_available_models():
        success = scheduler.schedule_preload(model_name)
        results[model_name] = {"status": "preloading" if success else "failed"}
    return results

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting AI Controller service")
    uvicorn.run(app, host="0.0.0.0", port=5000)