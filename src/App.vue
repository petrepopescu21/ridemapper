<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import { onMounted, ref } from 'vue'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const sessionStore = useSessionStore()
const isRecovering = ref(false)

onMounted(async () => {
  // Try to recover session on app load
  isRecovering.value = true
  
  try {
    const result = await sessionStore.recoverSession()
    
    if (result.success) {
      console.log('Session recovered successfully')
      // Redirect to map if session was recovered
      if (sessionStore.currentSession) {
        await router.push('/map')
      }
    } else {
      console.log('No session to recover:', result.error)
    }
  } catch (error) {
    console.error('Session recovery failed:', error)
  } finally {
    isRecovering.value = false
  }
})
</script>

<template>
  <div id="app">
    <!-- Loading overlay during session recovery -->
    <v-overlay
      v-model="isRecovering"
      persistent
      class="d-flex align-center justify-center"
    >
      <v-card class="pa-8 text-center" max-width="400">
        <v-progress-circular
          indeterminate
          size="64"
          color="primary"
          class="mb-4"
        />
        <h3 class="text-h6 mb-2">Recovering Session...</h3>
        <p class="text-body-2 text-medium-emphasis">
          Reconnecting to your active session
        </p>
      </v-card>
    </v-overlay>

    <RouterView />
  </div>
</template>

<style>
/* Minimal global styles - Vuetify handles the layout */
html, body {
  height: 100%;
  /* Prevent zoom on double-tap for mobile */
  touch-action: manipulation;
}

/* Allow text selection in form inputs and content areas */
input, textarea, [contenteditable] {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

/* PWA specific styles */
@media (display-mode: standalone) {
  body {
    /* Additional spacing for devices with notches */
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}

/* Custom gradient backgrounds for special components */
.gradient-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
}

.gradient-accent {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%) !important;
}
</style>
