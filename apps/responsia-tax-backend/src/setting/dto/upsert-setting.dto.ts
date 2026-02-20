import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpsertSettingDto {
  @ApiProperty({ example: 'some_value' })
  @IsString()
  value!: string;

  @ApiPropertyOptional({ example: 'Description of this setting' })
  @IsOptional()
  @IsString()
  description?: string;
}
