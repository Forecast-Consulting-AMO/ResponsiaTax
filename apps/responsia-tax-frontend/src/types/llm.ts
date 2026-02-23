export interface LlmModel {
  id: string;
  name: string;
  provider: string;
}

export interface LlmMessage {
  id: string;
  question_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  model: string;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

export interface ChatRequest {
  message: string;
  model: string;
  systemPrompt?: string;
  autoApplyToResponse?: boolean;
  includeDocuments?: boolean;
  documentIds?: string[];
}

export interface ChatResponse {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}
