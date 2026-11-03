# Prépare n8n depuis zéro : crée les credentials manquants, importe les workflows
# du dossier workflows/ et les publie. Rejouable (les credentials existants sont conservés).
# Prérequis : stack démarrée (.\start.ps1), .env avec BASEROW_API_TOKEN et GEMINI_API_KEY.
# Usage : .\scripts\bootstrap-n8n.ps1
$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')

$envVars = @{}
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') { $envVars[$Matches[1]] = $Matches[2].Trim('"', "'") }
  }
}
function Exec-N8n { docker compose exec -T n8n n8n @args 2>&1 }

# --- Credentials ---
Exec-N8n export:credentials --all --output=/tmp/existing.json 2>&1 | Out-Null
$existing = (docker compose exec -T n8n cat /tmp/existing.json | Out-String | ConvertFrom-Json).id

$wanted = @(
  @{ id = 'bsrwHdrAuth0001'; name = 'Baserow Header Auth'; type = 'httpHeaderAuth'
     need = 'BASEROW_API_TOKEN'; data = { @{ name = 'Authorization'; value = "Token $($envVars['BASEROW_API_TOKEN'])" } } },
  @{ id = 'mailpitSmtp0001'; name = 'Mailpit SMTP'; type = 'smtp'; need = $null
     data = { @{ host = 'mailpit'; port = 1025; secure = $false; disableStartTls = $true; user = ''; password = ''; hostName = '' } } },
  @{ id = 'Oo0yF8yxhfbkBJ72'; name = 'Google Gemini(PaLM) Api account'; type = 'googlePalmApi'
     need = 'GEMINI_API_KEY'; data = { @{ host = 'https://generativelanguage.googleapis.com'; apiKey = $envVars['GEMINI_API_KEY'] } } }
)
foreach ($c in $wanted) {
  if ($existing -contains $c.id) { Write-Host "Credential déjà présent : $($c.name)"; continue }
  if ($c.need -and -not $envVars[$c.need]) { throw "Renseigne $($c.need) dans .env avant de lancer ce script." }
  $file = Join-Path $env:TEMP "cred-$($c.id).json"
  ConvertTo-Json -Depth 5 @(@{ id = $c.id; name = $c.name; type = $c.type; data = (& $c.data) }) | Set-Content $file -Encoding UTF8
  docker compose cp $file "n8n:/tmp/cred.json" 2>&1 | Out-Null
  Remove-Item $file
  Exec-N8n import:credentials --input=/tmp/cred.json | Select-Object -Last 1
}
docker compose exec -T n8n rm -f /tmp/cred.json /tmp/existing.json

# --- Workflows (sous-workflow et workflow d'erreur d'abord, W1 en dernier) ---
$order = 'SUB-write-audit-log', 'ERR-error-handler', 'W2-assisted-reply', 'W3-sla-reminders', 'W4-weekly-report', 'W5-kb-assistant', 'W1-ticket-intake'
foreach ($name in $order) {
  $path = "workflows\$name.json"
  $json = Get-Content $path -Raw | ConvertFrom-Json
  $id = if ($json -is [array]) { $json[0].id } else { $json.id }
  docker compose cp $path "n8n:/tmp/$name.json" 2>&1 | Out-Null
  Exec-N8n import:workflow --input=/tmp/$name.json | Select-Object -Last 1
  Exec-N8n publish:workflow --id=$id 2>&1 | Out-Null
  Write-Host "Importé et publié : $name ($id)"
}

docker compose restart n8n 2>&1 | Out-Null
Write-Host 'n8n redémarré : les workflows publiés sont actifs.'
