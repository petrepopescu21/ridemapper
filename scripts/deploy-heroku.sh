#!/bin/bash

# Heroku Deployment Script for RideMapper
# Usage: ./scripts/deploy-heroku.sh [app-name]

set -e

APP_NAME=${1:-ridemapper}
HEROKU_APP=${APP_NAME}

echo "🚀 Deploying RideMapper to Heroku..."

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI is not installed. Please install it first."
    echo "   Visit: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if user is logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Please login to Heroku first:"
    echo "   heroku login"
    exit 1
fi

# Check if app exists, if not create it
if ! heroku apps:info --app=$HEROKU_APP &> /dev/null; then
    echo "📱 Creating Heroku app: $HEROKU_APP"
    heroku create $HEROKU_APP
else
    echo "📱 Using existing Heroku app: $HEROKU_APP"
fi

# Set environment variables
echo "🔧 Setting environment variables..."
heroku config:set NODE_ENV=production --app=$HEROKU_APP

# Check if Google Maps API key is set
if ! heroku config:get VITE_GOOGLE_MAPS_API_KEY --app=$HEROKU_APP &> /dev/null || [ -z "$(heroku config:get VITE_GOOGLE_MAPS_API_KEY --app=$HEROKU_APP)" ]; then
    echo "⚠️  Google Maps API key not set. Please set it manually:"
    echo "   heroku config:set VITE_GOOGLE_MAPS_API_KEY=your_api_key --app=$HEROKU_APP"
    echo ""
    read -p "Do you want to continue without setting the API key? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Add heroku remote if it doesn't exist
if ! git remote get-url heroku &> /dev/null; then
    echo "🔗 Adding Heroku remote..."
    heroku git:remote --app=$HEROKU_APP
fi

# Deploy to Heroku
echo "🚢 Deploying to Heroku..."
git push heroku main

# Run post-deployment checks
echo "🔍 Running health check..."
sleep 10
APP_URL="https://${HEROKU_APP}.herokuapp.com"

if curl -f "${APP_URL}/health" &> /dev/null; then
    echo "✅ Deployment successful!"
    echo "🌐 App URL: $APP_URL"
    echo "🏥 Health check: ${APP_URL}/health"
    
    # Open the app
    read -p "Open the app in browser? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        heroku open --app=$HEROKU_APP
    fi
else
    echo "❌ Health check failed. Check the logs:"
    echo "   heroku logs --tail --app=$HEROKU_APP"
fi

echo "🎉 Deployment script completed!"
echo ""
echo "Useful commands:"
echo "  heroku logs --tail --app=$HEROKU_APP    # View logs"
echo "  heroku ps --app=$HEROKU_APP             # Check dynos"
echo "  heroku config --app=$HEROKU_APP         # View config vars"
echo "  heroku open --app=$HEROKU_APP           # Open in browser" 