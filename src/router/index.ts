import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/session'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/manager-login',
      name: 'manager-login',
      component: () => import('../views/ManagerLogin.vue'),
    },
    {
      path: '/join',
      name: 'join',
      component: () => import('../views/JoinSession.vue'),
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('../views/MapView.vue'),
      beforeEnter: (to, from, next) => {
        const authStore = useAuthStore()
        const sessionStore = useSessionStore()

        // Allow access if user is either an authenticated manager or a participant
        if (authStore.isAuthenticated || sessionStore.currentParticipantId) {
          next()
        } else {
          next('/')
        }
      },
    },
    {
      path: '/manager-dashboard',
      name: 'manager-dashboard',
      component: () => import('../views/ManagerDashboard.vue'),
      beforeEnter: (to, from, next) => {
        const authStore = useAuthStore()

        if (authStore.isAuthenticated) {
          next()
        } else {
          next('/manager-login')
        }
      },
    },
    {
      path: '/maps',
      name: 'maps',
      component: () => import('../views/MapsManagement.vue'),
      beforeEnter: (to, from, next) => {
        const authStore = useAuthStore()

        if (authStore.isAuthenticated) {
          next()
        } else {
          next('/manager-login')
        }
      },
    },
  ],
})

export default router
