import type { Round } from './round';
import type { Document } from './document';

export type DossierStatus = 'open' | 'in_progress' | 'completed' | 'closed';

export interface Dossier {
  id: string;
  name: string;
  company_name: string;
  company_number: string | null;
  tax_type: string;
  tax_year: string;
  reference: string | null;
  controller_name: string | null;
  controller_email: string | null;
  status: DossierStatus;
  notes: string | null;
  system_prompt: string | null;
  created_at: string;
  updated_at: string;
  rounds?: Round[];
  documents?: Document[];
}

export interface CreateDossierDto {
  name: string;
  company_name: string;
  company_number?: string;
  tax_type: string;
  tax_year: string;
  reference?: string;
  controller_name?: string;
  controller_email?: string;
  status?: DossierStatus;
  notes?: string;
  system_prompt?: string;
}

export type UpdateDossierDto = Partial<CreateDossierDto>;
