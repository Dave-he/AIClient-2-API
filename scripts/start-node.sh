#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$DIR")"

cd "$ROOT_DIR"

PNPM="/root/.nvm/versions/node/v24.15.0/bin/pnpm"
NODE="/root/.nvm/versions/node/v24.15.0/bin/node"

echo "=== Starting AIClient2API Service ==="

echo "Pulling latest changes..."
git pull --rebase

echo "Installing dependencies..."
"$PNPM" install

echo "Building project..."
"$PNPM" run build

echo "Starting Node.js API service on port 30000..."
"$NODE" src/core/master.js