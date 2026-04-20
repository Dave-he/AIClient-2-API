#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$DIR")"

cd "$ROOT_DIR"

echo "=== Starting AIClient2API Service ==="

echo "Starting Node.js API service on port 30000..."
node src/core/master.js