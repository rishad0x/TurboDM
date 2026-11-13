@echo off
rem ── TurboDM dev bootstrap (double-clickable wrapper) ──
rem Installs Bun if missing, then deps + tests.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-setup.ps1"
pause
