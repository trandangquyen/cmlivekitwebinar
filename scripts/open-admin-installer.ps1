$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$installer = Join-Path $root "scripts\install-docker-desktop.ps1"

if (-not (Test-Path $installer)) {
  throw "Installer script not found: $installer"
}

$arguments = @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$installer`"",
  "-InstallWsl"
)

Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $arguments

Write-Host "An elevated PowerShell installer was requested. Approve the Windows UAC prompt to continue." -ForegroundColor Green
