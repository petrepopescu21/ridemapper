@echo off
setlocal

:: Heroku Deployment Script for RideMapper (Windows)
:: Usage: scripts\deploy-heroku.bat [app-name]

if "%1"=="" (
    set APP_NAME=ridemapper
) else (
    set APP_NAME=%1
)

set HEROKU_APP=%APP_NAME%

echo 🚀 Deploying RideMapper to Heroku...

:: Check if Heroku CLI is installed
heroku --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Heroku CLI is not installed. Please install it first.
    echo    Visit: https://devcenter.heroku.com/articles/heroku-cli
    exit /b 1
)

:: Check if user is logged in to Heroku
heroku auth:whoami >nul 2>&1
if errorlevel 1 (
    echo ❌ Please login to Heroku first:
    echo    heroku login
    exit /b 1
)

:: Check if app exists, if not create it
heroku apps:info --app=%HEROKU_APP% >nul 2>&1
if errorlevel 1 (
    echo 📱 Creating Heroku app: %HEROKU_APP%
    heroku create %HEROKU_APP%
) else (
    echo 📱 Using existing Heroku app: %HEROKU_APP%
)

:: Set environment variables
echo 🔧 Setting environment variables...
heroku config:set NODE_ENV=production --app=%HEROKU_APP%
heroku config:set HOST=0.0.0.0 --app=%HEROKU_APP%

:: Check if Google Maps API key is set
heroku config:get VITE_GOOGLE_MAPS_API_KEY --app=%HEROKU_APP% >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Google Maps API key not set. Please set it manually:
    echo    heroku config:set VITE_GOOGLE_MAPS_API_KEY=your_api_key --app=%HEROKU_APP%
    echo.
    set /p continue="Do you want to continue without setting the API key? (y/N): "
    if /i not "%continue%"=="y" exit /b 1
)

:: Add heroku remote if it doesn't exist
git remote get-url heroku >nul 2>&1
if errorlevel 1 (
    echo 🔗 Adding Heroku remote...
    heroku git:remote --app=%HEROKU_APP%
)

:: Deploy to Heroku
echo 🚢 Deploying to Heroku...
git push heroku main

:: Run post-deployment checks
echo 🔍 Running health check...
timeout /t 10 /nobreak >nul
set APP_URL=https://%HEROKU_APP%.herokuapp.com

curl -f "%APP_URL%/health" >nul 2>&1
if errorlevel 1 (
    echo ❌ Health check failed. Check the logs:
    echo    heroku logs --tail --app=%HEROKU_APP%
) else (
    echo ✅ Deployment successful!
    echo 🌐 App URL: %APP_URL%
    echo 🏥 Health check: %APP_URL%/health
    
    :: Open the app
    set /p open="Open the app in browser? (Y/n): "
    if /i not "%open%"=="n" heroku open --app=%HEROKU_APP%
)

echo 🎉 Deployment script completed!
echo.
echo Useful commands:
echo   heroku logs --tail --app=%HEROKU_APP%    # View logs
echo   heroku ps --app=%HEROKU_APP%             # Check dynos
echo   heroku config --app=%HEROKU_APP%         # View config vars
echo   heroku open --app=%HEROKU_APP%           # Open in browser

endlocal 