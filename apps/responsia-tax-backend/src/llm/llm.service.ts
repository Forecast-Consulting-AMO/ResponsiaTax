import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingService } from '../setting/setting.service';
import { LlmMessage, LlmRole } from './entities/llm-message.entity';

export const AVAILABLE_MODELS = [
  // Azure OpenAI
  { id: 'azure-openai/gpt-4o', name: 'GPT-4o', provider: 'azure-openai' },
  { id: 'azure-openai/gpt-4.1', name: 'GPT-4.1', provider: 'azure-openai' },
  { id: 'azure-openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'azure-openai' },
  { id: 'azure-openai/gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'azure-openai' },
  // Azure Anthropic (via Azure AI Foundry)
  { id: 'azure-anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'azure-anthropic' },
  { id: 'azure-anthropic/claude-haiku-3-5', name: 'Claude Haiku 3.5', provider: 'azure-anthropic' },
];

export interface ChatParams {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly settingService: SettingService,
    @InjectRepository(LlmMessage)
    private readonly messageRepo: Repository<LlmMessage>,
  ) {}

  getAvailableModels() {
    return AVAILABLE_MODELS;
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const modelDef = AVAILABLE_MODELS.find((m) => m.id === params.model);
    if (!modelDef) {
      throw new BadRequestException(
        `Unknown model: ${params.model}. Available: ${AVAILABLE_MODELS.map((m) => m.id).join(', ')}`,
      );
    }

    if (modelDef.provider === 'azure-openai') {
      return this.chatAzureOpenAI(params);
    } else if (modelDef.provider === 'azure-anthropic') {
      return this.chatAzureAnthropic(params);
    } else {
      throw new BadRequestException(`Unsupported provider: ${modelDef.provider}`);
    }
  }

  // ---- Azure OpenAI ----

  private async chatAzureOpenAI(params: ChatParams): Promise<ChatResponse> {
    const endpoint = await this.settingService.get('azure_openai_endpoint');
    const apiKey = await this.settingService.get('azure_openai_api_key');
    const apiVersion = await this.settingService.get(
      'azure_openai_api_version',
      '2024-12-01-preview',
    );

    if (!endpoint || !apiKey) {
      throw new BadRequestException(
        'Azure OpenAI is not configured. Set azure_openai_endpoint and azure_openai_api_key in Settings.',
      );
    }

    const { AzureOpenAI } = await import('openai');

    const deploymentName = params.model.replace('azure-openai/', '');

    const client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion: apiVersion!,
      deployment: deploymentName,
    });

    this.logger.log(
      `Calling Azure OpenAI model=${deploymentName}, messages=${params.messages.length}`,
    );

    const response = await client.chat.completions.create({
      model: deploymentName,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens ?? 4096,
    });

    const choice = response.choices?.[0];
    if (!choice?.message?.content) {
      throw new BadRequestException('Azure OpenAI returned an empty response');
    }

    return {
      content: choice.message.content,
      model: params.model,
      tokensIn: response.usage?.prompt_tokens ?? 0,
      tokensOut: response.usage?.completion_tokens ?? 0,
    };
  }

  // ---- Azure Anthropic (via Azure AI Foundry) ----

  private async chatAzureAnthropic(params: ChatParams): Promise<ChatResponse> {
    const endpoint = await this.settingService.get('azure_anthropic_endpoint');
    const apiKey = await this.settingService.get('azure_anthropic_api_key');

    if (!endpoint || !apiKey) {
      throw new BadRequestException(
        'Azure Anthropic is not configured. Set azure_anthropic_endpoint and azure_anthropic_api_key in Settings.',
      );
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default;

    const modelName = params.model.replace('azure-anthropic/', '');

    const systemMessages = params.messages.filter((m) => m.role === 'system');
    const conversationMessages = params.messages.filter((m) => m.role !== 'system');

    const client = new Anthropic({
      baseURL: endpoint,
      apiKey,
    });

    this.logger.log(
      `Calling Azure Anthropic model=${modelName}, messages=${conversationMessages.length}`,
    );

    const response = await client.messages.create({
      model: modelName,
      max_tokens: params.maxTokens ?? 4096,
      system: systemMessages.map((m) => m.content).join('\n\n') || undefined,
      messages: conversationMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      temperature: params.temperature ?? 0.3,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new BadRequestException('Azure Anthropic returned an empty response');
    }

    return {
      content: textBlock.text,
      model: params.model,
      tokensIn: response.usage?.input_tokens ?? 0,
      tokensOut: response.usage?.output_tokens ?? 0,
    };
  }

  // ---- Message persistence ----

  async getMessages(questionId: string): Promise<LlmMessage[]> {
    return this.messageRepo.find({
      where: { question_id: questionId },
      order: { created_at: 'ASC' },
    });
  }

  async saveMessage(data: {
    questionId: string;
    role: LlmRole;
    content: string;
    model?: string;
    tokensIn?: number;
    tokensOut?: number;
  }): Promise<LlmMessage> {
    const msg = this.messageRepo.create({
      question_id: data.questionId,
      role: data.role,
      content: data.content,
      model: data.model ?? '',
      tokens_in: data.tokensIn ?? null,
      tokens_out: data.tokensOut ?? null,
    });
    return this.messageRepo.save(msg);
  }

  async clearMessages(questionId: string): Promise<void> {
    await this.messageRepo.delete({ question_id: questionId });
  }

  /** Compat: create from DTO (used by other agent's code) */
  async findByQuestion(questionId: string): Promise<LlmMessage[]> {
    return this.getMessages(questionId);
  }
}
