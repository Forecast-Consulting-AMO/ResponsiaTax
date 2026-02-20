import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  NotFoundException,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmService, AVAILABLE_MODELS } from './llm.service';
import { LlmMessage, LlmRole } from './entities/llm-message.entity';
import { ChatRequestDto } from './dto/chat-request.dto';

@ApiTags('LLM')
@Controller({ version: '1' })
export class LlmController {
  private readonly logger = new Logger(LlmController.name);

  constructor(
    private readonly llmService: LlmService,
    @InjectRepository(LlmMessage)
    private readonly llmMessageRepo: Repository<LlmMessage>,
  ) {}

  @Get('llm/models')
  @ApiOperation({ summary: 'List available LLM models' })
  getModels() {
    return AVAILABLE_MODELS;
  }

  @Post('questions/:questionId/chat')
  @ApiOperation({ summary: 'Chat with an LLM for a specific question' })
  @ApiParam({ name: 'questionId', type: 'string', format: 'uuid' })
  async chat(
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: ChatRequestDto,
  ) {
    // Verify the question exists by querying the questions table directly
    const questionRow = await this.llmMessageRepo.manager.query(
      `SELECT q.id, q.question_text, q.response_text, r.dossier_id
       FROM questions q
       JOIN rounds r ON r.id = q.round_id
       WHERE q.id = $1`,
      [questionId],
    );
    if (!questionRow || questionRow.length === 0) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }
    const question = questionRow[0];

    // Load existing messages for this question
    let messages = await this.llmService.getMessages(questionId);

    // If no messages exist and a system prompt is provided, insert it
    if (messages.length === 0) {
      let systemPrompt = dto.systemPrompt;

      // Fallback to dossier system_prompt if not provided
      if (!systemPrompt && question.dossier_id) {
        const dossierRow = await this.llmMessageRepo.manager.query(
          `SELECT system_prompt FROM dossiers WHERE id = $1`,
          [question.dossier_id],
        );
        if (dossierRow?.[0]?.system_prompt) {
          systemPrompt = dossierRow[0].system_prompt;
        }
      }

      if (systemPrompt) {
        await this.llmService.saveMessage({
          questionId,
          role: LlmRole.SYSTEM,
          content: systemPrompt,
        });
      }
    }

    // Save the user message
    await this.llmService.saveMessage({
      questionId,
      role: LlmRole.USER,
      content: dto.message,
      model: dto.model,
    });

    // Reload all messages for the LLM call
    messages = await this.llmService.getMessages(questionId);

    // Call the LLM
    const response = await this.llmService.chat({
      messages: messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      model: dto.model,
    });

    // Save the assistant response
    const assistantMsg = await this.llmService.saveMessage({
      questionId,
      role: LlmRole.ASSISTANT,
      content: response.content,
      model: response.model,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
    });

    // Optionally auto-apply response to the question
    if (dto.autoApplyToResponse) {
      await this.llmMessageRepo.manager.query(
        `UPDATE questions SET response_text = $1, updated_at = NOW() WHERE id = $2`,
        [response.content, questionId],
      );
      this.logger.log(`Auto-applied LLM response to question ${questionId}`);
    }

    return {
      id: assistantMsg.id,
      content: response.content,
      model: response.model,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
      createdAt: assistantMsg.created_at,
    };
  }

  @Get('questions/:questionId/messages')
  @ApiOperation({ summary: 'Get all chat messages for a question' })
  @ApiParam({ name: 'questionId', type: 'string', format: 'uuid' })
  async getMessages(@Param('questionId', ParseUUIDPipe) questionId: string) {
    return this.llmService.getMessages(questionId);
  }

  @Delete('questions/:questionId/messages')
  @ApiOperation({ summary: 'Clear chat history for a question' })
  @ApiParam({ name: 'questionId', type: 'string', format: 'uuid' })
  async clearMessages(@Param('questionId', ParseUUIDPipe) questionId: string) {
    await this.llmService.clearMessages(questionId);
    return { deleted: true };
  }
}
