<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { routeService, type Route, type RoutePoint } from '@/services/routeService'

// Google Maps type declarations
declare global {
  interface Window {
    google: any
  }
}

const router = useRouter()
const authStore = useAuthStore()

// Map references
const mapContainer = ref<HTMLDivElement>()
const map = ref<any>()

// UI state
const maps = ref<Route[]>([])
const selectedMap = ref<Route | null>(null)
const isCreatingNew = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const showSaveDialog = ref(false)
const showDeleteDialog = ref(false)
const isLoading = ref(false)
const connectionError = ref<string | null>(null)

// Map editing state
const waypoints = ref<any[]>([])
const routeMarkers = ref<any[]>([])
const routePolyline = ref<any>()
const isDragging = ref(false)
const clickTimeout = ref<any>(null)
const totalDistance = ref<number>(0) // Distance in meters from Routes API

// Pins management state
const showPinsPanel = ref(false)
const pinAddresses = ref<Map<number, string>>(new Map())
const isLoadingAddresses = ref(false)

// Form data
const mapForm = ref({
  name: '',
  description: '',
  points: [] as RoutePoint[]
})

// Location tracking for centering
const isLocationLoading = ref(false)
const locationError = ref<string | null>(null)

const hasUnsavedChanges = computed(() => {
  return isEditing.value && waypoints.value.length > 0
})

const showLocationError = computed({
  get: () => !!locationError.value,
  set: (value: boolean) => {
    if (!value) {
      locationError.value = null
    }
  }
})

// Computed list of pins with addresses for the pins panel
const pinsWithAddresses = computed(() => {
  return waypoints.value.map((point: any, index: number) => ({
    index,
    lat: point.lat(),
    lng: point.lng(),
    type: index === 0 ? 'start' : index === waypoints.value.length - 1 ? 'end' : 'waypoint',
    address: pinAddresses.value.get(index) || 'Loading address...'
  }))
})

// Check if current manager owns the selected map
const isOwnMap = computed(() => {
  return !selectedMap.value || selectedMap.value.createdBy === authStore.managerId
})

// Format distance for display
const formattedDistance = computed(() => {
  if (totalDistance.value === 0) return null
  
  const meters = totalDistance.value
  const kilometers = (meters / 1000).toFixed(2)
  
  return `${kilometers} km`
})

// Initialize Google Maps
function initMap() {
  if (!mapContainer.value || !window.google) return

  map.value = new window.google.maps.Map(mapContainer.value, {
    center: { lat: 40.7128, lng: -74.0060 },
    zoom: 13,
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false,
  })

  // Add click listener for adding waypoints when editing
  map.value.addListener('click', handleMapClick)
  
  // Add mouseup listener to reset dragging state
  map.value.addListener('mouseup', () => {
    // Small delay to ensure dragend fires first if it's a drag
    setTimeout(() => {
      isDragging.value = false
    }, 50)
  })
  
  // Center map to manager's location after initialization
  setTimeout(() => {
    centerToManagerLocation()
  }, 1000)
}

// Center map to manager's current location
function centerToManagerLocation() {
  if (!map.value) return
  
  isLocationLoading.value = true
  locationError.value = null
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const managerLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        
        map.value.setCenter(managerLocation)
        map.value.setZoom(15)
        
        // Add a marker for the manager's location
        new window.google.maps.Marker({
          position: managerLocation,
          map: map.value,
          title: 'Your Location',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#667eea',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 3
          }
        })
        
        isLocationLoading.value = false
        console.log('Map centered to manager location')
      },
      (error) => {
        console.error('Geolocation error:', error.message)
        isLocationLoading.value = false
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            locationError.value = 'Location access denied. Using default location.'
            break
          case error.POSITION_UNAVAILABLE:
            locationError.value = 'Location unavailable. Using default location.'
            break
          case error.TIMEOUT:
            locationError.value = 'Location request timed out. Using default location.'
            break
          default:
            locationError.value = 'Could not get location. Using default location.'
            break
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    )
  } else {
    isLocationLoading.value = false
    locationError.value = 'Geolocation not supported.'
  }
}

function handleMapClick(event: any) {
  // Only allow interactions when editing
  if (!isEditing.value || !event.latLng) return

  // Clear any existing click timeout
  if (clickTimeout.value) {
    clearTimeout(clickTimeout.value)
  }

  // Delay the click processing to check if it's part of a drag
  clickTimeout.value = setTimeout(() => {
    // Only add waypoint if not dragging
    if (!isDragging.value) {
      waypoints.value.push(event.latLng)
      updateMapDisplay()
    }
    clickTimeout.value = null
  }, 200) // 200ms delay to differentiate click from drag start
}

function updateMapDisplay() {
  if (!map.value || !window.google) return

  // Clear existing markers and polyline
  routeMarkers.value.forEach((marker: any) => marker.setMap(null))
  routeMarkers.value = []
  if (routePolyline.value) {
    routePolyline.value.setMap(null)
  }

  // Add markers for waypoints
  waypoints.value.forEach((point: any, index: number) => {
    const marker = new window.google.maps.Marker({
      position: point,
      map: map.value,
      draggable: isEditing.value, // Only draggable when editing
      title: index === 0 ? 'Start' : index === waypoints.value.length - 1 ? 'End' : `Point ${index}`,
      icon: {
        url: index === 0 ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' : 
             index === waypoints.value.length - 1 ? 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' :
             'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
        scaledSize: new window.google.maps.Size(32, 32)
      }
    })

    // Only add interaction listeners when editing
    if (isEditing.value) {
      // Add click handler to prevent map clicks when clicking on marker
      marker.addListener('click', (e: any) => {
        // Stop the click from propagating to the map
        if (e && e.stop) {
          e.stop()
        }
      })
      
      // Add mousedown handler to immediately flag interaction
      marker.addListener('mousedown', () => {
        isDragging.value = true
      })
      
      // Add right-click to remove marker
      marker.addListener('rightclick', () => {
        removeWaypoint(index)
      })

      // Add drag start listener to set dragging state
      marker.addListener('dragstart', () => {
        isDragging.value = true
        
        // Cancel any pending click timeout
        if (clickTimeout.value) {
          clearTimeout(clickTimeout.value)
          clickTimeout.value = null
        }
      })

      // Add drag end listener to update route and get new address
      marker.addListener('dragend', (event: any) => {
        // Update the waypoint position
        waypoints.value[index] = event.latLng
        
        // Update the route polyline without recreating markers
        updateRouteAfterChange()
        
        // Get new address for the dragged pin
        getAddressForPin(index, event.latLng)
        
        // Reset dragging state
        isDragging.value = false
      })
    }

    routeMarkers.value.push(marker)
    
    // Get address for this pin (only when editing)
    if (isEditing.value) {
      getAddressForPin(index, point)
    }
  })

  // Use Routes API if we have at least 2 points
  if (waypoints.value.length >= 2) {
    updateRouteAfterChange()
  }

  // Update form points
  updateFormPoints()
}

// Separate function to update route after pin changes
function updateRouteAfterChange() {
  if (waypoints.value.length < 2) {
    // Clear route if less than 2 points
    if (routePolyline.value) {
      routePolyline.value.setMap(null)
    }
    totalDistance.value = 0
    return
  }

  callRoutesAPI(waypoints.value)
    .then(data => {
      if (data.routes && data.routes.length > 0) {
        // Success with Routes API - decode the polyline
        const route = data.routes[0]
        const encodedPolyline = route.polyline.encodedPolyline
        
        // Update total distance from Routes API
        totalDistance.value = route.distanceMeters || 0
        
        // Decode the polyline using Google Maps utility
        const decodedPath = window.google.maps.geometry.encoding.decodePath(encodedPolyline)
        
        // Clear existing polyline
        if (routePolyline.value) {
          routePolyline.value.setMap(null)
        }
        
        // Create new polyline from decoded path
        routePolyline.value = new window.google.maps.Polyline({
          path: decodedPath,
          geodesic: true,
          strokeColor: '#2196F3',
          strokeOpacity: 1.0,
          strokeWeight: 4,
          map: map.value
        })
        
        console.log('Route updated using Routes API after pin change')
      } else {
        throw new Error('No routes returned from Routes API')
      }
    })
    .catch(error => {
      console.warn('Routes API failed after pin change, using fallback:', error)
      // Fallback - draw simple polyline and reset distance
      if (routePolyline.value) {
        routePolyline.value.setMap(null)
      }
      
      routePolyline.value = new window.google.maps.Polyline({
        path: waypoints.value,
        geodesic: true,
        strokeColor: '#2196F3',
        strokeOpacity: 1.0,
        strokeWeight: 4,
        map: map.value
      })
      
      // Reset distance since we can't get accurate distance without Routes API
      totalDistance.value = 0
    })
    
  // Update form points
  updateFormPoints()
}

// Update form points
function updateFormPoints() {
  mapForm.value.points = waypoints.value.map((point: any, index: number) => ({
    lat: point.lat(),
    lng: point.lng(),
    type: index === 0 ? 'start' : index === waypoints.value.length - 1 ? 'end' : 'waypoint'
  }))
}

// Get address for a pin using Places API (reverse geocoding)
async function getAddressForPin(index: number, latLng: any) {
  if (!window.google?.maps?.places) {
    console.warn('Places API not loaded')
    return
  }

  try {
    const geocoder = new window.google.maps.Geocoder()
    
    geocoder.geocode({ location: latLng }, (results: any, status: any) => {
      if (status === 'OK' && results && results.length > 0) {
        const address = results[0].formatted_address
        pinAddresses.value.set(index, address)
        console.log(`Address for pin ${index}:`, address)
      } else {
        pinAddresses.value.set(index, `${latLng.lat().toFixed(6)}, ${latLng.lng().toFixed(6)}`)
        console.warn('Geocoding failed:', status)
      }
    })
  } catch (error) {
    console.error('Error getting address:', error)
    pinAddresses.value.set(index, `${latLng.lat().toFixed(6)}, ${latLng.lng().toFixed(6)}`)
  }
}

// Remove waypoint by index
function removeWaypoint(index: number) {
  waypoints.value.splice(index, 1)
  
  // Remove address for this pin and shift remaining addresses
  const newAddresses = new Map<number, string>()
  pinAddresses.value.forEach((address, pinIndex) => {
    if (pinIndex < index) {
      newAddresses.set(pinIndex, address)
    } else if (pinIndex > index) {
      newAddresses.set(pinIndex - 1, address)
    }
  })
  pinAddresses.value = newAddresses
  
  updateMapDisplay()
}

// Remove waypoint from pins list
function removePinFromList(index: number) {
  removeWaypoint(index)
}

function clearMap() {
  waypoints.value = []
  pinAddresses.value.clear()
  updateMapDisplay()
}

function loadMapToEditor(mapData: Route) {
  selectedMap.value = mapData
  mapForm.value.name = mapData.name
  mapForm.value.description = mapData.description || ''
  
  // Clear existing addresses
  pinAddresses.value.clear()
  
  // Load waypoints
  waypoints.value = mapData.points.map((point: RoutePoint) => 
    new window.google.maps.LatLng(point.lat, point.lng)
  )
  
  updateMapDisplay()
  
  // Center map to show all points
  if (waypoints.value.length > 0 && window.google) {
    const bounds = new window.google.maps.LatLngBounds()
    waypoints.value.forEach((point: any) => bounds.extend(point))
    map.value?.fitBounds(bounds)
  }
}

function startCreatingNew() {
  isCreatingNew.value = true
  isEditing.value = true
  selectedMap.value = null
  mapForm.value = { name: '', description: '', points: [] }
  pinAddresses.value.clear()
  clearMap()
}

function startEditing(mapData: Route) {
  isEditing.value = true
  loadMapToEditor(mapData)
}

function cancelEditing() {
  if (hasUnsavedChanges.value) {
    if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
      return
    }
  }
  
  isEditing.value = false
  isCreatingNew.value = false
  selectedMap.value = null
  clearMap()
}

function saveMap() {
  if (!mapForm.value.name.trim()) {
    alert('Please enter a map name')
    return
  }
  
  if (waypoints.value.length < 2) {
    alert('Please add at least 2 points to create a route')
    return
  }
  
  showSaveDialog.value = true
}

async function confirmSave() {
  isSaving.value = true
  showSaveDialog.value = false
  
  try {
    if (isCreatingNew.value) {
      // Create new map
      const result = await routeService.createRoute(
        mapForm.value.name.trim(),
        mapForm.value.description.trim(),
        mapForm.value.points,
        authStore.managerId!,
        totalDistance.value
      )
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create route')
      }
      
      console.log('Route created successfully:', result.route?.id)
    } else {
      // Update existing map
      if (!selectedMap.value) {
        throw new Error('No map selected for update')
      }
      
      const result = await routeService.updateRoute(
        selectedMap.value.id,
        mapForm.value.name.trim(),
        mapForm.value.description.trim(),
        mapForm.value.points,
        authStore.managerId!,
        totalDistance.value
      )
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update route')
      }
      
      console.log('Route updated successfully:', result.route?.id)
    }
    
    isEditing.value = false
    isCreatingNew.value = false
    selectedMap.value = null
    await loadMaps() // Refresh list
    clearMap()
    
  } catch (error) {
    console.error('Error saving map:', error)
    alert(`Failed to save map: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    isSaving.value = false
  }
}

function saveAsNew() {
  isCreatingNew.value = true
  selectedMap.value = null
  mapForm.value.name = `${mapForm.value.name} (Copy)`
  showSaveDialog.value = true
}

async function deleteMap(mapData: Route) {
  selectedMap.value = mapData
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!selectedMap.value) return
  
  try {
    const result = await routeService.deleteRoute(
      selectedMap.value.id,
      authStore.managerId!
    )
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete route')
    }
    
    console.log('Route deleted successfully:', selectedMap.value.id)
    showDeleteDialog.value = false
    await loadMaps() // Refresh list
    
    if (isEditing.value && selectedMap.value) {
      cancelEditing()
    }
    
  } catch (error) {
    console.error('Error deleting map:', error)
    alert(`Failed to delete map: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function loadMaps() {
  isLoading.value = true
  connectionError.value = null
  
  try {
    // Check if route service is connected
    if (!routeService.isConnected()) {
      console.log('RouteService not connected, attempting to reconnect...')
      routeService.reconnect()
      
      // Wait a bit for connection
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    const result = await routeService.listRoutes(
      undefined, // Remove manager filtering - show all maps
      true // Only load template routes
    )
    
    if (result.success && result.routes) {
      maps.value = result.routes
      console.log(`Loaded ${result.routes.length} maps (global)`)
    } else {
      throw new Error(result.error || 'Failed to load routes')
    }
  } catch (error) {
    console.error('Error loading maps:', error)
    
    // Provide specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Not connected')) {
        connectionError.value = 'Connection lost. Please check if the server is running and try again.'
      } else {
        connectionError.value = error.message
      }
    } else {
      connectionError.value = 'Failed to load maps'
    }
    
    maps.value = []
  } finally {
    isLoading.value = false
  }
}

// Add a manual retry function
async function retryConnection() {
  console.log('Manual retry requested...')
  routeService.reconnect()
  await loadMaps()
}

function goBack() {
  router.push('/manager-dashboard')
}

// Call the Routes API
async function callRoutesAPI(waypoints: any[]) {
  if (waypoints.length < 2) return null
  
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

onMounted(async () => {
  await loadMaps()
  
  // Initialize Google Maps
  if (window.google) {
    initMap()
  } else {
    // Load Google Maps with geometry and places libraries
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=geometry,places&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => {
      initMap()
    }
    script.onerror = () => {
      console.error('Failed to load Google Maps')
      connectionError.value = 'Failed to load Google Maps. Please check your internet connection.'
    }
    document.head.appendChild(script)
  }
})

onUnmounted(() => {
  // Clean up route service connection if needed
  // The service manages its own connection lifecycle
  pinAddresses.value.clear()
  
  // Clear any pending click timeout
  if (clickTimeout.value) {
    clearTimeout(clickTimeout.value)
  }
})
</script>

<template>
  <v-app>
    <!-- App Bar -->
    <v-app-bar color="primary" class="gradient-primary" elevation="4">
      <template #prepend>
        <v-btn @click="goBack" icon="mdi-arrow-left" variant="text" color="white" />
      </template>
      
      <v-app-bar-title class="font-weight-bold">
        Maps Management
      </v-app-bar-title>

      <template #append>
        <v-btn
          @click="centerToManagerLocation"
          color="white"
          variant="outlined"
          prepend-icon="mdi-crosshairs-gps"
          class="text-none mr-2"
          :loading="isLocationLoading"
          :disabled="isLocationLoading"
        >
          {{ isLocationLoading ? 'Finding...' : 'My Location' }}
        </v-btn>
        
        <!-- Connection Status -->
        <v-chip
          :color="routeService.isConnected() ? 'success' : 'error'"
          size="small"
          variant="elevated"
          class="mr-2"
        >
          <v-icon 
            :icon="routeService.isConnected() ? 'mdi-wifi' : 'mdi-wifi-off'" 
            start
          />
          {{ routeService.isConnected() ? 'Connected' : 'Disconnected' }}
        </v-chip>
        
        <v-btn
          v-if="isEditing && waypoints.length > 0"
          @click="showPinsPanel = !showPinsPanel"
          color="white"
          variant="outlined"
          prepend-icon="mdi-format-list-bulleted"
          class="text-none mr-2"
        >
          Pins ({{ waypoints.length }})
        </v-btn>
        
        <v-btn
          @click="startCreatingNew"
          color="white"
          variant="outlined"
          prepend-icon="mdi-plus"
          class="text-none"
          :disabled="isEditing"
        >
          New Map
        </v-btn>
      </template>
    </v-app-bar>

    <!-- Main Content -->
    <v-main>
      <v-container fluid class="pa-0 fill-height">
        <v-row no-gutters class="fill-height">
          <!-- Maps List Sidebar -->
          <v-col cols="12" md="4" lg="3" class="border-e">
            <v-card flat class="fill-height">
              <v-card-title class="d-flex align-center justify-space-between">
                <span>Saved Maps</span>
                <v-chip :color="isEditing ? 'warning' : 'success'" size="small">
                  {{ isEditing ? 'Editing' : 'View Mode' }}
                </v-chip>
              </v-card-title>
              
              <v-card-text class="pa-0">
                <!-- Loading State -->
                <div v-if="isLoading" class="text-center pa-6">
                  <v-progress-circular indeterminate color="primary" class="mb-3" />
                  <div class="text-body-2 text-medium-emphasis">Loading maps...</div>
                </div>
                
                <!-- Connection Error -->
                <v-alert
                  v-else-if="connectionError"
                  type="error"
                  density="compact"
                  class="ma-4"
                  :text="connectionError"
                >
                  <template #append>
                    <v-btn
                      @click="retryConnection"
                      size="small"
                      color="white"
                      variant="text"
                    >
                      Retry
                    </v-btn>
                  </template>
                </v-alert>
                
                <!-- Empty State -->
                <div v-else-if="maps.length === 0" class="text-center pa-6">
                  <v-icon size="48" color="grey-lighten-1" class="mb-3">mdi-map-outline</v-icon>
                  <div class="text-body-2 text-medium-emphasis mb-3">No maps found</div>
                  <div class="text-caption text-medium-emphasis">Create your first map to get started</div>
                </div>
                
                <!-- Maps List -->
                <v-list v-else>
                  <v-list-item
                    v-for="mapData in maps"
                    :key="mapData.id"
                    :active="selectedMap?.id === mapData.id"
                    @click="loadMapToEditor(mapData)"
                    :disabled="isEditing"
                  >
                    <template #prepend>
                      <v-icon color="primary">mdi-map</v-icon>
                    </template>
                    
                    <v-list-item-title>{{ mapData.name }}</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ mapData.points.length }} points
                      <span v-if="mapData.distance" class="text-success">
                        • {{ (mapData.distance / 1000).toFixed(2) }} km
                      </span>
                      {{ mapData.description ? `• ${mapData.description}` : '' }}
                      <br>
                      <span class="text-caption">Created by: {{ mapData.createdBy }}</span>
                    </v-list-item-subtitle>
                    
                    <template #append>
                      <v-menu>
                        <template #activator="{ props }">
                          <v-btn
                            icon="mdi-dots-vertical"
                            variant="text"
                            size="small"
                            v-bind="props"
                            @click.stop
                            :disabled="isEditing"
                          />
                        </template>
                        
                        <v-list>
                          <v-list-item @click="startEditing(mapData)">
                            <template #prepend>
                              <v-icon>mdi-pencil</v-icon>
                            </template>
                            <v-list-item-title>Edit</v-list-item-title>
                          </v-list-item>
                          
                          <v-list-item @click="deleteMap(mapData)">
                            <template #prepend>
                              <v-icon color="error">mdi-delete</v-icon>
                            </template>
                            <v-list-item-title>Delete</v-list-item-title>
                          </v-list-item>
                        </v-list>
                      </v-menu>
                    </template>
                  </v-list-item>
                </v-list>
                
                <v-divider v-if="maps.length > 0" />
                
                <div class="pa-4 text-center">
                  <v-btn
                    @click="startCreatingNew"
                    color="primary"
                    variant="outlined"
                    prepend-icon="mdi-plus"
                    block
                    class="text-none"
                    :disabled="isEditing"
                  >
                    Create New Map
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          
          <!-- Pins Management Panel -->
          <v-col v-if="showPinsPanel" cols="12" md="4" lg="3" class="border-e">
            <v-card flat class="fill-height">
              <v-card-title class="d-flex align-center justify-space-between">
                <span>Route Pins</span>
                <v-btn
                  @click="showPinsPanel = false"
                  icon="mdi-close"
                  variant="text"
                  size="small"
                />
              </v-card-title>
              
              <v-card-subtitle class="pb-2">
                Drag pins on the map or manage them here
              </v-card-subtitle>
              
              <v-card-text class="pa-0">
                <v-alert
                  v-if="waypoints.length === 0"
                  type="info"
                  density="compact"
                  class="ma-4"
                >
                  Click on the map to add route pins
                </v-alert>
                
                <v-list v-else>
                  <v-list-item
                    v-for="(pin, index) in pinsWithAddresses"
                    :key="index"
                    class="border-b"
                  >
                    <template #prepend>
                      <v-avatar size="32" class="mr-3">
                        <v-icon 
                          :color="pin.type === 'start' ? 'success' : 
                                  pin.type === 'end' ? 'error' : 'warning'"
                        >
                          {{ pin.type === 'start' ? 'mdi-flag' : 
                             pin.type === 'end' ? 'mdi-flag-checkered' : 'mdi-map-marker' }}
                        </v-icon>
                      </v-avatar>
                    </template>
                    
                    <v-list-item-title class="text-wrap">
                      {{ pin.type === 'start' ? 'Start' : 
                         pin.type === 'end' ? 'End' : `Point ${index + 1}` }}
                    </v-list-item-title>
                    
                    <v-list-item-subtitle class="text-wrap">
                      {{ pin.address }}
                    </v-list-item-subtitle>
                    
                    <template #append>
                      <v-btn
                        @click="removePinFromList(index)"
                        icon="mdi-delete"
                        variant="text"
                        size="small"
                        color="error"
                        :disabled="waypoints.length <= 1"
                      />
                    </template>
                  </v-list-item>
                </v-list>
                
                <v-divider />
                
                <div class="pa-4">
                  <v-alert
                    v-if="formattedDistance"
                    type="success"
                    density="compact"
                    class="mb-3"
                    icon="mdi-map-marker-distance"
                    variant="tonal"
                  >
                    <strong>Total Distance:</strong><br>
                    {{ formattedDistance }}
                  </v-alert>
                  
                  <v-alert
                    type="info"
                    density="compact"
                    class="mb-3"
                    icon="mdi-information"
                  >
                    Click on the map to add waypoints. Drag pins to move them. Right-click or use the pins list to remove them.
                  </v-alert>
                  
                  <v-alert
                    v-if="!isCreatingNew"
                    type="info"
                    density="compact"
                    class="mb-3"
                    icon="mdi-earth"
                    variant="tonal"
                  >
                    This is a shared map. Changes will be visible to all managers.
                  </v-alert>
                  
                  <v-btn
                    @click="clearMap"
                    color="error"
                    variant="outlined"
                    prepend-icon="mdi-delete-sweep"
                    block
                    class="text-none"
                    :disabled="waypoints.length === 0"
                  >
                    Clear All Pins
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          
          <!-- Map Editor -->
          <v-col :cols="showPinsPanel ? 12 : 12" :md="showPinsPanel ? 4 : 8" :lg="showPinsPanel ? 6 : 9" class="position-relative">
            <!-- Map Container -->
            <div ref="mapContainer" class="map-container fill-height"></div>
            
            <!-- Editing Controls -->
            <div v-if="isEditing" class="editing-controls">
              <v-card elevation="4" class="pa-4">
                <v-card-title class="pa-0 mb-3">
                  {{ isCreatingNew ? 'Create New Map' : 'Edit Map' }}
                  <v-chip
                    v-if="!isCreatingNew && !isOwnMap"
                    size="small"
                    color="info"
                    variant="tonal"
                    class="ml-2"
                  >
                    Created by {{ selectedMap?.createdBy }}
                  </v-chip>
                </v-card-title>
                
                <v-text-field
                  v-model="mapForm.name"
                  label="Map Name"
                  placeholder="Enter map name"
                  required
                  class="mb-2"
                />
                
                <v-textarea
                  v-model="mapForm.description"
                  label="Description (Optional)"
                  placeholder="Describe this map..."
                  rows="2"
                  class="mb-3"
                />
                
                <v-alert
                  type="info"
                  density="compact"
                  class="mb-3"
                  icon="mdi-information"
                >
                  Click on the map to add waypoints. Drag pins to move them. Right-click or use the pins list to remove them.
                </v-alert>
                
                <div class="d-flex gap-2 flex-wrap">
                  <v-btn
                    @click="saveMap"
                    color="success"
                    prepend-icon="mdi-content-save"
                    :disabled="!mapForm.name.trim() || waypoints.length < 2"
                    :loading="isSaving"
                  >
                    Save
                  </v-btn>
                  
                  <v-btn
                    v-if="!isCreatingNew"
                    @click="saveAsNew"
                    color="primary"
                    prepend-icon="mdi-content-copy"
                    variant="outlined"
                    :disabled="!mapForm.name.trim() || waypoints.length < 2"
                  >
                    Save As
                  </v-btn>
                  
                  <v-btn
                    @click="clearMap"
                    color="warning"
                    prepend-icon="mdi-delete-sweep"
                    variant="outlined"
                  >
                    Clear
                  </v-btn>
                  
                  <v-btn
                    @click="cancelEditing"
                    color="error"
                    prepend-icon="mdi-cancel"
                    variant="outlined"
                  >
                    Cancel
                  </v-btn>
                </div>
                
                <div class="mt-3">
                  <v-chip size="small" color="primary">
                    {{ waypoints.length }} waypoints
                  </v-chip>
                  <v-chip 
                    v-if="formattedDistance" 
                    size="small" 
                    color="success" 
                    class="ml-2"
                  >
                    <v-icon start>mdi-map-marker-distance</v-icon>
                    {{ formattedDistance }}
                  </v-chip>
                </div>
              </v-card>
            </div>
            
            <!-- View Mode Info -->
            <div v-else-if="selectedMap" class="view-info">
              <v-card elevation="4" class="pa-4">
                <v-card-title class="pa-0 mb-2">{{ selectedMap.name }}</v-card-title>
                <v-card-text class="pa-0">
                  <p v-if="selectedMap.description" class="mb-3">{{ selectedMap.description }}</p>
                  
                  <div class="mb-3">
                    <v-chip size="small" color="primary" class="mr-2">
                      {{ selectedMap.points.length }} waypoints
                    </v-chip>
                    <v-chip size="small" color="secondary">
                      by {{ selectedMap.createdBy }}
                    </v-chip>
                  </div>
                  
                  <v-alert
                    type="info"
                    density="compact"
                    icon="mdi-eye"
                    variant="tonal"
                  >
                    Viewing mode - Map is read-only
                  </v-alert>
                </v-card-text>
              </v-card>
            </div>
            
            <!-- Empty State -->
            <div v-else class="empty-state">
              <v-card elevation="4" class="pa-8 text-center">
                <v-icon 
                  size="120" 
                  :color="isEditing ? 'primary' : 'grey-lighten-1'" 
                  class="mb-4"
                >
                  {{ isEditing ? 'mdi-map-plus' : 'mdi-map-outline' }}
                </v-icon>
                
                <h2 class="text-h5 mb-4">
                  {{ isEditing ? 'Create Your Route' : 'Select a Map to View' }}
                </h2>
                
                <p class="text-body-1 mb-6">
                  {{ isEditing 
                    ? 'Click on the map to add waypoints and create your route.' 
                    : 'Choose a map from the sidebar to view its route details.' 
                  }}
                </p>
                
                <v-btn
                  v-if="!isEditing"
                  @click="startCreatingNew"
                  color="primary"
                  size="large"
                  prepend-icon="mdi-plus"
                  class="text-none"
                >
                  Create New Map
                </v-btn>
              </v-card>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <!-- Save Confirmation Dialog -->
    <v-dialog v-model="showSaveDialog" max-width="400">
      <v-card>
        <v-card-title>
          {{ isCreatingNew ? 'Create Map' : 'Save Changes' }}
        </v-card-title>
        
        <v-card-text>
          <p>{{ isCreatingNew ? 'Create' : 'Save changes to' }} map "{{ mapForm.name }}"?</p>
          <v-alert
            v-if="!isCreatingNew"
            type="warning"
            density="compact"
            class="mt-3"
          >
            This will overwrite the existing map.
          </v-alert>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showSaveDialog = false" variant="text">Cancel</v-btn>
          <v-btn @click="confirmSave" color="success" :loading="isSaving">
            {{ isCreatingNew ? 'Create' : 'Save' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title class="text-error">Delete Map</v-card-title>
        
        <v-card-text>
          <p>Are you sure you want to delete "{{ selectedMap?.name }}"?</p>
          <v-alert type="error" density="compact" class="mt-3">
            This action cannot be undone.
          </v-alert>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showDeleteDialog = false" variant="text">Cancel</v-btn>
          <v-btn @click="confirmDelete" color="error">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <!-- Location Error Snackbar -->
    <v-snackbar
      v-model="showLocationError"
      color="warning"
      timeout="5000"
      location="bottom"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-map-marker-off</v-icon>
        {{ locationError }}
      </div>
      
      <template #actions>
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
  height: 100vh;
}

.editing-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 320px;
  z-index: 1000;
}

.view-info {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 300px;
  z-index: 1000;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 500px;
  z-index: 1000;
}

.gap-2 {
  gap: 0.5rem;
}

.border-b {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

/* Mobile responsive adjustments */
@media (max-width: 960px) {
  .editing-controls {
    position: relative;
    top: auto;
    right: auto;
    width: 100%;
    margin: 16px;
    z-index: auto;
  }
  
  .view-info {
    position: relative;
    top: auto;
    right: auto;
    width: 100%;
    margin: 16px;
    z-index: auto;
  }
  
  .empty-state {
    position: relative;
    top: auto;
    left: auto;
    transform: none;
    width: 100%;
    margin: 16px;
    z-index: auto;
  }
  
  .map-container {
    height: 60vh;
    min-height: 400px;
  }
}

@media (max-width: 600px) {
  .map-container {
    height: 50vh;
    min-height: 300px;
  }
}
</style> 