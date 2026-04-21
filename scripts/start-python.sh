#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$DIR")"
CONTROLLER_DIR="$ROOT_DIR/app-controller"

cd "$CONTROLLER_DIR"

if ! command -v pip3 &> /dev/null; then
    echo "pip3 not found, please install Python 3 and pip"
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
pip install -q fastapi uvicorn httpx pydantic python-dotenv pynvml prometheus-client websockets

echo "Starting Python app-controller service..."
uvicorn main:app --host 0.0.0.0 --port 5000