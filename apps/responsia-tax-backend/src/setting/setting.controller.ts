import {
  Controller,
  Get,
  Put,
  Param,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SettingService } from './setting.service';
import { UpsertSettingDto } from './dto/upsert-setting.dto';

@ApiTags('settings')
@Controller({ path: 'settings', version: '1' })
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  @ApiOperation({ summary: 'List all settings' })
  @ApiResponse({ status: 200, description: 'All settings' })
  findAll() {
    return this.settingService.findAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a setting by key' })
  @ApiResponse({ status: 200, description: 'Setting found' })
  @ApiResponse({ status: 404, description: 'Setting not found' })
  findOne(@Param('key') key: string) {
    return this.settingService.findByKey(key);
  }

  @Put(':key')
  @ApiOperation({ summary: 'Create or update a setting' })
  @ApiResponse({ status: 200, description: 'Setting upserted' })
  upsert(
    @Param('key') key: string,
    @Body() dto: UpsertSettingDto,
  ) {
    return this.settingService.upsert(key, dto);
  }
}
