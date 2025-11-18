@echo off
REM Script to build a production Docker image for customized Superset
REM Usage: build-production-docker.bat [tag]

setlocal

REM Default tag
set TAG=%1
if "%TAG%"=="" set TAG=superset-custom:latest

echo ==========================================
echo Building Superset Production Docker Image
echo ==========================================
echo Tag: %TAG%
echo.

REM Check if we're in the right directory
if not exist "Dockerfile" (
    echo Error: Dockerfile not found. Please run this script from the Superset root directory.
    exit /b 1
)

REM Check if package.json has @google/model-viewer
findstr /C:"@google/model-viewer" superset-frontend\package.json >nul
if errorlevel 1 (
    echo Warning: @google/model-viewer not found in package.json
    echo This may cause the 3D Model component to fail.
    set /p CONTINUE="Continue anyway? (y/n) "
    if /i not "%CONTINUE%"=="y" exit /b 1
)

echo Building Docker image...
echo This may take 15-30 minutes depending on your system...
echo.

REM Build the image
docker build ^
    --target lean ^
    --tag "%TAG%" ^
    --build-arg BUILD_TRANSLATIONS=false ^
    --build-arg DEV_MODE=false ^
    --progress=plain ^
    .

if errorlevel 1 (
    echo.
    echo Build failed!
    exit /b 1
)

echo.
echo ==========================================
echo Build completed successfully!
echo ==========================================
echo.
echo Image tagged as: %TAG%
echo.
echo To test the image locally:
echo   docker run -p 8088:8088 %TAG%
echo.
echo To push to a registry:
echo   docker tag %TAG% your-registry/%TAG%
echo   docker push your-registry/%TAG%
echo.

endlocal

