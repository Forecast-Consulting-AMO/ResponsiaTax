/**
 * HTTP client wrapping the ResponsiaTax REST API (v1).
 * Uses native fetch — no external HTTP dependency.
 */

// ---- Response types (minimal, matching API shapes) ----

export interface Dossier {
  id: string;
  name: string;
  company_name: string;
  tax_type: string;
  tax_year: string;
  reference: string | null;
  status: string;
  notes: string | null;
  rounds_count?: number;
  documents_count?: number;
  created_at: string;
}

export interface Round {
  id: string;
  dossier_id: string;
  round_number: number;
  received_date: string | null;
  deadline: string | null;
  status: string;
  questions?: Question[];
}

export interface Question {
  id: string;
  round_id: string;
  question_number: number;
  question_text: string;
  response_text: string | null;
  status: string;
  notes: string | null;
  messages?: LlmMessage[];
}

export interface Document {
  id: string;
  dossier_id: string;
  round_id: string | null;
  doc_type: string;
  filename: string;
  mime_type: string;
  file_size: number;
  ocr_text: string | null;
  created_at: string;
}

export interface LlmMessage {
  id: string;
  role: string;
  content: string;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

export interface ChunkResult {
  id: string;
  content: string;
  section_title: string | null;
  filename: string;
  doc_type: string;
  score: number;
}

export interface ChatResponse {
  id: string;
  content: string;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface ModelDef {
  id: string;
  name: string;
  provider: string;
}

// ---- Client ----

export class ResponsiaTaxClient {
  private readonly base: string;

  constructor(baseUrl: string) {
    this.base = baseUrl.replace(/\/+$/, '');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.base}/v1/${path.replace(/^\/+/, '')}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string>),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${res.status} ${res.statusText}: ${body}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  // ---- Dossiers ----

  async listDossiers(status?: string): Promise<{ data: Dossier[]; total: number }> {
    const qs = status ? `?status=${encodeURIComponent(status)}&limit=100` : '?limit=100';
    return this.request(`dossiers${qs}`);
  }

  async getDossier(id: string): Promise<Dossier> {
    return this.request(`dossiers/${id}`);
  }

  // ---- Rounds ----

  async listRounds(dossierId: string): Promise<Round[]> {
    return this.request(`dossiers/${dossierId}/rounds`);
  }

  async getRound(id: string): Promise<Round> {
    return this.request(`rounds/${id}`);
  }

  // ---- Questions ----

  async listQuestions(roundId: string): Promise<Question[]> {
    return this.request(`rounds/${roundId}/questions`);
  }

  async getQuestion(id: string): Promise<Question> {
    return this.request(`questions/${id}`);
  }

  async updateQuestion(id: string, data: { response_text?: string; status?: string }): Promise<Question> {
    return this.request(`questions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ---- Documents ----

  async listDocuments(dossierId: string, roundId?: string): Promise<Document[]> {
    const qs = roundId ? `?round_id=${roundId}` : '';
    return this.request(`dossiers/${dossierId}/documents${qs}`);
  }

  async uploadDocument(
    dossierId: string,
    filePath: string,
    docType = 'support',
    roundId?: string,
  ): Promise<Document> {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const fileBuffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);

    // Build multipart form data manually (no external deps)
    const boundary = `----MCPBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    // File part
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
    ));
    parts.push(fileBuffer);
    parts.push(Buffer.from('\r\n'));

    // doc_type part
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="doc_type"\r\n\r\n` +
      `${docType}\r\n`,
    ));

    // round_id part (optional)
    if (roundId) {
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="round_id"\r\n\r\n` +
        `${roundId}\r\n`,
      ));
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    const url = `${this.base}/v1/dossiers/${dossierId}/documents`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Upload failed ${res.status}: ${text}`);
    }
    return res.json() as Promise<Document>;
  }

  async triggerOcr(docId: string): Promise<{ id: string; ocr_text_length: number; pages: number; chunks_created: number }> {
    return this.request(`documents/${docId}/ocr`, { method: 'POST' });
  }

  async getChunkCount(dossierId: string): Promise<{ chunk_count: number }> {
    return this.request(`dossiers/${dossierId}/chunks/count`);
  }

  // ---- Search (RAG) ----

  async searchChunks(
    dossierId: string,
    query: string,
    topK = 10,
    documentIds?: string[],
  ): Promise<ChunkResult[]> {
    const params = new URLSearchParams({ q: query, top_k: String(topK) });
    if (documentIds?.length) {
      params.set('document_ids', documentIds.join(','));
    }
    return this.request(`dossiers/${dossierId}/search?${params}`);
  }

  // ---- Chat ----

  async chat(
    questionId: string,
    message: string,
    model: string,
    opts?: { autoApplyToResponse?: boolean; includeDocuments?: boolean; documentIds?: string[] },
  ): Promise<ChatResponse> {
    return this.request(`questions/${questionId}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        model,
        autoApplyToResponse: opts?.autoApplyToResponse ?? false,
        includeDocuments: opts?.includeDocuments ?? true,
        documentIds: opts?.documentIds,
      }),
    });
  }

  async getMessages(questionId: string): Promise<LlmMessage[]> {
    return this.request(`questions/${questionId}/messages`);
  }

  async clearMessages(questionId: string): Promise<void> {
    await this.request(`questions/${questionId}/messages`, { method: 'DELETE' });
  }

  // ---- Export ----

  async exportRound(roundId: string): Promise<Buffer> {
    const url = `${this.base}/v1/rounds/${roundId}/export`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Export failed ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ---- Models ----

  async listModels(): Promise<ModelDef[]> {
    return this.request('llm/models');
  }
}
