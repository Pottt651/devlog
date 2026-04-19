@echo off
echo === Devlog Deploy ===
cd /d "%~dp0"
cd frontend && npm run build && cd ..
npx wrangler pages deploy frontend/dist --project-name devlog --branch main
pause
