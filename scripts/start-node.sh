#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$DIR")"
PNPM="pnpm"

cd "$ROOT_DIR"
echo "Pulling latest changes..."
git pull --rebase

echo "Installing dependencies..."
"$PNPM" install

echo "Building project..."
"$PNPM" build:vue

echo "=== Starting AIClient2API Service ==="

echo "Starting Node.js API service on port 30000..."
"$PNPM" start