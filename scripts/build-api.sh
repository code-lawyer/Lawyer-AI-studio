#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../apps/api"

echo "=== Building SuitAgent API with PyInstaller ==="

# Install build dependencies
pip install pyinstaller

# Run PyInstaller
pyinstaller suitagent-api.spec --clean --noconfirm

echo "=== Build complete ==="
echo "Output: apps/api/dist/suitagent-api"
