# Database Setup Guide

This project uses PostgreSQL with Prisma ORM for data management. This guide covers both local development setup and Heroku deployment.

## 🏠 Local Development Setup

### Option 1: Using Docker (Recommended)

1. **Create a docker-compose.yml file** (in project root):

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_USER: ridemapper
      POSTGRES_PASSWORD: localpassword
      POSTGRES_DB: ridemapper
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

2. **Start PostgreSQL**:

```bash
docker-compose up -d
```

3. **Update your .env file**:

```env
DATABASE_URL="postgresql://ridemapper:localpassword@localhost:5432/ridemapper?schema=public"
```

### Option 2: Local PostgreSQL Installation

1. **Install PostgreSQL** on your system:

   - **macOS**: `brew install postgresql`
   - **Ubuntu**: `sudo apt-get install postgresql postgresql-contrib`
   - **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/)

2. **Create database and user**:

```sql
sudo -u postgres psql
CREATE DATABASE ridemapper;
CREATE USER ridemapper WITH PASSWORD 'localpassword';
GRANT ALL PRIVILEGES ON DATABASE ridemapper TO ridemapper;
\q
```

3. **Update your .env file**:

```env
DATABASE_URL="postgresql://ridemapper:localpassword@localhost:5432/ridemapper?schema=public"
```

## 🚀 Setup Database Schema

After setting up PostgreSQL, run these commands in the `server` directory:

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database (for development)
npm run db:push

# OR run migrations (for production-like setup)
npm run db:migrate
```

## ☁️ Heroku Setup

### 1. Add Heroku Postgres Add-on

```bash
# Add Heroku Postgres (free tier)
heroku addons:create heroku-postgresql:essential-0 --app your-app-name

# OR paid tier for better performance
heroku addons:create heroku-postgresql:standard-0 --app your-app-name
```

### 2. Get Database URL

The `DATABASE_URL` environment variable will be automatically set by Heroku. You can view it with:

```bash
heroku config:get DATABASE_URL --app your-app-name
```

### 3. Run Database Migrations on Heroku

Add this to your `package.json` scripts in the server directory:

```json
{
  "scripts": {
    "heroku-postbuild": "npm run db:generate && npm run db:push",
    "release": "npm run db:push"
  }
}
```

Or run manually:

```bash
heroku run npm run db:push --app your-app-name
```

## 📊 Database Schema Overview

The application uses the following main tables:

### Routes

- Store reusable route templates and session-specific routes
- Fields: name, description, points (JSON), createdBy, isTemplate

### Sessions

- Active tracking sessions
- Fields: pin, managerId, managerName, routeId (optional), isActive

### Participants

- Users in tracking sessions
- Fields: sessionId, name, isOnline, location data

### Messages

- Chat messages between participants
- Fields: sessionId, fromId, toId, content, type

## 🔧 Common Database Operations

### Reset Database (Development Only)

```bash
npm run db:reset
```

### View Database

You can use any PostgreSQL client:

- **pgAdmin**: GUI tool
- **psql**: Command line
- **VS Code extensions**: PostgreSQL Explorer

### Backup Database (Heroku)

```bash
heroku pg:backups:capture --app your-app-name
heroku pg:backups:download --app your-app-name
```

## 🐛 Troubleshooting

### Connection Issues

1. Ensure PostgreSQL is running
2. Check DATABASE_URL format
3. Verify credentials and database exists

### Migration Issues

```bash
# Reset and regenerate
npm run db:reset
npm run db:generate
npm run db:push
```

### Heroku Issues

```bash
# Check logs
heroku logs --tail --app your-app-name

# Check database status
heroku pg:info --app your-app-name
```

## 📝 Environment Variables

Required environment variables:

```env
# Local Development
DATABASE_URL="postgresql://username:password@localhost:5432/dbname?schema=public"

# Heroku (automatically set)
DATABASE_URL=postgres://user:pass@host:5432/dbname
```

## 🔄 Data Migration Strategy

When you have existing data to migrate:

1. **Export from old system**
2. **Create migration script** in `prisma/migrations/`
3. **Test on local copy** of production data
4. **Run on production** during maintenance window

Example migration script:

```typescript
// prisma/migrations/custom/import-legacy-data.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateData() {
  // Your migration logic here
}

migrateData().finally(() => prisma.$disconnect())
```

This setup provides a robust, scalable database solution that works seamlessly in both development and production environments!
