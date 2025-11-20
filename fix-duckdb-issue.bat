@echo off
REM Quick fix for DuckDB error - Skip loading examples

echo ==========================================
echo Fixing DuckDB Error - Skipping Examples
echo ==========================================
echo.

REM Create .env-local if it doesn't exist
if not exist "docker\.env-local" (
    echo Creating docker\.env-local...
    if not exist "docker" mkdir docker
    type nul > docker\.env-local
)

REM Check if SUPERSET_LOAD_EXAMPLES is already set
findstr /C:"SUPERSET_LOAD_EXAMPLES" docker\.env-local >nul 2>&1
if errorlevel 1 (
    echo Adding SUPERSET_LOAD_EXAMPLES=no to docker\.env-local...
    echo. >> docker\.env-local
    echo # Skip loading examples (avoids DuckDB requirement) >> docker\.env-local
    echo SUPERSET_LOAD_EXAMPLES=no >> docker\.env-local
) else (
    echo Updating SUPERSET_LOAD_EXAMPLES in docker\.env-local...
    REM This is a simple approach - for Windows, manual edit might be easier
    echo Please manually set SUPERSET_LOAD_EXAMPLES=no in docker\.env-local
)

echo.
echo ✅ Configuration updated!
echo.
echo Restarting services...
echo.

REM Restart the services
docker-compose -f docker-compose.custom.yml down
docker-compose -f docker-compose.custom.yml up -d

echo.
echo ==========================================
echo Fix Applied!
echo ==========================================
echo.
echo Services are restarting. Check logs with:
echo   docker-compose -f docker-compose.custom.yml logs -f superset-init
echo.
echo Once initialization completes, access Superset at:
echo   http://localhost:8088
echo.

