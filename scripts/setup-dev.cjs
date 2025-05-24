#!/usr/bin/env node

const { execSync } = require('child_process')
const path = require('path')

console.log('🚀 RideMapper Development Setup')
console.log('================================')

// Paths
const rootDir = path.join(__dirname, '..')

// Database configuration that matches docker-compose.yml
const DATABASE_CONFIG = {
  user: 'ridemapper',
  password: 'localpassword',
  database: 'ridemapper',
  host: 'localhost',
  port: '5432',
}

function startDatabase() {
  console.log('🐳 Starting PostgreSQL with Docker...')

  try {
    // Check if Docker is running
    execSync('docker --version', { stdio: 'pipe' })

    // Start PostgreSQL container
    execSync('docker-compose up -d postgres', {
      cwd: rootDir,
      stdio: 'inherit',
    })

    console.log('✅ PostgreSQL container started!')

    // Wait a moment for the database to be ready
    console.log('⏳ Waiting for database to be ready...')

    return true
  } catch (error) {
    console.log('❌ Docker not available or failed to start PostgreSQL')
    console.log('💡 Please install Docker or set up PostgreSQL manually')
    console.log('📖 See DATABASE_SETUP.md for manual setup instructions')
    return false
  }
}

function setupDatabase() {
  console.log('⚙️ Setting up database schema...')

  try {
    // Change to server directory
    const serverDir = path.join(rootDir, 'server')

    // Generate Prisma client
    console.log('🔧 Generating Prisma client...')
    execSync('npx prisma generate', {
      cwd: serverDir,
      stdio: 'inherit',
    })

    // Push schema to database
    console.log('📊 Setting up database schema...')
    execSync('npx prisma db push', {
      cwd: serverDir,
      stdio: 'inherit',
    })

    console.log('✅ Database setup complete!')
    return true
  } catch (error) {
    console.log('❌ Database setup failed:', error.message)
    console.log('💡 You may need to wait for PostgreSQL to fully start')
    console.log('🔄 Try running: npm run db:setup')
    return false
  }
}

async function main() {
  try {
    console.log('📋 Prerequisites:')
    console.log('   1. Create .env file with your configuration')
    console.log('   2. Add your Google Maps API key to .env')
    console.log('   3. Ensure Docker is installed for database')
    console.log('')

    // Step 1: Start database
    const dbStarted = startDatabase()

    if (dbStarted) {
      // Wait a bit for database to be ready
      console.log('⏳ Waiting 8 seconds for database to initialize...')
      await new Promise((resolve) => setTimeout(resolve, 8000))

      // Step 2: Setup database
      setupDatabase()
    }

    console.log('')
    console.log('🎉 Development setup complete!')
    console.log('')
    console.log('📋 Next steps:')
    console.log('   1. Ensure .env file exists with your Google Maps API key')
    console.log('   2. Run: npm run dev:all')
    console.log('   3. Open: http://localhost:5173')
    console.log('')
    console.log(
      '🗄️ Database URL:',
      `postgresql://${DATABASE_CONFIG.user}:${DATABASE_CONFIG.password}@${DATABASE_CONFIG.host}:${DATABASE_CONFIG.port}/${DATABASE_CONFIG.database}`
    )
    console.log('🔧 pgAdmin: http://localhost:5050 (admin@ridemapper.com / admin)')
  } catch (error) {
    console.error('❌ Setup failed:', error.message)
    process.exit(1)
  }
}

// Run the setup
main()
