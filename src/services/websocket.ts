import { io, Socket } from 'socket.io-client'

export interface ServerToClientEvents {
  // Session events
  'session:joined': (data: { sessionId: string; participant: any }) => void
  'session:left': (data: { sessionId: string; participantId: string }) => void
  'session:ended': (data: { sessionId: string }) => void
  'session:participant-update': (data: { sessionId: string; participant: any }) => void

  // Location events
  'location:updated': (data: { sessionId: string; participantId: string; location: any }) => void

  // Route events
  'route:updated': (data: { sessionId: string; route: any }) => void

  // Message events
  'message:received': (data: any) => void

  // Error events
  error: (data: { message: string; code?: string }) => void
}

export interface ClientToServerEvents {
  // Session management
  'session:create': (
    data: { managerName: string; routeId?: string },
    callback: (response: { success: boolean; session?: any; error?: string }) => void
  ) => void
  'session:join': (
    data: { pin: string; participantName: string },
    callback: (response: {
      success: boolean
      session?: any
      participantId?: string
      error?: string
    }) => void
  ) => void
  'session:join-as-manager': (
    data: { pin: string; managerName: string; managerId: string },
    callback: (response: {
      success: boolean
      session?: any
      participantId?: string
      error?: string
    }) => void
  ) => void
  'session:leave': (data: { sessionId: string; participantId: string }) => void
  'session:end': (data: { sessionId: string; managerId: string }) => void
  'session:rejoin': (
    data: { sessionId: string; participantId: string },
    callback: (response: { success: boolean; session?: any; error?: string }) => void
  ) => void
  'session:validate-manager': (
    data: { sessionId: string; managerId: string },
    callback: (response: { success: boolean; session?: any; error?: string }) => void
  ) => void

  // Location updates
  'location:update': (data: {
    sessionId: string
    participantId: string
    location: { lat: number; lng: number }
  }) => void

  // Route management
  'route:update': (data: { sessionId: string; managerId: string; route: any[] }) => void

  // Session route management
  'session:update-route': (
    data: { sessionId: string; points: any[]; managerId: string },
    callback: (response: { success: boolean; route?: any; error?: string }) => void
  ) => void

  // Messaging
  'message:send': (data: {
    sessionId: string
    from: string
    to: string
    content: string
    type: 'direct' | 'broadcast'
  }) => void
}

class WebSocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null
  private isConnected = false

  connect(): Promise<Socket<ServerToClientEvents, ClientToServerEvents>> {
    return new Promise((resolve, reject) => {
      // Get server URL from environment or default to localhost
      const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3200'

      console.log('Connecting to WebSocket server at:', serverUrl)

      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
      })

      this.socket.on('connect', () => {
        console.log('Connected to WebSocket server:', this.socket?.id)
        this.isConnected = true
        resolve(this.socket!)
      })

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from WebSocket server:', reason)
        this.isConnected = false
      })

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error)
        this.isConnected = false
        reject(error)
      })
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }

  getSocket() {
    return this.socket
  }

  isSocketConnected() {
    return this.isConnected && this.socket?.connected
  }

  // Session methods
  createSession(
    managerName: string,
    routeId?: string
  ): Promise<{ success: boolean; session?: any; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected to server' })
        return
      }

      this.socket.emit('session:create', { managerName, routeId }, (response) => {
        resolve(response)
      })
    })
  }

  joinSession(
    pin: string,
    participantName: string
  ): Promise<{ success: boolean; session?: any; participantId?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected to server' })
        return
      }

      this.socket.emit('session:join', { pin, participantName }, (response) => {
        resolve(response)
      })
    })
  }

  joinAsManager(
    pin: string,
    managerName: string,
    managerId: string
  ): Promise<{ success: boolean; session?: any; participantId?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected to server' })
        return
      }

      this.socket.emit('session:join-as-manager', { pin, managerName, managerId }, (response) => {
        resolve(response)
      })
    })
  }

  leaveSession(sessionId: string, participantId: string) {
    if (this.socket) {
      this.socket.emit('session:leave', { sessionId, participantId })
    }
  }

  endSession(sessionId: string, managerId: string) {
    if (this.socket) {
      this.socket.emit('session:end', { sessionId, managerId })
    }
  }

  updateLocation(sessionId: string, participantId: string, location: { lat: number; lng: number }) {
    if (this.socket) {
      this.socket.emit('location:update', { sessionId, participantId, location })
    }
  }

  updateRoute(
    sessionId: string,
    managerId: string,
    route: any[]
  ): Promise<{ success: boolean; route?: any; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected to server' })
        return
      }

      this.socket.emit(
        'session:update-route',
        { sessionId, points: route, managerId },
        (response) => {
          resolve(response)
        }
      )
    })
  }

  sendMessage(
    sessionId: string,
    from: string,
    to: string,
    content: string,
    type: 'direct' | 'broadcast' = 'broadcast'
  ) {
    if (this.socket) {
      this.socket.emit('message:send', { sessionId, from, to, content, type })
    }
  }

  validateManagerSession(
    sessionId: string,
    managerId: string
  ): Promise<{ success: boolean; session?: any; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected to server' })
        return
      }

      this.socket.emit('session:validate-manager', { sessionId, managerId }, (response) => {
        resolve(response)
      })
    })
  }

  rejoinSession(
    sessionId: string,
    participantId: string
  ): Promise<{ success: boolean; session?: any; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected to server' })
        return
      }

      this.socket.emit('session:rejoin', { sessionId, participantId }, (response) => {
        resolve(response)
      })
    })
  }
}

export const websocketService = new WebSocketService()
