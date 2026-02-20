import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { DossierStatus } from '../entities/dossier.entity';

export class CreateDossierDto {
  @ApiProperty({ example: 'COLEAD - PrP 2022' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'COLEAD SA' })
  @IsString()
  company_name!: string;

  @ApiPropertyOptional({ example: 'BE0123.456.789' })
  @IsOptional()
  @IsString()
  company_number?: string;

  @ApiProperty({ example: 'Précompte Professionnel' })
  @IsString()
  tax_type!: string;

  @ApiProperty({ example: '2022' })
  @IsString()
  tax_year!: string;

  @ApiPropertyOptional({ example: 'SPF-2022-12345' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'Jean Dupont' })
  @IsOptional()
  @IsString()
  controller_name?: string;

  @ApiPropertyOptional({ example: 'j.dupont@minfin.fed.be' })
  @IsOptional()
  @IsString()
  controller_email?: string;

  @ApiPropertyOptional({ enum: DossierStatus, default: DossierStatus.OPEN })
  @IsOptional()
  @IsEnum(DossierStatus)
  status?: DossierStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Dossier-specific LLM system prompt' })
  @IsOptional()
  @IsString()
  system_prompt?: string;
}
