// Background Sync Service
// Handles communication with service worker for background updates

interface LocationUpdate {
  sessionId: string
  participantId: string
  location: { lat: number; lng: number }
  timestamp: number
}

interface NotificationPayload {
  title: string
  body: string
  tag?: string
  data?: any
  requireInteraction?: boolean
}

class BackgroundSyncService {
  private serviceWorker: ServiceWorker | null = null
  private isSupported = false

  constructor() {
    this.initialize()
  }

  private async initialize() {
    // Check if service workers are supported
    if ('serviceWorker' in navigator) {
      try {
        // Wait for service worker to be ready
        const registration = await navigator.serviceWorker.ready
        this.serviceWorker = registration.active
        this.isSupported = true

        console.log('✅ Background sync service initialized')

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage)

        // Request notification permissions
        await this.requestNotificationPermission()
      } catch (error) {
        console.error('❌ Failed to initialize background sync:', error)
        this.isSupported = false
      }
    } else {
      console.log('Service workers not supported')
      this.isSupported = false
    }
  }

  // Check if background sync is supported and available
  isBackgroundSyncSupported(): boolean {
    return this.isSupported && 'sync' in window.ServiceWorkerRegistration.prototype
  }

  // Check if push notifications are supported
  isPushNotificationSupported(): boolean {
    return this.isSupported && 'PushManager' in window
  }

  // Queue location update for background sync
  async queueLocationUpdate(update: LocationUpdate): Promise<boolean> {
    if (!this.isSupported || !this.serviceWorker) {
      console.log('Background sync not available, update will be lost if offline')
      return false
    }

    try {
      // Add timestamp if not provided
      const updateWithTimestamp = {
        ...update,
        timestamp: update.timestamp || Date.now(),
      }

      // Send to service worker
      this.serviceWorker.postMessage({
        type: 'QUEUE_LOCATION_UPDATE',
        data: updateWithTimestamp,
      })

      console.log('📤 Location update queued for background sync')
      return true
    } catch (error) {
      console.error('❌ Failed to queue location update:', error)
      return false
    }
  }

  // Get queue status from service worker
  async getQueueStatus(): Promise<{ queueLength: number } | null> {
    if (!this.isSupported || !this.serviceWorker) {
      return null
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel()

      channel.port1.onmessage = (event) => {
        if (event.data.type === 'QUEUE_STATUS') {
          resolve({ queueLength: event.data.queueLength })
        }
      }

      this.serviceWorker!.postMessage({ type: 'GET_QUEUE_STATUS' }, [channel.port2])

      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000)
    })
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.log('Notifications not supported')
      return 'denied'
    }

    if (Notification.permission === 'granted') {
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      return 'denied'
    }

    // Request permission
    const permission = await Notification.requestPermission()
    console.log('📱 Notification permission:', permission)

    return permission
  }

  // Show local notification
  async showNotification(payload: NotificationPayload): Promise<boolean> {
    const permission = await this.requestNotificationPermission()

    if (permission !== 'granted') {
      console.log('❌ Notification permission denied')
      return false
    }

    try {
      if (this.serviceWorker) {
        // Use service worker to show notification (persists when app is closed)
        const registration = await navigator.serviceWorker.ready
        await registration.showNotification(payload.title, {
          body: payload.body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: payload.tag || 'ridemapper',
          requireInteraction: payload.requireInteraction || false,
          data: payload.data || {},
        })
      } else {
        // Fallback to regular notification
        new Notification(payload.title, {
          body: payload.body,
          icon: '/pwa-192x192.png',
          tag: payload.tag || 'ridemapper',
          data: payload.data || {},
        })
      }

      console.log('📱 Notification shown:', payload.title)
      return true
    } catch (error) {
      console.error('❌ Failed to show notification:', error)
      return false
    }
  }

  // Handle messages from service worker
  private handleServiceWorkerMessage = (event: MessageEvent) => {
    const { type, data } = event.data

    switch (type) {
      case 'BACKGROUND_SYNC_SUCCESS':
        console.log('✅ Background sync completed successfully')
        // Emit custom event for other parts of the app
        window.dispatchEvent(new CustomEvent('backgroundSyncSuccess', { detail: data }))
        break

      case 'BACKGROUND_SYNC_FAILED':
        console.log('❌ Background sync failed')
        window.dispatchEvent(new CustomEvent('backgroundSyncFailed', { detail: data }))
        break

      default:
        console.log('Service worker message:', type, data)
    }
  }

  // Check if app is currently visible
  isAppVisible(): boolean {
    return document.visibilityState === 'visible'
  }

  // Listen for app visibility changes
  onVisibilityChange(callback: (isVisible: boolean) => void) {
    document.addEventListener('visibilitychange', () => {
      callback(this.isAppVisible())
    })
  }

  // Get connection status
  isOnline(): boolean {
    return navigator.onLine
  }

  // Listen for connection changes
  onConnectionChange(callback: (isOnline: boolean) => void) {
    window.addEventListener('online', () => callback(true))
    window.addEventListener('offline', () => callback(false))
  }
}

// Export singleton instance
export const backgroundSyncService = new BackgroundSyncService()
export type { LocationUpdate, NotificationPayload }
