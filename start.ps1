# Démarre la stack HelpDesk IA (Baserow + n8n + Mailpit) en une commande.
# Usage : .\start.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host '.env créé à partir de .env.example (ajoute BASEROW_API_TOKEN pour le seed).'
}

docker compose config --quiet
docker compose up -d

$services = @{ 'Baserow' = 'http://localhost:8081'; 'n8n' = 'http://localhost:5678'; 'Mailpit' = 'http://localhost:8025' }
foreach ($name in $services.Keys) {
  $ready = $false
  for ($i = 0; $i -lt 60 -and -not $ready; $i++) {
    try { Invoke-WebRequest -Uri $services[$name] -UseBasicParsing -TimeoutSec 3 | Out-Null; $ready = $true }
    catch { Start-Sleep -Seconds 5 }
  }
  Write-Host ("{0,-8} {1} {2}" -f $name, $services[$name], $(if ($ready) { 'OK' } else { 'NON PRÊT' }))
}
