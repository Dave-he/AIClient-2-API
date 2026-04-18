import subprocess
import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

class SystemController:
    def __init__(self):
        if os.name == 'nt':
            self._use_sudo = False
        else:
            self._use_sudo = os.geteuid() != 0 if hasattr(os, 'geteuid') else True
        
        self._restart_attempts: Dict[str, int] = {}
        self._last_restart_time: Dict[str, datetime] = {}
        self._max_restart_attempts = 3
        self._restart_cooldown = 60  # 冷却时间60秒
        self._watchdog_enabled = False
        self._watchdog_tasks: Dict[str, asyncio.Task] = {}
    
    def _run_command(self, cmd: list) -> subprocess.CompletedProcess:
        if self._use_sudo and os.name != 'nt':
            cmd = ['sudo'] + cmd
        return subprocess.run(cmd, capture_output=True, text=True)
    
    def start_service(self, service_name: str) -> bool:
        result = self._run_command(['systemctl', 'start', service_name])
        return result.returncode == 0
    
    def stop_service(self, service_name: str) -> bool:
        result = self._run_command(['systemctl', 'stop', service_name])
        return result.returncode == 0
    
    def restart_service(self, service_name: str) -> bool:
        result = self._run_command(['systemctl', 'restart', service_name])
        return result.returncode == 0
    
    def get_service_status(self, service_name: str) -> str:
        result = self._run_command(['systemctl', 'is-active', service_name])
        if result.returncode == 0:
            return result.stdout.strip()
        return 'inactive'
    
    def is_service_running(self, service_name: str) -> bool:
        status = self.get_service_status(service_name)
        return status == 'active'
    
    def enable_service(self, service_name: str) -> bool:
        result = self._run_command(['systemctl', 'enable', service_name])
        return result.returncode == 0
    
    def disable_service(self, service_name: str) -> bool:
        result = self._run_command(['systemctl', 'disable', service_name])
        return result.returncode == 0
    
    def get_service_info(self, service_name: str) -> Optional[Dict[str, Any]]:
        result = self._run_command(['systemctl', 'show', service_name, '--json'])
        if result.returncode == 0:
            try:
                return json.loads(result.stdout)
            except:
                pass
        return None
    
    def list_services(self, pattern: str = '') -> list:
        result = self._run_command(['systemctl', 'list-units', '--type=service', '--all', '--json'])
        if result.returncode == 0:
            try:
                services = json.loads(result.stdout)
                if pattern:
                    return [s for s in services if pattern in s.get('id', '')]
                return services
            except:
                pass
        return []
    
    def get_process_info(self, port: int) -> Optional[Dict[str, Any]]:
        try:
            result = subprocess.run(
                ['lsof', '-i', f':{port}', '-s', 'TCP:LISTEN', '-F', 'pc'],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                pid = None
                cmd = None
                for line in lines:
                    if line.startswith('p'):
                        pid = int(line[1:])
                    elif line.startswith('c'):
                        cmd = line[1:]
                if pid:
                    return {'pid': pid, 'command': cmd}
        except:
            pass
        return None
    
    def get_restart_attempts(self, service_name: str) -> int:
        """获取服务重启尝试次数"""
        return self._restart_attempts.get(service_name, 0)
    
    def reset_restart_attempts(self, service_name: str):
        """重置服务重启尝试次数"""
        self._restart_attempts[service_name] = 0
    
    async def _can_restart(self, service_name: str) -> bool:
        last_time = self._last_restart_time.get(service_name)
        if last_time and (datetime.now() - last_time).total_seconds() < self._restart_cooldown:
            return False
        
        attempts = self._restart_attempts.get(service_name, 0)
        return attempts < self._max_restart_attempts
    
    async def try_restart_service(self, service_name: str) -> bool:
        """尝试重启服务（带冷却和重试限制）"""
        if not await self._can_restart(service_name):
            return False
        
        self._last_restart_time[service_name] = datetime.now()
        self._restart_attempts[service_name] = self._restart_attempts.get(service_name, 0) + 1
        
        success = self.restart_service(service_name)
        if success:
            self.reset_restart_attempts(service_name)
        
        return success
    
    async def start_watchdog(self, service_name: str, check_interval: int = 5):
        """启动服务监控看门狗"""
        if service_name in self._watchdog_tasks:
            self._watchdog_tasks[service_name].cancel()
        
        async def watchdog_loop():
            while True:
                try:
                    if not self.is_service_running(service_name):
                        await self.try_restart_service(service_name)
                except Exception:
                    pass
                
                await asyncio.sleep(check_interval)
        
        self._watchdog_tasks[service_name] = asyncio.create_task(watchdog_loop())
        self._watchdog_enabled = True
    
    def stop_watchdog(self, service_name: str):
        """停止服务监控看门狗"""
        task = self._watchdog_tasks.get(service_name)
        if task:
            task.cancel()
            del self._watchdog_tasks[service_name]
    
    def get_watchdog_status(self) -> Dict[str, bool]:
        """获取所有看门狗状态"""
        status = {}
        for service_name, task in self._watchdog_tasks.items():
            status[service_name] = not task.done()
        return status
    
    def set_max_restart_attempts(self, attempts: int):
        """设置最大重启尝试次数"""
        self._max_restart_attempts = attempts
    
    def set_restart_cooldown(self, seconds: int):
        """设置重启冷却时间（秒）"""
        self._restart_cooldown = seconds