import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { QuestionService } from './question.service';
import { QuestionExtractionService } from './question-extraction.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { DocumentService } from '../document/document.service';
import { OcrService } from '../document/ocr.service';
import { RagService } from '../document/rag.service';

@ApiTags('questions')
@Controller({ version: '1' })
export class QuestionController {
  private readonly logger = new Logger(QuestionController.name);

  constructor(
    private readonly questionService: QuestionService,
    private readonly questionExtractionService: QuestionExtractionService,
    private readonly documentService: DocumentService,
    private readonly ocrService: OcrService,
    private readonly ragService: RagService,
  ) {}

  @Get('rounds/:roundId/questions')
  @ApiOperation({ summary: 'List all questions for a round' })
  @ApiResponse({ status: 200, description: 'List of questions' })
  findAll(@Param('roundId', ParseUUIDPipe) roundId: string) {
    return this.questionService.findAllByRound(roundId);
  }

  @Post('rounds/:roundId/questions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a question manually' })
  @ApiResponse({ status: 201, description: 'Question created' })
  create(
    @Param('roundId', ParseUUIDPipe) roundId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questionService.create(roundId, dto);
  }

  @Post('documents/:docId/extract-questions')
  @ApiOperation({ summary: 'Run OCR (if needed) + LLM extraction to create questions' })
  @ApiQuery({ name: 'round_id', required: true, description: 'Round to attach questions to' })
  @ApiQuery({ name: 'model', required: false, description: 'LLM model override' })
  @ApiResponse({ status: 200, description: 'Questions extracted and created' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async extractQuestions(
    @Param('docId', ParseUUIDPipe) docId: string,
    @Query('round_id') roundId: string,
    @Query('model') model?: string,
  ) {
    if (!roundId) {
      throw new BadRequestException('round_id query parameter is required');
    }

    const doc = await this.documentService.findOne(docId);

    // Run OCR if not already done
    let ocrText = doc.ocr_text;
    if (!ocrText) {
      this.logger.log(`Running OCR on document ${doc.id} before extraction`);
      const ocrResult = await this.ocrService.extractText(doc.file_path);
      await this.documentService.updateOcr(
        doc.id,
        ocrResult.fullText,
        ocrResult.pages as Record<string, unknown>[],
      );
      ocrText = ocrResult.fullText;

      // Auto-chunk for RAG
      await this.ragService.chunkDocument(
        doc.id,
        doc.dossier_id,
        ocrText,
        doc.filename,
      );
    }

    // Extract questions via LLM
    const extracted = await this.questionExtractionService.extractQuestions(ocrText, model);

    // Create question records
    const questions = await this.questionService.createBulk(
      roundId,
      extracted.map((q) => ({
        question_number: q.questionNumber,
        question_text: q.questionText,
      })),
    );

    return {
      document_id: doc.id,
      questions_extracted: questions.length,
      questions,
    };
  }

  @Get('questions/:id')
  @ApiOperation({ summary: 'Get a question by ID (with LLM messages)' })
  @ApiResponse({ status: 200, description: 'Question found' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.questionService.findOne(id);
  }

  @Patch('questions/:id')
  @ApiOperation({ summary: 'Update a question (response_text, status, notes)' })
  @ApiResponse({ status: 200, description: 'Question updated' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionService.update(id, dto);
  }
}
