from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
import asyncio
import httpx
import json
import os

from core.scheduler import Scheduler
from core.monitor import GPUMonitor
from core.sys_ctl import SystemController

app = FastAPI(title="AI Controller API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

gpu_monitor = GPUMonitor()
sys_controller = SystemController()
scheduler = Scheduler(gpu_monitor, sys_controller)

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
    id: str = Field(default_factory=lambda: f"chatcmpl-{os.urandom(12).hex()}")
    object: str = "chat.completion.chunk"
    created: int = Field(default_factory=lambda: int(asyncio.get_event_loop().time()))
    model: str
    choices: List[Dict[str, Any]]

@app.get("/v1/models")
async def list_models():
    models = scheduler.get_available_models()
    return {"object": "list", "data": [{"id": m, "object": "model", "created": 0, "owned_by": "local"} for m in models]}

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    model_name = request.model
    stream = request.stream or False
    
    if not scheduler.is_model_available(model_name):
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    gpu_status = gpu_monitor.get_gpu_status()
    if gpu_status and gpu_status['available_memory'] < 2 * 1024 ** 3:
        raise HTTPException(status_code=503, detail="Insufficient GPU memory available")
    
    if not scheduler.is_model_running(model_name):
        await scheduler.start_model(model_name)
        await asyncio.sleep(5)
    
    vllm_port = scheduler.get_model_port(model_name)
    vllm_url = f"http://localhost:{vllm_port}/v1/chat/completions"
    
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                vllm_url,
                json=request.dict(exclude_unset=True),
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
                return generate()
            else:
                result = response.json()
                result['id'] = f"chatcmpl-{os.urandom(12).hex()}"
                return result
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Model service unavailable: {str(e)}")

@app.get("/manage/gpu")
async def get_gpu_status():
    status = gpu_monitor.get_gpu_status()
    if not status:
        return {"status": "unavailable", "message": "No GPU detected"}
    return status

@app.get("/manage/models")
async def get_model_status():
    models = scheduler.get_available_models()
    status = {}
    for model in models:
        status[model] = {
            "running": scheduler.is_model_running(model),
            "port": scheduler.get_model_port(model),
            "service": scheduler.get_model_service(model)
        }
    return status

@app.post("/manage/models/{model_name}/start")
async def start_model(model_name: str):
    if not scheduler.is_model_available(model_name):
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    if scheduler.is_model_running(model_name):
        return {"status": "already_running", "model": model_name}
    
    success = await scheduler.start_model(model_name)
    if success:
        return {"status": "starting", "model": model_name}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to start model {model_name}")

@app.post("/manage/models/{model_name}/stop")
async def stop_model(model_name: str):
    if not scheduler.is_model_available(model_name):
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    if not scheduler.is_model_running(model_name):
        return {"status": "already_stopped", "model": model_name}
    
    success = await scheduler.stop_model(model_name)
    if success:
        return {"status": "stopped", "model": model_name}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to stop model {model_name}")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)