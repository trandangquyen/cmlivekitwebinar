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

function Get-LiveKitNodeIp {
  if ($env:LIVEKIT_NODE_IP) {
    return $env:LIVEKIT_NODE_IP
  }

  try {
    $udpClient = [System.Net.Sockets.UdpClient]::new()
    try {
      $udpClient.Connect("8.8.8.8", 80)
      $endpoint = [System.Net.IPEndPoint]$udpClient.Client.LocalEndPoint
      $address = $endpoint.Address.ToString()
      if ($address -and $address -ne "0.0.0.0") {
        return $address
      }
    } finally {
      $udpClient.Dispose()
    }
  } catch {
    # Fall back to DNS-based detection below.
  }

  $hostEntry = [System.Net.Dns]::GetHostEntry([System.Net.Dns]::GetHostName())
  $candidate = $hostEntry.AddressList |
    Where-Object {
      $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
      $_.ToString() -notlike "127.*" -and
      $_.ToString() -notlike "169.254.*"
    } |
    Select-Object -First 1

  if ($candidate) {
    return $candidate.ToString()
  }

  return "127.0.0.1"
}

$livekitNodeIp = Get-LiveKitNodeIp
$env:LIVEKIT_NODE_IP = $livekitNodeIp
Write-Host "LiveKit node IP: $livekitNodeIp" -ForegroundColor Cyan

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example" -ForegroundColor Yellow
}

if ($Rebuild) {
  docker compose -f $composeFile build --no-cache
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose build failed with exit code $LASTEXITCODE."
  }
}

docker compose -f $composeFile up -d --build
if ($LASTEXITCODE -ne 0) {
  throw "docker compose up failed with exit code $LASTEXITCODE."
}

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
