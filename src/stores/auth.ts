import { defineStore } from 'pinia'
import { ref } from 'vue'

// In a real app, this would be handled by a backend
const MANAGER_PASSWORD = 'RideManager2024'

// Fallback UUID generator for better browser compatibility
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback for browsers that don't support crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const managerId = ref<string | null>(null)

  function login(password: string): boolean {
    if (password === MANAGER_PASSWORD) {
      isAuthenticated.value = true
      managerId.value = generateUUID()
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
    checkAuth,
  }
})
