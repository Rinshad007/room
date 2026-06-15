#!/usr/bin/env pwsh
# Budget Buddy — Backend Startup Script (Windows)
# Usage: .\start.ps1

Write-Host "[*] Starting Budget Buddy Backend..." -ForegroundColor Cyan

# Activate virtual environment
$venvPython = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
$venvUvicorn = Join-Path $PSScriptRoot "venv\Scripts\uvicorn.exe"

if (-not (Test-Path $venvUvicorn)) {
    Write-Host "[!] Virtual environment not found. Creating..." -ForegroundColor Yellow
    python -m venv venv
    & "$PSScriptRoot\venv\Scripts\pip.exe" install -r requirements.txt --prefer-binary
}

# Set PYTHONPATH
$env:PYTHONPATH = $PSScriptRoot

Write-Host "[+] Starting server at http://localhost:8000" -ForegroundColor Green
Write-Host "[+] Swagger docs at http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""

& $venvUvicorn app.main:app --reload --host 0.0.0.0 --port 8000
