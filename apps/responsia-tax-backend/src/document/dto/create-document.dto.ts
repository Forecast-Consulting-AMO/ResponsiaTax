import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DocType } from '../entities/document.entity';

export class CreateDocumentDto {
  @ApiProperty({ enum: DocType, example: DocType.QUESTION_DR })
  @IsEnum(DocType)
  doc_type!: DocType;

  @ApiPropertyOptional({ description: 'Round ID to attach document to' })
  @IsOptional()
  @IsUUID()
  round_id?: string;
}
