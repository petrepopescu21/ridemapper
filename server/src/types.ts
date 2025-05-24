export interface Location {
  lat: number
  lng: number
  timestamp: number
}

export interface RoutePoint {
  lat: number
  lng: number
  type: 'start' | 'end' | 'waypoint'
}

// Route entity - separate from sessions
export interface Route {
  id: string
  name: string
  description?: string
  points: RoutePoint[]
  distance?: number // Distance in meters
  createdBy: string
  createdAt: number
  updatedAt: number
  isTemplate: boolean // true for reusable templates, false for session-specific
}

export interface Participant {
  id: string
  name: string
  location?: Location
  isOnline: boolean
  isManager: boolean
  joinedAt: number
  lastSeen: number
}

export interface Session {
  id: string
  pin: string
  managerId: string
  managerName: string
  routeId?: string // Optional reference to a route
  route?: Route // Populated route data
  participants: Map<string, Participant>
  createdAt: number
  updatedAt: number
  isActive: boolean
  endsAt?: number
}

// Serialized version for network transmission
export interface SerializedSession {
  id: string
  pin: string
  managerId: string
  managerName: string
  routeId?: string
  route?: Route
  participants: { [key: string]: Participant }
  createdAt: number
  updatedAt: number
  isActive: boolean
  endsAt?: number
}

export interface Message {
  id: string
  sessionId: string
  fromId: string
  toId?: string // undefined for broadcast messages
  content: string
  timestamp: number
  type: 'direct' | 'broadcast'
}

// Socket event types
export interface ServerToClientEvents {
  // Session events
  'session:joined': (data: { sessionId: string; participant: Participant }) => void
  'session:left': (data: { sessionId: string; participantId: string }) => void
  'session:ended': (data: { sessionId: string }) => void
  'session:participant-update': (data: { sessionId: string; participant: Participant }) => void

  // Location events
  'location:updated': (data: {
    sessionId: string
    participantId: string
    location: Location
  }) => void

  // Route events
  'route:updated': (data: { sessionId: string; route: Route }) => void
  'route:created': (data: { route: Route }) => void

  // Message events
  'message:received': (data: Message) => void

  // Error events
  error: (data: { message: string; code?: string }) => void
}

export interface ClientToServerEvents {
  // Session management
  'session:create': (
    data: { managerName: string; routeId?: string },
    callback: (response: { success: boolean; session?: SerializedSession; error?: string }) => void
  ) => void
  'session:join': (
    data: { pin: string; participantName: string },
    callback: (response: {
      success: boolean
      session?: SerializedSession
      participantId?: string
      error?: string
    }) => void
  ) => void
  'session:join-as-manager': (
    data: { pin: string; managerName: string; managerId: string },
    callback: (response: {
      success: boolean
      session?: SerializedSession
      participantId?: string
      error?: string
    }) => void
  ) => void
  'session:leave': (data: { sessionId: string; participantId: string }) => void
  'session:end': (data: { sessionId: string; managerId: string }) => void
  'session:rejoin': (
    data: { sessionId: string; participantId: string },
    callback: (response: { success: boolean; session?: SerializedSession; error?: string }) => void
  ) => void
  'session:validate-manager': (
    data: { sessionId: string; managerId: string },
    callback: (response: { success: boolean; session?: SerializedSession; error?: string }) => void
  ) => void

  // Location updates
  'location:update': (data: {
    sessionId: string
    participantId: string
    location: Location
  }) => void

  // Route management
  'route:create': (
    data: {
      name: string
      description?: string
      points: RoutePoint[]
      createdBy: string
      distance?: number
      isTemplate?: boolean
    },
    callback: (response: { success: boolean; route?: Route; error?: string }) => void
  ) => void
  'route:update': (
    data: {
      routeId: string
      name?: string
      description?: string
      points?: RoutePoint[]
      distance?: number
      updatedBy: string
    },
    callback: (response: { success: boolean; route?: Route; error?: string }) => void
  ) => void
  'route:delete': (
    data: { routeId: string; deletedBy: string },
    callback: (response: { success: boolean; error?: string }) => void
  ) => void
  'route:list': (
    data: { createdBy?: string; templatesOnly?: boolean },
    callback: (response: { success: boolean; routes?: Route[]; error?: string }) => void
  ) => void
  'route:get': (
    data: { routeId: string },
    callback: (response: { success: boolean; route?: Route; error?: string }) => void
  ) => void
  'route:assign-to-session': (
    data: { sessionId: string; routeId: string; managerId: string },
    callback: (response: { success: boolean; error?: string }) => void
  ) => void

  // Session route management (for editing routes within a session)
  'session:create-route': (
    data: {
      sessionId: string
      name: string
      description?: string
      points: RoutePoint[]
      managerId: string
    },
    callback: (response: { success: boolean; route?: Route; error?: string }) => void
  ) => void
  'session:update-route': (
    data: { sessionId: string; points: RoutePoint[]; managerId: string },
    callback: (response: { success: boolean; route?: Route; error?: string }) => void
  ) => void

  // Messaging
  'message:send': (data: {
    sessionId: string
    fromId: string
    toId?: string
    content: string
    type: 'direct' | 'broadcast'
  }) => void
}
