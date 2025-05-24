<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const sessionStore = useSessionStore()
const authStore = useAuthStore()

const showCreateModal = ref(false)
const isCreating = ref(false)
const createError = ref('')

// Set manager flag when accessing dashboard
sessionStore.isManager = true

const hasActiveSession = computed(() => {
  return sessionStore.currentSession && sessionStore.currentSession.isActive
})

const isSessionRecovered = computed(() => {
  // Check if we have a session that was loaded from storage
  return hasActiveSession.value && !isCreating.value
})

async function createNewSession() {
  isCreating.value = true
  createError.value = ''
  
  try {
    const result = await sessionStore.createSession(authStore.managerId!)
    if (result.success) {
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

function logout() {
  authStore.logout()
  sessionStore.endSession()
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
        <v-btn
          @click="logout"
          variant="outlined"
          color="white"
          prepend-icon="mdi-logout"
          class="text-none"
        >
          Logout
        </v-btn>
      </template>
    </v-app-bar>

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
              <v-icon size="120" color="primary" class="mb-6">mdi-map-plus</v-icon>
              
              <h2 class="text-h4 font-weight-bold mb-4">No Active Session</h2>
              <p class="text-h6 text-medium-emphasis mb-8">
                Create a new session to start managing routes and tracking participants
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
                class="text-none font-weight-bold px-8"
              >
                {{ isCreating ? 'Creating Session...' : 'Create New Session' }}
              </v-btn>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <!-- Create Session Modal -->
    <v-dialog v-model="showCreateModal" max-width="500">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <span class="text-h5 font-weight-bold">Session Created!</span>
          <v-btn
            @click="showCreateModal = false"
            variant="text"
            icon="mdi-close"
            size="small"
          />
        </v-card-title>

        <v-card-text class="text-center pa-8">
          <v-icon size="80" color="success" class="mb-6">mdi-check-circle</v-icon>
          
          <p class="text-h6 mb-6">Share this PIN with participants:</p>
          
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