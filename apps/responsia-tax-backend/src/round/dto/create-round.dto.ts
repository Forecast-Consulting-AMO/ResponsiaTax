import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { RoundStatus } from '../entities/round.entity';

export class CreateRoundDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  round_number!: number;

  @ApiPropertyOptional({ example: '2024-03-15' })
  @IsOptional()
  @IsDateString()
  received_date?: string;

  @ApiPropertyOptional({ example: '2024-04-15' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ enum: RoundStatus, default: RoundStatus.PENDING })
  @IsOptional()
  @IsEnum(RoundStatus)
  status?: RoundStatus;
}
