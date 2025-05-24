<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <v-app>
    <v-main>
      <RouterView />
    </v-main>
  </v-app>
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
