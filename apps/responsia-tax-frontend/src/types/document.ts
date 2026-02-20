export type DocType = 'question_dr' | 'support' | 'response_draft' | 'other';

export interface Document {
  id: string;
  dossier_id: string;
  round_id: string | null;
  doc_type: DocType;
  filename: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  ocr_text: string | null;
  ocr_pages_json: Record<string, unknown> | null;
  created_at: string;
}
