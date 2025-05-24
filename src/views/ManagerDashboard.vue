<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useAuthStore } from '@/stores/auth'
import { routeService, type Route } from '@/services/routeService'

const router = useRouter()
const sessionStore = useSessionStore()
const authStore = useAuthStore()

const showCreateModal = ref(false)
const isCreating = ref(false)
const createError = ref('')
const joinedExisting = ref(false)
const showMapSelection = ref(false)
const showMobileMenu = ref(false)
const availableMaps = ref<Route[]>([])
const selectedMapId = ref<string | null>(null)
const isLoadingSession = ref(false)

// Set manager flag when accessing dashboard
sessionStore.isManager = true

const hasActiveSession = computed(() => {
  return sessionStore.currentSession && sessionStore.currentSession.isActive
})

const isSessionRecovered = computed(() => {
  // Check if we have a session that was loaded from storage
  return hasActiveSession.value && !isCreating.value
})

// Auto-recover session when component mounts
onMounted(async () => {
  // Only try to recover if we don't already have an active session
  if (!hasActiveSession.value && !isLoadingSession.value) {
    isLoadingSession.value = true
    
    try {
      const recoveryResult = await sessionStore.recoverSession()
      
      if (recoveryResult.success && sessionStore.currentSession) {
        console.log('Active session automatically recovered in dashboard')
        // Session was successfully recovered - the UI will automatically update
        // due to the reactive hasActiveSession computed property
      } else {
        console.log('No active session to recover:', recoveryResult.error)
      }
    } catch (error) {
      console.error('Failed to recover session in dashboard:', error)
    } finally {
      isLoadingSession.value = false
    }
  }
})

async function createNewSession() {
  // First, load available maps
  await loadAvailableMaps()
  
  if (availableMaps.value.length === 0) {
    createError.value = 'No maps available. Please create a map first.'
    return
  }
  
  // Show map selection dialog
  showMapSelection.value = true
}

async function loadAvailableMaps() {
  try {
    const result = await routeService.listRoutes(
      undefined, // Remove manager filtering - show all maps
      true // Only load template routes
    )
    
    if (result.success && result.routes) {
      availableMaps.value = result.routes
      console.log(`Loaded ${result.routes.length} available maps (global)`)
    } else {
      throw new Error(result.error || 'Failed to load routes')
    }
  } catch (error) {
    console.error('Error loading maps:', error)
    createError.value = error instanceof Error ? error.message : 'Failed to load maps. Please try again.'
    availableMaps.value = []
  }
}

async function confirmCreateSession() {
  if (!selectedMapId.value) {
    return
  }
  
  isCreating.value = true
  createError.value = ''
  joinedExisting.value = false
  showMapSelection.value = false
  
  try {
    // Pass selectedMapId to session creation
    const result = await sessionStore.createSession(authStore.managerId!, selectedMapId.value)
    if (result.success) {
      joinedExisting.value = result.joinedExisting || false
      showCreateModal.value = true
    } else {
      createError.value = result.error || 'Failed to create session'
    }
  } catch (error) {
    console.error('Error creating session:', error)
    createError.value = 'Failed to create session. Please try again.'
  } finally {
    isCreating.value = false
  }
}

function goToMap() {
  router.push('/map')
}

function goToMaps() {
  router.push('/maps')
}

function logout() {
  authStore.logout()
  router.push('/')
}

function copyPin() {
  if (sessionStore.currentSession) {
    navigator.clipboard.writeText(sessionStore.currentSession.pin)
  }
}
</script>

<template>
  <v-app>
    <!-- App Bar -->
    <v-app-bar color="primary" class="gradient-primary" elevation="4">
      <template #prepend>
        <v-icon size="large">mdi-route</v-icon>
      </template>
      
      <v-app-bar-title class="font-weight-bold">
        Manager Dashboard
      </v-app-bar-title>

      <template #append>
        <!-- Desktop: Navigation Buttons -->
        <div class="d-none d-md-flex align-center">
          <v-btn
            @click="goToMaps"
            variant="outlined"
            color="white"
            prepend-icon="mdi-map-outline"
            class="text-none mr-2"
          >
            Manage Maps
          </v-btn>
          
          <v-btn
            @click="logout"
            variant="outlined"
            color="white"
            prepend-icon="mdi-logout"
            class="text-none"
          >
            Logout
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
        <v-list-subheader>Navigation</v-list-subheader>
        
        <v-list-item
          @click="goToMaps"
          prepend-icon="mdi-map-outline"
          title="Manage Maps"
          base-color="primary"
        />

        <v-divider class="my-2" />

        <v-list-item
          @click="logout"
          prepend-icon="mdi-logout"
          title="Logout"
          base-color="error"
        />
      </v-list>
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main>
      <v-container fluid class="pa-6">
        <!-- Session Recovery Banner -->
        <v-alert
          v-if="isSessionRecovered"
          type="success"
          variant="tonal"
          density="compact"
          class="mb-6"
          prepend-icon="mdi-backup-restore"
          closable
        >
          <v-alert-title>Session Recovered</v-alert-title>
          <div>Your previous session has been automatically restored. You can continue managing your active session.</div>
        </v-alert>

        <!-- Active Session -->
        <v-row v-if="hasActiveSession">
          <v-col cols="12">
            <v-card elevation="4" class="mb-6">
              <v-card-title class="d-flex align-center justify-space-between">
                <div class="d-flex align-center">
                  <v-icon color="success" class="mr-3">mdi-broadcast</v-icon>
                  <span>Active Session</span>
                </div>
                <v-chip color="success" variant="elevated">
                  <v-icon start>mdi-circle</v-icon>
                  Live
                </v-chip>
              </v-card-title>

              <v-card-text>
                <v-row align="center" class="mb-4">
                  <v-col cols="12" md="6">
                    <div class="text-h6 mb-2">Session PIN</div>
                    <div class="d-flex align-center">
                      <v-chip
                        size="x-large"
                        color="primary"
                        variant="elevated"
                        class="mr-4 text-h5 px-6 py-2"
                        style="letter-spacing: 4px; font-weight: bold;"
                      >
                        {{ sessionStore.currentSession?.pin }}
                      </v-chip>
                      <v-btn
                        @click="copyPin"
                        variant="outlined"
                        size="small"
                        icon="mdi-content-copy"
                      />
                    </div>
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <div class="text-h6 mb-2">Participants</div>
                    <div class="d-flex align-center">
                      <v-icon color="primary" class="mr-2">mdi-account-group</v-icon>
                      <span class="text-h6">{{ sessionStore.activeParticipants.length }} active</span>
                    </div>
                  </v-col>
                </v-row>

                <v-row>
                  <v-col cols="12" md="6">
                    <v-btn
                      @click="goToMap"
                      color="primary"
                      size="large"
                      prepend-icon="mdi-map"
                      block
                      class="text-none font-weight-bold"
                    >
                      View Map
                    </v-btn>
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <v-btn
                      @click="sessionStore.endSession"
                      color="error"
                      size="large"
                      prepend-icon="mdi-stop"
                      variant="outlined"
                      block
                      class="text-none font-weight-bold"
                    >
                      End Session
                    </v-btn>
                  </v-col>
                </v-row>

                <!-- Participants List -->
                <v-card
                  v-if="sessionStore.activeParticipants.length > 0"
                  variant="tonal"
                  class="mt-6"
                >
                  <v-card-title class="text-h6">
                    <v-icon class="mr-2">mdi-account-multiple</v-icon>
                    Active Participants
                  </v-card-title>
                  
                  <v-card-text>
                    <v-list density="compact">
                      <v-list-item
                        v-for="participant in sessionStore.activeParticipants"
                        :key="participant.id"
                        :prepend-avatar="`https://ui-avatars.com/api/?name=${participant.name}&background=667eea&color=fff`"
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
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- No Active Session -->
        <v-row v-else justify="center">
          <v-col cols="12" md="8" lg="6">
            <v-card elevation="4" class="text-center pa-8">
              <!-- Loading Session State -->
              <div v-if="isLoadingSession">
                <v-progress-circular
                  size="80"
                  width="6"
                  color="primary"
                  indeterminate
                  class="mb-6"
                />
                
                <h2 class="text-h4 font-weight-bold mb-4">Checking for Active Session</h2>
                <p class="text-h6 text-medium-emphasis mb-8">
                  Please wait while we check if you have an active session...
                </p>
              </div>
              
              <!-- No Session Found State -->
              <div v-else>
                <v-icon size="120" color="primary" class="mb-6">mdi-map-plus</v-icon>
                
                <h2 class="text-h4 font-weight-bold mb-4">No Active Session</h2>
                <p class="text-h6 text-medium-emphasis mb-8">
                  Start or join a session to manage routes and track participants
                </p>
                
                <!-- Error Message -->
                <v-alert
                  v-if="createError"
                  type="error"
                  variant="tonal"
                  class="mb-4"
                  :text="createError"
                />
                
                <!-- Connection Status -->
                <v-alert
                  v-if="!sessionStore.isConnected && sessionStore.connectionError"
                  type="warning"
                  variant="tonal"
                  class="mb-4"
                  :text="sessionStore.connectionError"
                />
                
                <v-btn
                  @click="createNewSession"
                  color="primary"
                  size="x-large"
                  prepend-icon="mdi-plus"
                  :loading="isCreating"
                  :disabled="isCreating"
                  class="text-none font-weight-bold px-8 mb-4"
                >
                  {{ isCreating ? 'Connecting...' : 'Start Session' }}
                </v-btn>
                
                <div class="text-body-2 text-medium-emphasis mb-4">or</div>
                
                <v-btn
                  @click="goToMaps"
                  color="secondary"
                  size="large"
                  prepend-icon="mdi-map-outline"
                  variant="outlined"
                  class="text-none font-weight-bold px-8"
                >
                  Manage Maps
                </v-btn>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <!-- Create Session Modal -->
    <v-dialog v-model="showCreateModal" max-width="500">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <span class="text-h5 font-weight-bold">
            {{ joinedExisting ? 'Joined Existing Session!' : 'Session Created!' }}
          </span>
          <v-btn
            @click="showCreateModal = false"
            variant="text"
            icon="mdi-close"
            size="small"
          />
        </v-card-title>

        <v-card-text class="text-center pa-8">
          <v-icon 
            size="80" 
            :color="joinedExisting ? 'info' : 'success'" 
            class="mb-6"
          >
            {{ joinedExisting ? 'mdi-account-plus' : 'mdi-check-circle' }}
          </v-icon>
          
          <p v-if="joinedExisting" class="text-h6 mb-6">
            You've been added as manager to the active session:
          </p>
          <p v-else class="text-h6 mb-6">
            Share this PIN with participants:
          </p>
          
          <v-chip
            size="x-large"
            color="primary"
            variant="elevated"
            class="mb-6 text-h4 px-8 py-4"
            style="letter-spacing: 6px; font-weight: bold;"
          >
            {{ sessionStore.currentSession?.pin }}
          </v-chip>
          
          <v-btn
            @click="copyPin"
            variant="outlined"
            color="primary"
            prepend-icon="mdi-content-copy"
            class="text-none mb-4"
            block
          >
            Copy PIN
          </v-btn>

          <v-alert
            v-if="joinedExisting"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-4"
          >
            This session was created by {{ sessionStore.currentSession?.managerName }}
          </v-alert>
        </v-card-text>

        <v-card-actions class="justify-center pb-6">
          <v-btn
            @click="showCreateModal = false; goToMap()"
            color="primary"
            size="large"
            prepend-icon="mdi-map"
            class="text-none font-weight-bold px-8"
          >
            Go to Map
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Map Selection Dialog -->
    <v-dialog v-model="showMapSelection" max-width="600">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <span class="text-h5 font-weight-bold">Select a Map</span>
          <v-btn
            @click="showMapSelection = false"
            variant="text"
            icon="mdi-close"
            size="small"
          />
        </v-card-title>

        <v-card-text class="pa-6">
          <p class="text-body-1 mb-6">
            Choose a map for your session. Participants will follow this route.
          </p>
          
          <v-radio-group v-model="selectedMapId">
            <v-card
              v-for="map in availableMaps"
              :key="map.id"
              variant="outlined"
              class="mb-3"
              :color="selectedMapId === map.id ? 'primary' : undefined"
            >
              <v-card-text class="pa-4">
                <div class="d-flex align-start">
                  <v-radio :value="map.id" class="mr-4" />
                  
                  <div class="flex-grow-1">
                    <h3 class="text-h6 font-weight-bold mb-2">{{ map.name }}</h3>
                    <p v-if="map.description" class="text-body-2 text-medium-emphasis mb-2">
                      {{ map.description }}
                    </p>
                    <div class="d-flex align-center flex-wrap mb-2">
                      <v-chip size="small" color="primary" variant="text" class="mr-2">
                        {{ map.points.length }} waypoints
                      </v-chip>
                      <v-chip size="small" color="secondary" variant="text">
                        by {{ map.createdBy }}
                      </v-chip>
                    </div>
                  </div>
                  
                  <v-icon color="primary" size="large">mdi-map</v-icon>
                </div>
              </v-card-text>
            </v-card>
          </v-radio-group>
          
          <v-alert
            v-if="availableMaps.length === 0"
            type="info"
            variant="tonal"
            class="mt-4"
          >
            <v-alert-title>No Maps Available</v-alert-title>
            <div>You need to create a map first before starting a session.</div>
            <template #append>
              <v-btn
                @click="showMapSelection = false; goToMaps()"
                color="primary"
                size="small"
                class="text-none"
              >
                Create Map
              </v-btn>
            </template>
          </v-alert>
        </v-card-text>

        <v-card-actions class="pa-6 pt-0">
          <v-spacer />
          <v-btn
            @click="showMapSelection = false"
            variant="text"
            class="text-none"
          >
            Cancel
          </v-btn>
          <v-btn
            @click="confirmCreateSession"
            color="primary"
            :disabled="!selectedMapId"
            :loading="isCreating"
            class="text-none"
          >
            Create Session
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<style scoped>
/* Responsive adjustments */
@media (max-width: 960px) {
  .v-card-text .v-row .v-col {
    margin-bottom: 1rem;
  }
}

@media (max-height: 600px) {
  .pa-8 {
    padding: 1rem !important;
  }
  
  .mb-6 {
    margin-bottom: 1rem !important;
  }
  
  .mb-4 {
    margin-bottom: 0.75rem !important;
  }
}
</style> 