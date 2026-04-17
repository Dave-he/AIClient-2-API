#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$DIR")"

cd "$ROOT_DIR"

NPM="/root/.nvm/versions/node/v24.15.0/bin/npm"
NODE="/root/.nvm/versions/node/v24.15.0/bin/node"

echo "=== Starting AIClient2API Service ==="

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    "$NPM" install
fi

echo "Starting Node.js API service on port 30000..."
"$NODE" src/core/master.js