import { AXIOS_INSTANCE } from './mutator';
import type { Round, CreateRoundDto, UpdateRoundDto } from '../types';

const BASE = '/api/v1/dossiers';

export const roundsApi = {
  findAll: (dossierId: string) =>
    AXIOS_INSTANCE.get<Round[]>(`${BASE}/${dossierId}/rounds`).then(
      (r) => r.data,
    ),

  findOne: (id: string) =>
    AXIOS_INSTANCE.get<Round>(`/api/v1/rounds/${id}`).then((r) => r.data),

  create: (dossierId: string, dto: CreateRoundDto) =>
    AXIOS_INSTANCE.post<Round>(`${BASE}/${dossierId}/rounds`, dto).then(
      (r) => r.data,
    ),

  update: (id: string, dto: UpdateRoundDto) =>
    AXIOS_INSTANCE.patch<Round>(`/api/v1/rounds/${id}`, dto).then(
      (r) => r.data,
    ),

  remove: (id: string) => AXIOS_INSTANCE.delete(`/api/v1/rounds/${id}`),
};
