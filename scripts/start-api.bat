@echo off
title mempalace viewer api
chcp 65001 >nul

rem Serves the viewer's REST API on 3001, backed by a MemPalace MCP server.
rem For a remote palace, keep the SSH tunnel window open first — it forwards
rem localhost:9000 to the palace host.

set PALACE_BACKEND=mcp
set MEMPALACE_MCP=http://127.0.0.1:9000/mcp
set API_PORT=3001

rem Local ChromaDB palace instead? Uncomment these two, comment the ones above:
rem set PALACE_BACKEND=local
rem set PALACE_PATH=%USERPROFILE%\.mempalace\palace

python "%~dp0..\api\server.py"
pause
