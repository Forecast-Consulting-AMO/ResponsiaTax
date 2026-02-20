import { ApiProperty } from '@nestjs/swagger';

export class AppVersionResponseDto {
  @ApiProperty({ example: '1.0.0' })
  version!: string;
}
