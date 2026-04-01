export interface AssistantChatResponse {
  sessionId: string
  message: string
  citations: string[]
  actions: Array<Record<string, unknown>>
}

export interface AssistantSuggestion {
  title: string
  prompt: string
}

export interface AssistantSuggestionsResponse {
  suggestions: AssistantSuggestion[]
}

export interface AssistantActionQueryResponse {
  action: string
  result: string
}

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}
