import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { websocketService } from '@/services/websocket'

export interface Participant {
  id: string
  name: string
  location?: {
    lat: number
    lng: number
    timestamp: number
  }
  isOnline: boolean
  isManager: boolean
  joinedAt: number
}

export interface RoutePoint {
  lat: number
  lng: number
  type: 'start' | 'end' | 'waypoint'
}

export interface Route {
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

export interface Session {
  id: string
  pin: string
  managerId: string
  managerName: string
  routeId?: string
  route?: Route
  participants: { [key: string]: Participant } // Changed from Map to object for network transmission
  createdAt: number
  updatedAt: number
  isActive: boolean
  endsAt?: number
}

export const useSessionStore = defineStore('session', () => {
  const currentSession = ref<Session | null>(null)
  const isManager = ref(false)
  const currentParticipantId = ref<string | null>(null)
  const isConnected = ref(false)
  const connectionError = ref<string | null>(null)

  const activeParticipants = computed(() => {
    if (!currentSession.value) return []
    return Object.values(currentSession.value.participants).filter((p) => p.isOnline)
  })

  // Session persistence
  const STORAGE_KEY = 'ridemapper_session'

  function saveSessionToStorage() {
    if (currentSession.value && currentParticipantId.value) {
      const sessionData = {
        session: currentSession.value,
        isManager: isManager.value,
        participantId: currentParticipantId.value,
        timestamp: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData))
      console.log('Session saved to localStorage')
    }
  }

  function loadSessionFromStorage(): {
    session: Session
    isManager: boolean
    participantId: string
  } | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return null

      const sessionData = JSON.parse(stored)

      // Check if session is not too old (max 24 hours)
      const maxAge = 24 * 60 * 60 * 1000
      if (Date.now() - sessionData.timestamp > maxAge) {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }

      console.log('Loaded session from localStorage')
      return sessionData
    } catch (error) {
      console.error('Failed to load session from localStorage:', error)
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
  }

  function clearSessionFromStorage() {
    localStorage.removeItem(STORAGE_KEY)
    console.log('Session cleared from localStorage')
  }

  // Session recovery
  async function recoverSession(): Promise<{ success: boolean; error?: string }> {
    const storedSession = loadSessionFromStorage()
    if (!storedSession) {
      return { success: false, error: 'No stored session found' }
    }

    try {
      // Connect to WebSocket first
      if (!isConnected.value) {
        await initialize()
      }

      // Validate session with server by trying to rejoin
      const socket = websocketService.getSocket()
      if (!socket) {
        return { success: false, error: 'Not connected to server' }
      }

      // For managers, try to reconnect to their session
      if (storedSession.isManager) {
        // Validate that session still exists by trying to create/rejoin
        const response = await websocketService.validateManagerSession(
          storedSession.session.id,
          storedSession.participantId
        )

        if (response.success && response.session) {
          currentSession.value = response.session
          isManager.value = true
          currentParticipantId.value = storedSession.participantId
          setupEventListeners()
          saveSessionToStorage()
          console.log('Manager session recovered successfully')
          return { success: true }
        }
      } else {
        // For participants, try to rejoin the session
        const response = await websocketService.rejoinSession(
          storedSession.session.id,
          storedSession.participantId
        )

        if (response.success && response.session) {
          currentSession.value = response.session
          isManager.value = false
          currentParticipantId.value = storedSession.participantId
          setupEventListeners()
          saveSessionToStorage()
          console.log('Participant session recovered successfully')
          return { success: true }
        }
      }

      // If recovery failed, clear storage
      clearSessionFromStorage()

      // Redirect based on what role they had when session ended
      if (storedSession.isManager) {
        // Former managers go to dashboard
        window.location.href = '/manager-dashboard'
      } else {
        // Former participants go to homepage
        window.location.href = '/'
      }

      return { success: false, error: 'Session no longer exists on server' }
    } catch (error) {
      console.error('Session recovery failed:', error)

      // Store the role before clearing storage
      const wasManager = storedSession.isManager
      clearSessionFromStorage()

      // Redirect based on what role they had
      if (wasManager) {
        window.location.href = '/manager-dashboard'
      } else {
        window.location.href = '/'
      }

      return { success: false, error: 'Failed to recover session' }
    }
  }

  // Initialize WebSocket connection
  async function initialize() {
    try {
      connectionError.value = null
      await websocketService.connect()
      isConnected.value = true

      // Set up event listeners
      setupEventListeners()

      console.log('WebSocket connection established')
    } catch (error) {
      console.error('Failed to connect to WebSocket server:', error)
      connectionError.value = 'Failed to connect to server'
      isConnected.value = false
    }
  }

  function setupEventListeners() {
    const socket = websocketService.getSocket()
    if (!socket) return

    // Session events
    socket.on('session:joined', (data) => {
      console.log('Participant joined:', data)
      if (currentSession.value && data.sessionId === currentSession.value.id) {
        currentSession.value.participants[data.participant.id] = data.participant
      }
    })

    socket.on('session:left', (data) => {
      console.log('Participant left:', data)
      if (currentSession.value && data.sessionId === currentSession.value.id) {
        delete currentSession.value.participants[data.participantId]
      }
    })

    socket.on('session:ended', (data) => {
      console.log('Session ended:', data)
      if (currentSession.value && data.sessionId === currentSession.value.id) {
        const wasManager = isManager.value

        currentSession.value = null
        currentParticipantId.value = null
        isManager.value = false
        clearSessionFromStorage()

        // Redirect based on role
        if (wasManager) {
          // Redirect managers to dashboard
          window.location.href = '/manager-dashboard'
        } else {
          // Redirect participants to homepage
          window.location.href = '/'
        }
      }
    })

    // Location events
    socket.on('location:updated', (data) => {
      if (currentSession.value && data.sessionId === currentSession.value.id) {
        const participant = currentSession.value.participants[data.participantId]
        if (participant) {
          participant.location = data.location
        }
      }
    })

    // Route events
    socket.on('route:updated', (data) => {
      if (currentSession.value && data.sessionId === currentSession.value.id) {
        currentSession.value.route = data.route
      }
    })
  }

  async function createSession(
    managerName: string,
    routeId?: string
  ): Promise<{ success: boolean; error?: string; joinedExisting?: boolean }> {
    if (!isConnected.value) {
      await initialize()
    }

    try {
      const response = await websocketService.createSession(managerName, routeId)

      if (response.success && response.session) {
        console.log('Session created/joined:', response.session)
        console.log('Route data in session:', response.session.route)

        const joinedExisting = response.session.managerName !== managerName

        currentSession.value = response.session
        isManager.value = true
        currentParticipantId.value = response.session.managerId

        // Save to localStorage
        saveSessionToStorage()

        if (joinedExisting) {
          console.log('Joined existing session:', response.session)
        } else {
          console.log('Created new session:', response.session)
        }

        return { success: true, joinedExisting }
      } else {
        return { success: false, error: response.error || 'Failed to create session' }
      }
    } catch (error) {
      console.error('Error creating session:', error)
      return { success: false, error: 'Failed to create session' }
    }
  }

  async function joinSession(
    pin: string,
    participantName: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isConnected.value) {
      await initialize()
    }

    try {
      const response = await websocketService.joinSession(pin, participantName)

      if (response.success && response.session && response.participantId) {
        currentSession.value = response.session
        isManager.value = false
        currentParticipantId.value = response.participantId

        // Save to localStorage
        saveSessionToStorage()

        console.log('Joined session:', response.session)

        // Trigger route display if route exists
        if (response.session.route && response.session.route.points.length > 0) {
          console.log('Session has existing route, will display it')
        }

        return { success: true }
      } else {
        return { success: false, error: response.error || 'Failed to join session' }
      }
    } catch (error) {
      console.error('Error joining session:', error)
      return { success: false, error: 'Failed to join session' }
    }
  }

  async function joinAsManager(
    pin: string,
    managerName: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isConnected.value) {
      await initialize()
    }

    try {
      const response = await websocketService.joinAsManager(pin, managerName, crypto.randomUUID())

      if (response.success && response.session && response.participantId) {
        currentSession.value = response.session
        isManager.value = true
        currentParticipantId.value = response.participantId

        // Save to localStorage
        saveSessionToStorage()

        console.log('Joined session as manager:', response.session)

        return { success: true }
      } else {
        return { success: false, error: response.error || 'Failed to join as manager' }
      }
    } catch (error) {
      console.error('Error joining as manager:', error)
      return { success: false, error: 'Failed to join as manager' }
    }
  }

  function leaveSession() {
    if (currentSession.value && currentParticipantId.value) {
      websocketService.leaveSession(currentSession.value.id, currentParticipantId.value)
      currentSession.value = null
      currentParticipantId.value = null
      isManager.value = false
      clearSessionFromStorage()
    }
  }

  function endSession() {
    if (currentSession.value && isManager.value && currentParticipantId.value) {
      websocketService.endSession(currentSession.value.id, currentParticipantId.value)
      currentSession.value = null
      currentParticipantId.value = null
      isManager.value = false
      clearSessionFromStorage()
    }
  }

  function updateParticipantLocation(lat: number, lng: number) {
    if (currentSession.value && currentParticipantId.value) {
      websocketService.updateLocation(currentSession.value.id, currentParticipantId.value, {
        lat,
        lng,
      })
    }
  }

  async function updateRoute(route: RoutePoint[]) {
    if (currentSession.value && isManager.value && currentParticipantId.value) {
      try {
        const response = await websocketService.updateRoute(
          currentSession.value.id,
          currentParticipantId.value,
          route
        )

        if (response.success && response.route) {
          // Update local session with the complete route object
          currentSession.value.route = response.route
          console.log('Route updated successfully')
        } else {
          console.error('Failed to update route:', response.error)
        }
      } catch (error) {
        console.error('Error updating route:', error)
      }
    }
  }

  function disconnect() {
    websocketService.disconnect()
    isConnected.value = false
    currentSession.value = null
    currentParticipantId.value = null
    isManager.value = false
    clearSessionFromStorage()
  }

  // Auto-save session data when it changes
  watch(
    [currentSession, isManager, currentParticipantId],
    () => {
      if (currentSession.value && currentParticipantId.value) {
        saveSessionToStorage()
      }
    },
    { deep: true }
  )

  return {
    currentSession,
    isManager,
    currentParticipantId,
    activeParticipants,
    isConnected,
    connectionError,
    initialize,
    createSession,
    joinSession,
    joinAsManager,
    leaveSession,
    endSession,
    updateParticipantLocation,
    updateRoute,
    disconnect,
    recoverSession,
    saveSessionToStorage,
    clearSessionFromStorage,
  }
})
