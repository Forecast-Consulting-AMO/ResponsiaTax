import { AXIOS_INSTANCE } from './mutator';
import type { Setting, UpsertSettingDto } from '../types';

const BASE = '/api/v1/settings';

export const settingsApi = {
  findAll: () =>
    AXIOS_INSTANCE.get<Setting[]>(BASE).then((r) => r.data),

  findOne: (key: string) =>
    AXIOS_INSTANCE.get<Setting>(`${BASE}/${key}`).then((r) => r.data),

  upsert: (key: string, dto: UpsertSettingDto) =>
    AXIOS_INSTANCE.put<Setting>(`${BASE}/${key}`, dto).then((r) => r.data),

  remove: (key: string) => AXIOS_INSTANCE.delete(`${BASE}/${key}`),
};
