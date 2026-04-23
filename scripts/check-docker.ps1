param(
  [switch]$VerboseOutput
)

$ErrorActionPreference = "Stop"

function Test-CommandExists {
  param([string]$CommandName)
  return [bool](Get-Command $CommandName -ErrorAction SilentlyContinue)
}

Write-Host "Checking Windows Docker prerequisites..." -ForegroundColor Cyan

$hasDocker = Test-CommandExists "docker"
$hasWinget = Test-CommandExists "winget"
$hasWsl = Test-CommandExists "wsl"

Write-Host ("docker: " + ($(if ($hasDocker) { "found" } else { "missing" })))
Write-Host ("winget: " + ($(if ($hasWinget) { "found" } else { "missing" })))
Write-Host ("wsl.exe: " + ($(if ($hasWsl) { "found" } else { "missing" })))

if ($hasWsl -and $hasDocker) {
  Write-Host ""
  Write-Host "WSL status:" -ForegroundColor Cyan
  $statusOutput = & wsl --status 2>$null
  if ($LASTEXITCODE -eq 0) {
    $statusOutput
  } else {
    Write-Host "WSL is available, but no Linux distribution is installed yet." -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "WSL distributions:" -ForegroundColor Cyan
  $listOutput = & wsl -l -v 2>$null
  if ($LASTEXITCODE -eq 0) {
    $listOutput
  } else {
    Write-Host "No WSL distribution found. Docker Desktop can install or use WSL 2 after setup." -ForegroundColor Yellow
  }
} elseif ($hasWsl) {
  Write-Host ""
  Write-Host "WSL command exists. Install Docker Desktop/WSL first, then rerun this check for detailed WSL status." -ForegroundColor Yellow
}

if ($hasDocker) {
  Write-Host ""
  Write-Host "Docker version:" -ForegroundColor Cyan
  docker --version
  docker compose version

  Write-Host ""
  Write-Host "Docker daemon:" -ForegroundColor Cyan
  docker info | Select-Object -First 30
}

if (-not $hasDocker) {
  Write-Host ""
  Write-Host "Docker is not available. Run scripts/install-docker-desktop.ps1 as Administrator, then reboot if Windows asks." -ForegroundColor Yellow
}
