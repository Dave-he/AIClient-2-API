import subprocess
import os
import json
from typing import Optional, Dict, Any

class SystemController:
    def __init__(self):
        self._use_sudo = os.geteuid() != 0 if hasattr(os, 'geteuid') else True
    
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