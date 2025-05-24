import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Participant {
  id: string
  name: string
  location?: {
    lat: number
    lng: number
    timestamp: number
  }
  isOnline: boolean
  joinedAt: number
}

export interface RoutePoint {
  lat: number
  lng: number
  type: 'start' | 'end' | 'waypoint'
}

export interface Session {
  id: string
  pin: string
  createdAt: number
  createdBy: string
  route: RoutePoint[]
  participants: Map<string, Participant>
  isActive: boolean
}

export const useSessionStore = defineStore('session', () => {
  const currentSession = ref<Session | null>(null)
  const isManager = ref(false)
  const currentParticipantId = ref<string | null>(null)

  const activeParticipants = computed(() => {
    if (!currentSession.value) return []
    return Array.from(currentSession.value.participants.values()).filter(p => p.isOnline)
  })

  function generatePin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  function createSession(managerId: string): Session {
    const session: Session = {
      id: crypto.randomUUID(),
      pin: generatePin(),
      createdAt: Date.now(),
      createdBy: managerId,
      route: [],
      participants: new Map(),
      isActive: true
    }
    currentSession.value = session
    return session
  }

  function joinSession(pin: string, participantName: string): boolean {
    // In a real app, this would validate against a backend
    if (currentSession.value && currentSession.value.pin === pin) {
      const participant: Participant = {
        id: crypto.randomUUID(),
        name: participantName,
        isOnline: true,
        joinedAt: Date.now()
      }
      currentSession.value.participants.set(participant.id, participant)
      currentParticipantId.value = participant.id
      return true
    }
    return false
  }

  function updateParticipantLocation(participantId: string, lat: number, lng: number) {
    if (!currentSession.value) return
    
    const participant = currentSession.value.participants.get(participantId)
    if (participant) {
      participant.location = {
        lat,
        lng,
        timestamp: Date.now()
      }
    }
  }

  function updateRoute(route: RoutePoint[]) {
    if (!currentSession.value || !isManager.value) return
    currentSession.value.route = route
  }

  function endSession() {
    if (!currentSession.value || !isManager.value) return
    currentSession.value.isActive = false
    currentSession.value = null
  }

  return {
    currentSession,
    isManager,
    currentParticipantId,
    activeParticipants,
    createSession,
    joinSession,
    updateParticipantLocation,
    updateRoute,
    endSession
  }
}) 