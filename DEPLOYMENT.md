# 🚀 RideMapper Deployment Guide

This guide covers all deployment options for the RideMapper application, from local development to production deployment on Heroku with automated CI/CD.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [GitHub Secrets Setup](#github-secrets-setup)
- [Automated Deployment (Recommended)](#automated-deployment-recommended)
- [Manual Deployment](#manual-deployment)
- [Local Development](#local-development)
- [Monitoring & Troubleshooting](#monitoring--troubleshooting)

## Prerequisites

### Required Services

1. **Heroku Account**: [Sign up here](https://signup.heroku.com/)
2. **Google Cloud Console**: [Create account](https://console.cloud.google.com/)
3. **GitHub Account**: [Sign up here](https://github.com/join)

### Required Tools

- **Git**: Version control
- **Heroku CLI**: [Install guide](https://devcenter.heroku.com/articles/heroku-cli)
- **Node.js 18+**: [Download here](https://nodejs.org/)

### Google Maps API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - **Maps JavaScript API**
   - **Routes API**
   - **Geocoding API** (optional)
4. Create credentials (API Key)
5. Restrict the API key (recommended):
   - Application restrictions: HTTP referrers
   - API restrictions: Select the APIs above

## GitHub Secrets Setup

To enable automated deployment, you need to configure GitHub repository secrets:

### 1. Get Heroku API Key

```bash
heroku login
heroku auth:token
```

### 2. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `HEROKU_API_KEY` | Heroku API token | `heroku auth:token` |
| `HEROKU_APP_NAME` | Your Heroku app name | Create app or use existing |
| `HEROKU_EMAIL` | Your Heroku account email | Your login email |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key | From Google Cloud Console |

### 3. Create Heroku App (if needed)

```bash
# Option 1: Via Heroku CLI
heroku create your-app-name

# Option 2: Via Heroku Dashboard
# Go to https://dashboard.heroku.com/new-app
```

## Automated Deployment (Recommended)

### How It Works

The GitHub Actions workflow automatically:

1. **On Pull Request**: Runs tests, security audit, and Docker builds
2. **On Merge to Main**: Deploys to Heroku after successful tests

### Workflow Files

- `.github/workflows/deploy.yml` - Main deployment workflow
- `.github/workflows/pr-check.yml` - Pull request validation

### Triggering Deployment

1. **Create a Pull Request** → Automatic validation runs
2. **Merge to Main** → Automatic deployment to Heroku
3. **Manual Trigger** → Go to Actions tab → "Deploy to Heroku" → Run workflow

### Monitoring Deployment

1. Go to your repository's **Actions** tab
2. Click on the latest workflow run
3. Monitor each job's progress
4. Check deployment status and logs

## Manual Deployment

### Quick Deploy Script

```bash
# Unix/Mac/Linux
npm run heroku:deploy

# Windows
npm run heroku:deploy:win
```

### Step-by-Step Manual Deploy

1. **Login to Heroku**
   ```bash
   heroku login
   ```

2. **Create/Configure App**
   ```bash
   heroku create your-app-name
   heroku config:set NODE_ENV=production
   heroku config:set VITE_GOOGLE_MAPS_API_KEY=your_api_key
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

4. **Open App**
   ```bash
   heroku open
   ```

## Local Development

### Environment Setup

1. **Clone repository**
   ```bash
   git clone https://github.com/your-username/ridemapper.git
   cd ridemapper
   ```

2. **Install dependencies**
   ```bash
   npm install
   npm run install:server
   ```

3. **Set up environment**
   ```bash
   cp env.example .env
   # Edit .env with your Google Maps API key
   ```

### Development Commands

```bash
# Start both client and server
npm run dev:all

# Individual services
npm run dev              # Client only (Vite)
npm run server:dev       # Server only (Nodemon)

# Build for production
npm run build            # Build both
npm run build:client     # Client only
npm run build:server     # Server only

# Type checking
npm run type-check       # Client
cd server && npm run type-check  # Server
```

### Docker Development

```bash
# Development with hot reload
npm run docker:dev

# Production simulation
npm run docker:up

# Cleanup
npm run docker:down
```

## Monitoring & Troubleshooting

### Health Checks

- **Application**: `https://your-app.herokuapp.com/health`
- **Status**: Returns JSON with app status and metrics

### Heroku Commands

```bash
# View logs
heroku logs --tail --app=your-app-name

# Check app status
heroku ps --app=your-app-name

# View configuration
heroku config --app=your-app-name

# Restart app
heroku restart --app=your-app-name

# Open app
heroku open --app=your-app-name
```

### Common Issues

#### 1. Build Failures

**Problem**: `npm run build` fails
**Solution**: 
- Check Google Maps API key is set
- Verify all dependencies are installed
- Check TypeScript errors

#### 2. Runtime Errors

**Problem**: App crashes on startup
**Solution**:
- Check Heroku logs: `heroku logs --tail`
- Verify environment variables
- Check server build artifacts exist

#### 3. API Key Issues

**Problem**: Maps don't load
**Solution**:
- Verify API key in Heroku config
- Check API restrictions in Google Cloud
- Ensure billing is enabled for Google Cloud project

#### 4. WebSocket Connection Issues

**Problem**: Real-time features don't work
**Solution**:
- Check browser console for connection errors
- Verify CORS settings in server
- Check Heroku app logs for WebSocket errors

### Performance Monitoring

```bash
# App metrics
heroku ps --app=your-app-name

# Database usage (if using add-ons)
heroku pg:info --app=your-app-name

# View releases
heroku releases --app=your-app-name
```

## Security Considerations

### Environment Variables

- Never commit API keys to git
- Use GitHub secrets for CI/CD
- Rotate API keys regularly
- Restrict API keys to specific domains

### API Security

- Enable API key restrictions in Google Cloud
- Use HTTPS in production (automatic on Heroku)
- Implement rate limiting for production
- Monitor usage and quotas

### Dependencies

- Regular security audits: `npm audit`
- Keep dependencies updated
- Use dependabot for automated updates

## Scaling Considerations

### Heroku Dynos

```bash
# Scale web dynos
heroku ps:scale web=2 --app=your-app-name

# Check current scaling
heroku ps --app=your-app-name
```

### Database (Future Enhancement)

For persistence, consider adding:
- Heroku Postgres
- Redis for session storage
- MongoDB Atlas

### Performance Optimization

- Enable gzip compression (already configured)
- Use CDN for static assets
- Implement caching strategies
- Monitor response times

---

## 🎯 Quick Reference

### Essential Commands

```bash
# Deploy to Heroku
git push heroku main

# View logs
heroku logs --tail

# Open app
heroku open

# Check status
heroku ps
```

### Important URLs

- **App**: `https://your-app-name.herokuapp.com`
- **Health**: `https://your-app-name.herokuapp.com/health`
- **Heroku Dashboard**: `https://dashboard.heroku.com/apps/your-app-name`
- **GitHub Actions**: `https://github.com/your-username/ridemapper/actions`

### Support

- **Heroku Support**: [help.heroku.com](https://help.heroku.com/)
- **Google Maps API**: [developers.google.com/maps](https://developers.google.com/maps/)
- **GitHub Actions**: [docs.github.com/actions](https://docs.github.com/en/actions)

---

*For more detailed information, check the main [README.md](README.md) file.* 