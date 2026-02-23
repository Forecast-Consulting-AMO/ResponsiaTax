import { IsString, IsOptional, IsBoolean, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatRequestDto {
  @ApiProperty({ description: 'User message to send to the LLM' })
  @IsString()
  message!: string;

  @ApiProperty({ description: 'Model ID (e.g. azure-openai/gpt-4.1-mini)' })
  @IsString()
  model!: string;

  @ApiPropertyOptional({ description: 'Optional system prompt for the conversation' })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({
    description: 'If true, automatically set the assistant response as the question response_text',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoApplyToResponse?: boolean;

  @ApiPropertyOptional({
    description: 'If true (default), search dossier documents via RAG and include relevant excerpts in context. Ignored if documentIds is provided.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeDocuments?: boolean;

  @ApiPropertyOptional({
    description: 'Specific document IDs to use for RAG. If provided, only these documents are searched. Overrides includeDocuments.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  documentIds?: string[];
}
