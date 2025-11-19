@echo off
REM Script to save Docker image for transfer to Ubuntu
REM Usage: save-image-for-ubuntu.bat [image-tag] [output-file]

setlocal

REM Default values
set IMAGE_TAG=%1
if "%IMAGE_TAG%"=="" set IMAGE_TAG=superset-custom:latest

set OUTPUT_FILE=%2
if "%OUTPUT_FILE%"=="" set OUTPUT_FILE=superset-custom-latest.tar

echo ==========================================
echo Saving Docker Image for Ubuntu Transfer
echo ==========================================
echo Image: %IMAGE_TAG%
echo Output: %OUTPUT_FILE%
echo.

REM Check if image exists
docker images %IMAGE_TAG% >nul 2>&1
if errorlevel 1 (
    echo Error: Image %IMAGE_TAG% not found!
    echo.
    echo Available images:
    docker images | findstr superset
    exit /b 1
)

echo Saving image...
echo This may take a few minutes...
echo.

docker save -o "%OUTPUT_FILE%" %IMAGE_TAG%

if errorlevel 1 (
    echo.
    echo Error: Failed to save image!
    exit /b 1
)

echo.
echo ==========================================
echo Image saved successfully!
echo ==========================================
echo.
echo File: %OUTPUT_FILE%
for %%A in ("%OUTPUT_FILE%") do echo Size: %%~zA bytes (%%~zA / 1024 / 1024 MB)
echo.
echo Next steps:
echo 1. Transfer this file to your Ubuntu server
echo 2. Use SCP: scp %OUTPUT_FILE% user@server:/path/
echo 3. Or use WinSCP to drag and drop
echo 4. On Ubuntu, run: docker load -i %OUTPUT_FILE%
echo.

endlocal

