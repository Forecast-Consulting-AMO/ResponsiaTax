import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsInt, IsUUID } from 'class-validator';
import { LlmRole } from '../entities/llm-message.entity';

export class CreateLlmMessageDto {
  @ApiProperty({ description: 'Question ID' })
  @IsUUID()
  question_id!: string;

  @ApiProperty({ enum: LlmRole })
  @IsEnum(LlmRole)
  role!: LlmRole;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiProperty({ example: 'gpt-4.1-mini' })
  @IsString()
  model!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  tokens_in?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  tokens_out?: number;
}
