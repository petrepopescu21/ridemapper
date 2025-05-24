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
  <div class="join-container">
    <div class="join-card">
      <button class="back-button" @click="goBack">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        Back
      </button>

      <div class="join-header">
        <div class="icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2c-4.97 0-9 4.03-9 9 0 5.52 7.5 11.67 7.78 11.9.14.12.31.18.47.18s.33-.06.47-.18C11.5 22.67 21 16.52 21 11c0-4.97-4.03-9-9-9zm0 2c3.86 0 7 3.14 7 7 0 3.73-4.84 8.44-7 10.31C9.84 19.44 5 14.73 5 11c0-3.86 3.14-7 7-7zm0 3c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
          </svg>
        </div>
        <h1>Join Session</h1>
        <p>Enter the session PIN to join the route</p>
      </div>

      <form @submit.prevent="handleJoin" class="join-form">
        <div class="form-group">
          <label for="pin">Session PIN</label>
          <input
            id="pin"
            v-model="pin"
            type="text"
            placeholder="Enter 6-digit PIN"
            maxlength="6"
            pattern="[0-9]{6}"
            required
            :disabled="isLoading"
          />
        </div>

        <div class="form-group">
          <label for="name">Your Name</label>
          <input
            id="name"
            v-model="name"
            type="text"
            placeholder="Enter your name"
            required
            :disabled="isLoading"
          />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <button type="submit" class="submit-button" :disabled="isLoading">
          <span v-if="!isLoading">Join Session</span>
          <span v-else>Joining...</span>
        </button>
      </form>

      <div class="info-section">
        <p>Ask your route manager for the session PIN</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.join-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.join-card {
  background: white;
  border-radius: 1rem;
  padding: 2.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
  position: relative;
}

.back-button {
  position: absolute;
  top: 1rem;
  left: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 0.875rem;
  transition: color 0.3s ease;
}

.back-button:hover {
  color: #333;
}

.back-button svg {
  width: 20px;
  height: 20px;
}

.join-header {
  text-align: center;
  margin-bottom: 2rem;
}

.icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border-radius: 50%;
  color: white;
}

.icon svg {
  width: 50px;
  height: 50px;
}

.join-header h1 {
  font-size: 1.75rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.join-header p {
  color: #666;
  font-size: 0.875rem;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #333;
  font-size: 0.875rem;
}

.form-group input {
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: #f7fafc;
}

.form-group input:focus {
  outline: none;
  border-color: #f093fb;
  background: white;
}

.form-group input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

#pin {
  text-align: center;
  font-size: 1.5rem;
  letter-spacing: 0.5rem;
  font-weight: 600;
}

.error-message {
  background: #fee;
  color: #c53030;
  padding: 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  text-align: center;
}

.submit-button {
  padding: 0.875rem 2rem;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.submit-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #e878f2 0%, #f23355 100%);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.info-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e2e8f0;
  text-align: center;
}

.info-section p {
  color: #666;
  font-size: 0.875rem;
}
</style> 