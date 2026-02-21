import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { Round } from '../round/entities/round.entity';
import { Dossier } from '../dossier/entities/dossier.entity';
import { Question } from '../question/entities/question.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Round, Dossier, Question])],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
