@echo off
REM Quick script to build custom Superset image and run with Docker Compose
REM Usage: build-and-run-custom.bat [image-tag]

setlocal

set IMAGE_TAG=%1
if "%IMAGE_TAG%"=="" set IMAGE_TAG=superset-custom:latest
set COMPOSE_FILE=docker-compose.custom.yml

echo ==========================================
echo Build and Run Custom Superset
echo ==========================================
echo Image Tag: %IMAGE_TAG%
echo.

REM Check if we're in the right directory
if not exist "Dockerfile" (
    echo Error: Dockerfile not found. Please run this script from the Superset root directory.
    exit /b 1
)

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker and try again.
    exit /b 1
)

REM Step 1: Build the image
echo Step 1: Building Docker image...
echo This will take 15-30 minutes. Please be patient...
echo.

docker build ^
  --target lean ^
  --tag "%IMAGE_TAG%" ^
  --build-arg BUILD_TRANSLATIONS=false ^
  --build-arg DEV_MODE=false ^
  --progress=plain ^
  .

if errorlevel 1 (
    echo.
    echo Error: Docker build failed!
    exit /b 1
)

echo.
echo Build completed successfully!
echo.

REM Step 2: Check if .env file exists
if not exist "docker\.env" (
    echo Warning: docker\.env file not found.
    echo Creating a basic .env file...
    if not exist "docker" mkdir docker
    (
        echo POSTGRES_USER=superset
        echo POSTGRES_PASSWORD=superset
        echo POSTGRES_DB=superset
        echo DATABASE_HOST=db
        echo DATABASE_DB=superset
        echo REDIS_HOST=redis
        echo REDIS_PORT=6379
        echo SECRET_KEY=CHANGE-THIS-SECRET-KEY-IN-PRODUCTION
    ) > docker\.env
    echo Created docker\.env with default values.
    echo ⚠️  Please update SECRET_KEY and passwords before production use!
    echo.
)

REM Step 3: Stop any existing containers
echo Step 2: Stopping any existing containers...
docker-compose -f "%COMPOSE_FILE%" down >nul 2>&1
echo.

REM Step 4: Start services
echo Step 3: Starting services with Docker Compose...
docker-compose -f "%COMPOSE_FILE%" up -d

if errorlevel 1 (
    echo.
    echo Error: Failed to start services!
    exit /b 1
)

echo.
echo ==========================================
echo Services started successfully!
echo ==========================================
echo.
echo Waiting for initialization to complete...
echo This may take 1-2 minutes...
echo.

REM Wait for initialization
timeout /t 5 /nobreak >nul

echo.
echo ==========================================
echo Superset is starting up!
echo ==========================================
echo.
echo Access Superset at: http://localhost:8088
echo.
echo Default credentials:
echo   Username: admin
echo   Password: admin
echo.
echo ⚠️  Change the admin password immediately after first login!
echo.
echo Useful commands:
echo   View logs:        docker-compose -f %COMPOSE_FILE% logs -f
echo   Stop services:    docker-compose -f %COMPOSE_FILE% down
echo   Restart:          docker-compose -f %COMPOSE_FILE% restart
echo   Check status:     docker-compose -f %COMPOSE_FILE% ps
echo.

endlocal

