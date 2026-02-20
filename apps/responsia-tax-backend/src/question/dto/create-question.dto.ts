import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsEnum } from 'class-validator';
import { QuestionStatus } from '../entities/question.entity';

export class CreateQuestionDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  question_number!: number;

  @ApiProperty({ example: 'Veuillez fournir les fiches de paie pour la période...' })
  @IsString()
  question_text!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  response_text?: string;

  @ApiPropertyOptional({ enum: QuestionStatus, default: QuestionStatus.PENDING })
  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
