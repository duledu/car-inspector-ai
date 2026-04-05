// =============================================================================
// Chat Store — Zustand
// Conversations, messages, unread counts, and real-time socket state.
// =============================================================================

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Conversation, Message, SendMessagePayload } from '@/types'
import { messagingApi } from '@/services/api/messaging.api'

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, Message[]> // conversationId → messages
  totalUnread: number
  isLoadingConversations: boolean
  isLoadingMessages: boolean
  isSending: boolean
  error: string | null
}

interface ChatActions {
  fetchConversations: () => Promise<void>
  setActiveConversation: (id: string) => void
  fetchMessages: (conversationId: string) => Promise<void>
  sendMessage: (payload: SendMessagePayload) => Promise<void>
  receiveMessage: (message: Message) => void // called by WebSocket handler
  startConversation: (recipientId: string) => Promise<Conversation>
  markAsRead: (conversationId: string) => Promise<void>
  getConversation: (id: string) => Conversation | undefined
  getMessages: (conversationId: string) => Message[]
}

type ChatStore = ChatState & ChatActions

export const useChatStore = create<ChatStore>()(
  immer((set, get) => ({
    // ─── State ────────────────────────────────────────────────────────────────
    conversations: [],
    activeConversationId: null,
    messages: {},
    totalUnread: 0,
    isLoadingConversations: false,
    isLoadingMessages: false,
    isSending: false,
    error: null,

    // ─── Actions ──────────────────────────────────────────────────────────────

    fetchConversations: async () => {
      set((state) => { state.isLoadingConversations = true })
      try {
        const conversations = await messagingApi.getConversations()
        set((state) => {
          state.conversations = conversations
          state.totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)
          state.isLoadingConversations = false
        })
      } catch (err: any) {
        set((state) => { state.isLoadingConversations = false; state.error = err.message })
      }
    },

    setActiveConversation: (id) => {
      set((state) => { state.activeConversationId = id })
      // Mark as read when conversation is opened
      get().markAsRead(id)
    },

    fetchMessages: async (conversationId) => {
      set((state) => { state.isLoadingMessages = true })
      try {
        const messages = await messagingApi.getMessages(conversationId)
        set((state) => {
          state.messages[conversationId] = messages
          state.isLoadingMessages = false
        })
      } catch (err: any) {
        set((state) => { state.isLoadingMessages = false; state.error = err.message })
      }
    },

    sendMessage: async (payload) => {
      set((state) => { state.isSending = true })
      try {
        const message = await messagingApi.sendMessage(payload)
        set((state) => {
          const msgs = state.messages[payload.conversationId] ?? []
          msgs.push(message)
          state.messages[payload.conversationId] = msgs
          // Update last message in conversation list
          const conv = state.conversations.find((c) => c.id === payload.conversationId)
          if (conv) conv.lastMessage = message
          state.isSending = false
        })
      } catch (err: any) {
        set((state) => { state.isSending = false; state.error = err.message })
        throw err
      }
    },

    // Called by the WebSocket event handler — no API call needed
    receiveMessage: (message) => {
      set((state) => {
        const msgs = state.messages[message.conversationId] ?? []
        // Deduplicate
        if (!msgs.find((m) => m.id === message.id)) {
          msgs.push(message)
          state.messages[message.conversationId] = msgs
        }
        // Update conversation preview
        const conv = state.conversations.find((c) => c.id === message.conversationId)
        if (conv) {
          conv.lastMessage = message
          const isActive = state.activeConversationId === message.conversationId
          if (!isActive) {
            conv.unreadCount += 1
            state.totalUnread += 1
          }
        }
      })
    },

    startConversation: async (recipientId) => {
      const conv = await messagingApi.createConversation(recipientId)
      set((state) => {
        const existing = state.conversations.find((c) => c.id === conv.id)
        if (!existing) state.conversations.unshift(conv)
        state.activeConversationId = conv.id
      })
      return conv
    },

    markAsRead: async (conversationId) => {
      set((state) => {
        const conv = state.conversations.find((c) => c.id === conversationId)
        if (conv) {
          state.totalUnread = Math.max(0, state.totalUnread - conv.unreadCount)
          conv.unreadCount = 0
        }
        // Mark all messages in this conversation as read locally
        const msgs = state.messages[conversationId]
        if (msgs) {
          msgs.forEach((m) => {
            if (!m.readAt) m.readAt = new Date().toISOString()
          })
        }
      })
      try {
        await messagingApi.markRead(conversationId)
      } catch {
        // Non-critical — ignore
      }
    },

    getConversation: (id) => {
      return get().conversations.find((c) => c.id === id)
    },

    getMessages: (conversationId) => {
      return get().messages[conversationId] ?? []
    },
  }))
)
