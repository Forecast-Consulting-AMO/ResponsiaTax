import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { OcrService } from './ocr.service';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [TypeOrmModule.forFeature([Document]), SettingModule],
  controllers: [DocumentController],
  providers: [DocumentService, OcrService],
  exports: [DocumentService, OcrService],
})
export class DocumentModule {}
