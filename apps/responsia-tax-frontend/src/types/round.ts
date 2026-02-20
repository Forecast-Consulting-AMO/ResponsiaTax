import type { Question } from './question';
import type { Document } from './document';
import type { Dossier } from './dossier';

export type RoundStatus = 'pending' | 'in_progress' | 'responded' | 'closed';

export interface Round {
  id: string;
  dossier_id: string;
  round_number: number;
  received_date: string | null;
  deadline: string | null;
  status: RoundStatus;
  created_at: string;
  updated_at: string;
  questions?: Question[];
  documents?: Document[];
  dossier?: Dossier;
}

export interface CreateRoundDto {
  round_number: number;
  received_date?: string;
  deadline?: string;
  status?: RoundStatus;
}

export type UpdateRoundDto = Partial<CreateRoundDto>;
