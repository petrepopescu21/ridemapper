# RideMapper 🗺️

[![Deploy to Heroku](https://github.com/your-username/ridemapper/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-username/ridemapper/actions/workflows/deploy.yml)
[![PR Checks](https://github.com/your-username/ridemapper/actions/workflows/pr-check.yml/badge.svg)](https://github.com/your-username/ridemapper/actions/workflows/pr-check.yml)
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/your-username/ridemapper)

A real-time location tracking and route management application with persistent data storage, built with Vue.js, Socket.io, PostgreSQL, and Google Maps.

## Features

- 📍 **Real-time Location Tracking**: Live participant positioning with WebSocket updates
- 🗺️ **Advanced Route Management**: Create, save, and reuse route templates
- 🗄️ **Persistent Data Storage**: PostgreSQL database with Prisma ORM
- 👥 **Session Management**: PIN-based joining with manager controls and session persistence
- 💬 **Real-time Messaging**: Manager-to-participant communication with message history
- 📱 **Progressive Web App**: Mobile-first responsive design with Vuetify
- 🔒 **Secure**: TypeScript, CORS protection, input validation, and graceful error handling

## Technology Stack

- **Frontend**: Vue.js 3, TypeScript, Vuetify, Pinia
- **Backend**: Node.js, Express, Socket.io, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Maps**: Google Maps JavaScript API + Routes API
- **Deployment**: Heroku (with Heroku Postgres)
- **Development**: Vite, Hot Module Replacement, Docker Compose

## Architecture Overview

The application now uses a robust 3-tier architecture with separated concerns:

- **Routes**: Reusable templates that can be shared across sessions
- **Sessions**: Live tracking sessions that can optionally use route templates
- **Participants**: Real-time location tracking with persistent history

```
┌─────────────────┐    WebSocket    ┌─────────────────┐    Prisma    ┌─────────────────┐
│   Vue.js Client │ ←──────────────→ │ Express Server  │ ←───────────→ │   PostgreSQL    │
│                 │                 │                 │              │                 │
│ • Vuetify UI    │                 │ • Socket.io     │              │ • Routes        │
│ • Google Maps   │                 │ • Session Mgmt  │              │ • Sessions      │
│ • Pinia Store   │                 │ • Route Service │              │ • Participants  │
│ • PWA Support   │                 │ • TypeScript    │              │ • Messages      │
└─────────────────┘                 └─────────────────┘              └─────────────────┘
```

## Quick Start

### Local Development with Database

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/ridemapper.git
   cd ridemapper
   ```

2. **Set up environment variables**

   Create a `.env` file in the root directory with:

   ```env
   # Google Maps API Key (required)
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

   # Server Configuration
   NODE_ENV=development
   HOST=127.0.0.1
   PORT=3200

   # Client Configuration
   CLIENT_URL=http://localhost:5173

   # For development
   VITE_API_URL=http://localhost:3200
   VITE_WS_URL=ws://localhost:3200

   # Database Configuration
   DATABASE_URL="postgresql://ridemapper:localpassword@localhost:5432/ridemapper?schema=public"

   # Optional: Prisma Configuration
   PRISMA_CLI_BINARY_TARGETS="native"
   ```

3. **Start PostgreSQL (Docker - Recommended)**

   ```bash
   docker-compose up -d postgres
   ```

4. **Install dependencies**

   ```bash
   npm install
   npm run install:server
   ```

5. **Set up database**

   ```bash
   npm run db:setup
   ```

6. **Start development servers**

   ```bash
   npm run dev:all
   ```

   This starts:

   - Client: http://localhost:5173
   - Server: http://localhost:3200
   - pgAdmin (optional): http://localhost:5050

### Alternative: Local PostgreSQL Installation

See [DATABASE_SETUP.md](DATABASE_SETUP.md) for detailed instructions on setting up PostgreSQL locally or using other database options.

## Heroku Deployment 🚀

### Prerequisites

1. **Heroku CLI** installed
2. **Google Maps API Key** with required APIs enabled
3. **Heroku Postgres** add-on

### Database Setup on Heroku

```bash
# Add Heroku Postgres add-on
heroku addons:create heroku-postgresql:essential-0 --app your-app-name

# Verify database is attached
heroku config --app your-app-name | grep DATABASE_URL
```

### Automated Deployment (Recommended)

**GitHub Actions** automatically deploys your app when you merge to the `main` branch.

#### Setup GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions

Add these secrets:

| Secret                     | Description          | How to Get           |
| -------------------------- | -------------------- | -------------------- |
| `HEROKU_API_KEY`           | Heroku API token     | `heroku auth:token`  |
| `HEROKU_APP_NAME`          | Your Heroku app name | Your app name        |
| `HEROKU_EMAIL`             | Heroku account email | Your login email     |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key  | Google Cloud Console |

#### How It Works

1. **Pull Request** → Runs tests, security audit, type checking
2. **Merge to Main** → Automatic deployment to Heroku with database migrations
3. **Manual Trigger** → Actions tab → "Deploy to Heroku"

### Manual Deployment

1. **Create a Heroku app with Postgres**

   ```bash
   heroku create your-app-name
   heroku addons:create heroku-postgresql:essential-0
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

4. **Run database setup**

   ```bash
   heroku run npm run db:push --app your-app-name
   ```

5. **Open your app**
   ```bash
   heroku open
   ```

### Environment Variables

| Variable                   | Description                          | Required                    |
| -------------------------- | ------------------------------------ | --------------------------- |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key                  | ✅ Yes                      |
| `DATABASE_URL`             | PostgreSQL connection string         | ✅ Yes (auto-set by Heroku) |
| `NODE_ENV`                 | Environment (production/development) | ✅ Yes                      |
| `PORT`                     | Server port (auto-set by Heroku)     | ❌ No                       |
| `CLIENT_URL`               | Client URL for CORS (leave empty)    | ❌ No                       |

## Usage

### Route Management

1. **Create Route Templates**: Design reusable routes that can be shared across sessions
2. **Save and Load**: Persist routes in the database for future use
3. **Session-Specific Editing**: Modify routes within sessions without affecting templates

### For Route Managers

1. **Create/Load Route**: Design a new route or load an existing template
2. **Create Session**: Start a tracking session (optionally with a pre-loaded route)
3. **Share PIN**: Give participants the 6-digit PIN
4. **Real-time Management**: Track participants and modify routes on-the-fly
5. **Messaging**: Send updates and instructions to participants

### For Participants

1. **Join Session**: Enter the PIN and your name
2. **Share Location**: Allow location access for real-time tracking
3. **Follow Route**: View the planned route and receive navigation guidance
4. **Stay Connected**: Receive real-time updates and messages from the manager

## Database Features

- **Persistent Sessions**: Sessions survive server restarts
- **Route Templates**: Reusable route designs
- **Message History**: All communications are stored
- **Location Tracking**: Historical location data
- **Graceful Recovery**: Automatic session restoration

## API Endpoints

- `GET /health` - Health check with database status
- `WebSocket /socket.io` - Real-time communication with route management

## Development Scripts

```bash
# Full Development
npm run dev:all          # Run client, server, and database

# Client & Server
npm run build            # Build for production
npm start               # Start production server

# Database
npm run db:setup         # Initialize database
npm run db:reset         # Reset database (dev only)
npm run db:migrate       # Run migrations

# Docker
docker-compose up -d     # Start PostgreSQL
docker-compose down      # Stop all services
```

## Performance & Monitoring

- **Database Connection Pooling**: Efficient connection management
- **Graceful Shutdown**: Proper cleanup on server termination
- **Health Checks**: Database and server status monitoring
- **Automatic Cleanup**: Removes inactive sessions periodically

## Data Management

- **Backup**: Heroku provides automated backups
- **Migration**: Prisma handles schema changes
- **Monitoring**: Built-in health checks and logging

## Contributing

1. Fork the repository
2. Set up local development environment (see Quick Start)
3. Create a feature branch
4. Make your changes with proper database migrations
5. Test with both local and Docker setups
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Made with ❤️ for real-time location tracking with persistent data storage
