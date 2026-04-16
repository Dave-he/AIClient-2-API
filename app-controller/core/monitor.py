import subprocess
import json
import re
import asyncio
import httpx
from datetime import datetime, timedelta
from typing import Dict, Optional, List

class GPUMonitor:
    def __init__(self):
        self._last_flush_time = datetime.now()
        self._flush_interval = 300  # 5分钟
        self._memory_strategy = "balanced"  # conservative, balanced, aggressive
        self._fragmentation_history: List[float] = []
    
    def _check_nvidia_smi(self) -> bool:
        try:
            result = subprocess.run(
                ["nvidia-smi", "--version"],
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except FileNotFoundError:
            return False
    
    def get_gpu_status(self) -> Optional[Dict]:
        if not self._check_nvidia_smi():
            return None
        
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total,memory.used,memory.free,temperature.gpu,utilization.gpu", "--format=csv,noheader,nounits"],
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                return None
            
            output = result.stdout.strip()
            if not output:
                return None
            
            lines = output.split('\n')
            gpus = []
            
            for line in lines:
                parts = line.split(',')
                if len(parts) >= 6:
                    total_mb = int(parts[1].strip())
                    used_mb = int(parts[2].strip())
                    free_mb = int(parts[3].strip())
                    
                    gpu_info = {
                        "name": parts[0].strip(),
                        "total_memory": total_mb,
                        "used_memory": used_mb,
                        "available_memory": free_mb,
                        "temperature": int(parts[4].strip()),
                        "utilization": int(parts[5].strip()),
                        "memory_utilization": int(used_mb / total_mb * 100) if total_mb > 0 else 0
                    }
                    gpus.append(gpu_info)
            
            if gpus:
                primary_gpu = gpus[0]
                return {
                    "status": "available",
                    "gpu_count": len(gpus),
                    "name": primary_gpu["name"],
                    "total_memory": primary_gpu["total_memory"],
                    "used_memory": primary_gpu["used_memory"],
                    "available_memory": primary_gpu["available_memory"],
                    "temperature": primary_gpu["temperature"],
                    "utilization": primary_gpu["utilization"],
                    "memory_utilization": primary_gpu["memory_utilization"],
                    "primary": primary_gpu,
                    "all_gpus": gpus
                }
            return None
        
        except Exception as e:
            return None
    
    def get_memory_usage(self) -> Optional[Dict[str, int]]:
        status = self.get_gpu_status()
        if status:
            return {
                "total": status["total_memory"],
                "used": status["used_memory"],
                "available": status["available_memory"]
            }
        return None
    
    def is_memory_available(self, required_bytes: int) -> bool:
        mem_info = self.get_memory_usage()
        if mem_info and mem_info.get("available", 0) >= required_bytes:
            return True
        return False
    
    def detect_fragmentation(self) -> float:
        """检测显存碎片率"""
        status = self.get_gpu_status()
        if not status:
            return 0.0
        
        total = status["primary"]["total_memory"]
        used = status["primary"]["used_memory"]
        available = status["primary"]["available_memory"]
        
        fragmentation = (total - used - available) / total if total > 0 else 0.0
        self._fragmentation_history.append(fragmentation)
        if len(self._fragmentation_history) > 60:
            self._fragmentation_history = self._fragmentation_history[-60:]
        
        return fragmentation
    
    def get_average_fragmentation(self) -> float:
        """获取平均碎片率"""
        if not self._fragmentation_history:
            return 0.0
        return sum(self._fragmentation_history) / len(self._fragmentation_history)
    
    def set_memory_strategy(self, strategy: str):
        """设置显存策略"""
        valid_strategies = ["conservative", "balanced", "aggressive"]
        if strategy in valid_strategies:
            self._memory_strategy = strategy
    
    def get_memory_strategy(self) -> str:
        """获取当前显存策略"""
        return self._memory_strategy
    
    def get_recommended_utilization(self) -> float:
        """根据策略返回推荐的显存利用率"""
        strategies = {
            "conservative": 0.80,
            "balanced": 0.90,
            "aggressive": 0.95
        }
        return strategies.get(self._memory_strategy, 0.90)
    
    async def optimize_memory(self, vllm_port: int = 8000) -> bool:
        """智能显存优化"""
        if (datetime.now() - self._last_flush_time).seconds < self._flush_interval:
            return False
        
        fragmentation = self.detect_fragmentation()
        avg_fragmentation = self.get_average_fragmentation()
        
        if fragmentation > 0.1 or avg_fragmentation > 0.05:
            await self._flush_vllm_cache(vllm_port)
            self._last_flush_time = datetime.now()
            return True
        
        return False
    
    async def _flush_vllm_cache(self, port: int):
        """刷新vLLM缓存"""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(f"http://localhost:{port}/v1/cache/flush")
        except Exception as e:
            pass
    
    async def optimize_memory_for_model(self, required_memory: int, vllm_port: int = 8000) -> bool:
        """为加载模型优化显存"""
        mem_info = self.get_memory_usage()
        if not mem_info:
            return False
        
        available = mem_info.get("available", 0)
        if available >= required_memory:
            return True
        
        await self._flush_vllm_cache(vllm_port)
        await asyncio.sleep(2)
        
        mem_info = self.get_memory_usage()
        return mem_info and mem_info.get("available", 0) >= required_memory
    
    def get_memory_optimization_status(self) -> Dict:
        """获取显存优化状态"""
        return {
            "strategy": self._memory_strategy,
            "fragmentation": self.detect_fragmentation(),
            "avg_fragmentation": self.get_average_fragmentation(),
            "recommended_utilization": self.get_recommended_utilization(),
            "last_flush": self._last_flush_time.isoformat(),
            "flush_interval": self._flush_interval
        }