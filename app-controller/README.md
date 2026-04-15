# AI Controller - Local LLM Management Service

A Python FastAPI-based control layer for managing local LLM models with GPU resource monitoring and automatic model scheduling.

## Architecture

This service acts as a smart proxy between AIClient-2-API and local vLLM instances, providing:

- **Automatic Model Management**: Start/stop models based on availability
- **GPU Memory Protection**: Prevent out-of-memory errors
- **OpenAI Protocol Compatibility**: Standard `/v1/chat/completions` endpoint
- **Real-time Monitoring**: GPU status and model health tracking

## Quick Start

### Prerequisites
- Python 3.10+
- NVIDIA GPU with CUDA support
- vLLM installed (`pip install vllm`)
- Systemd (for model service management)

### Installation

```bash
cd app-controller
pip install -r requirements.txt
```

### Configuration

Edit `config.yaml` to configure your models:

```yaml
models:
  gemma-2-9b:
    service: vllm-gemma
    port: 8000
    required_memory: 12GB
  
  llama-3-8b:
    service: vllm-llama
    port: 8001
    required_memory: 10GB

settings:
  concurrency_limit: 4
  min_available_memory: 2GB
```

### Start Service

```bash
python main.py
```

The service will be available at `http://localhost:5000`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | OpenAI-compatible chat completions |
| `/v1/models` | GET | List available models |
| `/manage/gpu` | GET | GPU status (memory, temperature, utilization) |
| `/manage/models` | GET | All model statuses |
| `/manage/models/{name}/start` | POST | Start a model |
| `/manage/models/{name}/stop` | POST | Stop a model |
| `/health` | GET | Health check |

## Systemd Integration

Copy the service files to `/etc/systemd/system/`:

```bash
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ai-controller
```

## Usage with AIClient-2-API

1. In AIClient-2-API admin panel, add a new Custom provider
2. Set Base URL to `http://localhost:5000`
3. Set any API Key (validation is disabled for local usage)

## Project Structure

```
app-controller/
├── main.py              # FastAPI entry point
├── config.yaml          # Model configuration
├── requirements.txt     # Python dependencies
├── core/
│   ├── monitor.py       # GPU memory monitoring
│   ├── scheduler.py     # Model scheduling logic
│   └── sys_ctl.py       # Systemd service control
└── api/
    └── proxy_vllm.py    # vLLM request proxy
```

## Key Features

1. **Automatic Model Startup**: Models are started on-demand when requests come in
2. **Memory Protection**: Returns 503 error if insufficient GPU memory
3. **Systemd Integration**: Reliable model service management
4. **Streaming Support**: Full support for SSE streaming responses
5. **Configurable**: Easy model-to-port/service mapping via YAML

## License

MIT