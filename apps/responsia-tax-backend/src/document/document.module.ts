import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentChunk } from './entities/document-chunk.entity';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { OcrService } from './ocr.service';
import { RagService } from './rag.service';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentChunk]), SettingModule],
  controllers: [DocumentController],
  providers: [DocumentService, OcrService, RagService],
  exports: [DocumentService, OcrService, RagService],
})
export class DocumentModule implements OnModuleInit {
  constructor(private readonly ragService: RagService) {}

  async onModuleInit() {
    await this.ragService.ensureExtensions();
    // Small delay to let TypeORM sync create the table first
    setTimeout(() => this.ragService.ensureIndexes(), 3000);
  }
}
