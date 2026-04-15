import yaml
import os
import asyncio
from typing import Dict, Optional, List

class Scheduler:
    def __init__(self, gpu_monitor, sys_controller):
        self.gpu_monitor = gpu_monitor
        self.sys_controller = sys_controller
        self.config = self._load_config()
        self.running_models = {}
    
    def _load_config(self) -> Dict:
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.yaml')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        return self._get_default_config()
    
    def _get_default_config(self) -> Dict:
        return {
            "models": {
                "gemma-2-9b": {
                    "service": "vllm-gemma",
                    "port": 8000,
                    "required_memory": 12 * 1024 ** 3
                },
                "llama-3-8b": {
                    "service": "vllm-llama",
                    "port": 8001,
                    "required_memory": 10 * 1024 ** 3
                }
            },
            "settings": {
                "concurrency_limit": 4,
                "min_available_memory": 2 * 1024 ** 3
            }
        }
    
    def get_available_models(self) -> List[str]:
        return list(self.config.get("models", {}).keys())
    
    def is_model_available(self, model_name: str) -> bool:
        return model_name in self.config.get("models", {})
    
    def get_model_config(self, model_name: str) -> Optional[Dict]:
        return self.config.get("models", {}).get(model_name)
    
    def get_model_service(self, model_name: str) -> Optional[str]:
        config = self.get_model_config(model_name)
        return config.get("service") if config else None
    
    def get_model_port(self, model_name: str) -> Optional[int]:
        config = self.get_model_config(model_name)
        return config.get("port") if config else None
    
    def is_model_running(self, model_name: str) -> bool:
        service_name = self.get_model_service(model_name)
        if not service_name:
            return False
        return self.sys_controller.is_service_running(service_name)
    
    async def start_model(self, model_name: str) -> bool:
        model_config = self.get_model_config(model_name)
        if not model_config:
            return False
        
        service_name = model_config.get("service")
        required_memory = model_config.get("required_memory", 0)
        
        if self.is_model_running(model_name):
            return True
        
        if required_memory > 0:
            mem_info = self.gpu_monitor.get_memory_usage()
            if not mem_info or mem_info.get("available", 0) < required_memory:
                return False
        
        success = self.sys_controller.start_service(service_name)
        if success:
            await asyncio.sleep(2)
            for _ in range(30):
                if self.is_model_running(model_name):
                    return True
                await asyncio.sleep(2)
        
        return False
    
    async def stop_model(self, model_name: str) -> bool:
        service_name = self.get_model_service(model_name)
        if not service_name:
            return False
        
        return self.sys_controller.stop_service(service_name)
    
    def get_concurrency_limit(self) -> int:
        return self.config.get("settings", {}).get("concurrency_limit", 4)
    
    def get_min_available_memory(self) -> int:
        return self.config.get("settings", {}).get("min_available_memory", 2 * 1024 ** 3)