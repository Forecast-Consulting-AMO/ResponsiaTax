import type { LlmMessage } from './llm';

export type QuestionStatus = 'pending' | 'drafting' | 'reviewed' | 'approved';

export interface Question {
  id: string;
  round_id: string;
  question_number: number;
  question_text: string;
  response_text: string | null;
  status: QuestionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  messages?: LlmMessage[];
}

export interface CreateQuestionDto {
  question_number: number;
  question_text: string;
  response_text?: string;
  status?: QuestionStatus;
  notes?: string;
}

export type UpdateQuestionDto = Partial<CreateQuestionDto>;
