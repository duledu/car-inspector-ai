// =============================================================================
// Messaging API Service
// =============================================================================

import { apiClient } from './client'
import type { Conversation, Message, SendMessagePayload, ApiResponse } from '@/types'

export const messagingApi = {
  getConversations: async (): Promise<Conversation[]> => {
    const { data } = await apiClient.get<ApiResponse<Conversation[]>>('/messaging/conversations')
    return data.data
  },

  createConversation: async (recipientId: string): Promise<Conversation> => {
    const { data } = await apiClient.post<ApiResponse<Conversation>>(
      '/messaging/conversations',
      { recipientId }
    )
    return data.data
  },

  getMessages: async (conversationId: string, cursor?: string): Promise<Message[]> => {
    const params = cursor ? `?cursor=${cursor}` : ''
    const { data } = await apiClient.get<ApiResponse<Message[]>>(
      `/messaging/conversations/${conversationId}/messages${params}`
    )
    return data.data
  },

  sendMessage: async (payload: SendMessagePayload): Promise<Message> => {
    const { data } = await apiClient.post<ApiResponse<Message>>(
      `/messaging/conversations/${payload.conversationId}/messages`,
      payload
    )
    return data.data
  },

  markRead: async (conversationId: string): Promise<void> => {
    await apiClient.patch(`/messaging/conversations/${conversationId}/read`)
  },
}
