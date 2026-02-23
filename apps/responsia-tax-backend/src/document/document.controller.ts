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
  BadRequestException,
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
import { DocType, Document } from './entities/document.entity';

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
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = /\.(pdf|docx?|xlsx?|png|jpe?g|tiff?)$/i;
      if (allowed.test(file.originalname)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Unsupported file type. Allowed: PDF, DOCX, XLSX, PNG, JPG, TIFF'), false);
      }
    },
  }))
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
  async upload(
    @Param('dossierId', ParseUUIDPipe) dossierId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('doc_type') docType: DocType,
    @Body('round_id') roundId?: string,
  ) {
    const doc = await this.documentService.upload(dossierId, file, docType, roundId);

    // Fire-and-forget: OCR + chunk for RAG in background (don't block response)
    this.processDocumentForRag(doc).catch((err) => {
      this.logger.warn(`Background OCR/chunking failed for ${doc.id}: ${err.message}`);
    });

    return doc;
  }

  /**
   * Background OCR + chunking so documents are immediately searchable via RAG.
   */
  private async processDocumentForRag(doc: Document): Promise<void> {
    try {
      const ocrResult = await this.ocrService.extractText(doc.file_path);
      await this.documentService.updateOcr(
        doc.id,
        ocrResult.fullText,
        ocrResult.pages as Record<string, unknown>[],
      );
      const chunkCount = await this.ragService.chunkDocument(
        doc.id,
        doc.dossier_id,
        ocrResult.fullText,
        doc.filename,
        doc.doc_type,
      );
      this.logger.log(
        `Auto-OCR complete for ${doc.filename}: ${ocrResult.fullText.length} chars, ${chunkCount} chunks`,
      );
    } catch (err: any) {
      this.logger.warn(`Auto-OCR failed for ${doc.filename}: ${err.message}`);
    }
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

  @Post('documents/batch-delete')
  @ApiOperation({ summary: 'Delete multiple documents at once' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['ids'],
      properties: {
        ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Documents deleted' })
  async removeBatch(@Body('ids') ids: string[]) {
    if (!ids || ids.length === 0) {
      return { deleted: 0 };
    }
    const deleted = await this.documentService.removeBatch(ids);
    return { deleted };
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
        doc.doc_type,
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
      doc.doc_type,
    );

    return {
      id: updated.id,
      ocr_text_length: ocrResult.fullText.length,
      pages: ocrResult.pages.length,
      chunks_created: chunkCount,
    };
  }

  @Get('dossiers/:dossierId/search')
  @ApiOperation({ summary: 'Search document chunks (RAG full-text + trigram)' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'top_k', required: false, description: 'Max results (default 10)' })
  @ApiQuery({ name: 'document_ids', required: false, description: 'Comma-separated document UUIDs to restrict search' })
  @ApiResponse({ status: 200, description: 'Matching chunks' })
  async searchChunks(
    @Param('dossierId', ParseUUIDPipe) dossierId: string,
    @Query('q') query: string,
    @Query('top_k') topK?: string,
    @Query('document_ids') documentIds?: string,
  ) {
    if (!query?.trim()) {
      throw new BadRequestException('Query parameter "q" is required');
    }
    const k = topK ? Math.min(parseInt(topK, 10) || 10, 50) : 10;
    const docIds = documentIds ? documentIds.split(',').filter(Boolean) : undefined;
    return this.ragService.search(query, dossierId, k, docIds);
  }

  @Get('dossiers/:dossierId/chunks/count')
  @ApiOperation({ summary: 'Get RAG chunk count for a dossier' })
  @ApiResponse({ status: 200, description: 'Chunk count' })
  async getChunkCount(@Param('dossierId', ParseUUIDPipe) dossierId: string) {
    const count = await this.ragService.getChunkCount(dossierId);
    return { dossier_id: dossierId, chunk_count: count };
  }
}
