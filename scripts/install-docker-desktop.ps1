param(
  [switch]$InstallWsl
)

$ErrorActionPreference = "Stop"

function Assert-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from an elevated PowerShell session."
  }
}

Assert-Admin

if ($InstallWsl) {
  Write-Host "Installing WSL. A reboot may be required." -ForegroundColor Cyan
  wsl --install
}

Write-Host "Installing Docker Desktop through winget..." -ForegroundColor Cyan
winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements

Write-Host ""
Write-Host "Docker Desktop installed. Start Docker Desktop once, enable WSL 2 backend if prompted, then run:" -ForegroundColor Green
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/check-docker.ps1"
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/start-stack.ps1 -Full"
