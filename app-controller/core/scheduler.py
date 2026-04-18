import yaml
import os
import asyncio
import httpx
import threading
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
        self._model_lock = threading.Lock()
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
                "idle_timeout": 300,
                "memory_cleanup_delay": 3,
                "gpu_memory_utilization": 0.9
            }
        }
    
    def _init_preloaded_models(self):
        for model_name, model_config in self.config.get('models', {}).items():
            if model_config.get('preload', False):
                self.preloaded_models.add(model_name)
    
    def get_available_models(self) -> List[str]:
        return list(self.config.get('models', {}).keys())
    
    def is_model_available(self, model_name: str) -> bool:
        return model_name in self.config.get('models', {})
    
    def get_model_config(self, model_name: str) -> Optional[Dict]:
        return self.config.get('models', {}).get(model_name)
    
    def get_model_port(self, model_name: str) -> Optional[int]:
        config = self.get_model_config(model_name)
        return config.get('port') if config else None
    
    def get_model_service(self, model_name: str) -> Optional[str]:
        config = self.get_model_config(model_name)
        return config.get('service') if config else None
    
    def get_min_available_memory(self) -> int:
        value = self.config.get('settings', {}).get('min_available_memory', '2GB')
        return _parse_memory_size(value)
    
    def get_concurrency_limit(self) -> int:
        return self.config.get('settings', {}).get('concurrency_limit', 4)
    
    def is_model_running(self, model_name: str) -> bool:
        with self._model_lock:
            port = self.get_model_port(model_name)
            if port:
                process_info = self.sys_controller.get_process_info(port)
                if process_info:
                    if model_name not in self.running_models:
                        self.running_models[model_name] = datetime.now()
                    return True
            
            if model_name in self.running_models:
                del self.running_models[model_name]
            
            return False
    
    def is_model_preloaded(self, model_name: str) -> bool:
        return model_name in self.preloaded_models
    
    def get_model_last_used(self, model_name: str) -> Optional[datetime]:
        return self.model_last_used.get(model_name)
    
    def get_preloaded_models(self) -> List[str]:
        return list(self.preloaded_models)
    
    def get_active_requests(self, model_name: str) -> int:
        return self.rate_limiter.get_active_requests(model_name)
    
    def acquire_request(self, model_name: str) -> bool:
        return self.rate_limiter.acquire_request(model_name, self.get_concurrency_limit())
    
    def release_request(self, model_name: str):
        self.rate_limiter.release_request(model_name)
        self.model_last_used[model_name] = datetime.now()
    
    def can_accept_request(self, model_name: str) -> bool:
        if not self.is_model_available(model_name):
            return False
        
        mem_info = self.gpu_monitor.get_memory_usage()
        if not mem_info:
            return False
        
        if mem_info.get('available', 0) < self.get_min_available_memory():
            return False
        
        return self.rate_limiter.can_accept_request(model_name, self.get_concurrency_limit())
    
    def is_queue_available(self, model_name: str) -> bool:
        """检查队列是否可用"""
        return self.rate_limiter.get_total_queue_length(model_name) < 100
    
    def get_queue_length(self, model_name: str) -> int:
        """获取队列长度"""
        return self.rate_limiter.get_queue_length(model_name)
    
    def get_wait_time_estimate(self, model_name: str) -> float:
        """估算等待时间"""
        return self.rate_limiter.get_wait_time_estimate(model_name, self.get_concurrency_limit())
    
    async def wait_for_slot(self, model_name: str, timeout: int = 30) -> bool:
        """等待可用槽位，支持优雅降级"""
        return await self.rate_limiter.wait_for_slot(model_name, self.get_concurrency_limit(), timeout)
    
    def enqueue_request(self, model_name: str, request_data: Dict, priority: str = "normal") -> str:
        """将请求加入队列（支持优先级）"""
        return self.rate_limiter.enqueue_request(model_name, request_data, priority)
    
    def get_supported_priorities(self) -> List[str]:
        """获取支持的优先级列表"""
        return list(self.rate_limiter.PRIORITIES.keys())
    
    async def _cleanup_memory_fragmentation(self) -> bool:
        """尝试清理显存碎片"""
        cleanup_delay = self.config.get('settings', {}).get('memory_cleanup_delay', 3)
        await asyncio.sleep(cleanup_delay)
        return True
    
    async def _send_warmup_request(self, model_name: str) -> bool:
        """发送预热请求到 vLLM"""
        port = self.get_model_port(model_name)
        url = f"http://localhost:{port}/v1/chat/completions"
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    url,
                    json={
                        "model": model_name,
                        "messages": [{"role": "user", "content": "Hello"}],
                        "max_tokens": 1
                    },
                    timeout=30
                )
                return response.status_code == 200
        except Exception:
            return False
    
    async def _adjust_gpu_utilization(self, model_name: str, target_utilization: float = 0.9):
        """调整 GPU 显存利用率"""
        port = self.get_model_port(model_name)
        url = f"http://localhost:{port}/v1/control"
        
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    url,
                    json={"gpu_memory_utilization": target_utilization},
                    timeout=10
                )
        except Exception:
            pass
    
    async def start_model(self, model_name: str) -> bool:
        config = self.get_model_config(model_name)
        if not config:
            return False
        
        service_name = config.get('service')
        if not service_name:
            return False
        
        if self.sys_controller.is_service_running(service_name):
            with self._model_lock:
                self.running_models[model_name] = datetime.now()
            return True
        
        mem_info = self.gpu_monitor.get_memory_usage()
        if mem_info:
            required_memory = _parse_memory_size(config.get('required_memory', 0))
            if mem_info.get('available', 0) < required_memory + self.get_min_available_memory():
                success = await self._free_up_memory(model_name)
                if not success:
                    return False
        
        success = self.sys_controller.start_service(service_name)
        if success:
            with self._model_lock:
                self.running_models[model_name] = datetime.now()
            
            preload_timeout = self.config.get('settings', {}).get('preload_timeout', 120)
            await asyncio.sleep(min(30, preload_timeout))
            
            await self._send_warmup_request(model_name)
            
            gpu_util = self.config.get('settings', {}).get('gpu_memory_utilization', 0.9)
            await self._adjust_gpu_utilization(model_name, gpu_util)
        
        return success
    
    async def stop_model(self, model_name: str) -> bool:
        config = self.get_model_config(model_name)
        if not config:
            return False
        
        service_name = config.get('service')
        if not service_name:
            return False
        
        success = self.sys_controller.stop_service(service_name)
        if success:
            await self._cleanup_memory_fragmentation()
            with self._model_lock:
                if model_name in self.running_models:
                    del self.running_models[model_name]
        
        return success
    
    async def _free_up_memory(self, target_model_name: str) -> bool:
        target_config = self.get_model_config(target_model_name)
        if not target_config:
            return False
        
        target_required = _parse_memory_size(target_config.get('required_memory', 0))
        mem_info = self.gpu_monitor.get_memory_usage()
        
        if not mem_info:
            return False
        
        available_memory = mem_info.get('available', 0)
        needed_memory = target_required + self.get_min_available_memory()
        
        if available_memory >= needed_memory:
            return True
        
        models_to_stop = []
        with self._model_lock:
            for model_name in list(self.running_models.keys()):
                if model_name == target_model_name:
                    continue
                
                config = self.get_model_config(model_name)
                if config and config.get('keep_alive', False):
                    continue
                
                models_to_stop.append((model_name, config.get('required_memory', 0)))
        
        models_to_stop.sort(key=lambda x: x[1], reverse=True)
        
        for model_name, _ in models_to_stop:
            await self.stop_model(model_name)
            
            gpu_status = self.gpu_monitor.get_gpu_status()
            if gpu_status and gpu_status.get('available_memory', 0) >= needed_memory:
                return True
        
        return False
    
    async def switch_model(self, target_model_name: str) -> bool:
        """智能切换到目标模型，自动处理显存管理"""
        if not self.is_model_available(target_model_name):
            return False
        
        if self.is_model_running(target_model_name):
            return True
        
        success = await self._free_up_memory(target_model_name)
        if not success:
            return False
        
        return await self.start_model(target_model_name)
    
    async def preload_models(self):
        """预热所有配置为预加载的模型"""
        for model_name in self.preloaded_models:
            if not self.is_model_running(model_name):
                await self.start_model(model_name)