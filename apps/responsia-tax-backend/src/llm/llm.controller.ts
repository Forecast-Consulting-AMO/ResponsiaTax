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
import { ClassifyDocTypesDto } from './dto/classify-doc-types.dto';
import { RagService } from '../document/rag.service';
import { SettingService } from '../setting/setting.service';
import { Question } from '../question/entities/question.entity';
import { Dossier } from '../dossier/entities/dossier.entity';
import { Round } from '../round/entities/round.entity';

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
    @InjectRepository(Round)
    private readonly roundRepo: Repository<Round>,
  ) {}

  @Get('llm/models')
  @ApiOperation({ summary: 'List available LLM models' })
  getModels() {
    return AVAILABLE_MODELS;
  }

  @Post('llm/classify-doc-types')
  @ApiOperation({ summary: 'Classify filenames into document types using an LLM' })
  async classifyDocTypes(@Body() dto: ClassifyDocTypesDto) {
    if (!dto.filenames.length) {
      return { classifications: [] };
    }

    // Pick the model: explicit > Sonnet > first available with a key
    let model = dto.model;
    if (!model) {
      const hasAnthropic = await this.settingService.get('anthropic_api_key');
      if (hasAnthropic) {
        model = 'anthropic/claude-sonnet-4-5-20250929';
      } else {
        const hasOpenai = await this.settingService.get('openai_api_key');
        model = hasOpenai ? 'openai/gpt-4.1-mini' : 'azure-openai/gpt-4.1-mini';
      }
    }

    const filenameList = dto.filenames
      .map((f, i) => `${i + 1}. "${f}"`)
      .join('\n');

    const prompt = `Classify each filename into exactly one document type.

Types:
- question_dr: Tax audit question or information request from the tax inspector (demande de renseignement, avis de rectification, notification, questionnaire, contrôle fiscal)
- support: Supporting documents, annexes, invoices, contracts, financial statements, accounting records, technical documentation
- response_draft: Draft response or reply to the inspector, answer project
- other: Anything that does not fit the above categories

Filenames:
${filenameList}

Respond with ONLY a JSON array of the document types in the same order as the filenames. Example: ["support","response_draft","question_dr"]`;

    try {
      const response = await this.llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        model,
        temperature: 0,
        maxTokens: 512,
      });

      // Extract JSON array from the response (handle markdown code blocks)
      const raw = response.content.trim();
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn(`LLM classification returned non-JSON: ${raw}`);
        return {
          classifications: dto.filenames.map(() => 'other'),
        };
      }

      const parsed: string[] = JSON.parse(jsonMatch[0]);
      const validTypes = ['question_dr', 'support', 'response_draft', 'other'];
      const classifications = dto.filenames.map((_, i) => {
        const val = parsed[i];
        return validTypes.includes(val) ? val : 'other';
      });

      return { classifications };
    } catch (err: any) {
      this.logger.error(`Doc type classification failed: ${err.message}`);
      // Graceful fallback — return "other" for all
      return {
        classifications: dto.filenames.map(() => 'other'),
      };
    }
  }

  @Get('questions/:questionId/system-prompt')
  @ApiOperation({ summary: 'Get the effective base system prompt for a question' })
  @ApiParam({ name: 'questionId', type: 'string', format: 'uuid' })
  async getEffectiveSystemPrompt(
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    const question = await this.questionRepo.findOne({
      where: { id: questionId },
      relations: ['round'],
    });
    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    const dossierId = question.round?.dossier_id;
    let basePrompt = '';

    if (dossierId) {
      const dossier = await this.dossierRepo.findOne({ where: { id: dossierId } });
      if (dossier?.system_prompt) {
        basePrompt = dossier.system_prompt;
      }
    }
    if (!basePrompt) {
      basePrompt = await this.settingService.get('default_system_prompt') ?? '';
    }

    return { system_prompt: basePrompt };
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

    // 2. Previous rounds context (inherit Q&A from earlier rounds)
    if (dossierId && question.round) {
      const currentRoundNumber = question.round.round_number;
      if (currentRoundNumber > 1) {
        const previousRounds = await this.roundRepo.find({
          where: { dossier_id: dossierId },
          relations: ['questions'],
          order: { round_number: 'ASC' },
        });

        const prevRoundQA = previousRounds
          .filter((r) => r.round_number < currentRoundNumber)
          .flatMap((r) =>
            (r.questions || [])
              .filter((q) => q.response_text)
              .sort((a, b) => a.question_number - b.question_number)
              .map(
                (q) =>
                  `[Tour ${r.round_number} — Q${q.question_number}]\nQuestion: ${q.question_text}\nRéponse: ${q.response_text}`,
              ),
          );

        if (prevRoundQA.length > 0) {
          parts.push(
            `HISTORIQUE DES TOURS PRÉCÉDENTS (questions et réponses déjà traitées):\n\n${prevRoundQA.join('\n\n---\n\n')}`,
          );
          this.logger.log(
            `Injected ${prevRoundQA.length} previous Q&A(s) for round ${currentRoundNumber}`,
          );
        }
      }
    }

    // 3. Current question context
    parts.push(
      `---\nQUESTION DU CONTRÔLEUR (Question ${question.question_number ?? ''}):\n${question.question_text}`,
    );

    // 4. RAG document excerpts (if enabled, default: true)
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
