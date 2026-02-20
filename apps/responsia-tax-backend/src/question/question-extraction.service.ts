import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { SettingService } from '../setting/setting.service';

export interface ExtractedQuestion {
  questionNumber: number;
  questionText: string;
}

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at parsing Belgian tax authority documents (SPF Finances / FOD Financien).
Given the OCR text of a "Demande de Renseignements" (Request for Information), extract each individual question asked.

Rules:
- Only extract actual questions/requests, not boilerplate legal text
- Preserve the original question numbering
- Include any sub-questions as part of the main question
- Return ONLY valid JSON: [{"questionNumber": 1, "questionText": "..."}, ...]
- If the text includes both French and Dutch, preserve the original language`;

@Injectable()
export class QuestionExtractionService {
  private readonly logger = new Logger(QuestionExtractionService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly settingService: SettingService,
  ) {}

  async extractQuestions(
    ocrText: string,
    model?: string,
  ): Promise<ExtractedQuestion[]> {
    // Determine model to use
    const effectiveModel =
      model ||
      (await this.settingService.get('default_llm_model')) ||
      'azure-openai/gpt-4.1-mini';

    this.logger.log(
      `Extracting questions using model=${effectiveModel}, text length=${ocrText.length}`,
    );

    const response = await this.llmService.chat({
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract the questions from the following OCR text of a "Demande de Renseignements":\n\n${ocrText}`,
        },
      ],
      model: effectiveModel,
      temperature: 0.1,
      maxTokens: 4096,
    });

    // Parse the JSON response
    let parsed: ExtractedQuestion[];
    try {
      // The LLM might wrap in markdown code blocks, strip them
      let jsonStr = response.content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      parsed = JSON.parse(jsonStr);
    } catch (err) {
      this.logger.error(
        `Failed to parse LLM response as JSON: ${response.content.slice(0, 200)}`,
      );
      throw new BadRequestException(
        'LLM did not return valid JSON for question extraction. Please try again.',
      );
    }

    // Validate structure
    if (!Array.isArray(parsed)) {
      throw new BadRequestException(
        'LLM returned non-array JSON for question extraction.',
      );
    }

    const questions: ExtractedQuestion[] = parsed
      .filter(
        (item) =>
          typeof item.questionNumber === 'number' &&
          typeof item.questionText === 'string',
      )
      .map((item) => ({
        questionNumber: item.questionNumber,
        questionText: item.questionText.trim(),
      }));

    this.logger.log(`Extracted ${questions.length} questions`);
    return questions;
  }
}
