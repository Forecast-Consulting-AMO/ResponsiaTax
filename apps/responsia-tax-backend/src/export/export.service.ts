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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Response text - split by paragraphs
      const responseText = q.response_text || '(Reponse en attente)';
      const paragraphs = responseText.split('\n');
      for (const para of paragraphs) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: para, size: 22 })],
            spacing: { after: 80 },
          }),
        );
      }

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
}
