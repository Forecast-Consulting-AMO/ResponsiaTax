import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Question } from './entities/question.entity';
import { QuestionService } from './question.service';
import { QuestionController } from './question.controller';
import { QuestionExtractionService } from './question-extraction.service';
import { DocumentModule } from '../document/document.module';
import { LlmModule } from '../llm/llm.module';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question]),
    DocumentModule,
    LlmModule,
    SettingModule,
  ],
  controllers: [QuestionController],
  providers: [QuestionService, QuestionExtractionService],
  exports: [QuestionService, QuestionExtractionService],
})
export class QuestionModule {}
