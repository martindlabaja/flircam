#!/bin/bash
# Serve demos/ to the browser on Windows: http://localhost:5173 (WSL forwards localhost).
cd "$(dirname "$0")" && exec python3 -m http.server "${1:-5173}"
