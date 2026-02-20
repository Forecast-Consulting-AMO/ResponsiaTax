import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SettingService } from '../setting/setting.service';

export interface OcrResult {
  fullText: string;
  pages: Array<{ pageNumber: number; text: string }>;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private readonly settingService: SettingService) {}

  async extractText(filePath: string): Promise<OcrResult> {
    const endpoint = await this.settingService.get('azure_di_endpoint');
    const key = await this.settingService.get('azure_di_key');

    if (!endpoint || !key) {
      throw new BadRequestException(
        'Azure Document Intelligence is not configured. Set azure_di_endpoint and azure_di_key in Settings.',
      );
    }

    const { DocumentAnalysisClient, AzureKeyCredential } = await import(
      '@azure/ai-form-recognizer'
    );

    const client = new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(key),
    );

    this.logger.log(`Starting OCR for file: ${filePath}`);

    // Read file as buffer
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(filePath);

    // Use the prebuilt-read model
    const poller = await client.beginAnalyzeDocument(
      'prebuilt-read',
      fileBuffer,
    );

    const result = await poller.pollUntilDone();

    const pages: Array<{ pageNumber: number; text: string }> = [];
    const pageTexts: string[] = [];

    if (result.pages) {
      for (const page of result.pages) {
        const pageNumber = page.pageNumber;
        const lines: string[] = [];

        if (page.lines) {
          for (const line of page.lines) {
            lines.push(line.content);
          }
        }

        const pageText = lines.join('\n');
        pages.push({ pageNumber, text: pageText });
        pageTexts.push(pageText);
      }
    }

    const fullText = pageTexts.join('\n\n--- Page Break ---\n\n');

    this.logger.log(
      `OCR complete: ${pages.length} pages, ${fullText.length} characters`,
    );

    return { fullText, pages };
  }
}
