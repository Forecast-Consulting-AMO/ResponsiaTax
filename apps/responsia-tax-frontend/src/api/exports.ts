import { AXIOS_INSTANCE } from './mutator';

const BASE = '/api/v1/rounds';

export const exportsApi = {
  exportDocx: (roundId: string) =>
    AXIOS_INSTANCE.get<Blob>(`${BASE}/${roundId}/export/docx`, {
      responseType: 'blob',
    }).then((r) => r.data),
};
