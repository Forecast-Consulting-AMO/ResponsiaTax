import { AXIOS_INSTANCE } from './mutator';
import type { LlmModel, LlmMessage, ChatRequest, ChatResponse } from '../types';

const BASE = '/api/v1/questions';

export interface StreamDoneResponse extends ChatResponse {
  id: string;
}

export const llmApi = {
  getModels: () =>
    AXIOS_INSTANCE.get<LlmModel[]>('/api/v1/llm/models').then((r) => r.data),

  chat: (questionId: string, request: ChatRequest) =>
    AXIOS_INSTANCE.post<ChatResponse>(
      `${BASE}/${questionId}/chat`,
      request,
    ).then((r) => r.data),

  chatStream: (
    questionId: string,
    body: ChatRequest,
    onDelta: (text: string) => void,
    onDone: (response: StreamDoneResponse) => void,
    onError?: (error: string) => void,
  ): AbortController => {
    const controller = new AbortController();

    const baseURL = AXIOS_INSTANCE.defaults.baseURL || '';
    fetch(`${baseURL}${BASE}/${questionId}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          onError?.(text || `HTTP ${response.status}`);
          return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) return;

        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'delta') onDelta(data.content);
              else if (data.type === 'done') onDone(data);
              else if (data.type === 'error') onError?.(data.message);
            } catch {
              /* ignore parse errors */
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') onError?.(err.message);
      });

    return controller;
  },

  getMessages: (questionId: string) =>
    AXIOS_INSTANCE.get<LlmMessage[]>(`${BASE}/${questionId}/messages`).then(
      (r) => r.data,
    ),

  clearMessages: (questionId: string) =>
    AXIOS_INSTANCE.delete(`${BASE}/${questionId}/messages`),
};
