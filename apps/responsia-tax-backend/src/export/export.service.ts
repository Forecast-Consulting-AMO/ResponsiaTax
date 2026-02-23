import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Round } from '../round/entities/round.entity';
import { Dossier } from '../dossier/entities/dossier.entity';
import { Question } from '../question/entities/question.entity';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectRepository(Round)
    private readonly roundRepo: Repository<Round>,
    @InjectRepository(Dossier)
    private readonly dossierRepo: Repository<Dossier>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
  ) {}

  async exportRound(roundId: string): Promise<Buffer> {
    // Load the round
    const round = await this.roundRepo.findOne({ where: { id: roundId } });
    if (!round) {
      throw new NotFoundException(`Round ${roundId} not found`);
    }

    // Load the dossier for header info
    const dossier = await this.dossierRepo.findOne({ where: { id: round.dossier_id } }) ?? {} as Partial<Dossier>;

    // Load questions ordered by question_number
    const questions = await this.questionRepo.find({
      where: { round_id: roundId },
      order: { question_number: 'ASC' },
    });

    this.logger.log(
      `Exporting round ${roundId}: ${questions.length} questions`,
    );

    // Dynamic import of docx
    const docx = await import('docx');

    const {
      Document,
      Packer,
      Paragraph,
      TextRun,
      HeadingLevel,
      AlignmentType,
      Footer,
      PageNumber,
      BorderStyle,
      Header,
    } = docx;

    // Format date nicely
    const receivedDate = round.received_date
      ? new Date(round.received_date).toLocaleDateString('fr-BE', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : 'N/A';

    const currentDate = new Date().toLocaleDateString('fr-BE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    // Build document sections
    const children: any[] = [];

    // Header info
    if (dossier.company_name) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: dossier.company_name, bold: true, size: 28 }),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { after: 100 },
        }),
      );
    }

    if (dossier.reference) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Reference: ${dossier.reference}`, size: 22 }),
          ],
          spacing: { after: 100 },
        }),
      );
    }

    if (dossier.tax_year) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Exercice fiscal: ${dossier.tax_year}`,
              size: 22,
            }),
          ],
          spacing: { after: 100 },
        }),
      );
    }

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Date: ${currentDate}`, size: 22 }),
        ],
        spacing: { after: 300 },
      }),
    );

    // Title
    children.push(
      new Paragraph({
        text: `Reponse a la Demande de Renseignements du ${receivedDate}`,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    );

    // Separator
    children.push(
      new Paragraph({
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        },
        spacing: { after: 300 },
      }),
    );

    // Questions and responses
    for (const q of questions) {
      // Question heading
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Question ${q.question_number}:`,
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 300, after: 100 },
        }),
      );

      // Question text
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: q.question_text || '(Pas de texte)',
              size: 22,
              italics: true,
            }),
          ],
          spacing: { after: 200 },
        }),
      );

      // Response heading
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Reponse:',
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 100 },
        }),
      );

      // Response text - parse markdown formatting
      const responseText = q.response_text || '(Reponse en attente)';
      children.push(...this.markdownToDocxChildren(responseText, docx));

      // Separator between questions
      children.push(
        new Paragraph({
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 3,
              color: 'CCCCCC',
            },
          },
          spacing: { before: 200, after: 200 },
        }),
      );
    }

    // Build the document
    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'md-numbering',
            levels: [
              {
                level: 0,
                format: docx.LevelFormat.DECIMAL,
                text: '%1.',
                alignment: docx.AlignmentType.START,
              },
            ],
          },
        ],
      },
      sections: [
        {
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'ResponsiaTax - Reponse a la Demande de Renseignements',
                      size: 18,
                      color: '999999',
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      children: ['Page ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES],
                      size: 18,
                      color: '999999',
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  }

  /** Convert a Markdown string into an array of docx Paragraph objects */
  private markdownToDocxChildren(markdown: string, docx: any): any[] {
    const { Paragraph, HeadingLevel } = docx;
    const children: any[] = [];
    const lines = markdown.split('\n');

    for (const line of lines) {
      // Skip empty lines (paragraph spacing handles it)
      if (line.trim() === '') continue;

      // Headings: # ## ###
      const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingLevel =
          level === 1
            ? HeadingLevel.HEADING_2
            : level === 2
              ? HeadingLevel.HEADING_3
              : HeadingLevel.HEADING_4;
        children.push(
          new Paragraph({
            children: this.parseInlineFormatting(headingMatch[2], docx),
            heading: headingLevel,
            spacing: { before: 200, after: 100 },
          }),
        );
        continue;
      }

      // Unordered list items: - or *
      if (/^[-*]\s+/.test(line)) {
        const text = line.replace(/^[-*]\s+/, '');
        children.push(
          new Paragraph({
            children: this.parseInlineFormatting(text, docx),
            bullet: { level: 0 },
            spacing: { after: 40 },
          }),
        );
        continue;
      }

      // Ordered list items: 1. 2. etc.
      const olMatch = line.match(/^\d+\.\s+(.+)$/);
      if (olMatch) {
        children.push(
          new Paragraph({
            children: this.parseInlineFormatting(olMatch[1], docx),
            numbering: { reference: 'md-numbering', level: 0 },
            spacing: { after: 40 },
          }),
        );
        continue;
      }

      // Regular paragraph
      children.push(
        new Paragraph({
          children: this.parseInlineFormatting(line, docx),
          spacing: { after: 80 },
        }),
      );
    }

    return children;
  }

  /** Parse inline Markdown formatting (**bold**, *italic*, `code`, [link](url)) into TextRun objects */
  private parseInlineFormatting(text: string, docx: any): any[] {
    const { TextRun, ExternalHyperlink } = docx;
    const runs: any[] = [];
    // Match: ***bold+italic***, **bold**, *italic*, `code`, [text](url)
    const pattern =
      /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // Plain text before this match
      if (match.index > lastIndex) {
        runs.push(
          new TextRun({
            text: text.slice(lastIndex, match.index),
            size: 22,
          }),
        );
      }

      if (match[2]) {
        // ***bold+italic***
        runs.push(
          new TextRun({
            text: match[2],
            bold: true,
            italics: true,
            size: 22,
          }),
        );
      } else if (match[3]) {
        // **bold**
        runs.push(
          new TextRun({ text: match[3], bold: true, size: 22 }),
        );
      } else if (match[4]) {
        // *italic*
        runs.push(
          new TextRun({ text: match[4], italics: true, size: 22 }),
        );
      } else if (match[5]) {
        // `code`
        runs.push(
          new TextRun({ text: match[5], font: 'Courier New', size: 20 }),
        );
      } else if (match[6] && match[7]) {
        // [link](url)
        runs.push(
          new ExternalHyperlink({
            children: [
              new TextRun({
                text: match[6],
                style: 'Hyperlink',
                size: 22,
              }),
            ],
            link: match[7],
          }),
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Trailing plain text
    if (lastIndex < text.length) {
      runs.push(
        new TextRun({ text: text.slice(lastIndex), size: 22 }),
      );
    }

    if (runs.length === 0) {
      runs.push(new TextRun({ text, size: 22 }));
    }

    return runs;
  }
}
