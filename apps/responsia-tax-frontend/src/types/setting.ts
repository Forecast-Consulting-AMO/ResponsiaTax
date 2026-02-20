export interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertSettingDto {
  value: string;
  description?: string;
}
