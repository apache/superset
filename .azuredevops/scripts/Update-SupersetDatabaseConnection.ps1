param (
  [Parameter(Mandatory = $true)] [string]$OEE_DB_HOST,
  [Parameter(Mandatory = $true)] [string]$OEE_DB_PORT,
  [Parameter(Mandatory = $true)] [string]$OEE_DB_NAME,
  [Parameter(Mandatory = $true)] [string]$OEE_DB_USER,
  [Parameter(Mandatory = $true)] [string]$OEE_DB_PASSWORD
)

$ErrorActionPreference = "Stop"

Write-Host "=== Updating Superset Database Connection ==="
Write-Host "Target: $OEE_DB_USER@$OEE_DB_HOST:$OEE_DB_PORT/$OEE_DB_NAME"

# Build the connection string
$connectionString = "postgresql+psycopg2://${OEE_DB_USER}:${OEE_DB_PASSWORD}@${OEE_DB_HOST}:${OEE_DB_PORT}/${OEE_DB_NAME}"

Write-Host "Connecting to Superset metadata database..."

# Connect to Superset's internal database and update the connection
$sqlUpdate = @"
UPDATE dbs
SET sqlalchemy_uri = '{0}'
WHERE database_name = 'oeeintellisuite';
"@ -f $connectionString

# Execute the update using docker exec
docker exec superset_db psql -U superset -d superset -c $sqlUpdate

if ($LASTEXITCODE -eq 0) {
  Write-Host "✓ Superset database connection updated successfully"
  Write-Host "  Database: oeeintellisuite"
  Write-Host "  Host: $OEE_DB_HOST"
  Write-Host "  Port: $OEE_DB_PORT"
  Write-Host "  User: $OEE_DB_USER"
  Write-Host "=== Update Complete ==="
} else {
  Write-Host "✗ Failed to update database connection"
  exit 1
}
