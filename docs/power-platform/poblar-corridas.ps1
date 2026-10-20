# Corre Guardian en modo replay sobre todos los casos del eval y envía cada resultado
# al flujo de Power Automate. No gasta cuota de IA ni modifica el .env del repo:
# las variables de esta sesión tienen prioridad sobre las del .env.
# Uso (después de npm run setup):
#   $env:PA_URL   = '<URL del trigger HTTP>'
#   $env:PA_TOKEN = '<token compartido>'
#   .\docs\power-platform\poblar-corridas.ps1
param(
  [string]$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

if (-not $env:PA_URL -or -not $env:PA_TOKEN) {
  Write-Error 'Define $env:PA_URL y $env:PA_TOKEN antes de correr el script.'
  exit 1
}

$env:GUARDIAN_WEBHOOK_URL = $env:PA_URL
$env:GUARDIAN_WEBHOOK_TOKEN = $env:PA_TOKEN
$env:GITHUB_REPOSITORY = 'WalRol/storefront-guardian'

$casos = Get-ChildItem -Directory (Join-Path $Repo 'eval\cases') | Sort-Object Name
$numero = 100
foreach ($caso in $casos) {
  $numero++
  Write-Host "== $($caso.Name) (PR #$numero)"
  npm run guardian --prefix (Join-Path $Repo 'agent') --silent -- review --case $caso.Name `
    --provider replay --cassettes cassettes/eval --pr-number $numero --exit-zero | Out-Null
}
Write-Host 'Listo: revisa la lista de SharePoint y el canal de Teams.'
