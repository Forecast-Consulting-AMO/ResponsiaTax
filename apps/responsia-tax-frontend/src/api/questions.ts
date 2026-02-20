import { AXIOS_INSTANCE } from './mutator';
import type { Question, CreateQuestionDto, UpdateQuestionDto } from '../types';

const ROUNDS_BASE = '/api/v1/rounds';

export const questionsApi = {
  findAll: (roundId: string) =>
    AXIOS_INSTANCE.get<Question[]>(`${ROUNDS_BASE}/${roundId}/questions`).then(
      (r) => r.data,
    ),

  findOne: (id: string) =>
    AXIOS_INSTANCE.get<Question>(`/api/v1/questions/${id}`).then(
      (r) => r.data,
    ),

  create: (roundId: string, dto: CreateQuestionDto) =>
    AXIOS_INSTANCE.post<Question>(
      `${ROUNDS_BASE}/${roundId}/questions`,
      dto,
    ).then((r) => r.data),

  update: (id: string, dto: UpdateQuestionDto) =>
    AXIOS_INSTANCE.patch<Question>(`/api/v1/questions/${id}`, dto).then(
      (r) => r.data,
    ),

  remove: (id: string) => AXIOS_INSTANCE.delete(`/api/v1/questions/${id}`),

  extractQuestions: (documentId: string, roundId: string, model?: string) =>
    AXIOS_INSTANCE.post(
      `/api/v1/documents/${documentId}/extract-questions`,
      undefined,
      { params: { round_id: roundId, ...(model ? { model } : {}) } },
    ).then((r) => r.data),
};
