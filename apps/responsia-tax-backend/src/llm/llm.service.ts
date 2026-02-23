import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingService } from '../setting/setting.service';
import { LlmMessage, LlmRole } from './entities/llm-message.entity';

// Use runtime require to bypass webpack bundling of SDK packages
declare const __non_webpack_require__: NodeRequire | undefined;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runtimeRequire: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;

export const AVAILABLE_MODELS = [
  // OpenAI (direct API)
  { id: 'openai/gpt-5.2-chat', name: 'GPT-5.2 Chat', provider: 'openai' },
  { id: 'openai/gpt-4.1', name: 'GPT-4.1', provider: 'openai' },
  { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai' },
  { id: 'openai/gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'openai/o3', name: 'o3 (reasoning)', provider: 'openai' },
  { id: 'openai/o3-mini', name: 'o3-mini', provider: 'openai' },
  // Anthropic (direct API)
  { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic' },
  { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic' },
  { id: 'anthropic/claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic' },
  { id: 'anthropic/claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic' },
  // Azure OpenAI
  { id: 'azure-openai/gpt-5.2-chat', name: 'Azure GPT-5.2 Chat', provider: 'azure-openai' },
  { id: 'azure-openai/gpt-4o', name: 'Azure GPT-4o', provider: 'azure-openai' },
  { id: 'azure-openai/gpt-4.1', name: 'Azure GPT-4.1', provider: 'azure-openai' },
  { id: 'azure-openai/gpt-4.1-mini', name: 'Azure GPT-4.1 Mini', provider: 'azure-openai' },
  { id: 'azure-openai/gpt-4.1-nano', name: 'Azure GPT-4.1 Nano', provider: 'azure-openai' },
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

    if (modelDef.provider === 'openai') {
      return this.chatOpenAI(params);
    } else if (modelDef.provider === 'anthropic') {
      return this.chatAnthropic(params);
    } else if (modelDef.provider === 'azure-openai') {
      return this.chatAzureOpenAI(params);
    } else {
      throw new BadRequestException(`Unsupported provider: ${modelDef.provider}`);
    }
  }

  // ---- OpenAI (direct API) ----

  private async chatOpenAI(params: ChatParams): Promise<ChatResponse> {
    const apiKey = await this.settingService.get('openai_api_key');

    if (!apiKey) {
      throw new BadRequestException(
        'OpenAI is not configured. Set openai_api_key in Settings.',
      );
    }

    const OpenAI = runtimeRequire('openai').default ?? runtimeRequire('openai').OpenAI;

    const modelName = params.model.replace('openai/', '');
    const client = new OpenAI({ apiKey });

    this.logger.log(
      `Calling OpenAI model=${modelName}, messages=${params.messages.length}`,
    );

    const response = await client.chat.completions.create({
      model: modelName,
      messages: params.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: params.temperature ?? 0.3,
      max_completion_tokens: params.maxTokens ?? 4096,
    });

    const choice = response.choices?.[0];
    if (!choice?.message?.content) {
      throw new BadRequestException('OpenAI returned an empty response');
    }

    return {
      content: choice.message.content,
      model: params.model,
      tokensIn: response.usage?.prompt_tokens ?? 0,
      tokensOut: response.usage?.completion_tokens ?? 0,
    };
  }

  // ---- Azure OpenAI ----

  private async chatAzureOpenAI(params: ChatParams): Promise<ChatResponse> {
    const endpoint = await this.settingService.get('azure_openai_endpoint');
    const apiKey = await this.settingService.get('azure_openai_api_key');
    const apiVersion = await this.settingService.get(
      'azure_openai_api_version',
      '2025-04-01-preview',
    );

    if (!endpoint || !apiKey) {
      throw new BadRequestException(
        'Azure OpenAI is not configured. Set azure_openai_endpoint and azure_openai_api_key in Settings.',
      );
    }

    const OpenAI = runtimeRequire('openai').default ?? runtimeRequire('openai').OpenAI;

    const deploymentName = params.model.replace('azure-openai/', '');

    // Strip endpoint to origin only (users may paste full API URL with path/query params)
    const cleanEndpoint = new URL(endpoint).origin;
    const baseURL = `${cleanEndpoint}/openai/deployments/${deploymentName}`;
    const client = new OpenAI({
      apiKey,
      baseURL,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': apiKey },
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
      max_completion_tokens: params.maxTokens ?? 4096,
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

  // ---- Anthropic (direct API) ----

  private async chatAnthropic(params: ChatParams): Promise<ChatResponse> {
    const apiKey = await this.settingService.get('anthropic_api_key');

    if (!apiKey) {
      throw new BadRequestException(
        'Anthropic is not configured. Set anthropic_api_key in Settings.',
      );
    }

    const Anthropic = runtimeRequire('@anthropic-ai/sdk').default ?? runtimeRequire('@anthropic-ai/sdk');

    const modelName = params.model.replace('anthropic/', '');

    const systemMessages = params.messages.filter((m) => m.role === 'system');
    const conversationMessages = params.messages.filter((m) => m.role !== 'system');

    const client = new Anthropic({ apiKey });

    this.logger.log(
      `Calling Anthropic model=${modelName}, messages=${conversationMessages.length}`,
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

    const textBlock = response.content.find((b: any) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new BadRequestException('Anthropic returned an empty response');
    }

    return {
      content: textBlock.text,
      model: params.model,
      tokensIn: response.usage?.input_tokens ?? 0,
      tokensOut: response.usage?.output_tokens ?? 0,
    };
  }

  // ---- Streaming variants ----

  async *chatStream(
    params: ChatParams,
  ): AsyncGenerator<{
    type: 'delta' | 'done';
    content: string;
    tokensIn?: number;
    tokensOut?: number;
  }> {
    const modelDef = AVAILABLE_MODELS.find((m) => m.id === params.model);
    if (!modelDef) {
      throw new BadRequestException(
        `Unknown model: ${params.model}. Available: ${AVAILABLE_MODELS.map((m) => m.id).join(', ')}`,
      );
    }

    if (modelDef.provider === 'openai') {
      yield* this.chatStreamOpenAI(params);
    } else if (modelDef.provider === 'anthropic') {
      yield* this.chatStreamAnthropic(params);
    } else if (modelDef.provider === 'azure-openai') {
      yield* this.chatStreamAzureOpenAI(params);
    } else {
      throw new BadRequestException(`Unsupported provider: ${modelDef.provider}`);
    }
  }

  private async *chatStreamOpenAI(
    params: ChatParams,
  ): AsyncGenerator<{
    type: 'delta' | 'done';
    content: string;
    tokensIn?: number;
    tokensOut?: number;
  }> {
    const apiKey = await this.settingService.get('openai_api_key');
    if (!apiKey) {
      throw new BadRequestException(
        'OpenAI is not configured. Set openai_api_key in Settings.',
      );
    }

    const OpenAI =
      runtimeRequire('openai').default ?? runtimeRequire('openai').OpenAI;
    const modelName = params.model.replace('openai/', '');
    const client = new OpenAI({ apiKey });

    this.logger.log(
      `Streaming OpenAI model=${modelName}, messages=${params.messages.length}`,
    );

    const stream = await client.chat.completions.create({
      model: modelName,
      messages: params.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: params.temperature ?? 0.3,
      max_completion_tokens: params.maxTokens ?? 4096,
      stream: true,
      stream_options: { include_usage: true },
    });

    let fullContent = '';
    let tokensIn = 0;
    let tokensOut = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        yield { type: 'delta', content: delta };
      }
      if (chunk.usage) {
        tokensIn = chunk.usage.prompt_tokens ?? 0;
        tokensOut = chunk.usage.completion_tokens ?? 0;
      }
    }

    yield { type: 'done', content: fullContent, tokensIn, tokensOut };
  }

  private async *chatStreamAzureOpenAI(
    params: ChatParams,
  ): AsyncGenerator<{
    type: 'delta' | 'done';
    content: string;
    tokensIn?: number;
    tokensOut?: number;
  }> {
    const endpoint = await this.settingService.get('azure_openai_endpoint');
    const apiKey = await this.settingService.get('azure_openai_api_key');
    const apiVersion = await this.settingService.get(
      'azure_openai_api_version',
      '2025-04-01-preview',
    );

    if (!endpoint || !apiKey) {
      throw new BadRequestException(
        'Azure OpenAI is not configured. Set azure_openai_endpoint and azure_openai_api_key in Settings.',
      );
    }

    const OpenAI =
      runtimeRequire('openai').default ?? runtimeRequire('openai').OpenAI;
    const deploymentName = params.model.replace('azure-openai/', '');

    const cleanEndpoint = new URL(endpoint).origin;
    const baseURL = `${cleanEndpoint}/openai/deployments/${deploymentName}`;
    const client = new OpenAI({
      apiKey,
      baseURL,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': apiKey },
    });

    this.logger.log(
      `Streaming Azure OpenAI model=${deploymentName}, messages=${params.messages.length}`,
    );

    const stream = await client.chat.completions.create({
      model: deploymentName,
      messages: params.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: params.temperature ?? 0.3,
      max_completion_tokens: params.maxTokens ?? 4096,
      stream: true,
      stream_options: { include_usage: true },
    });

    let fullContent = '';
    let tokensIn = 0;
    let tokensOut = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        yield { type: 'delta', content: delta };
      }
      if (chunk.usage) {
        tokensIn = chunk.usage.prompt_tokens ?? 0;
        tokensOut = chunk.usage.completion_tokens ?? 0;
      }
    }

    yield { type: 'done', content: fullContent, tokensIn, tokensOut };
  }

  private async *chatStreamAnthropic(
    params: ChatParams,
  ): AsyncGenerator<{
    type: 'delta' | 'done';
    content: string;
    tokensIn?: number;
    tokensOut?: number;
  }> {
    const apiKey = await this.settingService.get('anthropic_api_key');
    if (!apiKey) {
      throw new BadRequestException(
        'Anthropic is not configured. Set anthropic_api_key in Settings.',
      );
    }

    const Anthropic =
      runtimeRequire('@anthropic-ai/sdk').default ??
      runtimeRequire('@anthropic-ai/sdk');
    const modelName = params.model.replace('anthropic/', '');

    const systemMessages = params.messages.filter((m) => m.role === 'system');
    const conversationMessages = params.messages.filter(
      (m) => m.role !== 'system',
    );

    const client = new Anthropic({ apiKey });

    this.logger.log(
      `Streaming Anthropic model=${modelName}, messages=${conversationMessages.length}`,
    );

    const stream = client.messages.stream({
      model: modelName,
      max_tokens: params.maxTokens ?? 4096,
      system: systemMessages.map((m) => m.content).join('\n\n') || undefined,
      messages: conversationMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      temperature: params.temperature ?? 0.3,
    });

    let fullContent = '';
    let tokensIn = 0;
    let tokensOut = 0;

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        fullContent += event.delta.text;
        yield { type: 'delta', content: event.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();
    tokensIn = finalMessage.usage?.input_tokens ?? 0;
    tokensOut = finalMessage.usage?.output_tokens ?? 0;

    yield { type: 'done', content: fullContent, tokensIn, tokensOut };
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
