import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { UpsertSettingDto } from './dto/upsert-setting.dto';

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
  ) {}

  async findAll(): Promise<Setting[]> {
    return this.settingRepo.find({ order: { key: 'ASC' } });
  }

  async findByKey(key: string): Promise<Setting> {
    const setting = await this.settingRepo.findOne({ where: { key } });
    if (!setting) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }
    return setting;
  }

  async upsert(key: string, dto: UpsertSettingDto): Promise<Setting> {
    let setting = await this.settingRepo.findOne({ where: { key } });
    if (setting) {
      setting.value = dto.value;
      if (dto.description !== undefined) {
        setting.description = dto.description;
      }
    } else {
      setting = this.settingRepo.create({
        key,
        value: dto.value,
        description: dto.description ?? null,
      });
    }
    return this.settingRepo.save(setting);
  }

  /** Helper for internal use: get a setting value or return default */
  async getValue(key: string, defaultValue?: string): Promise<string | undefined> {
    const setting = await this.settingRepo.findOne({ where: { key } });
    return setting?.value ?? defaultValue;
  }

  /**
   * Get a setting value by key, returning null if not found.
   * Used by LLM, OCR, and other services.
   */
  async get(key: string, defaultValue?: string): Promise<string | null> {
    const setting = await this.settingRepo.findOne({ where: { key } });
    return setting?.value ?? defaultValue ?? null;
  }

  /** Set a setting value (create or update) */
  async set(key: string, value: string, description?: string): Promise<Setting> {
    let setting = await this.settingRepo.findOne({ where: { key } });
    if (setting) {
      setting.value = value;
      if (description !== undefined) {
        setting.description = description;
      }
    } else {
      setting = this.settingRepo.create({
        key,
        value,
        description: description ?? null,
      });
    }
    return this.settingRepo.save(setting);
  }
}
