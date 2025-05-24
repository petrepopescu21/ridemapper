<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useAuthStore } from '@/stores/auth'
import { useMessagesStore } from '@/stores/messages'
import { useGeolocation } from '@vueuse/core'

// Google Maps type declarations
declare global {
  interface Window {
    google: {
      maps: {
        Map: any
        DirectionsRenderer: any
        Polyline: any
        Marker: any
        LatLng: any
        LatLngBounds: any
        SymbolPath: any
        Animation: any
        MapMouseEvent: any
        Size: any
        Point: any
        event: any
        geometry: {
          encoding: {
            decodePath: (encodedPath: string) => any[]
          }
        }
      }
    }
  }
}

const router = useRouter()
const sessionStore = useSessionStore()
const authStore = useAuthStore()
const messagesStore = useMessagesStore()

// Map references
const mapContainer = ref<HTMLDivElement>()
const map = ref<any>()
const directionsRenderer = ref<any>()
const routePolyline = ref<any>()

// Markers
const participantMarkers = ref<Map<string, any>>(new Map())
const routeMarkers = ref<any[]>([])
const managerMarker = ref<any>()

// Location tracking
const { coords, error: geoError } = useGeolocation({ enableHighAccuracy: true })
const locationInterval = ref<number>()
const lastSentLocation = ref<{ lat: number; lng: number; timestamp: number } | null>(null)
const isStationary = ref(false)
const stationaryStartTime = ref<number>(0)

// UI state
const selectedParticipant = ref<string | null>(null)
const showMessageModal = ref(false)
const messageContent = ref('')
const showParticipantsPanel = ref(false)
const showMobileMenu = ref(false)
const waypoints = ref<any[]>([])
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

// Computed for visible participants based on role
const visibleParticipants = computed(() => {
  if (!sessionStore.currentSession) return []
  
  const allParticipants = Object.entries(sessionStore.currentSession.participants)
    .filter(([_, participant]) => participant.isOnline)
    .map(([id, participant]) => ({
      ...participant,
      id
    }))

  // Managers see all participants, participants only see managers
  if (sessionStore.isManager) {
    return allParticipants
  } else {
    return allParticipants.filter(participant => participant.isManager)
  }
})

// Initialize Google Maps
function initMap() {
  if (!mapContainer.value) return

  map.value = new window.google.maps.Map(mapContainer.value, {
    center: { lat: 40.7128, lng: -74.0060 }, // Default to New York (will be updated)
    zoom: 13,
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false,
  })

  // Wait for map to be ready, then center it
  window.google.maps.event.addListenerOnce(map.value, 'idle', () => {
    // Small delay to ensure map is fully loaded
    setTimeout(() => {
      centerMapBasedOnRole()
    }, 500)
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
      new window.google.maps.Marker({
        position: userLocation,
        map: map.value,
        title: sessionStore.isManager ? 'Your Location (Manager)' : 'Your Location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
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
          new window.google.maps.Marker({
            position: userLocation,
            map: map.value,
            title: sessionStore.isManager ? 'Your Location (Manager)' : 'Your Location',
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
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
        enableHighAccuracy: true, // Use high accuracy for better positioning
        timeout: 15000, // Increased timeout
        maximumAge: 60000 // Shorter cache for more current location
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
  if (sessionStore.currentSession?.route && sessionStore.currentSession.route.points.length > 0) {
    // Center to show the entire route
    const bounds = new window.google.maps.LatLngBounds()
    sessionStore.currentSession.route.points.forEach(point => {
      bounds.extend(new window.google.maps.LatLng(point.lat, point.lng))
    })
    
    map.value.fitBounds(bounds)
    
    // Ensure minimum zoom level
    const listener = window.google.maps.event.addListener(map.value, 'idle', () => {
      if (map.value!.getZoom()! > 16) {
        map.value!.setZoom(16)
      }
      window.google.maps.event.removeListener(listener)
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

    // Visibility rules: 
    // - Participants only see managers AND their own location
    // - Managers see everyone (participants and managers) including themselves
    if (!sessionStore.isManager && !participant.isManager && id !== sessionStore.currentParticipantId) {
      // Remove marker if current user is participant, this participant is not a manager, and it's not the current user
      const marker = participantMarkers.value.get(id)
      if (marker) {
        marker.setMap(null)
        participantMarkers.value.delete(id)
      }
      return
    }

    let marker = participantMarkers.value.get(id)
    const position = new window.google.maps.LatLng(participant.location.lat, participant.location.lng)

    // Check if location is stale (more than 2 minutes old for biking events)
    const now = Date.now()
    const lastUpdate = participant.location.timestamp || now
    const isStale = (now - lastUpdate) > 120000 // 2 minutes in milliseconds

    // Check if this is the current user's own location
    const isCurrentUser = id === sessionStore.currentParticipantId

    // Determine marker color, size, and icon
    let fillColor: string
    let scale: number
    let iconPath: any
    let iconUrl: string | undefined
    
    if (isStale) {
      fillColor = '#9e9e9e' // Grey for stale locations
    } else if (participant.isManager) {
      fillColor = '#f44336' // Red for managers
    } else {
      fillColor = '#10b981' // Green for participants
    }
    
    // Manager markers are larger, current user gets bike icon
    if (isCurrentUser) {
      // Use bike icon for current user
      scale = 0 // Not used for custom icon
      iconPath = undefined
      iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6" cy="18" r="3" stroke="${fillColor}" stroke-width="2" fill="white"/>
          <circle cx="18" cy="18" r="3" stroke="${fillColor}" stroke-width="2" fill="white"/>
          <path d="M12 5l-1 4h4l1-4" stroke="${fillColor}" stroke-width="2" fill="none"/>
          <path d="M6 18l6-6" stroke="${fillColor}" stroke-width="2"/>
          <path d="M12 12l6 6" stroke="${fillColor}" stroke-width="2"/>
          <circle cx="12" cy="8" r="1" fill="${fillColor}"/>
        </svg>
      `)}`
    } else {
      scale = participant.isManager ? 12 : 10
      iconPath = window.google.maps.SymbolPath.CIRCLE
      iconUrl = undefined
    }

    if (!marker) {
      // Create new marker
      const markerOptions: any = {
        position,
        map: map.value,
        title: participant.name
      }

      if (isCurrentUser && iconUrl) {
        // Use custom bike icon
        markerOptions.icon = {
          url: iconUrl,
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 16)
        }
      } else {
        // Use circle icon
        markerOptions.icon = {
          path: iconPath,
          scale: scale,
          fillColor: fillColor,
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 3
        }
      }

      marker = new window.google.maps.Marker(markerOptions)

      // Add click listener for messaging (manager only, not for own marker)
      if (sessionStore.isManager && !isCurrentUser) {
        marker.addListener('click', () => {
          selectedParticipant.value = id
          showMessageModal.value = true
        })
      }

      participantMarkers.value.set(id, marker)
    } else {
      // Update existing marker position and style
      marker.setPosition(position)
      
      if (isCurrentUser && iconUrl) {
        // Update custom bike icon
        marker.setIcon({
          url: iconUrl,
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 16)
        })
      } else {
        // Update circle icon
        marker.setIcon({
          path: iconPath,
          scale: scale,
          fillColor: fillColor,
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 3
        })
      }
    }

    // Add label with name only for managers (but not for current user to avoid clutter)
    if (participant.isManager && !isCurrentUser) {
      marker.setLabel({
        text: participant.name,
        color: '#333',
        fontSize: '12px',
        fontWeight: 'bold'
      })
    } else {
      // Remove label for participants and current user
      marker.setLabel(null)
    }
  })
}

// Send location update with smart filtering for biking events
function sendLocationUpdate() {
  if (!coords.value || 
      !sessionStore.currentParticipantId ||
      !isFinite(coords.value.latitude) || 
      !isFinite(coords.value.longitude) ||
      coords.value.latitude === 0 || 
      coords.value.longitude === 0) {
    return
  }

  const currentLocation = {
    lat: coords.value.latitude,
    lng: coords.value.longitude,
    timestamp: Date.now()
  }

  // If this is the first location update, always send it
  if (!lastSentLocation.value) {
    sessionStore.updateParticipantLocation(currentLocation.lat, currentLocation.lng)
    lastSentLocation.value = currentLocation
    isStationary.value = false
    return
  }

  // Calculate distance from last sent location using Haversine formula
  const distance = calculateDistance(
    lastSentLocation.value.lat,
    lastSentLocation.value.lng,
    currentLocation.lat,
    currentLocation.lng
  )

  const timeSinceLastUpdate = currentLocation.timestamp - lastSentLocation.value.timestamp

  // Determine if we should send update based on biking context
  let shouldSendUpdate = false

  // Force update every 30 seconds regardless (for safety)
  if (timeSinceLastUpdate > 30000) {
    shouldSendUpdate = true
  }
  // Send if moved more than 5 meters (good for biking at 17km/h)
  else if (distance > 5) {
    shouldSendUpdate = true
    isStationary.value = false
    stationaryStartTime.value = 0
  }
  // Send if stationary for more than 2 minutes (safety check)
  else if (distance < 2) {
    if (!isStationary.value) {
      isStationary.value = true
      stationaryStartTime.value = currentLocation.timestamp
    } else if (currentLocation.timestamp - stationaryStartTime.value > 120000) { // 2 minutes
      shouldSendUpdate = true
    }
  }

  if (shouldSendUpdate) {
    sessionStore.updateParticipantLocation(currentLocation.lat, currentLocation.lng)
    lastSentLocation.value = currentLocation
  }
}

// Calculate distance between two points in meters using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Send message to participant
function sendMessage() {
  if (!selectedParticipant.value || !messageContent.value.trim()) return

  messagesStore.sendMessage('manager', selectedParticipant.value, messageContent.value.trim())
  messageContent.value = ''
  showMessageModal.value = false
}

// Navigate back to dashboard or leave session
function leaveSession() {
  if (sessionStore.isManager) {
    // Navigate to manager dashboard without ending session
    router.push('/manager-dashboard')
  } else {
    // Participants leave the session
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=geometry&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => resolve(true)
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
}

// Call the new Routes API
async function callRoutesAPI(waypoints: any[]) {
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
    intermediates: intermediates.map((point: any) => ({
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
  console.log('displayRoute() called')
  console.log('Map value:', !!map.value)
  console.log('Session route:', sessionStore.currentSession?.route)
  console.log('Route points length:', sessionStore.currentSession?.route?.points.length)
  
  if (!map.value || !sessionStore.currentSession?.route?.points.length) {
    console.log('Exiting displayRoute - missing map or route data')
    return
  }

  console.log('Proceeding with route display...')
  
  // Clear existing route
  if (directionsRenderer.value) {
    directionsRenderer.value.setMap(null)
  }
  if (routePolyline.value) {
    routePolyline.value.setMap(null)
  }
  // Clear existing markers
  routeMarkers.value.forEach((marker: any) => marker.setMap(null))
  routeMarkers.value = []

  // Try to use Routes API first, fallback to simple polyline
  const waypoints = sessionStore.currentSession.route.points.map(wp => 
    new window.google.maps.LatLng(wp.lat, wp.lng)
  )
  
  console.log('Waypoints created:', waypoints.length)

  callRoutesAPI(waypoints)
    .then(data => {
      console.log('Routes API success:', !!data.routes?.length)
      if (data.routes && data.routes.length > 0) {
        // Success with Routes API - decode the polyline
        const route = data.routes[0]
        const encodedPolyline = route.polyline.encodedPolyline
        
        // Decode the polyline using Google Maps utility
        const decodedPath = window.google.maps.geometry.encoding.decodePath(encodedPolyline)
        
        // Create polyline from decoded path
        routePolyline.value = new window.google.maps.Polyline({
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
function addWaypointMarkers(waypoints: any[]) {
  waypoints.forEach((waypoint: any, index: number) => {
    if (!map.value) return
    
    const marker = new window.google.maps.Marker({
      position: waypoint,
      map: map.value,
      title: `Waypoint ${index + 1}`,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
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
  if (!map.value || !sessionStore.currentSession?.route?.points.length) return

  const path = sessionStore.currentSession.route.points.map(wp => 
    new window.google.maps.LatLng(wp.lat, wp.lng)
  )

  routePolyline.value = new window.google.maps.Polyline({
    path: path,
    geodesic: true,
    strokeColor: '#667eea',
    strokeOpacity: 0.8,
    strokeWeight: 4
  })

  routePolyline.value.setMap(map.value || null)

  // Add markers for waypoints
  sessionStore.currentSession.route.points.forEach((waypoint: any, index: number) => {
    if (!map.value || !sessionStore.currentSession?.route) return
    
    const marker = new window.google.maps.Marker({
      position: { lat: waypoint.lat, lng: waypoint.lng },
      map: map.value,
      title: `Waypoint ${index + 1}`,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: index === 0 ? '#4CAF50' : 
                   index === sessionStore.currentSession.route.points.length - 1 ? '#F44336' : '#667eea',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      }
    })
    routeMarkers.value.push(marker)
  })
}

// Lifecycle
onMounted(async () => {
  try {
    await loadGoogleMapsScript()
    initMap()

    // Display existing route if available (for both managers and participants)
    if (sessionStore.currentSession?.route?.points.length) {
      setTimeout(() => {
        displayRoute()
      }, 1000) // Give time for map to initialize
    }

    // Start adaptive location updates optimized for biking
    locationInterval.value = window.setInterval(() => {
      sendLocationUpdate()
      updateParticipantMarkers()
    }, 3000) // Check every 3 seconds (optimized for 17km/h biking speed)

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
  if (!sessionStore.isManager && newRoute && newRoute.points.length > 0) {
    // Participant: display the updated route and center to it
    setTimeout(() => {
      displayRoute()
      centerToRouteOrManagerLocation()
    }, 1000) // Give time for route to be rendered
  }
}, { deep: true })

// Watch for session availability (display route when session loads)
watch(() => sessionStore.currentSession, (newSession) => {
  if (newSession && newSession.route && newSession.route.points.length > 0 && map.value) {
    console.log('Session loaded with existing route, displaying it')
    console.log('Route data:', newSession.route)
    setTimeout(() => {
      displayRoute()
      if (!sessionStore.isManager) {
        centerToRouteOrManagerLocation()
      }
    }, 500)
  }
}, { immediate: true })
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
        <!-- Desktop: Session Info and Navigation Button -->
        <div class="d-none d-md-flex align-center">
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

          <!-- Navigation/Leave Button -->
          <v-btn
            @click="leaveSession"
            :color="sessionStore.isManager ? 'info' : 'error'"
            variant="outlined"
            :prepend-icon="sessionStore.isManager ? 'mdi-view-dashboard' : 'mdi-exit-to-app'"
            size="small"
            class="text-none"
          >
            {{ sessionStore.isManager ? 'Dashboard' : 'Leave' }}
          </v-btn>
        </div>

        <!-- Mobile: Hamburger Menu -->
        <v-btn
          @click="showMobileMenu = !showMobileMenu"
          icon="mdi-menu"
          variant="text"
          color="white"
          class="d-md-none"
        />
      </template>
    </v-app-bar>

    <!-- Mobile Menu Drawer -->
    <v-navigation-drawer
      v-model="showMobileMenu"
      location="right"
      temporary
      width="280"
      class="d-md-none"
    >
      <v-list density="compact">
        <v-list-subheader>Session Info</v-list-subheader>
        
        <v-list-item>
          <v-list-item-title>
            <v-chip size="small" color="primary" variant="tonal" class="mr-2">
              PIN: {{ sessionPin }}
            </v-chip>
          </v-list-item-title>
        </v-list-item>

        <v-list-item v-if="!sessionStore.isManager">
          <v-list-item-title>
            <v-chip size="small" color="success" variant="tonal">
              {{ participantName }}
            </v-chip>
          </v-list-item-title>
        </v-list-item>

        <v-divider class="my-2" />

        <v-list-subheader>Navigation</v-list-subheader>

        <v-list-item
          @click="leaveSession"
          :prepend-icon="sessionStore.isManager ? 'mdi-view-dashboard' : 'mdi-exit-to-app'"
          :title="sessionStore.isManager ? 'Dashboard' : 'Leave Session'"
          :base-color="sessionStore.isManager ? 'info' : 'error'"
        />
      </v-list>
    </v-navigation-drawer>

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
              v-if="!sessionStore.isManager && sessionStore.currentSession?.route?.points.length"
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
        />
      </div>

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
            Participants ({{ visibleParticipants.length }})
          </v-card-title>
          
          <v-card-text>
            <v-list>
              <v-list-item
                v-for="participant in visibleParticipants"
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