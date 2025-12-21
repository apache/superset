param (
  [Parameter(Mandatory = $true)] [string]$ConfigPath
)

function Read-Json([string]$Path) {
  if (!(Test-Path -LiteralPath $Path)) { throw "Config not found: $Path" }
  Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json -Depth 64
}

$json = Read-Json $ConfigPath
$pg = $json.'app-suite'[0].postgres

# Output environment variables for Superset deployment
Write-Output "SUPERSET_DB_HOST=$($pg.host)"
Write-Output "SUPERSET_DB_PORT=$($pg.port)"
Write-Output "SUPERSET_DB_NAME=superset_metadata"
Write-Output "SUPERSET_DB_USER=$($pg.admin.user)"
Write-Output "SUPERSET_DB_PASSWORD=$($pg.admin.password)"
Write-Output ""
Write-Output "OEE_DB_HOST=$($pg.host)"
Write-Output "OEE_DB_PORT=$($pg.port)"
Write-Output "OEE_DB_NAME=$(if ($pg.database) { $pg.database } else { 'oeeintellisuite' })"
Write-Output "OEE_DB_USER=$($pg.reader.user)"
Write-Output "OEE_DB_PASSWORD=$($pg.reader.password)"
