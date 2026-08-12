#!/bin/bash
# MemPalace Viewer - start both API and frontend
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Colours
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting MemPalace Viewer${NC}"
echo "---"

# Check dependencies
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "ERROR: node not found"
  exit 1
fi

# Install node deps if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing node dependencies...${NC}"
  npm install
fi

# Check chromadb is available
python3 -c "import chromadb" 2>/dev/null || {
  echo -e "${YELLOW}Installing chromadb...${NC}"
  pip3 install chromadb
}

# Kill any existing processes on our ports
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true

# Start API server (background)
echo -e "${GREEN}Starting API server on :3001${NC}"
python3 api/server.py &
API_PID=$!

# Start Vite dev server (foreground)
echo -e "${GREEN}Starting frontend on :5173${NC}"
echo "---"
echo -e "  Frontend: ${GREEN}http://localhost:5173${NC}"
echo -e "  API:      ${GREEN}http://localhost:3001${NC}"
echo "---"
echo "Press Ctrl+C to stop both servers"
echo ""

# Trap to kill API when frontend stops
trap "kill $API_PID 2>/dev/null; exit" INT TERM EXIT

npm run dev
