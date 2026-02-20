import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { QuestionService } from './question.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { DocumentService } from '../document/document.service';

@ApiTags('questions')
@Controller({ version: '1' })
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly documentService: DocumentService,
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
  @ApiOperation({ summary: 'Auto-extract questions from a document OCR text (placeholder)' })
  @ApiResponse({ status: 200, description: 'Questions extracted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async extractQuestions(@Param('docId', ParseUUIDPipe) docId: string) {
    const doc = await this.documentService.findOne(docId);
    if (!doc.ocr_text) {
      return {
        message: 'No OCR text available for this document. Run OCR first.',
        questions: [],
      };
    }
    // Placeholder: actual LLM-based extraction will be done separately
    return {
      message: 'Question extraction not yet implemented. This is a placeholder endpoint.',
      document_id: doc.id,
      ocr_text_length: doc.ocr_text.length,
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
