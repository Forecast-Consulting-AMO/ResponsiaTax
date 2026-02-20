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
import { RagService } from '../document/rag.service';
import { SettingService } from '../setting/setting.service';

@ApiTags('LLM')
@Controller({ version: '1' })
export class LlmController {
  private readonly logger = new Logger(LlmController.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly ragService: RagService,
    private readonly settingService: SettingService,
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
      `SELECT q.id, q.question_text, q.question_number, q.response_text, r.dossier_id
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

  /**
   * Build the system prompt for the first message of a chat.
   * Combines: base prompt + question context + RAG document excerpts.
   */
  private async buildSystemPrompt(
    dto: ChatRequestDto,
    question: { question_text: string; question_number: number; dossier_id: string },
  ): Promise<string> {
    const parts: string[] = [];

    // 1. Base system prompt (DTO override > dossier > settings default)
    let basePrompt = dto.systemPrompt;
    if (!basePrompt && question.dossier_id) {
      const dossierRow = await this.llmMessageRepo.manager.query(
        `SELECT system_prompt FROM dossiers WHERE id = $1`,
        [question.dossier_id],
      );
      if (dossierRow?.[0]?.system_prompt) {
        basePrompt = dossierRow[0].system_prompt;
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
    if (dto.includeDocuments !== false && question.dossier_id) {
      const ragResults = await this.ragService.search(
        question.question_text,
        question.dossier_id,
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
