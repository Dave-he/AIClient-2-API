import yaml
import os
import asyncio
from typing import Dict, Optional, List, Set
from datetime import datetime, timedelta
from .rate_limiter import RateLimiter

def _parse_memory_size(size_str: str) -> int:
    if not size_str:
        return 0
    
    size_str = str(size_str).strip().upper()
    multipliers = {
        'TB': 1024 ** 4,
        'GB': 1024 ** 3,
        'MB': 1024 ** 2,
        'KB': 1024,
        'B': 1
    }
    
    for suffix, multiplier in multipliers.items():
        if size_str.endswith(suffix):
            num_str = size_str[:-len(suffix)].strip()
            if num_str:
                try:
                    num = float(num_str)
                    return int(num * multiplier)
                except ValueError:
                    pass
            break
    
    try:
        return int(size_str)
    except ValueError:
        return 0

class Scheduler:
    def __init__(self, gpu_monitor, sys_controller):
        self.gpu_monitor = gpu_monitor
        self.sys_controller = sys_controller
        self.config = self._load_config()
        self.running_models = {}
        self.rate_limiter = RateLimiter()
        self.preloaded_models: Set[str] = set()
        self.model_last_used: Dict[str, datetime] = {}
        self._init_preloaded_models()
    
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
                    "required_memory": 12 * 1024 ** 3,
                    "preload": False,
                    "keep_alive": True
                },
                "llama-3-8b": {
                    "service": "vllm-llama",
                    "port": 8001,
                    "required_memory": 10 * 1024 ** 3,
                    "preload": False,
                    "keep_alive": True
                }
            },
            "settings": {
                "concurrency_limit": 4,
                "min_available_memory": 2 * 1024 ** 3,
                "preload_timeout": 120,
                "idle_timeout": 300
            }
        }
    
    def _init_preloaded_models(self):
        preload_models = [name for name, cfg in self.config.get("models", {}).items() if cfg.get("preload", False)]
        if not preload_models:
            return
        
        try:
            loop = asyncio.get_running_loop()
            for model_name in preload_models:
                asyncio.create_task(self._preload_model(model_name))
        except RuntimeError:
            pass
    
    async def _preload_model(self, model_name: str):
        try:
            await self.start_model(model_name)
            self.preloaded_models.add(model_name)
        except Exception as e:
            pass
    
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
    
    def is_model_preloaded(self, model_name: str) -> bool:
        return model_name in self.preloaded_models
    
    def can_accept_request(self, model_name: str) -> bool:
        concurrency_limit = self.get_concurrency_limit()
        return self.rate_limiter.is_available(model_name, concurrency_limit)
    
    def get_active_requests(self, model_name: str) -> int:
        return self.rate_limiter.get_active_requests(model_name)
    
    def acquire_request(self, model_name: str) -> bool:
        concurrency_limit = self.get_concurrency_limit()
        if not self.can_accept_request(model_name):
            return False
        self.rate_limiter.increment_request(model_name)
        self.model_last_used[model_name] = datetime.now()
        return True
    
    def release_request(self, model_name: str):
        self.rate_limiter.decrement_request(model_name)
        try:
            loop = asyncio.get_running_loop()
            asyncio.create_task(self._check_idle_timeout(model_name))
        except RuntimeError:
            pass
    
    def get_preloaded_models(self) -> List[str]:
        return list(self.preloaded_models)
    
    async def _check_idle_timeout(self, model_name: str):
        idle_timeout = self.config.get("settings", {}).get("idle_timeout", 300)
        model_config = self.get_model_config(model_name)
        
        if model_config and model_config.get("keep_alive", False):
            return
        
        await asyncio.sleep(idle_timeout)
        
        last_used = self.model_last_used.get(model_name)
        if last_used and datetime.now() - last_used >= timedelta(seconds=idle_timeout):
            if self.get_active_requests(model_name) == 0:
                await self.stop_model(model_name)
                if model_name in self.preloaded_models:
                    self.preloaded_models.remove(model_name)
    
    async def start_model(self, model_name: str, force: bool = False) -> bool:
        model_config = self.get_model_config(model_name)
        if not model_config:
            return False
        
        service_name = model_config.get("service")
        required_memory = _parse_memory_size(model_config.get("required_memory", 0))
        
        if self.is_model_running(model_name):
            return True
        
        if required_memory > 0:
            mem_info = self.gpu_monitor.get_memory_usage()
            if not mem_info or mem_info.get("available", 0) < required_memory:
                if not force:
                    return False
        
        success = self.sys_controller.start_service(service_name)
        if success:
            preload_timeout = self.config.get("settings", {}).get("preload_timeout", 120)
            check_interval = 2
            max_retries = preload_timeout // check_interval
            
            await asyncio.sleep(check_interval)
            for _ in range(max_retries):
                if self.is_model_running(model_name):
                    self.model_last_used[model_name] = datetime.now()
                    return True
                await asyncio.sleep(check_interval)
        
        return False
    
    async def stop_model(self, model_name: str) -> bool:
        service_name = self.get_model_service(model_name)
        if not service_name:
            return False
        
        success = self.sys_controller.stop_service(service_name)
        if success and model_name in self.preloaded_models:
            self.preloaded_models.remove(model_name)
        return success
    
    async def switch_model(self, target_model: str) -> bool:
        if not self.is_model_available(target_model):
            return False
        
        if self.is_model_running(target_model):
            return True
        
        mem_info = self.gpu_monitor.get_memory_usage()
        if not mem_info:
            return False
        
        target_config = self.get_model_config(target_model)
        target_memory = _parse_memory_size(target_config.get("required_memory", 0))
        
        if mem_info.get("available", 0) >= target_memory:
            return await self.start_model(target_model)
        
        running_models = [m for m in self.get_available_models() if self.is_model_running(m) and m != target_model]
        
        for model in running_models:
            model_config = self.get_model_config(model)
            if not model_config.get("keep_alive", False):
                if self.get_active_requests(model) == 0:
                    await self.stop_model(model)
                    mem_info = self.gpu_monitor.get_memory_usage()
                    if mem_info and mem_info.get("available", 0) >= target_memory:
                        return await self.start_model(target_model)
        
        return False
    
    def get_concurrency_limit(self) -> int:
        return self.config.get("settings", {}).get("concurrency_limit", 4)
    
    def get_min_available_memory(self) -> int:
        return _parse_memory_size(self.config.get("settings", {}).get("min_available_memory", 2 * 1024 ** 3))
    
    def get_model_last_used(self, model_name: str) -> Optional[datetime]:
        return self.model_last_used.get(model_name)