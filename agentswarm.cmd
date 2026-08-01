@echo off
rem Launch AgentSwarm from anywhere, using this checkout's build.
rem
rem This exists because the docs said "run agentswarm" while nothing had ever put
rem that command on a PATH — the app was built into a target directory and left
rem there. A shim next to the project is the shortest honest distance between
rem the instruction and the thing it describes.
rem
rem All arguments pass through:  agentswarm --swarm morning
setlocal
set "EXE=%~dp0app\src-tauri\target\release\agentswarm.exe"
if not exist "%EXE%" (
  echo AgentSwarm is not built yet.
  echo.
  echo   cd "%~dp0app"
  echo   npm install
  echo   npx tauri build --no-bundle
  echo.
  exit /b 1
)
rem start /b so the shell returns immediately, the way a desktop app should.
rem The pane's own working directory is wherever you ran this from, which is what
rem decides which project's transcripts and swarms it reads.
start "" /b "%EXE%" %*
