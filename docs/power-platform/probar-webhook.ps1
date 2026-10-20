# Envía el evento de ejemplo al flujo de Power Automate, sin pasar por Guardian.
# Uso (desde cualquier carpeta):
#   $env:PA_URL   = '<URL del trigger HTTP>'
#   $env:PA_TOKEN = '<token compartido>'
#   .\docs\power-platform\probar-webhook.ps1                 # token correcto: debe responder 202
#   .\docs\power-platform\probar-webhook.ps1 -TokenInvalido  # debe responder 401
param(
  [string]$Evento = (Join-Path $PSScriptRoot '..\n8n\ejemplo-evento.json'),
  [switch]$TokenInvalido
)

if (-not $env:PA_URL -or -not $env:PA_TOKEN) {
  Write-Error 'Define $env:PA_URL y $env:PA_TOKEN antes de correr el script.'
  exit 1
}

$token = if ($TokenInvalido) { 'token-incorrecto' } else { $env:PA_TOKEN }
# Se envían los bytes del archivo para conservar los acentos (UTF-8) en Windows PowerShell 5.1.
$body = [System.IO.File]::ReadAllBytes((Resolve-Path $Evento))

try {
  $res = Invoke-WebRequest -Method Post -Uri $env:PA_URL -UseBasicParsing `
    -Headers @{ 'X-Guardian-Token' = $token } `
    -ContentType 'application/json; charset=utf-8' -Body $body
  "HTTP $($res.StatusCode)"
} catch {
  "HTTP $($_.Exception.Response.StatusCode.value__) (esperado si usaste -TokenInvalido)"
}
