// =============================================================================
// Community API Service
// =============================================================================

import { apiClient } from './client'
import type { Post, Comment, CreatePostPayload, ApiResponse, PaginatedResponse } from '@/types'

export const communityApi = {
  getPosts: async (page = 1, tag?: string): Promise<PaginatedResponse<Post>> => {
    const params = new URLSearchParams({ page: String(page) })
    if (tag) params.set('tag', tag)
    const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Post>>>(
      `/community/posts?${params.toString()}`
    )
    return data.data
  },

  createPost: async (payload: CreatePostPayload): Promise<Post> => {
    const { data } = await apiClient.post<ApiResponse<Post>>('/community/posts', payload)
    return data.data
  },

  getPost: async (id: string): Promise<Post> => {
    const { data } = await apiClient.get<ApiResponse<Post>>(`/community/posts/${id}`)
    return data.data
  },

  deletePost: async (id: string): Promise<void> => {
    await apiClient.delete(`/community/posts/${id}`)
  },

  likePost: async (id: string): Promise<{ liked: boolean; count: number }> => {
    const { data } = await apiClient.post<ApiResponse<{ liked: boolean; count: number }>>(
      `/community/posts/${id}/like`
    )
    return data.data
  },

  getComments: async (postId: string): Promise<Comment[]> => {
    const { data } = await apiClient.get<ApiResponse<Comment[]>>(
      `/community/posts/${postId}/comments`
    )
    return data.data
  },

  addComment: async (postId: string, content: string): Promise<Comment> => {
    const { data } = await apiClient.post<ApiResponse<Comment>>(
      `/community/posts/${postId}/comments`,
      { content }
    )
    return data.data
  },
}
