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
const directionsRenderer = ref<google.maps.DirectionsRenderer>()
const routePolyline = ref<google.maps.Polyline>()

// Markers
const participantMarkers = ref<Map<string, google.maps.Marker>>(new Map())
const routeMarkers = ref<google.maps.Marker[]>([])
const managerMarker = ref<google.maps.Marker>()

// Location tracking
const { coords, error: geoError } = useGeolocation({ enableHighAccuracy: true })
const locationInterval = ref<number>()

// UI state
const selectedParticipant = ref<string | null>(null)
const showMessageModal = ref(false)
const messageContent = ref('')
const showRoutePanel = ref(false)
const showParticipantsPanel = ref(false)
const waypoints = ref<google.maps.LatLng[]>([])
const locationError = ref<string | null>(null)
const isLocationLoading = ref(false)

// Session info display
const sessionPin = computed(() => sessionStore.currentSession?.pin || '')
const participantName = computed(() => {
  if (!sessionStore.currentParticipantId || !sessionStore.currentSession) return ''
  const participant = sessionStore.currentSession.participants[sessionStore.currentParticipantId]
  return participant?.name || ''
})

// Computed for geolocation error display
const showLocationError = computed({
  get: () => !!geoError.value || !!locationError.value,
  set: (value: boolean) => {
    if (!value) {
      locationError.value = null
      // We can't actually clear the error from useGeolocation, but we can hide the snackbar
      // The error will be reset when location is successfully obtained
    }
  }
})

const locationErrorMessage = computed(() => {
  if (locationError.value) return locationError.value
  if (geoError.value) return 'Location access denied. Please enable location services.'
  return ''
})

// Initialize Google Maps
function initMap() {
  if (!mapContainer.value) return

  map.value = new google.maps.Map(mapContainer.value, {
    center: { lat: 40.7128, lng: -74.0060 }, // Default to New York (will be updated)
    zoom: 13,
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false,
  })

  // Add click listener for route creation
  if (sessionStore.isManager) {
    map.value.addListener('click', handleMapClick)
  }

  // Wait for map to be ready, then center it
  google.maps.event.addListenerOnce(map.value, 'idle', () => {
    centerMapBasedOnRole()
  })
}

// Center map based on whether user is manager or participant
function centerMapBasedOnRole() {
  console.log('Centering map for role:', sessionStore.isManager ? 'Manager' : 'Participant')
  if (sessionStore.isManager) {
    // Manager: Center to their current location
    centerToUserLocation()
  } else {
    // Participant: Center to route or manager location
    centerToRouteOrManagerLocation()
  }
}

// Center map to current user's location
function centerToUserLocation() {
  console.log('Attempting to center to user location...')
  isLocationLoading.value = true
  locationError.value = null
  
  // First try to use the existing coords from useGeolocation hook
  if (coords.value && 
      coords.value.latitude && 
      coords.value.longitude &&
      isFinite(coords.value.latitude) && 
      isFinite(coords.value.longitude) &&
      coords.value.latitude !== 0 && 
      coords.value.longitude !== 0) {
    console.log('Using existing coordinates:', coords.value.latitude, coords.value.longitude)
    const userLocation = {
      lat: coords.value.latitude,
      lng: coords.value.longitude
    }
    
    if (map.value) {
      map.value.setCenter(userLocation)
      map.value.setZoom(15)
      console.log('Map centered successfully to user location')
      
      // Add a marker for the user's location
      new google.maps.Marker({
        position: userLocation,
        map: map.value,
        title: sessionStore.isManager ? 'Your Location (Manager)' : 'Your Location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: sessionStore.isManager ? '#667eea' : '#10b981',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 3
        }
      })
    }
    isLocationLoading.value = false
    return
  }

  console.log('No valid coordinates available, requesting fresh location...')
  // Fallback to fresh geolocation request if coords not available yet
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Fresh location obtained:', position.coords.latitude, position.coords.longitude)
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        
        if (map.value) {
          map.value.setCenter(userLocation)
          map.value.setZoom(15)
          console.log('Map centered successfully to fresh location')
          
          // Add a marker for the user's location
          new google.maps.Marker({
            position: userLocation,
            map: map.value,
            title: sessionStore.isManager ? 'Your Location (Manager)' : 'Your Location',
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: sessionStore.isManager ? '#667eea' : '#10b981',
              fillOpacity: 1,
              strokeColor: 'white',
              strokeWeight: 3
            }
          })
        }
        isLocationLoading.value = false
        locationError.value = null
      },
      (error) => {
        console.error('Geolocation error:', error.message)
        isLocationLoading.value = false
        
        // Provide specific error messages based on error code
        switch (error.code) {
          case error.PERMISSION_DENIED:
            locationError.value = 'Location access denied. Please enable location in your browser settings and refresh the page.'
            break
          case error.POSITION_UNAVAILABLE:
            locationError.value = 'Location information unavailable. Please check your GPS/network connection.'
            break
          case error.TIMEOUT:
            locationError.value = 'Location request timed out. Click retry or enable location services.'
            break
          default:
            locationError.value = 'Unable to get your location. Please try again or enable location services.'
            break
        }
        
        // For managers, this is more critical
        if (sessionStore.isManager) {
          console.log('Manager location centering failed - using default location')
        }
        // Fall back to default location or route centering
        if (!sessionStore.isManager) {
          centerToRouteOrManagerLocation()
        }
      },
      {
        enableHighAccuracy: false, // Try less accurate but faster positioning first
        timeout: 15000, // Increased timeout
        maximumAge: 300000 // 5 minutes cache
      }
    )
  } else {
    console.error('Geolocation not supported by browser')
    isLocationLoading.value = false
    locationError.value = 'Geolocation not supported by your browser.'
  }
}

// Center map to show route or manager location for participants
function centerToRouteOrManagerLocation() {
  if (!map.value) return

  // Check if there's an existing route
  if (sessionStore.currentSession?.route && sessionStore.currentSession.route.length > 0) {
    // Center to show the entire route
    const bounds = new google.maps.LatLngBounds()
    sessionStore.currentSession.route.forEach(point => {
      bounds.extend(new google.maps.LatLng(point.lat, point.lng))
    })
    
    map.value.fitBounds(bounds)
    
    // Ensure minimum zoom level
    const listener = google.maps.event.addListener(map.value, 'idle', () => {
      if (map.value!.getZoom()! > 16) {
        map.value!.setZoom(16)
      }
      google.maps.event.removeListener(listener)
    })
  } else {
    // Check if manager has a location
    const managerParticipant = Object.values(sessionStore.currentSession?.participants || {})
      .find(p => p.name.includes('Manager') || p.id === sessionStore.currentSession?.managerId)
    
    if (managerParticipant?.location) {
      const managerLocation = {
        lat: managerParticipant.location.lat,
        lng: managerParticipant.location.lng
      }
      map.value.setCenter(managerLocation)
      map.value.setZoom(14)
    } else {
      // Fall back to user's own location
      centerToUserLocation()
    }
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

// Update route display and center map for participants
function updateRoute() {
  if (routeMarkers.value.length < 2) {
    // Clear any existing route display
    if (directionsRenderer.value) {
      directionsRenderer.value.setMap(null)
    }
    if (routePolyline.value) {
      routePolyline.value.setMap(null)
    }
    return
  }

  // Convert markers to LatLng for Routes API
  const waypoints = routeMarkers.value.map(marker => marker.getPosition()!).filter(pos => pos !== null)

  callRoutesAPI(waypoints)
    .then(data => {
      if (data.routes && data.routes.length > 0) {
        // Success with Routes API - decode the polyline
        const route = data.routes[0]
        const encodedPolyline = route.polyline.encodedPolyline
        
        // Decode the polyline using Google Maps utility
        const decodedPath = google.maps.geometry.encoding.decodePath(encodedPolyline)
        
        // Clear existing polyline
        if (routePolyline.value) {
          routePolyline.value.setMap(null)
        }
        
        // Create new polyline from decoded path
        routePolyline.value = new google.maps.Polyline({
          path: decodedPath,
          geodesic: true,
          strokeColor: '#667eea',
          strokeOpacity: 0.8,
          strokeWeight: 4
        })

        routePolyline.value.setMap(map.value || null)
        
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

        // If this is a participant and route was just created/updated, center to route
        if (!sessionStore.isManager) {
          setTimeout(() => {
            centerToRouteOrManagerLocation()
          }, 500) // Small delay to ensure route is rendered
        }
        
        console.log('Route updated using Routes API')
      } else {
        throw new Error('No routes returned from Routes API')
      }
    })
    .catch(error => {
      console.warn('Routes API failed in updateRoute, using fallback:', error)
      // Fallback - save the waypoints as a simple route
      const routePoints = routeMarkers.value.map((marker, index) => {
        const pos = marker.getPosition()!
        return {
          lat: pos.lat(),
          lng: pos.lng(),
          type: index === 0 ? 'start' : index === routeMarkers.value.length - 1 ? 'end' : 'waypoint'
        } as const
      })
      sessionStore.updateRoute(routePoints)
      
      // Display simple polyline fallback
      const path = waypoints
      if (routePolyline.value) {
        routePolyline.value.setMap(null)
      }
      
      routePolyline.value = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#667eea',
        strokeOpacity: 0.8,
        strokeWeight: 4
      })

      routePolyline.value.setMap(map.value || null)
    })
}

// Clear route
function clearRoute() {
  routeMarkers.value.forEach(marker => marker.setMap(null))
  routeMarkers.value = []
  
  // Clear directions renderer
  if (directionsRenderer.value) {
    directionsRenderer.value.setMap(null)
  }
  
  // Clear fallback polyline
  if (routePolyline.value) {
    routePolyline.value.setMap(null)
    routePolyline.value = undefined
  }
  
  sessionStore.updateRoute([])
}

// Update participant locations on map
function updateParticipantMarkers() {
  if (!map.value || !sessionStore.currentSession) return

  Object.entries(sessionStore.currentSession.participants).forEach(([id, participant]) => {
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
  if (coords.value && 
      sessionStore.currentParticipantId &&
      isFinite(coords.value.latitude) && 
      isFinite(coords.value.longitude) &&
      coords.value.latitude !== 0 && 
      coords.value.longitude !== 0) {
    sessionStore.updateParticipantLocation(
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
    // Remove directions library since we'll use Routes API directly
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=geometry&v=weekly`
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

    // For participants: display existing route if available
    if (!sessionStore.isManager && sessionStore.currentSession?.route?.length) {
      setTimeout(() => {
        displayRoute()
      }, 1000) // Give time for map to initialize
    }

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

// Watch for initial location availability (for manager centering)
watch(coords, (newCoords) => {
  if (newCoords && 
      newCoords.latitude && 
      newCoords.longitude &&
      isFinite(newCoords.latitude) && 
      isFinite(newCoords.longitude) &&
      newCoords.latitude !== 0 && 
      newCoords.longitude !== 0 &&
      sessionStore.isManager && 
      map.value) {
    // Check if map is still at default location (hasn't been centered yet)
    const currentCenter = map.value.getCenter()
    if (currentCenter && 
        Math.abs(currentCenter.lat() - 40.7128) < 0.1 && 
        Math.abs(currentCenter.lng() - (-74.0060)) < 0.1) {
      // Still at default location, center to user location
      console.log('Auto-centering map as valid coordinates became available')
      centerToUserLocation()
    }
  }
}, { immediate: true })

// Watch for route changes (for participants to auto-center when manager updates route)
watch(() => sessionStore.currentSession?.route, (newRoute) => {
  if (!sessionStore.isManager && newRoute && newRoute.length > 0) {
    // Participant: display the updated route and center to it
    setTimeout(() => {
      displayRoute()
      centerToRouteOrManagerLocation()
    }, 1000) // Give time for route to be rendered
  }
}, { deep: true })

// Watch for session availability (for participants to display route when session loads)
watch(() => sessionStore.currentSession, (newSession) => {
  if (!sessionStore.isManager && newSession && newSession.route && newSession.route.length > 0 && map.value) {
    console.log('Session loaded with existing route, displaying it')
    setTimeout(() => {
      displayRoute()
      centerToRouteOrManagerLocation()
    }, 500)
  }
}, { immediate: true })

// Call the new Routes API
async function callRoutesAPI(waypoints: google.maps.LatLng[]) {
  const origin = waypoints[0]
  const destination = waypoints[waypoints.length - 1]
  const intermediates = waypoints.slice(1, -1)

  const requestBody = {
    origin: {
      location: {
        latLng: {
          latitude: origin.lat(),
          longitude: origin.lng()
        }
      }
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.lat(),
          longitude: destination.lng()
        }
      }
    },
    intermediates: intermediates.map(point => ({
      location: {
        latLng: {
          latitude: point.lat(),
          longitude: point.lng()
        }
      }
    })),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    routeModifiers: {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false
    },
    languageCode: 'en-US',
    units: 'IMPERIAL'
  }

  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`Routes API failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Routes API error:', error)
    throw error
  }
}

// Display route on map using Routes API
function displayRoute() {
  if (!map.value || !sessionStore.currentSession?.route?.length) return

  // Clear existing route
  if (directionsRenderer.value) {
    directionsRenderer.value.setMap(null)
  }
  if (routePolyline.value) {
    routePolyline.value.setMap(null)
  }
  // Clear existing markers
  routeMarkers.value.forEach(marker => marker.setMap(null))
  routeMarkers.value = []

  // Try to use Routes API first, fallback to simple polyline
  const waypoints = sessionStore.currentSession.route.map(wp => 
    new google.maps.LatLng(wp.lat, wp.lng)
  )

  callRoutesAPI(waypoints)
    .then(data => {
      if (data.routes && data.routes.length > 0) {
        // Success with Routes API - decode the polyline
        const route = data.routes[0]
        const encodedPolyline = route.polyline.encodedPolyline
        
        // Decode the polyline using Google Maps utility
        const decodedPath = google.maps.geometry.encoding.decodePath(encodedPolyline)
        
        // Create polyline from decoded path
        routePolyline.value = new google.maps.Polyline({
          path: decodedPath,
          geodesic: true,
          strokeColor: '#667eea',
          strokeOpacity: 0.8,
          strokeWeight: 4
        })

        routePolyline.value.setMap(map.value || null)

        // Add waypoint markers
        addWaypointMarkers(waypoints)
        
        console.log('Route displayed using Routes API')
      } else {
        throw new Error('No routes returned from Routes API')
      }
    })
    .catch(error => {
      // Fallback: Draw simple polyline connecting waypoints
      console.warn('Routes API failed, using fallback polyline:', error)
      displayFallbackRoute()
    })
}

// Add markers for waypoints
function addWaypointMarkers(waypoints: google.maps.LatLng[]) {
  waypoints.forEach((waypoint, index) => {
    if (!map.value) return
    
    const marker = new google.maps.Marker({
      position: waypoint,
      map: map.value,
      title: `Waypoint ${index + 1}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: index === 0 ? '#4CAF50' : 
                   index === waypoints.length - 1 ? '#F44336' : '#667eea',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      }
    })
    routeMarkers.value.push(marker)
  })
}

// Fallback route display without Routes API
function displayFallbackRoute() {
  if (!map.value || !sessionStore.currentSession?.route?.length) return

  const path = sessionStore.currentSession.route.map(wp => 
    new google.maps.LatLng(wp.lat, wp.lng)
  )

  routePolyline.value = new google.maps.Polyline({
    path: path,
    geodesic: true,
    strokeColor: '#667eea',
    strokeOpacity: 0.8,
    strokeWeight: 4
  })

  routePolyline.value.setMap(map.value || null)

  // Add markers for waypoints
  sessionStore.currentSession.route.forEach((waypoint, index) => {
    if (!map.value || !sessionStore.currentSession) return
    
    const marker = new google.maps.Marker({
      position: { lat: waypoint.lat, lng: waypoint.lng },
      map: map.value,
      title: `Waypoint ${index + 1}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: index === 0 ? '#4CAF50' : 
                   index === sessionStore.currentSession.route.length - 1 ? '#F44336' : '#667eea',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      }
    })
    routeMarkers.value.push(marker)
  })
}
</script>

<template>
  <v-app>
    <!-- App Bar -->
    <v-app-bar color="primary" density="compact" elevation="4">
      <template #prepend>
        <v-icon>mdi-map</v-icon>
      </template>
      
      <v-app-bar-title class="text-body-1">
        {{ sessionStore.isManager ? 'Route Manager' : 'Participant' }} View
      </v-app-bar-title>

      <template #append>
        <!-- Session Info -->
        <div class="d-flex align-center mr-4">
          <v-chip size="small" color="white" variant="outlined" class="mr-2">
            PIN: {{ sessionPin }}
          </v-chip>
          <v-chip 
            v-if="!sessionStore.isManager" 
            size="small" 
            color="white" 
            variant="outlined"
          >
            {{ participantName }}
          </v-chip>
        </div>

        <!-- Leave Button -->
        <v-btn
          @click="leaveSession"
          color="error"
          variant="outlined"
          prepend-icon="mdi-exit-to-app"
          size="small"
          class="text-none"
        >
          {{ sessionStore.isManager ? 'End Session' : 'Leave' }}
        </v-btn>
      </template>
    </v-app-bar>

    <!-- Main Content -->
    <v-main class="fill-height">
      <!-- Map Container -->
      <div ref="mapContainer" class="map-container"></div>

      <!-- Floating Action Buttons for Mobile -->
      <div class="floating-controls">
        <!-- Center to My Location FAB (Manager Only) -->
        <v-tooltip location="left">
          <template #activator="{ props }">
            <v-btn
              v-if="sessionStore.isManager"
              @click="centerToUserLocation"
              color="success"
              :icon="isLocationLoading ? 'mdi-loading' : 'mdi-crosshairs-gps'"
              size="large"
              elevation="4"
              class="mb-2"
              :class="{ 'rotating': isLocationLoading }"
              :disabled="isLocationLoading"
              v-bind="props"
            />
          </template>
          <span>{{ isLocationLoading ? 'Getting Location...' : 'Center to My Location' }}</span>
        </v-tooltip>

        <!-- Re-center to Route FAB (Participants Only) -->
        <v-tooltip location="left">
          <template #activator="{ props }">
            <v-btn
              v-if="!sessionStore.isManager && sessionStore.currentSession?.route?.length"
              @click="centerToRouteOrManagerLocation"
              color="info"
              icon="mdi-crosshairs-gps"
              size="large"
              elevation="4"
              class="mb-2"
              v-bind="props"
            />
          </template>
          <span>Center to Route</span>
        </v-tooltip>

        <!-- Participants FAB -->
        <v-btn
          @click="showParticipantsPanel = !showParticipantsPanel"
          color="primary"
          icon="mdi-account-group"
          size="large"
          elevation="4"
          class="mb-2"
        />

        <!-- Route Tools FAB (Manager Only) -->
        <v-btn
          v-if="sessionStore.isManager"
          @click="showRoutePanel = !showRoutePanel"
          color="secondary"
          icon="mdi-routes"
          size="large"
          elevation="4"
        />
      </div>

      <!-- Route Panel -->
      <v-navigation-drawer
        v-if="sessionStore.isManager"
        v-model="showRoutePanel"
        location="left"
        temporary
        width="320"
      >
        <v-card flat>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-routes</v-icon>
            Route Management
          </v-card-title>
          
          <v-card-text>
            <v-alert type="info" density="compact" class="mb-4">
              Click on the map to add waypoints. Right-click markers to remove them.
            </v-alert>

            <v-btn
              @click="clearRoute"
              color="error"
              variant="outlined"
              prepend-icon="mdi-delete"
              block
              class="text-none mb-4"
            >
              Clear Route
            </v-btn>

            <v-card v-if="routeMarkers.length > 0" variant="tonal">
              <v-card-title class="text-subtitle-1">Route Points</v-card-title>
              <v-card-text>
                <v-chip
                  v-for="(marker, index) in routeMarkers"
                  :key="index"
                  size="small"
                  class="ma-1"
                  :color="index === 0 ? 'success' : index === routeMarkers.length - 1 ? 'error' : 'warning'"
                >
                  {{ index === 0 ? 'Start' : index === routeMarkers.length - 1 ? 'End' : `Point ${index}` }}
                </v-chip>
              </v-card-text>
            </v-card>
          </v-card-text>
        </v-card>
      </v-navigation-drawer>

      <!-- Participants Panel -->
      <v-navigation-drawer
        v-model="showParticipantsPanel"
        location="right"
        temporary
        width="320"
      >
        <v-card flat>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-account-group</v-icon>
            Participants ({{ sessionStore.activeParticipants.length }})
          </v-card-title>
          
          <v-card-text>
            <v-list>
              <v-list-item
                v-for="participant in sessionStore.activeParticipants"
                :key="participant.id"
                :prepend-avatar="`https://ui-avatars.com/api/?name=${participant.name}&background=667eea&color=fff`"
                @click="sessionStore.isManager && (selectedParticipant = participant.id, showMessageModal = true)"
                :class="{ 'cursor-pointer': sessionStore.isManager }"
              >
                <v-list-item-title>{{ participant.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip
                    v-if="participant.location"
                    size="small"
                    color="success"
                    variant="text"
                    prepend-icon="mdi-map-marker"
                  >
                    Live Location
                  </v-chip>
                  <v-chip
                    v-else
                    size="small"
                    color="warning"
                    variant="text"
                    prepend-icon="mdi-map-marker-off"
                  >
                    No Location
                  </v-chip>
                </v-list-item-subtitle>

                <!-- Unread Messages Badge -->
                <template #append>
                  <v-badge
                    v-if="sessionStore.isManager && messagesStore.unreadCount.get(participant.id)"
                    :content="messagesStore.unreadCount.get(participant.id)"
                    color="error"
                  >
                    <v-icon>mdi-message</v-icon>
                  </v-badge>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-navigation-drawer>
    </v-main>

    <!-- Message Modal -->
    <v-dialog v-model="showMessageModal" max-width="500">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <span>Send Message</span>
          <v-btn
            @click="showMessageModal = false"
            variant="text"
            icon="mdi-close"
            size="small"
          />
        </v-card-title>

        <v-card-text>
          <v-alert
            v-if="selectedParticipant"
            type="info"
            density="compact"
            class="mb-4"
          >
            To: {{ sessionStore.currentSession?.participants[selectedParticipant]?.name }}
          </v-alert>

          <v-textarea
            v-model="messageContent"
            label="Message"
            placeholder="Type your message..."
            rows="4"
            variant="outlined"
            counter
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            @click="showMessageModal = false"
            variant="text"
            class="text-none"
          >
            Cancel
          </v-btn>
          <v-btn
            @click="sendMessage"
            color="primary"
            :disabled="!messageContent.trim()"
            class="text-none"
          >
            Send Message
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Location Error Snackbar -->
    <v-snackbar
      v-model="showLocationError"
      color="error"
      timeout="-1"
      location="bottom"
      multi-line
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-map-marker-off</v-icon>
        <div>
          <div class="font-weight-medium">{{ locationErrorMessage }}</div>
          <div v-if="locationError && locationError.includes('denied')" class="text-caption mt-1">
            Click the location icon in your browser's address bar to enable location access.
          </div>
        </div>
      </div>
      
      <template #actions>
        <v-btn
          v-if="locationError && (locationError.includes('timed out') || locationError.includes('unavailable'))"
          variant="text"
          color="white"
          size="small"
          @click="centerToUserLocation"
          :disabled="isLocationLoading"
        >
          Retry
        </v-btn>
        <v-btn 
          variant="text" 
          color="white"
          size="small"
          @click="showLocationError = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<style scoped>
.map-container {
  height: 100%;
  width: 100%;
}

.floating-controls {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  z-index: 6;
}

.cursor-pointer {
  cursor: pointer;
}

/* Loading animation */
.rotating {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Mobile responsive adjustments */
@media (max-width: 960px) {
  .floating-controls {
    bottom: 16px;
    right: 16px;
  }
}

@media (max-width: 600px) {
  .v-app-bar-title {
    font-size: 0.875rem !important;
  }
  
  .floating-controls {
    bottom: 80px;
    right: 16px;
  }
}
</style> 