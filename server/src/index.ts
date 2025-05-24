import express, { Request, Response, NextFunction } from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import path from 'path'
import { config } from 'dotenv'
import { SessionManager } from './services/SessionManager'
import { RouteService } from './services/RouteService'
import { DatabaseService } from './services/DatabaseService'
import { ServerToClientEvents, ClientToServerEvents, SerializedSession } from './types'

// Load environment variables from .env file in project root
config({ path: path.join(__dirname, '../../.env') })

const app = express()
const server = createServer(app)
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin:
      process.env.CLIENT_URL ||
      (process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173'),
    methods: ['GET', 'POST'],
  },
})

// Helper function to serialize session
function serializeSession(session: any): SerializedSession {
  return {
    ...session,
    participants: Object.fromEntries(session.participants),
  }
}

// Middleware
app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      (process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173'),
  })
)
app.use(express.json())

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the Vue.js build
  app.use(express.static(path.join(__dirname, '../client-dist')))

  // Handle client-side routing - serve index.html for non-API routes
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // Skip API routes and socket.io
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/socket.io') ||
      req.path.startsWith('/health')
    ) {
      return next()
    }
    res.sendFile(path.join(__dirname, '../client-dist/index.html'))
  })
}

// Initialize services
const databaseService = DatabaseService.getInstance()
const sessionManager = new SessionManager()
const routeService = new RouteService()

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const dbHealth = await databaseService.healthCheck()

  // Check if database tables exist
  let tablesExist = false
  let routeCount = 0
  let sessionCount = 0

  try {
    if (dbHealth) {
      // Test if our tables exist by counting records
      routeCount = await databaseService.getClient().route.count()
      sessionCount = await databaseService.getClient().session.count()
      tablesExist = true
    }
  } catch (error) {
    console.error('Health check - table check failed:', error)
    tablesExist = false
  }

  res.json({
    status: dbHealth ? 'healthy' : 'unhealthy',
    database: dbHealth ? 'connected' : 'disconnected',
    tablesExist,
    routeCount,
    sessionCount,
    databaseUrl: !!process.env.DATABASE_URL,
    timestamp: new Date().toISOString(),
    activeSessions: sessionManager.getAllActiveSessions().length,
    environment: process.env.NODE_ENV || 'development',
  })
})

// API endpoint for background sync location updates
app.post('/api/location', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, participantId, location, timestamp } = req.body

    // Validate required fields
    if (!sessionId || !participantId || !location || !location.lat || !location.lng) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, participantId, location.lat, location.lng',
      })
      return
    }

    console.log('📍 API location update:', {
      sessionId,
      participantId,
      location,
      timestamp,
    })

    // Update location via SessionManager
    const result = await sessionManager.updateParticipantLocation(
      participantId,
      location.lat,
      location.lng
    )

    if (result.success && result.sessionId) {
      // Broadcast location update to all participants in the session via WebSocket
      io.to(result.sessionId).emit('location:updated', {
        sessionId: result.sessionId,
        participantId,
        location,
      })

      res.json({
        success: true,
        message: 'Location updated successfully',
      })

      console.log('✅ API location update broadcasted to session', result.sessionId)
      return
    } else {
      res.status(404).json({
        success: false,
        error: 'Participant or session not found',
      })
      return
    }
  } catch (error) {
    console.error('❌ API location update error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
    return
  }
})

// Initialize database and services
async function initializeServer() {
  try {
    await databaseService.connect()
    await sessionManager.initialize()
    console.log('🚀 Server services initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize server services:', error)
    process.exit(1)
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Session management
  socket.on('session:create', async (data, callback) => {
    try {
      console.log('Creating session with data:', data)
      const session = await sessionManager.createSession(data.managerName, data.routeId)
      console.log('Session created:', {
        id: session.id,
        pin: session.pin,
        routeId: session.routeId,
        hasRoute: !!session.route,
      })
      if (session.route) {
        console.log('Route details:', {
          id: session.route.id,
          name: session.route.name,
          pointsCount: session.route.points.length,
        })
      }

      // Join the socket to the session room
      socket.join(session.id)

      // Serialize the session for transmission
      const serializedSession = serializeSession(session)
      console.log('Serialized session route:', !!serializedSession.route)

      callback({ success: true, session: serializedSession })
      console.log(`Manager ${data.managerName} created session ${session.pin}`)
    } catch (error) {
      console.error('Error creating session:', error)
      callback({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create session',
      })
    }
  })

  socket.on('session:join', async (data, callback) => {
    try {
      const result = await sessionManager.joinSession(data.pin, data.participantName)

      if (result.success && result.session && result.participantId) {
        // Join the socket to the session room
        socket.join(result.session.id)

        // Serialize the session for transmission
        const serializedSession = serializeSession(result.session)

        // Notify other participants
        socket.to(result.session.id).emit('session:joined', {
          sessionId: result.session.id,
          participant: result.session.participants.get(result.participantId)!,
        })

        callback({
          success: true,
          session: serializedSession,
          participantId: result.participantId,
        })

        console.log(`${data.participantName} joined session ${data.pin}`)
      } else {
        callback({ success: false, error: result.error })
      }
    } catch (error) {
      console.error('Error joining session:', error)
      callback({ success: false, error: 'Failed to join session' })
    }
  })

  socket.on('session:join-as-manager', async (data, callback) => {
    try {
      const result = await sessionManager.joinAsManager(data.pin, data.managerName, data.managerId)

      if (result.success && result.session && result.participantId) {
        // Join the socket to the session room
        socket.join(result.session.id)

        // Serialize the session for transmission
        const serializedSession = serializeSession(result.session)

        // Notify other participants
        socket.to(result.session.id).emit('session:joined', {
          sessionId: result.session.id,
          participant: result.session.participants.get(result.participantId)!,
        })

        callback({
          success: true,
          session: serializedSession,
          participantId: result.participantId,
        })

        console.log(`Manager ${data.managerName} joined session ${data.pin}`)
      } else {
        callback({ success: false, error: result.error })
      }
    } catch (error) {
      console.error('Error joining session as manager:', error)
      callback({ success: false, error: 'Failed to join session as manager' })
    }
  })

  socket.on('session:leave', async (data) => {
    try {
      const result = await sessionManager.leaveSession(data.participantId)

      if (result.success && result.sessionId) {
        // Leave the socket room
        socket.leave(result.sessionId)

        // Notify other participants
        socket.to(result.sessionId).emit('session:left', {
          sessionId: result.sessionId,
          participantId: data.participantId,
        })

        // If manager left, notify all participants that session ended
        if (result.wasManager) {
          socket.to(result.sessionId).emit('session:ended', {
            sessionId: result.sessionId,
          })
        }

        console.log(`Participant ${data.participantId} left session ${result.sessionId}`)
      }
    } catch (error) {
      console.error('Error leaving session:', error)
    }
  })

  socket.on('session:end', async (data) => {
    try {
      const session = sessionManager.getSession(data.sessionId)
      if (session && session.managerId === data.managerId) {
        // Notify all participants
        socket.to(data.sessionId).emit('session:ended', {
          sessionId: data.sessionId,
        })

        // End the session
        await sessionManager.endSession(data.sessionId)

        console.log(`Session ${data.sessionId} ended by manager`)
      }
    } catch (error) {
      console.error('Error ending session:', error)
    }
  })

  // Session recovery handlers
  socket.on('session:validate-manager', async (data, callback) => {
    try {
      const result = await sessionManager.validateManager(data.sessionId, data.managerId)

      if (result.success && result.session) {
        // Rejoin the socket to the session room
        socket.join(result.session.id)

        // Serialize the session for transmission
        const serializedSession = serializeSession(result.session)

        callback({ success: true, session: serializedSession })
        console.log(`Manager reconnected to session ${result.session.pin}`)
      } else {
        callback({ success: false, error: result.error || 'Session not found or access denied' })
      }
    } catch (error) {
      console.error('Error validating manager session:', error)
      callback({ success: false, error: 'Failed to validate session' })
    }
  })

  socket.on('session:rejoin', async (data, callback) => {
    try {
      const session = sessionManager.getParticipantSession(data.participantId)

      if (session && session.isActive && session.id === data.sessionId) {
        // Mark participant as online
        const participant = session.participants.get(data.participantId)
        if (participant) {
          participant.isOnline = true

          // Rejoin the socket to the session room
          socket.join(session.id)

          // Serialize the session for transmission
          const serializedSession = serializeSession(session)

          // Notify other participants that this participant is back online
          socket.to(session.id).emit('session:joined', {
            sessionId: session.id,
            participant: participant,
          })

          callback({ success: true, session: serializedSession })
          console.log(`Participant ${participant.name} reconnected to session ${session.pin}`)
        } else {
          callback({ success: false, error: 'Participant not found in session' })
        }
      } else {
        callback({ success: false, error: 'Session not found or access denied' })
      }
    } catch (error) {
      console.error('Error rejoining session:', error)
      callback({ success: false, error: 'Failed to rejoin session' })
    }
  })

  // Location updates
  socket.on('location:update', async (data) => {
    try {
      const result = await sessionManager.updateParticipantLocation(
        data.participantId,
        data.location.lat,
        data.location.lng
      )

      if (result.success && result.sessionId) {
        // Broadcast location update to all participants in the session
        socket.to(result.sessionId).emit('location:updated', {
          sessionId: result.sessionId,
          participantId: data.participantId,
          location: data.location,
        })
      }
    } catch (error) {
      console.error('Error updating location:', error)
    }
  })

  // Route management
  socket.on('route:create', async (data, callback) => {
    try {
      console.log('Route creation request:', {
        name: data.name,
        pointsCount: data.points?.length,
        createdBy: data.createdBy,
        hasDescription: !!data.description,
        isTemplate: data.isTemplate,
      })

      // Validate required fields
      if (!data.name || !data.points || !data.createdBy) {
        const error = 'Missing required fields: name, points, or createdBy'
        console.error('Route creation validation failed:', error)
        callback({ success: false, error })
        return
      }

      const route = await routeService.createRoute(
        data.name,
        data.points,
        data.createdBy,
        data.description,
        data.isTemplate
      )

      callback({ success: true, route })

      // Broadcast route creation to interested clients
      io.emit('route:created', { route })

      console.log(`✅ Route "${data.name}" created successfully by ${data.createdBy}`)
    } catch (error) {
      console.error('❌ Error creating route:', error)

      // Log more details about the error
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }

      callback({ success: false, error: 'Failed to create route' })
    }
  })

  socket.on('route:update', async (data, callback) => {
    try {
      const route = await routeService.updateRoute(data.routeId, data.updatedBy, {
        name: data.name,
        description: data.description,
        points: data.points,
      })

      if (route) {
        callback({ success: true, route })
        console.log(`Route ${data.routeId} updated by ${data.updatedBy}`)
      } else {
        callback({ success: false, error: 'Route not found or permission denied' })
      }
    } catch (error) {
      console.error('Error updating route:', error)
      callback({ success: false, error: 'Failed to update route' })
    }
  })

  socket.on('route:delete', async (data, callback) => {
    try {
      const success = await routeService.deleteRoute(data.routeId, data.deletedBy)

      if (success) {
        callback({ success: true })
        console.log(`Route ${data.routeId} deleted by ${data.deletedBy}`)
      } else {
        callback({ success: false, error: 'Route not found or cannot be deleted' })
      }
    } catch (error) {
      console.error('Error deleting route:', error)
      callback({ success: false, error: 'Failed to delete route' })
    }
  })

  socket.on('route:list', async (data, callback) => {
    try {
      const routes = await routeService.listRoutes({
        createdBy: data.createdBy,
        templatesOnly: data.templatesOnly,
      })

      callback({ success: true, routes })
    } catch (error) {
      console.error('Error listing routes:', error)
      callback({ success: false, error: 'Failed to list routes' })
    }
  })

  socket.on('route:get', async (data, callback) => {
    try {
      const route = await routeService.getRoute(data.routeId)

      if (route) {
        callback({ success: true, route })
      } else {
        callback({ success: false, error: 'Route not found' })
      }
    } catch (error) {
      console.error('Error getting route:', error)
      callback({ success: false, error: 'Failed to get route' })
    }
  })

  socket.on('route:assign-to-session', async (data, callback) => {
    try {
      const success = await sessionManager.assignRouteToSession(
        data.sessionId,
        data.routeId,
        data.managerId
      )

      if (success) {
        const session = sessionManager.getSession(data.sessionId)
        if (session && session.route) {
          // Broadcast route update to all participants
          socket.to(data.sessionId).emit('route:updated', {
            sessionId: data.sessionId,
            route: session.route,
          })
        }

        callback({ success: true })
        console.log(`Route ${data.routeId} assigned to session ${data.sessionId}`)
      } else {
        callback({ success: false, error: 'Failed to assign route to session' })
      }
    } catch (error) {
      console.error('Error assigning route to session:', error)
      callback({ success: false, error: 'Failed to assign route to session' })
    }
  })

  // Session route management
  socket.on('session:create-route', async (data, callback) => {
    try {
      const route = await sessionManager.createSessionRoute(
        data.sessionId,
        data.name,
        data.points,
        data.managerId,
        data.description
      )

      if (route) {
        // Broadcast route update to all participants
        socket.to(data.sessionId).emit('route:updated', {
          sessionId: data.sessionId,
          route,
        })

        callback({ success: true, route })
        console.log(`Session route "${data.name}" created for session ${data.sessionId}`)
      } else {
        callback({ success: false, error: 'Failed to create session route' })
      }
    } catch (error) {
      console.error('Error creating session route:', error)
      callback({ success: false, error: 'Failed to create session route' })
    }
  })

  socket.on('session:update-route', async (data, callback) => {
    try {
      const route = await sessionManager.updateSessionRoute(
        data.sessionId,
        data.points,
        data.managerId
      )

      if (route) {
        // Broadcast route update to all participants
        socket.to(data.sessionId).emit('route:updated', {
          sessionId: data.sessionId,
          route,
        })

        callback({ success: true, route })
        console.log(`Session route updated for session ${data.sessionId}`)
      } else {
        callback({ success: false, error: 'Failed to update session route' })
      }
    } catch (error) {
      console.error('Error updating session route:', error)
      callback({ success: false, error: 'Failed to update session route' })
    }
  })

  // Messaging
  socket.on('message:send', (data) => {
    try {
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: data.sessionId,
        fromId: data.fromId,
        toId: data.toId,
        content: data.content,
        timestamp: Date.now(),
        type: data.type,
      }

      if (data.type === 'broadcast') {
        // Send to all participants in the session
        socket.to(data.sessionId).emit('message:received', message)
      } else {
        // Send to specific participant (would need socket mapping for this)
        // For now, broadcast to all and let client filter
        socket.to(data.sessionId).emit('message:received', message)
      }

      console.log(
        `Message sent from ${data.fromId} to ${data.toId || 'all'} in session ${data.sessionId}`
      )
    } catch (error) {
      console.error('Error sending message:', error)
    }
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`)

  try {
    // Close the server
    server.close(() => {
      console.log('📡 HTTP server closed')
    })

    // Disconnect from database
    await databaseService.disconnect()

    console.log('✅ Graceful shutdown completed')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error)
    process.exit(1)
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Cleanup job - run every hour
setInterval(async () => {
  await sessionManager.cleanup()
}, 60 * 60 * 1000)

const PORT = Number(process.env.PORT) || 3200
const HOST = process.env.HOST || '0.0.0.0'

// Start the server
initializeServer().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`🌟 RideMapper server running on http://${HOST}:${PORT}`)
    console.log(`🔌 WebSocket server ready for connections`)
    console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'Connected' : 'Local'}`)
  })
})
