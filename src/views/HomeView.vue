<script setup lang="ts">
import { useRouter } from 'vue-router'
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

onMounted(() => {
  // Check if manager is already authenticated
  authStore.checkAuth()
  if (authStore.isAuthenticated) {
    router.push('/manager-dashboard')
  }
})

function goToManagerLogin() {
  router.push('/manager-login')
}

function goToJoin() {
  router.push('/join')
}
</script>

<template>
  <v-container fluid class="fill-height gradient-primary">
    <v-row justify="center" align="center" class="fill-height">
      <v-col cols="12" md="10" lg="8" xl="6">
        <!-- Hero Section -->
        <v-row justify="center" class="mb-8">
          <v-col cols="12" class="text-center">
            <h1 class="text-h2 text-md-h1 font-weight-bold text-white mb-4">
              RideMapper
            </h1>
            <p class="text-h6 text-md-h5 text-white opacity-90">
              Real-time Route Management & Tracking
            </p>
          </v-col>
        </v-row>

        <!-- Action Cards -->
        <v-row justify="center" align="stretch">
          <v-col cols="12" md="6" class="d-flex">
            <v-card 
              class="flex-grow-1 d-flex flex-column"
              hover
              @click="goToManagerLogin"
              style="cursor: pointer; transition: transform 0.3s ease;"
              elevation="8"
            >
              <v-card-text class="d-flex flex-column align-center pa-8 flex-grow-1">
                <v-avatar size="80" class="gradient-primary mb-6">
                  <v-icon size="40" color="white">mdi-account-supervisor</v-icon>
                </v-avatar>
                
                <h2 class="text-h5 mb-4 text-center">Route Manager</h2>
                <p class="text-body-1 text-center text-medium-emphasis mb-6 flex-grow-1">
                  Create and manage routes, monitor participants in real-time
                </p>
                
                <v-btn
                  color="primary"
                  size="large"
                  class="text-none font-weight-bold"
                  block
                  prepend-icon="mdi-login"
                >
                  Login as Manager
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="6" class="d-flex">
            <v-card 
              class="flex-grow-1 d-flex flex-column"
              hover
              @click="goToJoin"
              style="cursor: pointer; transition: transform 0.3s ease;"
              elevation="8"
            >
              <v-card-text class="d-flex flex-column align-center pa-8 flex-grow-1">
                <v-avatar size="80" class="gradient-accent mb-6">
                  <v-icon size="40" color="white">mdi-map-marker-account</v-icon>
                </v-avatar>
                
                <h2 class="text-h5 mb-4 text-center">Participant</h2>
                <p class="text-body-1 text-center text-medium-emphasis mb-6 flex-grow-1">
                  Join a route session and share your live location
                </p>
                
                <v-btn
                  color="accent"
                  size="large"
                  class="text-none font-weight-bold"
                  block
                  prepend-icon="mdi-map-marker-plus"
                >
                  Join Session
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.v-card:hover {
  transform: translateY(-4px);
}

/* Custom responsive typography adjustments */
@media (max-width: 960px) {
  .v-card {
    margin-bottom: 1rem;
  }
}

@media (max-height: 600px) {
  .mb-8 {
    margin-bottom: 1rem !important;
  }
  
  .mb-6 {
    margin-bottom: 0.75rem !important;
  }
  
  .pa-8 {
    padding: 1rem !important;
  }
}
</style>
