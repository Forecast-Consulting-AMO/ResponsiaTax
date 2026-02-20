/// <reference types="multer" />
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import * as express from 'express';
import { DocumentService } from './document.service';
import { OcrService } from './ocr.service';
import { RagService } from './rag.service';
import { DocType } from './entities/document.entity';

@ApiTags('documents')
@Controller({ version: '1' })
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

  constructor(
    private readonly documentService: DocumentService,
    private readonly ocrService: OcrService,
    private readonly ragService: RagService,
  ) {}

  @Post('dossiers/:dossierId/documents')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload a document to a dossier' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'doc_type'],
      properties: {
        file: { type: 'string', format: 'binary' },
        doc_type: { type: 'string', enum: Object.values(DocType) },
        round_id: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded' })
  upload(
    @Param('dossierId', ParseUUIDPipe) dossierId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('doc_type') docType: DocType,
    @Body('round_id') roundId?: string,
  ) {
    return this.documentService.upload(dossierId, file, docType, roundId);
  }

  @Get('dossiers/:dossierId/documents')
  @ApiOperation({ summary: 'List documents for a dossier' })
  @ApiQuery({ name: 'round_id', required: false })
  @ApiQuery({ name: 'doc_type', enum: DocType, required: false })
  @ApiResponse({ status: 200, description: 'List of documents' })
  findAll(
    @Param('dossierId', ParseUUIDPipe) dossierId: string,
    @Query('round_id') roundId?: string,
    @Query('doc_type') docType?: DocType,
  ) {
    return this.documentService.findAllByDossier(dossierId, roundId, docType);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get document metadata' })
  @ApiResponse({ status: 200, description: 'Document found' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentService.findOne(id);
  }

  @Get('documents/:id/download')
  @ApiOperation({ summary: 'Download a document file' })
  @ApiResponse({ status: 200, description: 'File stream' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: express.Response,
  ) {
    const doc = await this.documentService.findOne(id);
    const filePath = this.documentService.getFilePath(doc);
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.filename)}"`,
    );
    res.sendFile(filePath);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 204, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentService.remove(id);
  }

  @Post('documents/:id/ocr')
  @ApiOperation({ summary: 'Run OCR on a document and auto-chunk for RAG' })
  @ApiResponse({ status: 200, description: 'OCR + chunking complete' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async triggerOcr(@Param('id', ParseUUIDPipe) id: string) {
    const doc = await this.documentService.findOne(id);

    // If already OCR'd, skip OCR but re-chunk
    if (doc.ocr_text) {
      const chunkCount = await this.ragService.chunkDocument(
        doc.id,
        doc.dossier_id,
        doc.ocr_text,
        doc.filename,
      );
      return {
        id: doc.id,
        ocr_text_length: doc.ocr_text.length,
        chunks_created: chunkCount,
        message: 'Document already OCR\'d. Re-chunked for RAG.',
      };
    }

    // Run OCR
    this.logger.log(`Running OCR on document ${doc.id} (${doc.filename})`);
    const ocrResult = await this.ocrService.extractText(doc.file_path);

    // Save OCR text to document
    const updated = await this.documentService.updateOcr(
      doc.id,
      ocrResult.fullText,
      ocrResult.pages as Record<string, unknown>[],
    );

    // Auto-chunk for RAG
    const chunkCount = await this.ragService.chunkDocument(
      doc.id,
      doc.dossier_id,
      ocrResult.fullText,
      doc.filename,
    );

    return {
      id: updated.id,
      ocr_text_length: ocrResult.fullText.length,
      pages: ocrResult.pages.length,
      chunks_created: chunkCount,
    };
  }

  @Get('dossiers/:dossierId/chunks/count')
  @ApiOperation({ summary: 'Get RAG chunk count for a dossier' })
  @ApiResponse({ status: 200, description: 'Chunk count' })
  async getChunkCount(@Param('dossierId', ParseUUIDPipe) dossierId: string) {
    const count = await this.ragService.getChunkCount(dossierId);
    return { dossier_id: dossierId, chunk_count: count };
  }
}
