#!/usr/bin/env bash
# Build and start the app container (Mac/Linux). Usage: scripts/start.sh
set -euo pipefail
cd "$(dirname "$0")/.."

docker build -t pm-app .
docker rm -f pm-app >/dev/null 2>&1 || true
docker run -d --name pm-app -p 8000:8000 --env-file .env pm-app
echo "Running at http://localhost:8000"
