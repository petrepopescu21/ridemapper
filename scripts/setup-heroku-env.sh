#!/bin/bash

# Heroku Environment Setup Script
# This script sets up the required environment variables for Heroku deployment

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Setting up Heroku Environment Variables${NC}"

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo -e "${RED}❌ Heroku CLI is not installed. Please install it first.${NC}"
    echo "Visit: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if user is logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  You're not logged in to Heroku. Please log in first.${NC}"
    heroku login
fi

# Get the app name
read -p "Enter your Heroku app name: " APP_NAME

if [ -z "$APP_NAME" ]; then
    echo -e "${RED}❌ App name is required.${NC}"
    exit 1
fi

# Get the Google Maps API key
read -p "Enter your Google Maps API key: " GOOGLE_MAPS_API_KEY

if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo -e "${RED}❌ Google Maps API key is required.${NC}"
    exit 1
fi

echo -e "${YELLOW}📝 Setting environment variables...${NC}"

# Set the environment variables (API and WS URLs are now auto-detected)
heroku config:set NODE_ENV=production --app="$APP_NAME"
heroku config:set HOST=0.0.0.0 --app="$APP_NAME"
heroku config:set CLIENT_URL=https://$APP_NAME.herokuapp.com --app="$APP_NAME"
heroku config:set VITE_GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY" --app="$APP_NAME"

echo -e "${GREEN}✅ Environment variables set successfully!${NC}"

echo -e "${YELLOW}📋 Current config:${NC}"
heroku config --app="$APP_NAME"

echo -e "${GREEN}🎉 Setup complete! You can now deploy your app.${NC}"
echo -e "🔗 API and WebSocket URLs are now auto-detected from the domain"
echo -e "Run: ${YELLOW}git push heroku main${NC} to deploy" 