import { AXIOS_INSTANCE } from './mutator';
import type { Document, DocType } from '../types';

const BASE = '/api/v1/dossiers';

export const documentsApi = {
  findAll: (dossierId: string, roundId?: string) =>
    AXIOS_INSTANCE.get<Document[]>(`${BASE}/${dossierId}/documents`, {
      params: roundId ? { round_id: roundId } : {},
    }).then((r) => r.data),

  findOne: (id: string) =>
    AXIOS_INSTANCE.get<Document>(`/api/v1/documents/${id}`).then(
      (r) => r.data,
    ),

  upload: async (
    dossierId: string,
    files: File[],
    docType: DocType,
    roundId?: string,
  ): Promise<Document[]> => {
    const results: Document[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', docType);
      if (roundId) {
        formData.append('round_id', roundId);
      }
      const doc = await AXIOS_INSTANCE.post<Document>(
        `${BASE}/${dossierId}/documents`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      ).then((r) => r.data);
      results.push(doc);
    }
    return results;
  },

  uploadBatch: async (
    dossierId: string,
    items: Array<{ file: File; docType: DocType }>,
    roundId?: string,
  ): Promise<Document[]> => {
    const results: Document[] = [];
    for (const { file, docType } of items) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', docType);
      if (roundId) {
        formData.append('round_id', roundId);
      }
      const doc = await AXIOS_INSTANCE.post<Document>(
        `${BASE}/${dossierId}/documents`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      ).then((r) => r.data);
      results.push(doc);
    }
    return results;
  },

  remove: (id: string) => AXIOS_INSTANCE.delete(`/api/v1/documents/${id}`),

  download: (id: string) =>
    AXIOS_INSTANCE.get<Blob>(`/api/v1/documents/${id}/download`, {
      responseType: 'blob',
    }).then((r) => r.data),

  triggerOcr: (id: string) =>
    AXIOS_INSTANCE.post<Document>(`/api/v1/documents/${id}/ocr`).then(
      (r) => r.data,
    ),
};
