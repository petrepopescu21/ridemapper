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

export interface Participant {
  id: string
  name: string
  location?: Location
  isOnline: boolean
  joinedAt: number
}

export interface Session {
  id: string
  pin: string
  managerId: string
  managerName: string
  participants: Map<string, Participant>
  route: RoutePoint[]
  createdAt: number
  isActive: boolean
}

// Serialized version for network transmission
export interface SerializedSession {
  id: string
  pin: string
  managerId: string
  managerName: string
  participants: { [key: string]: Participant }
  route: RoutePoint[]
  createdAt: number
  isActive: boolean
}

export interface Message {
  id: string
  sessionId: string
  from: string
  to: string
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
  'location:updated': (data: { sessionId: string; participantId: string; location: Location }) => void
  
  // Route events
  'route:updated': (data: { sessionId: string; route: RoutePoint[] }) => void
  
  // Message events
  'message:received': (data: Message) => void
  
  // Error events
  'error': (data: { message: string; code?: string }) => void
}

export interface ClientToServerEvents {
  // Session management
  'session:create': (data: { managerName: string }, callback: (response: { success: boolean; session?: SerializedSession; error?: string }) => void) => void
  'session:join': (data: { pin: string; participantName: string }, callback: (response: { success: boolean; session?: SerializedSession; participantId?: string; error?: string }) => void) => void
  'session:leave': (data: { sessionId: string; participantId: string }) => void
  'session:end': (data: { sessionId: string; managerId: string }) => void
  'session:rejoin': (data: { sessionId: string; participantId: string }, callback: (response: { success: boolean; session?: SerializedSession; error?: string }) => void) => void
  'session:validate-manager': (data: { sessionId: string; managerId: string }, callback: (response: { success: boolean; session?: SerializedSession; error?: string }) => void) => void
  
  // Location updates
  'location:update': (data: { sessionId: string; participantId: string; location: Location }) => void
  
  // Route management
  'route:update': (data: { sessionId: string; managerId: string; route: RoutePoint[] }) => void
  
  // Messaging
  'message:send': (data: { sessionId: string; from: string; to: string; content: string; type: 'direct' | 'broadcast' }) => void
} 