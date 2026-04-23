param(
  [switch]$Full,
  [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is not installed or not in PATH. Run scripts/install-docker-desktop.ps1 as Administrator first."
}

$composeFile = if ($Full) { "docker-compose.full.yml" } else { "docker-compose.livekit.yml" }

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example" -ForegroundColor Yellow
}

if ($Rebuild) {
  docker compose -f $composeFile build --no-cache
}

docker compose -f $composeFile up -d --build

Write-Host ""
Write-Host "Stack started." -ForegroundColor Green
Write-Host "LiveKit:  ws://localhost:7880"

if ($Full) {
  Write-Host "API:      http://localhost:4300/api/health"
  Write-Host "Web:      http://localhost:8080"
} else {
  Write-Host "Run API:  npm run dev:api"
  Write-Host "Run web:  npm run dev:web"
}
