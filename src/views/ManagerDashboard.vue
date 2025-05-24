<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const sessionStore = useSessionStore()
const authStore = useAuthStore()

const showCreateModal = ref(false)

// Set manager flag when accessing dashboard
sessionStore.isManager = true

const hasActiveSession = computed(() => {
  return sessionStore.currentSession && sessionStore.currentSession.isActive
})

function createNewSession() {
  const session = sessionStore.createSession(authStore.managerId!)
  showCreateModal.value = true
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
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h1>Manager Dashboard</h1>
      <button @click="logout" class="logout-button">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
        </svg>
        Logout
      </button>
    </header>

    <main class="dashboard-main">
      <!-- Active Session Card -->
      <div v-if="hasActiveSession" class="session-card active">
        <div class="session-header">
          <h2>Active Session</h2>
          <span class="status-badge active">Live</span>
        </div>
        
        <div class="session-info">
          <div class="info-item">
            <span class="label">Session PIN</span>
            <div class="pin-display">
              <span class="pin">{{ sessionStore.currentSession?.pin }}</span>
              <button @click="copyPin" class="copy-button" title="Copy PIN">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="info-item">
            <span class="label">Participants</span>
            <span class="value">{{ sessionStore.activeParticipants.length }} active</span>
          </div>
        </div>

        <div class="session-actions">
          <button @click="goToMap" class="action-button primary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            View Map
          </button>
          <button @click="sessionStore.endSession" class="action-button danger">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            End Session
          </button>
        </div>
      </div>

      <!-- No Active Session -->
      <div v-else class="no-session">
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <h2>No Active Session</h2>
          <p>Create a new session to start managing routes and tracking participants</p>
          <button @click="createNewSession" class="create-button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Create New Session
          </button>
        </div>
      </div>
    </main>

    <!-- Create Session Modal -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal">
          <div class="modal-header">
            <h2>Session Created!</h2>
            <button @click="showCreateModal = false" class="close-button">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            <p>Share this PIN with participants:</p>
            <div class="pin-large">{{ sessionStore.currentSession?.pin }}</div>
            <button @click="copyPin" class="copy-large">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
              Copy PIN
            </button>
          </div>
          
          <div class="modal-footer">
            <button @click="showCreateModal = false; goToMap()" class="modal-button">
              Go to Map
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background: #f7fafc;
}

.dashboard-header {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-header h1 {
  font-size: 1.5rem;
  color: #333;
}

.logout-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  color: #666;
  cursor: pointer;
  transition: all 0.3s ease;
}

.logout-button:hover {
  background: #f7fafc;
  color: #333;
  border-color: #cbd5e0;
}

.logout-button svg {
  width: 20px;
  height: 20px;
}

.dashboard-main {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.session-card {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.session-header h2 {
  font-size: 1.5rem;
  color: #333;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.status-badge.active {
  background: #d4f8e8;
  color: #065f46;
}

.session-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label {
  font-size: 0.875rem;
  color: #666;
  font-weight: 600;
}

.value {
  font-size: 1.25rem;
  color: #333;
}

.pin-display {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.pin {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.5rem;
  color: #667eea;
}

.copy-button {
  padding: 0.5rem;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.copy-button:hover {
  background: #e2e8f0;
}

.copy-button svg {
  width: 20px;
  height: 20px;
  color: #666;
}

.session-actions {
  display: flex;
  gap: 1rem;
}

.action-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-button svg {
  width: 20px;
  height: 20px;
}

.action-button.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.action-button.primary:hover {
  background: linear-gradient(135deg, #5a67d8 0%, #68428e 100%);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.action-button.danger {
  background: #fee;
  color: #c53030;
}

.action-button.danger:hover {
  background: #fed7d7;
}

.no-session {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.empty-state {
  text-align: center;
  max-width: 400px;
}

.empty-state svg {
  width: 100px;
  height: 100px;
  color: #cbd5e0;
  margin-bottom: 2rem;
}

.empty-state h2 {
  font-size: 1.5rem;
  color: #333;
  margin-bottom: 1rem;
}

.empty-state p {
  color: #666;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.create-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.create-button:hover {
  background: linear-gradient(135deg, #5a67d8 0%, #68428e 100%);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.create-button svg {
  width: 24px;
  height: 24px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 1rem;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 1.5rem;
  color: #333;
}

.close-button {
  padding: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  transition: color 0.3s ease;
}

.close-button:hover {
  color: #333;
}

.close-button svg {
  width: 24px;
  height: 24px;
}

.modal-body {
  padding: 2rem;
  text-align: center;
}

.modal-body p {
  color: #666;
  margin-bottom: 1.5rem;
}

.pin-large {
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: 1rem;
  color: #667eea;
  margin-bottom: 1.5rem;
}

.copy-large {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #f7fafc;
  border: 2px solid #e2e8f0;
  border-radius: 0.5rem;
  font-weight: 600;
  color: #333;
  cursor: pointer;
  transition: all 0.3s ease;
}

.copy-large:hover {
  background: #e2e8f0;
}

.copy-large svg {
  width: 20px;
  height: 20px;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: center;
}

.modal-button {
  padding: 0.75rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.modal-button:hover {
  background: linear-gradient(135deg, #5a67d8 0%, #68428e 100%);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

@media (max-width: 768px) {
  .session-info {
    grid-template-columns: 1fr;
  }

  .session-actions {
    flex-direction: column;
  }

  .pin {
    font-size: 1.5rem;
    letter-spacing: 0.25rem;
  }

  .pin-large {
    font-size: 2rem;
    letter-spacing: 0.5rem;
  }
}
</style> 