import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClassifyDocTypesDto {
  @ApiProperty({
    description: 'Array of filenames to classify',
    example: ['Annexe C.pdf', 'Réponse D.docx', 'Notification.pdf'],
  })
  @IsArray()
  @IsString({ each: true })
  filenames!: string[];

  @ApiPropertyOptional({
    description:
      'Model to use for classification (defaults to anthropic/claude-sonnet-4-5-20250929)',
  })
  @IsOptional()
  @IsString()
  model?: string;
}
