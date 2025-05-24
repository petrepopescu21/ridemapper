import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Message {
  id: string
  from: string
  to: string
  content: string
  timestamp: number
  read: boolean
}

export const useMessagesStore = defineStore('messages', () => {
  const messages = ref<Map<string, Message[]>>(new Map())
  const unreadCount = ref<Map<string, number>>(new Map())

  function sendMessage(from: string, to: string, content: string) {
    const message: Message = {
      id: crypto.randomUUID(),
      from,
      to,
      content,
      timestamp: Date.now(),
      read: false
    }

    // Store messages by participant ID
    if (!messages.value.has(to)) {
      messages.value.set(to, [])
    }
    messages.value.get(to)!.push(message)

    // Update unread count
    unreadCount.value.set(to, (unreadCount.value.get(to) || 0) + 1)

    return message
  }

  function getMessages(participantId: string): Message[] {
    return messages.value.get(participantId) || []
  }

  function markAsRead(participantId: string) {
    const participantMessages = messages.value.get(participantId)
    if (participantMessages) {
      participantMessages.forEach(msg => {
        msg.read = true
      })
    }
    unreadCount.value.set(participantId, 0)
  }

  function clearMessages() {
    messages.value.clear()
    unreadCount.value.clear()
  }

  return {
    messages,
    unreadCount,
    sendMessage,
    getMessages,
    markAsRead,
    clearMessages
  }
}) 