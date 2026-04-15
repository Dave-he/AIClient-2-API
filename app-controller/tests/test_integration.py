import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import json
import asyncio

@pytest.fixture
def mock_redis_client():
    mock = Mock()
    mock.ping.return_value = True
    mock.incr.return_value = 1
    mock.decr.return_value = 0
    mock.get.return_value = b'0'
    mock.set.return_value = True
    mock.delete.return_value = True
    mock.rpush.return_value = 1
    mock.lpop.return_value = None
    mock.llen.return_value = 0
    mock.keys.return_value = []
    mock.lrem.return_value = 0
    return mock

@pytest.fixture
def mock_vllm_response():
    return {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "created": 1234567890,
        "model": "gemma-2-9b",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Hello from vLLM!"},
                "finish_reason": "stop"
            }
        ]
    }

@pytest.fixture
def client(mock_redis_client, mock_vllm_response):
    with patch('redis.from_url') as mock_from_url:
        mock_from_url.return_value = mock_redis_client
        
        with patch('httpx.AsyncClient') as mock_http_client:
            mock_response = Mock()
            mock_response.raise_for_status = AsyncMock()
            mock_response.json = AsyncMock(return_value=mock_vllm_response)
            mock_response.aiter_lines = AsyncMock(return_value=[])
            
            mock_client_instance = Mock()
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_http_client.return_value = mock_client_instance
            
            with patch('core.monitor.GPUMonitor.get_gpu_status') as mock_gpu_status:
                mock_gpu_status.return_value = {
                    "status": "available",
                    "gpu_count": 1,
                    "available_memory": 19 * 1024 ** 3,
                    "primary": {
                        "total_memory": 24 * 1024 ** 3,
                        "used_memory": 5 * 1024 ** 3,
                        "available_memory": 19 * 1024 ** 3
                    },
                    "all_gpus": []
                }
                
                with patch('core.sys_ctl.SystemController.is_service_running') as mock_is_running:
                    mock_is_running.return_value = True
                    
                    from main import app
                    with TestClient(app) as client:
                        yield client

class TestIntegration:
    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert "status" in response.json()

    def test_list_models(self, client):
        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert data["object"] == "list"
        assert isinstance(data["data"], list)

    def test_chat_completions_non_streaming(self, client, mock_redis_client):
        mock_redis_client.get.return_value = b'0'
        mock_redis_client.incr.return_value = 1
        
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "gemma-2-9b",
                "messages": [{"role": "user", "content": "Hello"}]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["object"] == "chat.completion"
        assert len(data["choices"]) > 0

    def test_chat_completions_model_not_found(self, client):
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "unknown-model",
                "messages": [{"role": "user", "content": "Hello"}]
            }
        )
        
        assert response.status_code == 404

    def test_chat_completions_too_many_requests(self, client, mock_redis_client):
        mock_redis_client.get.return_value = b'5'
        
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "gemma-2-9b",
                "messages": [{"role": "user", "content": "Hello"}]
            }
        )
        
        assert response.status_code == 429

    def test_get_gpu_status(self, client):
        response = client.get("/manage/gpu")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "available"

    def test_get_model_status(self, client):
        response = client.get("/manage/models")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

    def test_start_model(self, client):
        with patch('core.sys_ctl.SystemController.is_service_running') as mock_is_running:
            mock_is_running.side_effect = [False, True]
            
            with patch('core.sys_ctl.SystemController.start_service') as mock_start:
                mock_start.return_value = True
                
                response = client.post("/manage/models/gemma-2-9b/start")
                
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "starting"

    def test_stop_model(self, client):
        with patch('core.sys_ctl.SystemController.is_service_running') as mock_is_running:
            mock_is_running.return_value = True
            
            with patch('core.sys_ctl.SystemController.stop_service') as mock_stop:
                mock_stop.return_value = True
                
                response = client.post("/manage/models/gemma-2-9b/stop")
                
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "stopped"

    def test_queue_status(self, client):
        response = client.get("/manage/queue")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

    def test_preload_status(self, client):
        response = client.get("/manage/preload")
        assert response.status_code == 200
        data = response.json()
        assert "preloaded_models" in data
        assert "all_models" in data

    def test_switch_model(self, client):
        with patch('core.scheduler.Scheduler.switch_model') as mock_switch:
            mock_switch.return_value = True
            
            response = client.post("/manage/models/gemma-2-9b/switch")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "switched"

    def test_preload_model(self, client):
        with patch('core.scheduler.Scheduler.start_model') as mock_start:
            mock_start.return_value = True
            
            response = client.post("/manage/preload/gemma-2-9b")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "preloaded"