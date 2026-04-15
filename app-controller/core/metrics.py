from datetime import datetime, timedelta
from typing import Dict, List, Optional
from collections import defaultdict
from core.logger import setup_logger

logger = setup_logger()

class MetricsCollector:
    def __init__(self):
        self.request_counts: Dict[str, int] = defaultdict(int)
        self.error_counts: Dict[str, int] = defaultdict(int)
        self.response_times: List[float] = []
        self.model_requests: Dict[str, int] = defaultdict(int)
        self.start_time = datetime.now()
    
    def record_request(self, endpoint: str, status_code: int, response_time: float, model_name: Optional[str] = None):
        self.request_counts[endpoint] += 1
        
        if status_code >= 400:
            self.error_counts[endpoint] += 1
        
        self.response_times.append(response_time)
        if len(self.response_times) > 1000:
            self.response_times = self.response_times[-1000:]
        
        if model_name:
            self.model_requests[model_name] += 1
    
    def get_metrics(self) -> Dict:
        avg_response_time = sum(self.response_times) / len(self.response_times) if self.response_times else 0
        max_response_time = max(self.response_times) if self.response_times else 0
        min_response_time = min(self.response_times) if self.response_times else 0
        
        uptime = datetime.now() - self.start_time
        
        return {
            "uptime": str(uptime),
            "total_requests": sum(self.request_counts.values()),
            "total_errors": sum(self.error_counts.values()),
            "request_counts": dict(self.request_counts),
            "error_counts": dict(self.error_counts),
            "response_time": {
                "average": round(avg_response_time, 2),
                "max": round(max_response_time, 2),
                "min": round(min_response_time, 2),
                "count": len(self.response_times)
            },
            "model_requests": dict(self.model_requests),
            "timestamp": datetime.now().isoformat()
        }
    
    def reset(self):
        self.request_counts.clear()
        self.error_counts.clear()
        self.response_times.clear()
        self.model_requests.clear()
        self.start_time = datetime.now()
    
    def get_health_score(self) -> float:
        total = sum(self.request_counts.values())
        errors = sum(self.error_counts.values())
        
        if total == 0:
            return 100.0
        
        error_rate = errors / total
        score = max(0, 100 - (error_rate * 100))
        return round(score, 2)