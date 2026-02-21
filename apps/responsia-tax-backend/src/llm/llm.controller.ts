import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Res,
  UseGuards,
  NotFoundException,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import * as express from 'express';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmService, AVAILABLE_MODELS } from './llm.service';
import { LlmRole } from './entities/llm-message.entity';
import { ChatRequestDto } from './dto/chat-request.dto';
import { RagService } from '../document/rag.service';
import { SettingService } from '../setting/setting.service';
import { Question } from '../question/entities/question.entity';
import { Dossier } from '../dossier/entities/dossier.entity';

@ApiTags('LLM')
@Controller({ version: '1' })
@UseGuards(ThrottlerGuard)
export class LlmController {
  private readonly logger = new Logger(LlmController.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly ragService: RagService,
    private readonly settingService: SettingService,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(Dossier)
    private readonly dossierRepo: Repository<Dossier>,
  ) {}

  @Get('llm/models')
  @ApiOperation({ summary: 'List available LLM models' })
  getModels() {
    return AVAILABLE_MODELS;
  }

  @Post('questions/:questionId/chat')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Chat with an LLM for a specific question' })
  @ApiParam({ name: 'questionId', type: 'string', format: 'uuid' })
  async chat(
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: ChatRequestDto,
  ) {
    // Verify the question exists and load its round (for dossier_id)
    const question = await this.questionRepo.findOne({
      where: { id: questionId },
      relations: ['round'],
    });
    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    // Load existing messages for this question
    let messages = await this.llmService.getMessages(questionId);

    // If no messages exist, build a rich system prompt with context
    if (messages.length === 0) {
      const systemPrompt = await this.buildSystemPrompt(dto, question);

      if (systemPrompt.trim()) {
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
      await this.questionRepo.update(questionId, { response_text: response.content });
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

  @Post('questions/:questionId/chat/stream')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Chat with streaming (SSE)' })
  @ApiParam({ name: 'questionId', type: 'string', format: 'uuid' })
  async chatStream(
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: ChatRequestDto,
    @Res() res: express.Response,
  ) {
    // Verify the question exists and load its round (for dossier_id)
    const question = await this.questionRepo.findOne({
      where: { id: questionId },
      relations: ['round'],
    });
    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    // Load existing messages for this question
    let messages = await this.llmService.getMessages(questionId);

    // If no messages exist, build a rich system prompt with context
    if (messages.length === 0) {
      const systemPrompt = await this.buildSystemPrompt(dto, question);

      if (systemPrompt.trim()) {
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

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.llmService.chatStream({
        messages: messages.map((m) => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        })),
        model: dto.model,
      });

      for await (const event of stream) {
        if (event.type === 'delta') {
          res.write(
            `data: ${JSON.stringify({ type: 'delta', content: event.content })}\n\n`,
          );
        } else if (event.type === 'done') {
          // Save the complete assistant message
          const assistantMsg = await this.llmService.saveMessage({
            questionId,
            role: LlmRole.ASSISTANT,
            content: event.content,
            model: dto.model,
            tokensIn: event.tokensIn,
            tokensOut: event.tokensOut,
          });

          // Optionally auto-apply response to the question
          if (dto.autoApplyToResponse) {
            await this.questionRepo.update(questionId, {
              response_text: event.content,
            });
            this.logger.log(
              `Auto-applied streamed LLM response to question ${questionId}`,
            );
          }

          res.write(
            `data: ${JSON.stringify({
              type: 'done',
              content: event.content,
              id: assistantMsg.id,
              model: dto.model,
              tokensIn: event.tokensIn,
              tokensOut: event.tokensOut,
            })}\n\n`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`Stream error for question ${questionId}: ${err.message}`);
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`,
      );
    }

    res.end();
  }

  /**
   * Build the system prompt for the first message of a chat.
   * Combines: base prompt + question context + RAG document excerpts.
   */
  private async buildSystemPrompt(
    dto: ChatRequestDto,
    question: Question,
  ): Promise<string> {
    const dossierId = question.round?.dossier_id;
    const parts: string[] = [];

    // 1. Base system prompt (DTO override > dossier > settings default)
    let basePrompt = dto.systemPrompt;
    if (!basePrompt && dossierId) {
      const dossier = await this.dossierRepo.findOne({ where: { id: dossierId } });
      if (dossier?.system_prompt) {
        basePrompt = dossier.system_prompt;
      }
    }
    if (!basePrompt) {
      basePrompt = await this.settingService.get('default_system_prompt') ?? '';
    }
    if (basePrompt.trim()) {
      parts.push(basePrompt.trim());
    }

    // 2. Question context
    parts.push(
      `---\nQUESTION DU CONTRÔLEUR (Question ${question.question_number ?? ''}):\n${question.question_text}`,
    );

    // 3. RAG document excerpts (if enabled, default: true)
    if (dto.includeDocuments !== false && dossierId) {
      const ragResults = await this.ragService.search(
        question.question_text,
        dossierId,
        5,
      );

      if (ragResults.length > 0) {
        const excerpts = ragResults.map((r) => {
          const content = r.content.length > 800
            ? r.content.substring(0, 800) + '\n[...]'
            : r.content;
          return `[Source: ${r.filename}]\n${content}`;
        }).join('\n\n---\n\n');

        parts.push(
          `EXTRAITS DE DOCUMENTS DE RÉFÉRENCE (utilisez-les pour enrichir votre réponse):\n\n${excerpts}\n\nIMPORTANT: Inspirez-vous de ces extraits pour structurer et enrichir votre réponse, mais ne les copiez pas verbatim.`,
        );

        this.logger.log(
          `RAG: injected ${ragResults.length} chunk(s) for question ${question.question_number}`,
        );
      }
    }

    return parts.join('\n\n');
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
