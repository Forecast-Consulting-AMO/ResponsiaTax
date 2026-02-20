import { Injectable } from '@nestjs/common';
import { AppVersionResponseDto } from './dto/app-version-response.dto';

@Injectable()
export class AppService {
  getVersion(): AppVersionResponseDto {
    const version = process.env.APP_VERSION || '0.0.0';
    // Validate semver format
    const semverRegex = /^\d+\.\d+\.\d+$/;
    return {
      version: semverRegex.test(version) ? version : '0.0.0',
    };
  }
}
