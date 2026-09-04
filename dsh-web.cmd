@echo off
if not defined DSH_HOME set "DSH_HOME=%~dp0"
node --expose-internals "%~dp0runtime\node_modules\@deepseek-ai\dsh\lib\bin.js" web %*
