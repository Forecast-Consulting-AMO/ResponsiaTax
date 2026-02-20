import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmMessage } from './entities/llm-message.entity';
import { LlmService } from './llm.service';

@Module({
  imports: [TypeOrmModule.forFeature([LlmMessage])],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
