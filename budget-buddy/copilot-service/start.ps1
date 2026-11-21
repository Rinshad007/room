# Expense Copilot - Quick Start Script
Write-Host "Starting Expense Copilot Service..." -ForegroundColor Cyan

# Check for .env
if (-Not (Test-Path ".env")) {
    Write-Host "No .env file found. Copying from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Please edit .env with your API keys before continuing." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Green
uv sync

# Run the server on port 8001 (port 8000 is used by Budget Buddy backend)
Write-Host "Launching server on http://localhost:8001" -ForegroundColor Green
uv run uvicorn app.main:app --reload --port 8001
