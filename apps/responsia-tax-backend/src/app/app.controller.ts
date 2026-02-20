import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { AppVersionResponseDto } from './dto/app-version-response.dto';

@ApiTags('App')
@Controller({ path: 'app', version: '1' })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('version')
  @ApiOperation({ summary: 'Get application version' })
  @ApiOkResponse({ type: AppVersionResponseDto })
  getVersion(): AppVersionResponseDto {
    return this.appService.getVersion();
  }
}
