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
  <div class="home-container">
    <div class="hero">
      <h1 class="title">RideMapper</h1>
      <p class="subtitle">Real-time Route Management & Tracking</p>
    </div>

    <div class="action-cards">
      <div class="card manager-card" @click="goToManagerLogin">
        <div class="card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
        </div>
        <h2>Route Manager</h2>
        <p>Create and manage routes, monitor participants in real-time</p>
        <button class="btn btn-primary">Login as Manager</button>
      </div>

      <div class="card participant-card" @click="goToJoin">
        <div class="card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2c-4.97 0-9 4.03-9 9 0 5.52 7.5 11.67 7.78 11.9.14.12.31.18.47.18s.33-.06.47-.18C11.5 22.67 21 16.52 21 11c0-4.97-4.03-9-9-9zm0 2c3.86 0 7 3.14 7 7 0 3.73-4.84 8.44-7 10.31C9.84 19.44 5 14.73 5 11c0-3.86 3.14-7 7-7zm0 3c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
          </svg>
        </div>
        <h2>Participant</h2>
        <p>Join a route session and share your live location</p>
        <button class="btn btn-secondary">Join Session</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.hero {
  text-align: center;
  margin-bottom: 3rem;
  color: white;
}

.title {
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.subtitle {
  font-size: 1.25rem;
  opacity: 0.9;
}

.action-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  max-width: 800px;
  width: 100%;
}

.card {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  cursor: pointer;
  text-align: center;
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
}

.card-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: white;
}

.card-icon svg {
  width: 50px;
  height: 50px;
}

.manager-card .card-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.participant-card .card-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.card h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.card p {
  color: #666;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #5a67d8 0%, #68428e 100%);
  transform: scale(1.05);
}

.btn-secondary {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.btn-secondary:hover {
  background: linear-gradient(135deg, #e878f2 0%, #f23355 100%);
  transform: scale(1.05);
}

@media (max-width: 768px) {
  .title {
    font-size: 2.5rem;
  }

  .action-cards {
    grid-template-columns: 1fr;
  }
}
</style>
