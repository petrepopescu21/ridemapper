import { defineStore } from 'pinia'
import { ref } from 'vue'

// In a real app, this would be handled by a backend
const MANAGER_PASSWORD = 'RideManager2024'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const managerId = ref<string | null>(null)

  function login(password: string): boolean {
    if (password === MANAGER_PASSWORD) {
      isAuthenticated.value = true
      managerId.value = crypto.randomUUID()
      // Store in sessionStorage for persistence during session
      sessionStorage.setItem('managerId', managerId.value)
      sessionStorage.setItem('isAuthenticated', 'true')
      return true
    }
    return false
  }

  function logout() {
    isAuthenticated.value = false
    managerId.value = null
    sessionStorage.removeItem('managerId')
    sessionStorage.removeItem('isAuthenticated')
  }

  function checkAuth() {
    const storedAuth = sessionStorage.getItem('isAuthenticated')
    const storedManagerId = sessionStorage.getItem('managerId')
    
    if (storedAuth === 'true' && storedManagerId) {
      isAuthenticated.value = true
      managerId.value = storedManagerId
    }
  }

  return {
    isAuthenticated,
    managerId,
    login,
    logout,
    checkAuth
  }
}) 