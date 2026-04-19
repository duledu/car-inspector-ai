import { apiClient } from './client'
import type { AppAnnouncementContent, MarketingCampaignContent } from '@/lib/email/types/email-template.types'
import type { RecipientMode } from '@/lib/admin/bulk-email-sender'
import type { ApiResponse } from '@/types'

interface UserStats {
  total:      number
  verified:   number
  unverified: number
}

interface RecentUser {
  id:            string
  email:         string
  name:          string
  emailVerified: string | null
  createdAt:     string
  role:          string
}

export interface BulkSendResult {
  dbUsers:      number
  manualEmails: number
  valid:        number
  sent:         number
  failed:       number
}

export const adminApi = {
  // ─── Announcement (App Update) ───────────────────────────────────────────────

  getAnnouncement: async (): Promise<AppAnnouncementContent> => {
    const { data } = await apiClient.get<ApiResponse<AppAnnouncementContent>>('/admin/announcement')
    return data.data
  },

  saveAnnouncement: async (content: AppAnnouncementContent): Promise<AppAnnouncementContent> => {
    const { data } = await apiClient.put<ApiResponse<AppAnnouncementContent>>('/admin/announcement', { content })
    return data.data
  },

  previewAnnouncement: async (content: AppAnnouncementContent): Promise<string> => {
    const { data } = await apiClient.post<ApiResponse<{ html: string }>>('/admin/announcement/preview', { content })
    return data.data.html
  },

  sendAnnouncementTest: async (content: AppAnnouncementContent, testEmail?: string): Promise<{ sentTo: string }> => {
    const { data } = await apiClient.post<ApiResponse<{ success: boolean; sentTo: string }>>(
      '/admin/announcement/send-test',
      { content, testEmail }
    )
    return data.data
  },

  sendAnnouncementToAll: async (
    content: AppAnnouncementContent,
    manualEmails: string[],
    recipientMode: RecipientMode
  ): Promise<BulkSendResult> => {
    const { data } = await apiClient.post<ApiResponse<BulkSendResult>>(
      '/admin/announcement/send-all',
      { content, confirmed: true, manualEmails, recipientMode }
    )
    return data.data
  },

  // ─── Marketing Campaign ──────────────────────────────────────────────────────

  getMarketing: async (): Promise<MarketingCampaignContent> => {
    const { data } = await apiClient.get<ApiResponse<MarketingCampaignContent>>('/admin/marketing')
    return data.data
  },

  saveMarketing: async (content: MarketingCampaignContent): Promise<MarketingCampaignContent> => {
    const { data } = await apiClient.put<ApiResponse<MarketingCampaignContent>>('/admin/marketing', { content })
    return data.data
  },

  previewMarketing: async (content: MarketingCampaignContent): Promise<string> => {
    const { data } = await apiClient.post<ApiResponse<{ html: string }>>('/admin/marketing/preview', { content })
    return data.data.html
  },

  sendMarketingTest: async (content: MarketingCampaignContent, testEmail?: string): Promise<{ sentTo: string }> => {
    const { data } = await apiClient.post<ApiResponse<{ success: boolean; sentTo: string }>>(
      '/admin/marketing/send-test',
      { content, testEmail }
    )
    return data.data
  },

  sendMarketingToAll: async (
    content: MarketingCampaignContent,
    manualEmails: string[],
    recipientMode: RecipientMode
  ): Promise<BulkSendResult> => {
    const { data } = await apiClient.post<ApiResponse<BulkSendResult>>(
      '/admin/marketing/send-all',
      { content, confirmed: true, manualEmails, recipientMode }
    )
    return data.data
  },

  // ─── Users ───────────────────────────────────────────────────────────────────

  getUserStats: async (): Promise<{ stats: UserStats; recentUsers: RecentUser[] }> => {
    const { data } = await apiClient.get<ApiResponse<{ stats: UserStats; recentUsers: RecentUser[] }>>('/admin/users')
    return data.data
  },
}
