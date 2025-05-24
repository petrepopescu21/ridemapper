# RideMapper 🗺️

[![Deploy to Heroku](https://github.com/your-username/ridemapper/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-username/ridemapper/actions/workflows/deploy.yml)
[![PR Checks](https://github.com/your-username/ridemapper/actions/workflows/pr-check.yml/badge.svg)](https://github.com/your-username/ridemapper/actions/workflows/pr-check.yml)
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/your-username/ridemapper)

A real-time location tracking and route management application built with Vue.js, Socket.io, and Google Maps.

## Features

- 📍 **Real-time Location Tracking**: Live participant positioning with WebSocket updates
- 🗺️ **Interactive Route Planning**: Create and share routes using Google Maps Routes API
- 👥 **Session Management**: PIN-based joining with manager controls
- 💬 **Real-time Messaging**: Manager-to-participant communication
- 📱 **Progressive Web App**: Mobile-first responsive design with Vuetify
- 🔒 **Secure**: TypeScript, CORS protection, and input validation

## Technology Stack

- **Frontend**: Vue.js 3, TypeScript, Vuetify, Pinia
- **Backend**: Node.js, Express, Socket.io, TypeScript
- **Maps**: Google Maps JavaScript API + Routes API
- **Deployment**: Docker, Kubernetes, Heroku
- **Development**: Vite, Hot Module Replacement, Concurrently

## Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ridemapper.git
   cd ridemapper
   ```

2. **Install dependencies**
   ```bash
   npm install
   npm run install:server
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env and add your Google Maps API key
   ```

4. **Start development servers**
   ```bash
   npm run dev:all
   ```

   This starts both the client (http://localhost:5173) and server (http://localhost:3001)

### Docker Development

```bash
# Development with hot reload
npm run docker:dev

# Production build
npm run docker:up
```

## Heroku Deployment 🚀

### Prerequisites

1. **Heroku CLI** installed
2. **Google Maps API Key** with the following APIs enabled:
   - Maps JavaScript API
   - Routes API
   - Geocoding API (optional)

### Automated Deployment (Recommended)

**GitHub Actions** automatically deploys your app when you merge to the `main` branch.

#### Setup GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions

Add these secrets:

| Secret | Description | How to Get |
|--------|-------------|------------|
| `HEROKU_API_KEY` | Heroku API token | `heroku auth:token` |
| `HEROKU_APP_NAME` | Your Heroku app name | Your app name |
| `HEROKU_EMAIL` | Heroku account email | Your login email |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key | Google Cloud Console |

#### How It Works

1. **Pull Request** → Runs tests, security audit, type checking
2. **Merge to Main** → Automatic deployment to Heroku
3. **Manual Trigger** → Actions tab → "Deploy to Heroku"

### Manual Deployment

1. **Create a Heroku app**
   ```bash
   heroku create your-app-name
   ```

2. **Set environment variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

4. **Open your app**
   ```bash
   heroku open
   ```

### One-Click Deploy

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/your-username/ridemapper)

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key | ✅ Yes |
| `NODE_ENV` | Environment (production/development) | ✅ Yes |
| `PORT` | Server port (auto-set by Heroku) | ❌ No |
| `CLIENT_URL` | Client URL for CORS (leave empty) | ❌ No |

## Usage

### For Route Managers

1. **Create Session**: Enter your name and get a PIN
2. **Plan Route**: Click on the map to add waypoints
3. **Share PIN**: Give participants the 6-digit PIN
4. **Track Progress**: See live locations and send messages

### For Participants

1. **Join Session**: Enter the PIN and your name
2. **Share Location**: Allow location access for real-time tracking
3. **Follow Route**: View the planned route and navigation
4. **Receive Updates**: Get messages from the route manager

## API Endpoints

- `GET /health` - Health check
- `WebSocket /socket.io` - Real-time communication

## Development Scripts

```bash
# Client & Server
npm run dev:all          # Run both in development
npm run build            # Build for production
npm start               # Start production server

# Client only
npm run dev             # Vite dev server
npm run build:client    # Build client
npm run type-check      # TypeScript check

# Server only
npm run server:dev      # Server dev with nodemon
npm run server:build    # Build server

# Docker
npm run docker:dev      # Development with Docker
npm run docker:up       # Production with Docker

# Deployment
npm run heroku-postbuild # Heroku build hook
```

## Architecture

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Vue.js Client │ ←──────────────→ │ Express Server  │
│                 │                 │                 │
│ • Vuetify UI    │                 │ • Socket.io     │
│ • Google Maps   │                 │ • Session Mgmt  │
│ • Pinia Store   │                 │ • TypeScript    │
└─────────────────┘                 └─────────────────┘
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests (when available)
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Made with ❤️ for real-time location tracking
