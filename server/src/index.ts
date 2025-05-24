import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import path from 'path'
import { SessionManager } from './services/SessionManager'
import { ServerToClientEvents, ClientToServerEvents, SerializedSession } from './types'

const app = express()
const server = createServer(app)
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? false : "http://localhost:5173"),
    methods: ["GET", "POST"]
  }
})

// Helper function to serialize session
function serializeSession(session: any): SerializedSession {
  return {
    ...session,
    participants: Object.fromEntries(session.participants)
  }
}

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? false : "http://localhost:5173")
}))
app.use(express.json())

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the Vue.js build
  app.use(express.static(path.join(__dirname, '../client-dist')))
  
  // Handle client-side routing - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes and socket.io
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
      return next()
    }
    res.sendFile(path.join(__dirname, '../client-dist/index.html'))
  })
}

// Services
const sessionManager = new SessionManager()

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: sessionManager.getAllActiveSessions().length,
    environment: process.env.NODE_ENV || 'development'
  })
})

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Session management
  socket.on('session:create', (data, callback) => {
    try {
      const session = sessionManager.createSession(data.managerName)
      
      // Join the socket to the session room
      socket.join(session.id)
      
      // Serialize the session for transmission
      const serializedSession = serializeSession(session)
      
      callback({ success: true, session: serializedSession })
      console.log(`Manager ${data.managerName} created session ${session.pin}`)
    } catch (error) {
      console.error('Error creating session:', error)
      callback({ success: false, error: 'Failed to create session' })
    }
  })

  socket.on('session:join', (data, callback) => {
    try {
      const result = sessionManager.joinSession(data.pin, data.participantName)
      
      if (result.success && result.session && result.participantId) {
        // Join the socket to the session room
        socket.join(result.session.id)
        
        // Serialize the session for transmission
        const serializedSession = serializeSession(result.session)
        
        // Notify other participants
        socket.to(result.session.id).emit('session:joined', {
          sessionId: result.session.id,
          participant: result.session.participants.get(result.participantId)!
        })
        
        callback({ 
          success: true, 
          session: serializedSession, 
          participantId: result.participantId 
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

  socket.on('session:leave', (data) => {
    try {
      const result = sessionManager.leaveSession(data.participantId)
      
      if (result.success && result.sessionId) {
        // Leave the socket room
        socket.leave(result.sessionId)
        
        // Notify other participants
        socket.to(result.sessionId).emit('session:left', {
          sessionId: result.sessionId,
          participantId: data.participantId
        })
        
        // If manager left, notify all participants that session ended
        if (result.wasManager) {
          socket.to(result.sessionId).emit('session:ended', {
            sessionId: result.sessionId
          })
        }
        
        console.log(`Participant ${data.participantId} left session ${result.sessionId}`)
      }
    } catch (error) {
      console.error('Error leaving session:', error)
    }
  })

  socket.on('session:end', (data) => {
    try {
      const session = sessionManager.getSession(data.sessionId)
      if (session && session.managerId === data.managerId) {
        // Notify all participants
        socket.to(data.sessionId).emit('session:ended', {
          sessionId: data.sessionId
        })
        
        // End the session
        sessionManager.endSession(data.sessionId)
        
        console.log(`Session ${data.sessionId} ended by manager`)
      }
    } catch (error) {
      console.error('Error ending session:', error)
    }
  })

  // Location updates
  socket.on('location:update', (data) => {
    try {
      const result = sessionManager.updateParticipantLocation(
        data.participantId,
        data.location.lat,
        data.location.lng
      )
      
      if (result.success && result.sessionId) {
        // Broadcast location update to all participants in the session
        socket.to(result.sessionId).emit('location:updated', {
          sessionId: result.sessionId,
          participantId: data.participantId,
          location: data.location
        })
      }
    } catch (error) {
      console.error('Error updating location:', error)
    }
  })

  // Route management
  socket.on('route:update', (data) => {
    try {
      const success = sessionManager.updateRoute(data.sessionId, data.managerId, data.route)
      
      if (success) {
        // Broadcast route update to all participants
        socket.to(data.sessionId).emit('route:updated', {
          sessionId: data.sessionId,
          route: data.route
        })
        
        console.log(`Route updated for session ${data.sessionId}`)
      }
    } catch (error) {
      console.error('Error updating route:', error)
    }
  })

  // Messaging
  socket.on('message:send', (data) => {
    try {
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: data.sessionId,
        from: data.from,
        to: data.to,
        content: data.content,
        timestamp: Date.now(),
        type: data.type
      }
      
      if (data.type === 'broadcast') {
        // Send to all participants in the session
        socket.to(data.sessionId).emit('message:received', message)
      } else {
        // Send to specific participant (would need socket mapping for this)
        // For now, broadcast to all and let client filter
        socket.to(data.sessionId).emit('message:received', message)
      }
      
      console.log(`Message sent from ${data.from} to ${data.to} in session ${data.sessionId}`)
    } catch (error) {
      console.error('Error sending message:', error)
    }
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

// Cleanup job - run every hour
setInterval(() => {
  sessionManager.cleanup()
}, 60 * 60 * 1000)

const PORT = process.env.PORT || 3002

server.listen(PORT, () => {
  console.log(`RideMapper server running on port ${PORT}`)
  console.log(`WebSocket server ready for connections`)
}) 