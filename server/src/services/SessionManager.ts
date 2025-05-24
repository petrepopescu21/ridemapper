import { PrismaClient } from '@prisma/client'
import { Session, Participant, Route, RoutePoint, Message } from '../types'
import { DatabaseService } from './DatabaseService'
import { RouteService } from './RouteService'
import { v4 as uuidv4 } from 'uuid'

export class SessionManager {
  private prisma: PrismaClient
  private routeService: RouteService
  private activeSessions: Map<string, Session> = new Map() // In-memory cache for active sessions
  private sessionsByPin: Map<string, string> = new Map() // pin -> sessionId
  private participantSessions: Map<string, string> = new Map() // participantId -> sessionId

  constructor() {
    this.prisma = DatabaseService.getInstance().getClient()
    this.routeService = new RouteService()
  }

  async initialize(): Promise<void> {
    // Load active sessions from database into memory
    try {
      const activeSessions = await this.prisma.session.findMany({
        where: { isActive: true },
        include: {
          route: true,
          // Note: No participants loaded from DB - they're memory-only
        },
      })

      for (const sessionData of activeSessions) {
        const session = await this.mapPrismaSessionToSession(sessionData)
        this.activeSessions.set(session.id, session)
        this.sessionsByPin.set(session.pin, session.id)

        // Note: No participant mapping needed - they don't persist in DB
      }

      console.log(`📊 Loaded ${activeSessions.length} active sessions from database`)
    } catch (error) {
      console.error('Error loading active sessions:', error)
    }
  }

  async createSession(managerName: string, routeId?: string): Promise<Session> {
    // First, check if any active session already exists
    const existingSession = await this.getAnyActiveSession()
    if (existingSession) {
      console.log(`Manager ${managerName} joined existing active session ${existingSession.pin}`)
      return existingSession
    }

    // No active session exists, create a new one
    const sessionId = uuidv4()
    const managerId = uuidv4()
    const pin = this.generatePin()

    // Validate route if provided
    let route: Route | undefined
    if (routeId) {
      const foundRoute = await this.routeService.getRoute(routeId)
      if (!foundRoute) {
        throw new Error('Route not found')
      }
      route = foundRoute
    }

    // Create session in database (without participants)
    const sessionData = await this.prisma.session.create({
      data: {
        id: sessionId,
        pin,
        managerId,
        managerName,
        routeId: routeId || undefined,
      },
      include: {
        route: true,
      },
    })

    // Create session object with manager participant in memory only
    const participants = new Map<string, Participant>()
    const managerParticipant: Participant = {
      id: managerId,
      name: `${managerName} (Manager)`,
      isOnline: true,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    }
    participants.set(managerId, managerParticipant)

    const session: Session = {
      id: sessionId,
      pin,
      managerId,
      managerName,
      routeId: routeId || undefined,
      route,
      participants,
      createdAt: sessionData.createdAt.getTime(),
      updatedAt: sessionData.updatedAt.getTime(),
      isActive: sessionData.isActive,
      endsAt: sessionData.endsAt ? sessionData.endsAt.getTime() : undefined,
    }

    // Cache in memory
    this.activeSessions.set(sessionId, session)
    this.sessionsByPin.set(pin, sessionId)
    this.participantSessions.set(managerId, sessionId)

    console.log(`New session created: ${sessionId} with PIN: ${pin}`)
    return session
  }

  async joinSession(
    pin: string,
    participantName: string
  ): Promise<{ success: boolean; session?: Session; participantId?: string; error?: string }> {
    const sessionId = this.sessionsByPin.get(pin)
    if (!sessionId) {
      return { success: false, error: 'Invalid PIN' }
    }

    let session = this.activeSessions.get(sessionId)
    if (!session || !session.isActive) {
      return { success: false, error: 'Session not found or inactive' }
    }

    const participantId = uuidv4()

    try {
      // Create participant in memory only (no database storage)
      const participant: Participant = {
        id: participantId,
        name: participantName,
        isOnline: true,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      }

      session.participants.set(participantId, participant)
      this.participantSessions.set(participantId, sessionId)

      console.log(`Participant ${participantName} joined session ${sessionId} (memory only)`)
      return { success: true, session, participantId }
    } catch (error) {
      console.error('Error joining session:', error)
      return { success: false, error: 'Failed to join session' }
    }
  }

  async leaveSession(
    participantId: string
  ): Promise<{ success: boolean; sessionId?: string; wasManager?: boolean }> {
    const sessionId = this.participantSessions.get(participantId)
    if (!sessionId) {
      return { success: false }
    }

    const session = this.activeSessions.get(sessionId)
    if (!session) {
      return { success: false }
    }

    const participant = session.participants.get(participantId)
    if (!participant) {
      return { success: false }
    }

    const wasManager = participantId === session.managerId

    try {
      // Remove from memory only (no database operations for participants)
      session.participants.delete(participantId)
      this.participantSessions.delete(participantId)

      // If manager left, end the session
      if (wasManager) {
        await this.endSession(sessionId)
      }

      console.log(`Participant ${participant.name} left session ${sessionId} (memory cleanup only)`)
      return { success: true, sessionId, wasManager }
    } catch (error) {
      console.error('Error leaving session:', error)
      return { success: false }
    }
  }

  async endSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      return false
    }

    try {
      // Mark as inactive in database
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          endsAt: new Date(),
        },
      })

      // Clean up memory
      for (const participantId of session.participants.keys()) {
        this.participantSessions.delete(participantId)
      }

      this.sessionsByPin.delete(session.pin)
      this.activeSessions.delete(sessionId)

      console.log(`Session ${sessionId} ended`)
      return true
    } catch (error) {
      console.error('Error ending session:', error)
      return false
    }
  }

  async updateParticipantLocation(
    participantId: string,
    lat: number,
    lng: number
  ): Promise<{ success: boolean; sessionId?: string }> {
    const sessionId = this.participantSessions.get(participantId)
    if (!sessionId) {
      return { success: false }
    }

    const session = this.activeSessions.get(sessionId)
    if (!session || !session.isActive) {
      return { success: false }
    }

    const participant = session.participants.get(participantId)
    if (!participant) {
      return { success: false }
    }

    // Update location and lastSeen ONLY in memory (no database operations)
    participant.location = {
      lat,
      lng,
      timestamp: Date.now(),
    }
    participant.lastSeen = Date.now()

    return { success: true, sessionId }
  }

  async assignRouteToSession(
    sessionId: string,
    routeId: string,
    managerId: string
  ): Promise<boolean> {
    const session = this.activeSessions.get(sessionId)
    if (!session || !session.isActive || session.managerId !== managerId) {
      return false
    }

    const route = await this.routeService.getRoute(routeId)
    if (!route) {
      return false
    }

    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { routeId },
      })

      // Update memory cache
      session.routeId = routeId
      session.route = route

      console.log(`Route ${routeId} assigned to session ${sessionId}`)
      return true
    } catch (error) {
      console.error('Error assigning route to session:', error)
      return false
    }
  }

  async createSessionRoute(
    sessionId: string,
    name: string,
    points: RoutePoint[],
    managerId: string,
    description?: string
  ): Promise<Route | null> {
    const session = this.activeSessions.get(sessionId)
    if (!session || !session.isActive || session.managerId !== managerId) {
      return null
    }

    try {
      // Create a session-specific route (not a template)
      const route = await this.routeService.createRoute(name, points, managerId, description, false)

      // Assign it to the session
      await this.assignRouteToSession(sessionId, route.id, managerId)

      return route
    } catch (error) {
      console.error('Error creating session route:', error)
      return null
    }
  }

  async updateSessionRoute(
    sessionId: string,
    points: RoutePoint[],
    managerId: string
  ): Promise<Route | null> {
    const session = this.activeSessions.get(sessionId)
    if (!session || !session.isActive || session.managerId !== managerId) {
      return null
    }

    try {
      // If session has no route yet, create a new one
      if (!session.routeId) {
        const routeName = `Route for Session ${session.pin}`
        const route = await this.createSessionRoute(sessionId, routeName, points, managerId)
        return route
      }

      // Update existing route
      const route = await this.routeService.updateRoute(session.routeId, managerId, { points })
      if (route) {
        session.route = route
      }
      return route
    } catch (error) {
      console.error('Error updating session route:', error)
      return null
    }
  }

  getSession(sessionId: string): Session | undefined {
    return this.activeSessions.get(sessionId)
  }

  getSessionByPin(pin: string): Session | undefined {
    const sessionId = this.sessionsByPin.get(pin)
    return sessionId ? this.activeSessions.get(sessionId) : undefined
  }

  getParticipantSession(participantId: string): Session | undefined {
    const sessionId = this.participantSessions.get(participantId)
    return sessionId ? this.activeSessions.get(sessionId) : undefined
  }

  getAllActiveSessions(): Session[] {
    return Array.from(this.activeSessions.values()).filter((session) => session.isActive)
  }

  async getAnyActiveSession(): Promise<Session | null> {
    // First check memory
    const activeSessions = this.getAllActiveSessions()
    if (activeSessions.length > 0) {
      return activeSessions[0] // Return the first (and should be only) active session
    }

    // Check database
    try {
      const sessionData = await this.prisma.session.findFirst({
        where: { isActive: true },
        include: {
          route: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      if (sessionData) {
        const session = await this.mapPrismaSessionToSession(sessionData)
        // Cache it in memory
        this.activeSessions.set(session.id, session)
        this.sessionsByPin.set(session.pin, session.id)
        return session
      }
    } catch (error) {
      console.error('Error getting active session from database:', error)
    }

    return null
  }

  async validateManager(
    sessionId: string,
    managerId: string
  ): Promise<{ success: boolean; session?: Session; error?: string }> {
    // In single-session mode, any manager can manage any active session
    const session = this.activeSessions.get(sessionId)

    if (!session) {
      // Try to load from database
      const dbSession = await this.getSessionFromDatabase(sessionId)
      if (dbSession && dbSession.isActive) {
        return { success: true, session: dbSession }
      }
      return { success: false, error: 'Session not found' }
    }

    if (!session.isActive) {
      return { success: false, error: 'Session is not active' }
    }

    return { success: true, session }
  }

  private async getSessionFromDatabase(sessionId: string): Promise<Session | null> {
    try {
      const sessionData = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          route: true,
          // Note: No participants to include - they're memory-only
        },
      })

      return sessionData ? await this.mapPrismaSessionToSession(sessionData) : null
    } catch (error) {
      console.error('Error getting session from database:', error)
      return null
    }
  }

  private async mapPrismaSessionToSession(prismaSession: any): Promise<Session> {
    // Participants are memory-only, so start with empty Map
    const participants = new Map<string, Participant>()

    return {
      id: prismaSession.id,
      pin: prismaSession.pin,
      managerId: prismaSession.managerId,
      managerName: prismaSession.managerName,
      routeId: prismaSession.routeId,
      route: prismaSession.route
        ? {
            id: prismaSession.route.id,
            name: prismaSession.route.name,
            description: prismaSession.route.description,
            points: prismaSession.route.points as RoutePoint[],
            createdBy: prismaSession.route.createdBy,
            createdAt: prismaSession.route.createdAt.getTime(),
            updatedAt: prismaSession.route.updatedAt.getTime(),
            isTemplate: prismaSession.route.isTemplate,
          }
        : undefined,
      participants,
      createdAt: prismaSession.createdAt.getTime(),
      updatedAt: prismaSession.updatedAt.getTime(),
      isActive: prismaSession.isActive,
      endsAt: prismaSession.endsAt ? prismaSession.endsAt.getTime() : undefined,
    }
  }

  private generatePin(): string {
    // Generate a 6-digit PIN
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  // Cleanup inactive sessions (run periodically)
  async cleanup(): Promise<void> {
    try {
      await DatabaseService.getInstance().cleanup()

      // Reload active sessions
      await this.initialize()
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }
}
