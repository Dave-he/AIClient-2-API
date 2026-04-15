import subprocess
import json
import re
from typing import Dict, Optional

class GPUMonitor:
    def __init__(self):
        self._nvidia_smi_available = self._check_nvidia_smi()
    
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
        if not self._nvidia_smi_available:
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
                    gpu_info = {
                        "name": parts[0].strip(),
                        "total_memory": int(parts[1].strip()) * 1024 ** 2,
                        "used_memory": int(parts[2].strip()) * 1024 ** 2,
                        "available_memory": int(parts[3].strip()) * 1024 ** 2,
                        "temperature": int(parts[4].strip()),
                        "utilization": int(parts[5].strip())
                    }
                    gpus.append(gpu_info)
            
            if gpus:
                primary_gpu = gpus[0]
                return {
                    "status": "available",
                    "gpu_count": len(gpus),
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
                "total": status["primary"]["total_memory"],
                "used": status["primary"]["used_memory"],
                "available": status["primary"]["available_memory"]
            }
        return None
    
    def is_memory_available(self, required_bytes: int) -> bool:
        mem_info = self.get_memory_usage()
        if mem_info and mem_info.get("available", 0) >= required_bytes:
            return True
        return False