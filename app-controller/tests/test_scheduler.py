import pytest
from unittest.mock import Mock, patch, MagicMock
from core.scheduler import Scheduler, _parse_memory_size
from core.monitor import GPUMonitor
from core.sys_ctl import SystemController

class TestMemoryParsing:
    def test_parse_memory_bytes(self):
        assert _parse_memory_size("1024") == 1024
        assert _parse_memory_size("0") == 0
        assert _parse_memory_size("1000000") == 1000000

    def test_parse_memory_kb(self):
        assert _parse_memory_size("1KB") == 1024
        assert _parse_memory_size("1024KB") == 1024 * 1024

    def test_parse_memory_mb(self):
        assert _parse_memory_size("1MB") == 1024 ** 2
        assert _parse_memory_size("1024MB") == 1024 ** 3

    def test_parse_memory_gb(self):
        assert _parse_memory_size("1GB") == 1024 ** 3
        assert _parse_memory_size("12GB") == 12 * 1024 ** 3

    def test_parse_memory_tb(self):
        assert _parse_memory_size("1TB") == 1024 ** 4

    def test_parse_memory_case_insensitive(self):
        assert _parse_memory_size("1gb") == 1024 ** 3
        assert _parse_memory_size("1Gb") == 1024 ** 3

    def test_parse_memory_with_spaces(self):
        assert _parse_memory_size(" 12 GB ") == 12 * 1024 ** 3

    def test_parse_memory_invalid(self):
        assert _parse_memory_size("invalid") == 0
        assert _parse_memory_size("") == 0

class TestScheduler:
    @pytest.fixture
    def mock_gpu_monitor(self):
        monitor = Mock(spec=GPUMonitor)
        monitor.get_memory_usage.return_value = {
            "total": 24 * 1024 ** 3,
            "used": 5 * 1024 ** 3,
            "available": 19 * 1024 ** 3
        }
        return monitor

    @pytest.fixture
    def mock_sys_controller(self):
        controller = Mock(spec=SystemController)
        controller.is_service_running.return_value = False
        controller.start_service.return_value = True
        controller.stop_service.return_value = True
        return controller

    @pytest.fixture
    def scheduler(self, mock_gpu_monitor, mock_sys_controller):
        return Scheduler(mock_gpu_monitor, mock_sys_controller)

    def test_get_available_models(self, scheduler):
        models = scheduler.get_available_models()
        assert isinstance(models, list)
        assert len(models) > 0
        assert "gemma-2-9b" in models
        assert "llama-3-8b" in models

    def test_is_model_available(self, scheduler):
        assert scheduler.is_model_available("gemma-2-9b") is True
        assert scheduler.is_model_available("llama-3-8b") is True
        assert scheduler.is_model_available("unknown-model") is False

    def test_get_model_config(self, scheduler):
        config = scheduler.get_model_config("gemma-2-9b")
        assert config is not None
        assert config.get("service") == "vllm-gemma"
        assert config.get("port") == 8000

    def test_get_model_service(self, scheduler):
        assert scheduler.get_model_service("gemma-2-9b") == "vllm-gemma"
        assert scheduler.get_model_service("llama-3-8b") == "vllm-llama"
        assert scheduler.get_model_service("unknown") is None

    def test_get_model_port(self, scheduler):
        assert scheduler.get_model_port("gemma-2-9b") == 8000
        assert scheduler.get_model_port("llama-3-8b") == 8001
        assert scheduler.get_model_port("unknown") is None

    def test_is_model_running(self, scheduler, mock_sys_controller):
        mock_sys_controller.is_service_running.return_value = True
        assert scheduler.is_model_running("gemma-2-9b") is True
        
        mock_sys_controller.is_service_running.return_value = False
        assert scheduler.is_model_running("gemma-2-9b") is False

    @pytest.mark.asyncio
    async def test_start_model_success(self, scheduler, mock_sys_controller, mock_gpu_monitor):
        mock_sys_controller.is_service_running.side_effect = [False, True]
        mock_gpu_monitor.get_memory_usage.return_value = {
            "total": 24 * 1024 ** 3,
            "used": 5 * 1024 ** 3,
            "available": 19 * 1024 ** 3
        }
        
        result = await scheduler.start_model("gemma-2-9b")
        assert result is True
        mock_sys_controller.start_service.assert_called_once_with("vllm-gemma")

    @pytest.mark.asyncio
    async def test_start_model_insufficient_memory(self, scheduler, mock_gpu_monitor):
        mock_gpu_monitor.get_memory_usage.return_value = {
            "total": 24 * 1024 ** 3,
            "used": 23 * 1024 ** 3,
            "available": 1 * 1024 ** 3
        }
        
        result = await scheduler.start_model("gemma-2-9b")
        assert result is False

    @pytest.mark.asyncio
    async def test_stop_model(self, scheduler, mock_sys_controller):
        mock_sys_controller.stop_service.return_value = True
        
        result = await scheduler.stop_model("gemma-2-9b")
        assert result is True
        mock_sys_controller.stop_service.assert_called_once_with("vllm-gemma")

    def test_get_concurrency_limit(self, scheduler):
        assert scheduler.get_concurrency_limit() == 4

    def test_get_min_available_memory(self, scheduler):
        assert scheduler.get_min_available_memory() == 2 * 1024 ** 3

    def test_acquire_request(self, scheduler):
        result = scheduler.acquire_request("gemma-2-9b")
        assert result is True

    def test_release_request(self, scheduler):
        scheduler.acquire_request("gemma-2-9b")
        scheduler.release_request("gemma-2-9b")

    def test_get_active_requests(self, scheduler):
        scheduler.acquire_request("gemma-2-9b")
        count = scheduler.get_active_requests("gemma-2-9b")
        assert count >= 0

    def test_can_accept_request(self, scheduler):
        assert scheduler.can_accept_request("gemma-2-9b") is True