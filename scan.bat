@echo off
echo === Devlog Scanner ===
cd /d "%~dp0"
python scanner/scan.py
pause
