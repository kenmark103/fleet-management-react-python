import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { ApiResponse } from '../types/api'
import type {
  AssistantActionQueryResponse,
  AssistantChatResponse,
  AssistantSuggestionsResponse,
} from '../types/assistant'

export const assistantKeys = {
  suggestions: ['assistant', 'suggestions'] as const,
}

export function useAssistantSuggestions() {
  return useQuery({
    queryKey: assistantKeys.suggestions,
    queryFn: () => api.get<ApiResponse<AssistantSuggestionsResponse>>('/api/v1/assistant/suggestions').then((r) => r.data.data),
    staleTime: 30 * 60 * 1000,
  })
}

export function useAssistantChat() {
  return useMutation({
    mutationFn: (payload: { message: string; sessionId?: string }) =>
      api
        .post<ApiResponse<AssistantChatResponse>>('/api/v1/assistant/chat', {
          message: payload.message,
          session_id: payload.sessionId,
        })
        .then((r) => r.data.data),
  })
}

export function useAssistantActionQuery() {
  return useMutation({
    mutationFn: (payload: { action: string; targetType?: string; targetId?: string; query?: string }) =>
      api
        .post<ApiResponse<AssistantActionQueryResponse>>('/api/v1/assistant/actions/query', {
          action: payload.action,
          target_type: payload.targetType,
          target_id: payload.targetId,
          query: payload.query,
        })
        .then((r) => r.data.data),
  })
}
