<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const sessionStore = useSessionStore()

const pin = ref('')
const name = ref('')
const error = ref('')
const isLoading = ref(false)

async function handleJoin() {
  error.value = ''
  isLoading.value = true

  try {
    // Validate inputs
    if (!pin.value || pin.value.length !== 6) {
      error.value = 'Please enter a valid 6-digit PIN'
      return
    }

    if (!name.value.trim()) {
      error.value = 'Please enter your name'
      return
    }

    // In a real app, this would connect to a backend to validate the PIN
    // For now, we'll simulate this with a temporary session
    
    // Demo mode: Create a session if PIN is '123456'
    if (pin.value === '123456' && !sessionStore.currentSession) {
      sessionStore.createSession('demo-manager')
      sessionStore.currentSession!.pin = '123456'
    }
    
    const success = sessionStore.joinSession(pin.value, name.value.trim())
    
    if (success) {
      router.push('/map')
    } else {
      error.value = 'Invalid PIN. Please check and try again. (Try demo PIN: 123456)'
    }
  } catch (e) {
    error.value = 'An error occurred. Please try again.'
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  router.push('/')
}
</script>

<template>
  <v-container fluid class="fill-height gradient-accent">
    <v-row justify="center" align="center" class="fill-height">
      <v-col cols="12" sm="8" md="6" lg="4" xl="3">
        <v-card elevation="12" class="mx-auto" max-width="400">
          <v-card-text class="pa-8">
            <!-- Icon -->
            <v-row justify="center" class="mb-6">
              <v-avatar size="80" class="gradient-accent">
                <v-icon size="40" color="white">mdi-map-marker-account</v-icon>
              </v-avatar>
            </v-row>

            <!-- Title -->
            <h1 class="text-h4 font-weight-bold text-center mb-2">
              Join Session
            </h1>
            <p class="text-body-1 text-center text-medium-emphasis mb-6">
              Enter the session PIN to join the route
            </p>

            <!-- Demo Note -->
            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-6"
              icon="mdi-information"
            >
              <template #text>
                <strong>Demo Mode:</strong> Use PIN <strong>123456</strong> to try the app
              </template>
            </v-alert>

            <!-- Join Form -->
            <v-form @submit.prevent="handleJoin">
              <v-text-field
                v-model="pin"
                label="Session PIN"
                placeholder="000000"
                maxlength="6"
                :rules="[v => v.length === 6 || 'PIN must be 6 digits']"
                :disabled="isLoading"
                class="mb-4 text-center"
                style="text-align: center; letter-spacing: 4px; font-weight: 600; font-size: 1.2rem;"
                autofocus
              />

              <v-text-field
                v-model="name"
                label="Your Name"
                placeholder="Enter your name"
                :disabled="isLoading"
                :rules="[v => !!v || 'Name is required']"
                class="mb-4"
              />

              <v-alert
                v-if="error"
                type="error"
                density="compact"
                class="mb-4"
                closable
                @click:close="error = ''"
              >
                {{ error }}
              </v-alert>

              <v-btn
                type="submit"
                color="accent"
                size="large"
                :loading="isLoading"
                :disabled="!pin || !name || pin.length !== 6"
                block
                class="text-none font-weight-bold mb-4"
              >
                {{ isLoading ? 'Joining...' : 'Join Session' }}
              </v-btn>
            </v-form>

            <!-- Back Link -->
            <v-row justify="center">
              <v-btn
                to="/"
                variant="text"
                color="accent"
                prepend-icon="mdi-arrow-left"
                class="text-none"
              >
                Back to Home
              </v-btn>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
/* Custom styles for PIN input */
:deep(.v-field__input) {
  text-align: center;
  letter-spacing: 4px;
  font-weight: 600;
  font-size: 1.2rem;
}

/* Responsive adjustments */
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