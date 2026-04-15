import httpx
import json
import asyncio
from typing import Dict, Any, Optional

class VLLMProxy:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(60))
    
    async def chat_completion(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}/v1/chat/completions"
        response = await self.client.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    
    async def chat_completion_stream(self, payload: Dict[str, Any]):
        url = f"{self.base_url}/v1/chat/completions"
        async with self.client.stream('POST', url, json=payload) as response:
            async for chunk in response.aiter_lines():
                if chunk.startswith("data: "):
                    chunk_data = chunk[6:]
                    if chunk_data == "[DONE]":
                        yield {"type": "done"}
                        break
                    try:
                        yield json.loads(chunk_data)
                    except json.JSONDecodeError:
                        continue
    
    async def list_models(self) -> Dict[str, Any]:
        url = f"{self.base_url}/v1/models"
        response = await self.client.get(url)
        response.raise_for_status()
        return response.json()
    
    async def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/v1/models/{model_name}"
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError:
            return None
    
    async def close(self):
        await self.client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc, tb):
        await self.close()