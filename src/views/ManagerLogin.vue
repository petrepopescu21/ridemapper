<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const password = ref('')
const error = ref('')
const isLoading = ref(false)
const showPassword = ref(false)

async function handleLogin() {
  error.value = ''
  isLoading.value = true

  try {
    const success = authStore.login(password.value)
    
    if (success) {
      router.push('/manager-dashboard')
    } else {
      error.value = 'Invalid password. Please try again.'
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
  <v-container fluid class="fill-height gradient-primary">
    <v-row justify="center" align="center" class="fill-height">
      <v-col cols="12" sm="8" md="6" lg="4" xl="3">
        <v-card elevation="12" class="mx-auto" max-width="400">
          <v-card-text class="pa-8">
            <!-- Icon -->
            <v-row justify="center" class="mb-6">
              <v-avatar size="80" class="gradient-primary">
                <v-icon size="40" color="white">mdi-account-supervisor</v-icon>
              </v-avatar>
            </v-row>

            <!-- Title -->
            <h1 class="text-h4 font-weight-bold text-center mb-2">
              Manager Login
            </h1>
            <p class="text-body-1 text-center text-medium-emphasis mb-6">
              Enter your password to access the manager dashboard
            </p>

            <!-- Login Form -->
            <v-form @submit.prevent="handleLogin">
              <v-text-field
                v-model="password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="showPassword = !showPassword"
                placeholder="Enter manager password"
                :disabled="isLoading"
                :error-messages="error"
                required
                class="mb-4"
                autofocus
              />

              <v-btn
                type="submit"
                color="primary"
                size="large"
                :loading="isLoading"
                :disabled="!password"
                block
                class="text-none font-weight-bold mb-4"
              >
                {{ isLoading ? 'Logging in...' : 'Login' }}
              </v-btn>
            </v-form>

            <!-- Back Link -->
            <v-row justify="center">
              <v-btn
                to="/"
                variant="text"
                color="primary"
                prepend-icon="mdi-arrow-left"
                class="text-none"
              >
                Back to Home
              </v-btn>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Demo Info -->
        <v-card class="mt-4" variant="tonal" color="info">
          <v-card-text class="pa-4">
            <v-row align="center">
              <v-col cols="auto">
                <v-icon color="info">mdi-information</v-icon>
              </v-col>
              <v-col>
                <p class="text-body-2 mb-0">
                  <strong>Demo Password:</strong> RideManager2024
                </p>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
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