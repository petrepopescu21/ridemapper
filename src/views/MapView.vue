<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useAuthStore } from '@/stores/auth'
import { useMessagesStore } from '@/stores/messages'
import { useGeolocation } from '@vueuse/core'

const router = useRouter()
const sessionStore = useSessionStore()
const authStore = useAuthStore()
const messagesStore = useMessagesStore()

// Map references
const mapContainer = ref<HTMLDivElement>()
const map = ref<google.maps.Map>()
const directionsService = ref<google.maps.DirectionsService>()
const directionsRenderer = ref<google.maps.DirectionsRenderer>()

// Markers
const participantMarkers = ref<Map<string, google.maps.Marker>>(new Map())
const routeMarkers = ref<google.maps.Marker[]>([])

// Location tracking
const { coords, error: geoError } = useGeolocation({ enableHighAccuracy: true })
const locationInterval = ref<number>()

// UI state
const selectedParticipant = ref<string | null>(null)
const showMessageModal = ref(false)
const messageContent = ref('')
const showRoutePanel = ref(false)
const waypoints = ref<google.maps.LatLng[]>([])

// Session info display
const sessionPin = computed(() => sessionStore.currentSession?.pin || '')
const participantName = computed(() => {
  if (!sessionStore.currentParticipantId || !sessionStore.currentSession) return ''
  const participant = sessionStore.currentSession.participants.get(sessionStore.currentParticipantId)
  return participant?.name || ''
})

// Initialize Google Maps
function initMap() {
  if (!mapContainer.value) return

  map.value = new google.maps.Map(mapContainer.value, {
    center: { lat: 40.7128, lng: -74.0060 }, // Default to New York
    zoom: 13,
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false,
  })

  directionsService.value = new google.maps.DirectionsService()
  directionsRenderer.value = new google.maps.DirectionsRenderer({
    map: map.value,
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#667eea',
      strokeWeight: 5,
      strokeOpacity: 0.8
    }
  })

  // Add click listener for route creation
  if (sessionStore.isManager) {
    map.value.addListener('click', handleMapClick)
  }
}

// Handle map clicks for route creation
function handleMapClick(event: google.maps.MapMouseEvent) {
  if (!sessionStore.isManager || !event.latLng) return

  const marker = new google.maps.Marker({
    position: event.latLng,
    map: map.value,
    draggable: true,
    animation: google.maps.Animation.DROP,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#667eea',
      fillOpacity: 1,
      strokeColor: 'white',
      strokeWeight: 2
    }
  })

  routeMarkers.value.push(marker)
  updateRoute()

  // Allow marker deletion on right click
  marker.addListener('rightclick', () => {
    marker.setMap(null)
    const index = routeMarkers.value.indexOf(marker)
    if (index > -1) {
      routeMarkers.value.splice(index, 1)
      updateRoute()
    }
  })

  // Update route on drag
  marker.addListener('dragend', updateRoute)
}

// Update route display
function updateRoute() {
  if (routeMarkers.value.length < 2) {
    directionsRenderer.value?.setDirections({ routes: [] } as any)
    return
  }

  const waypoints = routeMarkers.value.slice(1, -1).map(marker => ({
    location: marker.getPosition()!,
    stopover: true
  }))

  const request: google.maps.DirectionsRequest = {
    origin: routeMarkers.value[0].getPosition()!,
    destination: routeMarkers.value[routeMarkers.value.length - 1].getPosition()!,
    waypoints,
    travelMode: google.maps.TravelMode.DRIVING
  }

  directionsService.value?.route(request, (result, status) => {
    if (status === 'OK' && result) {
      directionsRenderer.value?.setDirections(result)
      
      // Save route to store
      const routePoints = routeMarkers.value.map((marker, index) => {
        const pos = marker.getPosition()!
        return {
          lat: pos.lat(),
          lng: pos.lng(),
          type: index === 0 ? 'start' : index === routeMarkers.value.length - 1 ? 'end' : 'waypoint'
        } as const
      })
      sessionStore.updateRoute(routePoints)
    }
  })
}

// Clear route
function clearRoute() {
  routeMarkers.value.forEach(marker => marker.setMap(null))
  routeMarkers.value = []
  directionsRenderer.value?.setDirections({ routes: [] } as any)
  sessionStore.updateRoute([])
}

// Update participant locations on map
function updateParticipantMarkers() {
  if (!map.value || !sessionStore.currentSession) return

  sessionStore.currentSession.participants.forEach((participant, id) => {
    if (!participant.location || !participant.isOnline) {
      // Remove marker if participant is offline
      const marker = participantMarkers.value.get(id)
      if (marker) {
        marker.setMap(null)
        participantMarkers.value.delete(id)
      }
      return
    }

    let marker = participantMarkers.value.get(id)
    const position = new google.maps.LatLng(participant.location.lat, participant.location.lng)

    if (!marker) {
      // Create new marker
      marker = new google.maps.Marker({
        position,
        map: map.value,
        title: participant.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: id === sessionStore.currentParticipantId ? '#10b981' : '#f59e0b',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 3
        }
      })

      // Add click listener for messaging (manager only)
      if (sessionStore.isManager) {
        marker.addListener('click', () => {
          selectedParticipant.value = id
          showMessageModal.value = true
        })
      }

      participantMarkers.value.set(id, marker)
    } else {
      // Update existing marker position
      marker.setPosition(position)
    }

    // Add label with participant name
    if (!marker.getLabel()) {
      marker.setLabel({
        text: participant.name,
        color: '#333',
        fontSize: '12px',
        fontWeight: 'bold'
      })
    }
  })
}

// Send location update
function sendLocationUpdate() {
  if (coords.value && sessionStore.currentParticipantId) {
    sessionStore.updateParticipantLocation(
      sessionStore.currentParticipantId,
      coords.value.latitude,
      coords.value.longitude
    )
  }
}

// Send message to participant
function sendMessage() {
  if (!selectedParticipant.value || !messageContent.value.trim()) return

  messagesStore.sendMessage('manager', selectedParticipant.value, messageContent.value.trim())
  messageContent.value = ''
  showMessageModal.value = false
}

// Leave session
function leaveSession() {
  if (sessionStore.isManager) {
    sessionStore.endSession()
    router.push('/manager-dashboard')
  } else {
    // In a real app, this would notify the server
    router.push('/')
  }
}

// Load Google Maps script
function loadGoogleMapsScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve(true)
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
}

// Lifecycle
onMounted(async () => {
  try {
    await loadGoogleMapsScript()
    initMap()

    // Start location updates
    locationInterval.value = window.setInterval(() => {
      sendLocationUpdate()
      updateParticipantMarkers()
    }, 5000) // Update every 5 seconds

    // Initial update
    sendLocationUpdate()
    updateParticipantMarkers()
  } catch (error) {
    console.error('Failed to initialize map:', error)
  }
})

onUnmounted(() => {
  if (locationInterval.value) {
    clearInterval(locationInterval.value)
  }
})

// Watch for changes
watch(coords, () => {
  sendLocationUpdate()
})
</script>

<template>
  <div class="map-view">
    <!-- Header -->
    <header class="map-header">
      <div class="header-left">
        <h1>{{ sessionStore.isManager ? 'Route Manager' : 'Participant' }} View</h1>
        <div class="session-info">
          <span class="pin-badge">PIN: {{ sessionPin }}</span>
          <span v-if="!sessionStore.isManager" class="name-badge">{{ participantName }}</span>
        </div>
      </div>
      <button @click="leaveSession" class="leave-button">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
        </svg>
        {{ sessionStore.isManager ? 'End Session' : 'Leave' }}
      </button>
    </header>

    <!-- Map Container -->
    <div ref="mapContainer" class="map-container"></div>

    <!-- Manager Controls -->
    <div v-if="sessionStore.isManager" class="manager-controls">
      <button @click="showRoutePanel = !showRoutePanel" class="control-button">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.71 11.29l-9-9c-.39-.39-1.02-.39-1.41 0l-9 9c-.39.39-.39 1.02 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9c.39-.39.39-1.02 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/>
        </svg>
        Route Tools
      </button>
      
      <div v-if="showRoutePanel" class="route-panel">
        <h3>Route Management</h3>
        <p>Click on the map to add waypoints</p>
        <div class="route-actions">
          <button @click="clearRoute" class="action-btn danger">Clear Route</button>
        </div>
        <div class="route-points">
          <div v-for="(marker, index) in routeMarkers" :key="index" class="route-point">
            <span>{{ index === 0 ? 'Start' : index === routeMarkers.length - 1 ? 'End' : `Waypoint ${index}` }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Participants Panel -->
    <div class="participants-panel">
      <h3>Active Participants ({{ sessionStore.activeParticipants.length }})</h3>
      <div class="participants-list">
        <div
          v-for="participant in sessionStore.activeParticipants"
          :key="participant.id"
          class="participant-item"
          :class="{ selected: selectedParticipant === participant.id }"
          @click="sessionStore.isManager && (selectedParticipant = participant.id)"
        >
          <div class="participant-info">
            <span class="participant-name">{{ participant.name }}</span>
            <span v-if="participant.location" class="participant-status">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              Live
            </span>
          </div>
          <div v-if="sessionStore.isManager && messagesStore.unreadCount.get(participant.id)" class="unread-badge">
            {{ messagesStore.unreadCount.get(participant.id) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Message Modal -->
    <Teleport to="body">
      <div v-if="showMessageModal" class="modal-overlay" @click.self="showMessageModal = false">
        <div class="message-modal">
          <div class="modal-header">
            <h3>Send Message</h3>
            <button @click="showMessageModal = false" class="close-button">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div v-if="selectedParticipant" class="recipient">
              To: {{ sessionStore.currentSession?.participants.get(selectedParticipant)?.name }}
            </div>
            <textarea
              v-model="messageContent"
              placeholder="Type your message..."
              rows="4"
              class="message-input"
            ></textarea>
          </div>
          <div class="modal-footer">
            <button @click="sendMessage" class="send-button" :disabled="!messageContent.trim()">
              Send Message
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Location Error -->
    <div v-if="geoError" class="location-error">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      Location access denied. Please enable location services.
    </div>
  </div>
</template>

<style scoped>
.map-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

.map-header {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}

.header-left h1 {
  font-size: 1.25rem;
  color: #333;
  margin-bottom: 0.25rem;
}

.session-info {
  display: flex;
  gap: 1rem;
}

.pin-badge, .name-badge {
  background: #f7fafc;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #667eea;
}

.leave-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #fee;
  color: #c53030;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.leave-button:hover {
  background: #fed7d7;
}

.leave-button svg {
  width: 20px;
  height: 20px;
}

.map-container {
  flex: 1;
  position: relative;
}

.manager-controls {
  position: absolute;
  top: 80px;
  left: 20px;
  z-index: 5;
}

.control-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: white;
  border: none;
  border-radius: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.control-button:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.control-button svg {
  width: 20px;
  height: 20px;
  color: #667eea;
}

.route-panel {
  margin-top: 0.5rem;
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-width: 250px;
}

.route-panel h3 {
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.route-panel p {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 1rem;
}

.route-actions {
  margin-bottom: 1rem;
}

.action-btn {
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn.danger {
  background: #fee;
  color: #c53030;
}

.action-btn.danger:hover {
  background: #fed7d7;
}

.route-points {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.route-point {
  padding: 0.5rem;
  background: #f7fafc;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #333;
}

.participants-panel {
  position: absolute;
  top: 80px;
  right: 20px;
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 300px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 5;
}

.participants-panel h3 {
  font-size: 1.125rem;
  margin-bottom: 1rem;
  color: #333;
}

.participants-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.participant-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f7fafc;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.participant-item:hover {
  background: #e2e8f0;
}

.participant-item.selected {
  background: #eef2ff;
  border: 1px solid #667eea;
}

.participant-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.participant-name {
  font-weight: 600;
  color: #333;
}

.participant-status {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #10b981;
}

.participant-status svg {
  width: 12px;
  height: 12px;
}

.unread-badge {
  background: #ef4444;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 1rem;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.message-modal {
  background: white;
  border-radius: 0.5rem;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-size: 1.25rem;
  color: #333;
}

.close-button {
  padding: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  transition: color 0.3s ease;
}

.close-button:hover {
  color: #333;
}

.close-button svg {
  width: 24px;
  height: 24px;
}

.modal-body {
  padding: 1.5rem;
}

.recipient {
  font-weight: 600;
  color: #333;
  margin-bottom: 1rem;
}

.message-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 0.375rem;
  resize: vertical;
  font-family: inherit;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.message-input:focus {
  outline: none;
  border-color: #667eea;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

.send-button {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.send-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #5a67d8 0%, #68428e 100%);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.location-error {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #fee;
  color: #c53030;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.location-error svg {
  width: 20px;
  height: 20px;
}

@media (max-width: 768px) {
  .map-header {
    padding: 0.75rem 1rem;
  }

  .header-left h1 {
    font-size: 1rem;
  }

  .manager-controls,
  .participants-panel {
    position: fixed;
    bottom: 20px;
    top: auto;
  }

  .participants-panel {
    left: 20px;
    right: 20px;
    max-width: none;
    max-height: 200px;
  }
}
</style> 