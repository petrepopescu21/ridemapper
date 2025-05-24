import { io, Socket } from 'socket.io-client'

interface RoutePoint {
  lat: number
  lng: number
  type: 'start' | 'end' | 'waypoint'
}

interface Route {
  id: string
  name: string
  description?: string
  points: RoutePoint[]
  distance?: number // Distance in meters
  createdBy: string
  createdAt: number
  updatedAt: number
  isTemplate: boolean
}

class RouteService {
  private socket: Socket | null = null

  constructor() {
    this.initializeSocket()
  }

  private initializeSocket() {
    if (this.socket?.connected) return

    // Automatically detect WebSocket URL based on current location
    let wsUrl: string

    if (import.meta.env.VITE_WS_URL) {
      // Use explicit URL if provided (for development)
      wsUrl = import.meta.env.VITE_WS_URL
    } else if (typeof window !== 'undefined') {
      // In browser: construct WebSocket URL from current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      wsUrl = `${protocol}//${host}`
    } else {
      // Fallback for development
      wsUrl = 'ws://localhost:3200'
    }

    console.log('RouteService: Attempting to connect to:', wsUrl)

    this.socket = io(wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 10000,
    })

    this.socket.on('connect', () => {
      console.log('✅ RouteService connected to server successfully')
    })

    this.socket.on('disconnect', (reason) => {
      console.log('❌ RouteService disconnected from server. Reason:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('❌ RouteService connection error:', error)
      console.log('🔧 Check if server is running on:', wsUrl)
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 RouteService reconnected after', attemptNumber, 'attempts')
    })

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 RouteService reconnection attempt:', attemptNumber)
    })

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ RouteService reconnection failed:', error)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('❌ RouteService failed to reconnect after all attempts')
    })
  }

  async createRoute(
    name: string,
    description: string,
    points: RoutePoint[],
    createdBy: string,
    distance?: number
  ): Promise<{ success: boolean; route?: Route; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' })
        return
      }

      this.socket.emit(
        'route:create',
        {
          name,
          description,
          points,
          createdBy,
          distance,
          isTemplate: true,
        },
        (response: { success: boolean; route?: Route; error?: string }) => {
          resolve(response)
        }
      )
    })
  }

  async updateRoute(
    routeId: string,
    name: string,
    description: string,
    points: RoutePoint[],
    updatedBy: string,
    distance?: number
  ): Promise<{ success: boolean; route?: Route; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' })
        return
      }

      this.socket.emit(
        'route:update',
        {
          routeId,
          name,
          description,
          points,
          updatedBy,
          distance,
        },
        (response: { success: boolean; route?: Route; error?: string }) => {
          resolve(response)
        }
      )
    })
  }

  async deleteRoute(
    routeId: string,
    deletedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' })
        return
      }

      this.socket.emit(
        'route:delete',
        {
          routeId,
          deletedBy,
        },
        (response: { success: boolean; error?: string }) => {
          resolve(response)
        }
      )
    })
  }

  async listRoutes(
    createdBy?: string,
    templatesOnly?: boolean
  ): Promise<{ success: boolean; routes?: Route[]; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' })
        return
      }

      this.socket.emit(
        'route:list',
        {
          createdBy,
          templatesOnly,
        },
        (response: { success: boolean; routes?: Route[]; error?: string }) => {
          resolve(response)
        }
      )
    })
  }

  async getRoute(routeId: string): Promise<{ success: boolean; route?: Route; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' })
        return
      }

      this.socket.emit(
        'route:get',
        {
          routeId,
        },
        (response: { success: boolean; route?: Route; error?: string }) => {
          resolve(response)
        }
      )
    })
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // Reconnect if needed
  reconnect() {
    if (!this.socket?.connected) {
      this.initializeSocket()
    }
  }
}

// Export a singleton instance
export const routeService = new RouteService()
export type { Route, RoutePoint }
