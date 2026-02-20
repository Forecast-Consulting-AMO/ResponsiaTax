import { AXIOS_INSTANCE } from './mutator';
import type { Dossier, CreateDossierDto, UpdateDossierDto } from '../types';

const BASE = '/api/v1/dossiers';

export const dossiersApi = {
  findAll: (status?: string) =>
    AXIOS_INSTANCE.get<Dossier[]>(BASE, {
      params: status ? { status } : {},
    }).then((r) => r.data),

  findOne: (id: string) =>
    AXIOS_INSTANCE.get<Dossier>(`${BASE}/${id}`).then((r) => r.data),

  create: (dto: CreateDossierDto) =>
    AXIOS_INSTANCE.post<Dossier>(BASE, dto).then((r) => r.data),

  update: (id: string, dto: UpdateDossierDto) =>
    AXIOS_INSTANCE.patch<Dossier>(`${BASE}/${id}`, dto).then((r) => r.data),

  remove: (id: string) => AXIOS_INSTANCE.delete(`${BASE}/${id}`),
};
