import yaml
import os
import asyncio
from typing import Dict, Callable, List
from datetime import datetime

class ConfigWatcher:
    def __init__(self, config_path: str):
        self.config_path = config_path
        self._config = {}
        self._last_modified = None
        self._callbacks: List[Callable[[Dict], None]] = []
        self._watch_task = None
        self._stop_event = asyncio.Event()
    
    def load_config(self) -> Dict:
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                return yaml.safe_load(f)
        return {}
    
    def get_config(self) -> Dict:
        return self._config
    
    def register_callback(self, callback: Callable[[Dict], None]):
        self._callbacks.append(callback)
    
    def _notify_callbacks(self, new_config: Dict):
        for callback in self._callbacks:
            try:
                callback(new_config)
            except Exception as e:
                pass
    
    async def _watch_loop(self):
        while not self._stop_event.is_set():
            try:
                if os.path.exists(self.config_path):
                    current_modified = os.path.getmtime(self.config_path)
                    if self._last_modified is None:
                        self._last_modified = current_modified
                        self._config = self.load_config()
                        self._notify_callbacks(self._config)
                    elif current_modified > self._last_modified:
                        self._last_modified = current_modified
                        new_config = self.load_config()
                        if new_config != self._config:
                            self._config = new_config
                            self._notify_callbacks(self._config)
            except Exception as e:
                pass
            
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=5)
            except asyncio.TimeoutError:
                pass
    
    def start_watching(self):
        if self._watch_task is None:
            try:
                loop = asyncio.get_running_loop()
                self._watch_task = loop.create_task(self._watch_loop())
            except RuntimeError:
                pass
    
    def stop_watching(self):
        if self._watch_task is not None:
            self._stop_event.set()
            self._watch_task.cancel()
            self._watch_task = None
