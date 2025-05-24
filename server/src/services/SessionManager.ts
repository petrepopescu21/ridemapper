import { Session, Participant, RoutePoint, Message } from '../types'
import { v4 as uuidv4 } from 'uuid'

export class SessionManager {
  private sessions: Map<string, Session> = new Map()
  private sessionsByPin: Map<string, string> = new Map() // pin -> sessionId
  private participantSessions: Map<string, string> = new Map() // participantId -> sessionId

  createSession(managerName: string): Session {
    const sessionId = uuidv4()
    const managerId = uuidv4()
    const pin = this.generatePin()

    const session: Session = {
      id: sessionId,
      pin,
      managerId,
      managerName,
      participants: new Map(),
      route: [],
      createdAt: Date.now(),
      isActive: true
    }

    // Add manager as a participant
    const managerParticipant: Participant = {
      id: managerId,
      name: `${managerName} (Manager)`,
      isOnline: true,
      joinedAt: Date.now()
    }

    session.participants.set(managerId, managerParticipant)

    this.sessions.set(sessionId, session)
    this.sessionsByPin.set(pin, sessionId)
    this.participantSessions.set(managerId, sessionId)

    console.log(`Session created: ${sessionId} with PIN: ${pin}`)
    return session
  }

  joinSession(pin: string, participantName: string): { success: boolean; session?: Session; participantId?: string; error?: string } {
    const sessionId = this.sessionsByPin.get(pin)
    if (!sessionId) {
      return { success: false, error: 'Invalid PIN' }
    }

    const session = this.sessions.get(sessionId)
    if (!session || !session.isActive) {
      return { success: false, error: 'Session not found or inactive' }
    }

    const participantId = uuidv4()
    const participant: Participant = {
      id: participantId,
      name: participantName,
      isOnline: true,
      joinedAt: Date.now()
    }

    session.participants.set(participantId, participant)
    this.participantSessions.set(participantId, sessionId)

    console.log(`Participant ${participantName} joined session ${sessionId}`)
    return { success: true, session, participantId }
  }

  leaveSession(participantId: string): { success: boolean; sessionId?: string; wasManager?: boolean } {
    const sessionId = this.participantSessions.get(participantId)
    if (!sessionId) {
      return { success: false }
    }

    const session = this.sessions.get(sessionId)
    if (!session) {
      return { success: false }
    }

    const participant = session.participants.get(participantId)
    if (!participant) {
      return { success: false }
    }

    const wasManager = participantId === session.managerId

    // Remove participant
    session.participants.delete(participantId)
    this.participantSessions.delete(participantId)

    // If manager left, end the session
    if (wasManager) {
      this.endSession(sessionId)
    }

    console.log(`Participant ${participant.name} left session ${sessionId}`)
    return { success: true, sessionId, wasManager }
  }

  endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    // Mark as inactive
    session.isActive = false

    // Clean up all participants
    for (const participantId of session.participants.keys()) {
      this.participantSessions.delete(participantId)
    }

    // Clean up maps
    this.sessionsByPin.delete(session.pin)
    this.sessions.delete(sessionId)

    console.log(`Session ${sessionId} ended`)
    return true
  }

  updateParticipantLocation(participantId: string, lat: number, lng: number): { success: boolean; sessionId?: string } {
    const sessionId = this.participantSessions.get(participantId)
    if (!sessionId) {
      return { success: false }
    }

    const session = this.sessions.get(sessionId)
    if (!session || !session.isActive) {
      return { success: false }
    }

    const participant = session.participants.get(participantId)
    if (!participant) {
      return { success: false }
    }

    participant.location = {
      lat,
      lng,
      timestamp: Date.now()
    }

    return { success: true, sessionId }
  }

  updateRoute(sessionId: string, managerId: string, route: RoutePoint[]): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || !session.isActive || session.managerId !== managerId) {
      return false
    }

    session.route = route
    console.log(`Route updated for session ${sessionId}`)
    return true
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId)
  }

  getSessionByPin(pin: string): Session | undefined {
    const sessionId = this.sessionsByPin.get(pin)
    return sessionId ? this.sessions.get(sessionId) : undefined
  }

  getParticipantSession(participantId: string): Session | undefined {
    const sessionId = this.participantSessions.get(participantId)
    return sessionId ? this.sessions.get(sessionId) : undefined
  }

  getAllActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive)
  }

  private generatePin(): string {
    // Generate a 6-digit PIN
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  // Cleanup inactive sessions (run periodically)
  cleanup(): void {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.createdAt > maxAge || !session.isActive) {
        this.endSession(sessionId)
      }
    }
  }
} 