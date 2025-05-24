# Heroku Environment Setup Script (PowerShell)
# This script sets up the required environment variables for Heroku deployment

Write-Host "🚀 Setting up Heroku Environment Variables" -ForegroundColor Green

# Check if Heroku CLI is installed
if (-not (Get-Command heroku -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Heroku CLI is not installed. Please install it first." -ForegroundColor Red
    Write-Host "Visit: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
}

# Check if user is logged in to Heroku
try {
    heroku auth:whoami | Out-Null
} catch {
    Write-Host "⚠️  You're not logged in to Heroku. Please log in first." -ForegroundColor Yellow
    heroku login
}

# Get the app name
$APP_NAME = Read-Host "Enter your Heroku app name"

if ([string]::IsNullOrWhiteSpace($APP_NAME)) {
    Write-Host "❌ App name is required." -ForegroundColor Red
    exit 1
}

# Get the Google Maps API key
$GOOGLE_MAPS_API_KEY = Read-Host "Enter your Google Maps API key"

if ([string]::IsNullOrWhiteSpace($GOOGLE_MAPS_API_KEY)) {
    Write-Host "❌ Google Maps API key is required." -ForegroundColor Red
    exit 1
}

Write-Host "📝 Setting environment variables..." -ForegroundColor Yellow

# Set the environment variables (API and WS URLs are now auto-detected)
heroku config:set NODE_ENV=production --app="$APP_NAME"
heroku config:set HOST=0.0.0.0 --app="$APP_NAME"
heroku config:set CLIENT_URL=https://$APP_NAME.herokuapp.com --app="$APP_NAME"
heroku config:set VITE_GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY" --app="$APP_NAME"

Write-Host "✅ Environment variables set successfully!" -ForegroundColor Green

Write-Host "📋 Current config:" -ForegroundColor Yellow
heroku config --app="$APP_NAME"

Write-Host "🎉 Setup complete! You can now deploy your app." -ForegroundColor Green
Write-Host "🔗 API and WebSocket URLs are now auto-detected from the domain" -ForegroundColor Cyan
Write-Host "Run: git push heroku main to deploy" -ForegroundColor Yellow 