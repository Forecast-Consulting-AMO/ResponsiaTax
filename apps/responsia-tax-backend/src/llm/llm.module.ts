import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmMessage } from './entities/llm-message.entity';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { SettingModule } from '../setting/setting.module';
import { DocumentModule } from '../document/document.module';
import { Question } from '../question/entities/question.entity';
import { Dossier } from '../dossier/entities/dossier.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LlmMessage, Question, Dossier]),
    SettingModule,
    DocumentModule,
  ],
  controllers: [LlmController],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
