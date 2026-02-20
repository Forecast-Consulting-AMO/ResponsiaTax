import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmMessage } from './entities/llm-message.entity';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { SettingModule } from '../setting/setting.module';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LlmMessage]),
    SettingModule,
    DocumentModule,
  ],
  controllers: [LlmController],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
