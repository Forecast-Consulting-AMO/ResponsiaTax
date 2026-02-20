import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(private readonly dataSource: DataSource) {}

  async exportRound(roundId: string): Promise<Buffer> {
    // Load the round
    const roundRows = await this.dataSource.query(
      `SELECT r.id, r.round_number, r.received_date, r.deadline, r.dossier_id
       FROM rounds r
       WHERE r.id = $1`,
      [roundId],
    );

    if (!roundRows || roundRows.length === 0) {
      throw new NotFoundException(`Round ${roundId} not found`);
    }
    const round = roundRows[0];

    // Load the dossier for header info
    const dossierRows = await this.dataSource.query(
      `SELECT d.id, d.company_name, d.reference, d.tax_year
       FROM dossiers d
       WHERE d.id = $1`,
      [round.dossier_id],
    );
    const dossier = dossierRows?.[0] ?? {};

    // Load questions ordered by question_number
    const questions = await this.dataSource.query(
      `SELECT q.id, q.question_number, q.question_text, q.response_text, q.status
       FROM questions q
       WHERE q.round_id = $1
       ORDER BY q.question_number ASC`,
      [roundId],
    );

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
