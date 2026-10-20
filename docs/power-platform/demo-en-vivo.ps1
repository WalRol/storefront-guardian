# Corre un caso en modo replay y envía el resultado al flujo de Power Automate.
# En la terminal solo se ve el avance por etapa (incluida "Webhook notificado");
# el reporte completo queda en .guardian-out/<caso>/report.md.
# Uso:
#   $env:PA_URL = '<URL del trigger HTTP>'; $env:PA_TOKEN = '<token compartido>'; cls
#   .\docs\power-platform\demo-en-vivo.ps1                                       # caso 06: fila + tarjeta
#   .\docs\power-platform\demo-en-vivo.ps1 -Caso 11-clean-list-stores -PR 211    # limpio: fila, sin tarjeta
param(
  [string]$Caso = '06-idor-order-history',
  [int]$PR = 206,
  [string]$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

if (-not $env:PA_URL -or -not $env:PA_TOKEN) {
  Write-Error 'Define $env:PA_URL y $env:PA_TOKEN antes de correr el script.'
  exit 1
}

$env:GUARDIAN_WEBHOOK_URL = $env:PA_URL
$env:GUARDIAN_WEBHOOK_TOKEN = $env:PA_TOKEN
$env:GITHUB_REPOSITORY = 'WalRol/storefront-guardian'

# stdout (el reporte en Markdown) se descarta; stderr (el avance por etapa) se ve en la terminal.
npm run guardian --prefix (Join-Path $Repo 'agent') --silent -- review --case $Caso `
  --provider replay --cassettes cassettes/eval --pr-number $PR --exit-zero | Out-Null

Write-Host ''
Write-Host "Reporte: $(Join-Path $Repo ".guardian-out\$Caso\report.md")"
