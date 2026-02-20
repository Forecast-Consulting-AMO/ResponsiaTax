import { AXIOS_INSTANCE } from './mutator';
import type { LlmModel, LlmMessage, ChatRequest, ChatResponse } from '../types';

const BASE = '/api/v1/questions';

export const llmApi = {
  getModels: () =>
    AXIOS_INSTANCE.get<LlmModel[]>('/api/v1/llm/models').then((r) => r.data),

  chat: (questionId: string, request: ChatRequest) =>
    AXIOS_INSTANCE.post<ChatResponse>(
      `${BASE}/${questionId}/chat`,
      request,
    ).then((r) => r.data),

  getMessages: (questionId: string) =>
    AXIOS_INSTANCE.get<LlmMessage[]>(`${BASE}/${questionId}/messages`).then(
      (r) => r.data,
    ),

  clearMessages: (questionId: string) =>
    AXIOS_INSTANCE.delete(`${BASE}/${questionId}/messages`),
};
